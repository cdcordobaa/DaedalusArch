/**
 * The row stage of the construct switches (v1.3 only). It runs after symbolic evaluation, on the rows of the
 * functions that executed, and changes them as the chosen options define: drops rows outside a narrowed rule, moves a
 * row to the rule that owns its construct (P2), and adds rows a widened rule reports, computed from the in-memory graph
 * (`graph.ts`). The frozen template text is never edited. With every question at its status quo the input is returned
 * unchanged (same array), so the v1.3 rows are byte-identical.
 *
 * Rows are only ever added to a function that executed (it is in `results`): a rule that does not run in a style gets
 * no rows here, so the report's identities (compiled = executed + ...) hold. A rule that a switch makes run in a new
 * style is declared at compile time (`compile.ts`, a carrier function where no template exists).
 *
 * The offline re-score (`scripts/v1.3/lib/construct-rescore.ts`) calls the same function on the saved rows.
 */
import type { SymbolicFunctionResult } from '../shared/types/evaluation.js';
import type { Violation, ViolationType } from '../shared/taxonomy/violation-types.js';
import type { FitnessFunction, LayerModel } from '../shared/types/spec.js';
import type { FunctionId } from '../shared/types/value-objects.js';
import type { ConstructAnswers } from '../shared/construct-switches.js';
import type { ConstructQuestionId } from '../shared/construct-switch-catalogue.js';
import { isStatusQuo } from '../shared/construct-switches.js';
import { computeViolationId } from '../evaluation-engine/violation-id.js';
import { roleExemptionPatterns } from '../fitness-compiler/role-exemptions.js';
import { bindDddModel } from '../fitness-compiler/ddd-templates.js';
import type { CgClass, CgEdge, ConstructGraph } from './graph.js';
import { literalEdges } from './graph.js';
import type { LayerView } from './layer-view.js';
import { cycleFiles, cycleInOneComponent, layerViewOf } from './layer-view.js';
import {
  ADAPTER_ISOLATION_ID, BARREL_APPLICATION_ID, CONSTRUCT_COMPOSITION_ROOT_GLOBS, CONSTRUCT_PACKAGE_LAYERS,
  CONSTRUCT_WEB_UI_PACKAGES, globMatcher, packageMatches,
} from './overlays.js';

export interface RowSwitchContext {
  readonly answers: ConstructAnswers;
  readonly style?: string;
  readonly layerModel: LayerModel;
  /** The spec's functions after the compile overlays (`applyConstructCompileOverlays`). */
  readonly functions: readonly FitnessFunction[];
  readonly graph: ConstructGraph;
}

/** One change the stage made, for the report and the tests. */
export interface RowChange {
  readonly q: ConstructQuestionId;
  readonly functionId: string;
  readonly action: 'dropped' | 'added' | 'moved-out' | 'moved-in';
  readonly file: string;
  readonly target?: string;
}

export interface RowSwitchResult {
  readonly results: readonly SymbolicFunctionResult[];
  readonly changes: readonly RowChange[];
}

interface Working {
  readonly base: SymbolicFunctionResult;
  readonly fn: FitnessFunction | undefined;
  violations: Violation[];
  changed: boolean;
}

const VIOLATION_TYPE: Readonly<Record<string, ViolationType>> = {
  'dependency-direction': 'LAYER_VIOLATION',
  'dependency-direction-graph': 'LAYER_VIOLATION',
  'no-cyclic-deps': 'CYCLIC_DEPENDENCY',
  'no-layer-skip': 'LAYER_SKIP',
  'layer-skip-graph': 'LAYER_SKIP',
  'no-domain-outward-dep': 'DOMAIN_OUTWARD_DEP',
  'core-isolation': 'DOMAIN_OUTWARD_DEP',
  'domain-purity': 'DOMAIN_PURITY_VIOLATION',
  'dependency-inversion': 'DEPENDENCY_INVERSION_VIOLATION',
  'port-dependency-inversion': 'DEPENDENCY_INVERSION_VIOLATION',
  'repository-pattern': 'REPOSITORY_PATTERN_VIOLATION',
  'port-adapter-pattern': 'REPOSITORY_PATTERN_VIOLATION',
  'controller-no-entity': 'CONTROLLER_ENTITY_VIOLATION',
};

export function applyConstructRows(results: readonly SymbolicFunctionResult[], ctx: RowSwitchContext): RowSwitchResult {
  if (isStatusQuo(ctx.answers)) return { results, changes: [] };
  const stage = new RowStage(results, ctx);
  stage.run();
  return stage.finish();
}

class RowStage {
  private readonly work = new Map<string, Working>();
  private readonly changes: RowChange[] = [];
  /** Which question added a row (by violation id), so a rebuild keeps the rows other questions added (R08). */
  private readonly addedBy = new Map<string, ConstructQuestionId>();
  private readonly view: LayerView;
  private readonly style: string | undefined;
  private readonly a: ConstructAnswers;
  private readonly g: ConstructGraph;
  /** Literal-view file edges, without the type-only ones under Q2 B. */
  private readonly edges: readonly CgEdge[];
  private readonly isCompositionRoot: (file: string) => boolean;

  constructor(private readonly results: readonly SymbolicFunctionResult[], private readonly ctx: RowSwitchContext) {
    this.a = ctx.answers;
    this.style = ctx.style?.toLowerCase();
    this.g = ctx.graph;
    this.view = layerViewOf(ctx.layerModel);
    const byId = new Map(ctx.functions.map((f) => [String(f.id), f]));
    for (const r of results) {
      this.work.set(String(r.functionId), { base: r, fn: byId.get(String(r.functionId)), violations: [...r.violations], changed: false });
    }
    const typeOnlyOut = this.a.Q2 === 'B';
    this.edges = literalEdges(this.g).filter((e) => !(typeOnlyOut && e.typeOnly));
    const rootGlob = globMatcher(CONSTRUCT_COMPOSITION_ROOT_GLOBS);
    this.isCompositionRoot = (file) => rootGlob(file) || this.view.compositionLayers.includes(this.layer(file) ?? '');
  }

  // ── helpers ──

  private layer(file: string | undefined): string | null {
    return file === undefined ? null : this.g.files.get(file) ?? null;
  }

  /** Working results of the executed functions with this template name. */
  private byName(name: string): Working[] {
    return [...this.work.values()].filter((w) => w.fn?.name === name);
  }

  private byId(id: string): Working | undefined {
    return this.work.get(id);
  }

  private drop(q: ConstructQuestionId, w: Working, pred: (v: Violation) => boolean): void {
    const keep: Violation[] = [];
    for (const v of w.violations) {
      if (pred(v)) this.changes.push({ q, functionId: String(w.base.functionId), action: 'dropped', file: v.filePath, ...(v.target !== undefined ? { target: v.target } : {}) });
      else keep.push(v);
    }
    if (keep.length !== w.violations.length) {
      w.violations = keep;
      w.changed = true;
    }
  }

  private excluded(w: Working, file: string, templateName: string): boolean {
    const globs = w.fn?.excludePaths ?? [];
    if (globs.length > 0 && globMatcher(globs)(file)) return true;
    return roleExemptionPatterns(templateName).some((rx) => new RegExp(`^(?:${rx})$`).test(file));
  }

  /** Adds a row unless the function already has one with the same id, or excludes the file. */
  private add(q: ConstructQuestionId, w: Working, row: {
    filePath: string; target?: string; line?: number; isTypeOnly?: boolean; discriminator: string[]; message: string; type?: ViolationType;
  }, templateName: string): void {
    if (this.excluded(w, row.filePath, templateName)) return;
    const functionId = w.base.functionId;
    const id = computeViolationId({ functionId, filePath: row.filePath, target: row.target, line: row.line, discriminator: row.discriminator });
    if (w.violations.some((v) => v.id === id)) return;
    const tag = w.violations[0]?.tag ?? w.base.tag;
    const v: Violation = {
      id,
      type: row.type ?? VIOLATION_TYPE[templateName] ?? (`CUSTOM_${templateName}` as ViolationType),
      dimension: w.base.dimension,
      severity: w.fn?.severity ?? 'major',
      functionId,
      route: 'symbolic',
      filePath: row.filePath,
      message: row.message,
      deterministic: true,
      ...(row.target !== undefined ? { target: row.target } : {}),
      ...(row.line !== undefined ? { line: row.line } : {}),
      ...(row.isTypeOnly !== undefined ? { isTypeOnly: row.isTypeOnly } : {}),
      discriminator: row.discriminator,
      ...(tag !== undefined ? { tag } : {}),
    };
    w.violations.push(v);
    w.changed = true;
    this.addedBy.set(id, q);
    this.changes.push({ q, functionId: String(functionId), action: 'added', file: row.filePath, ...(row.target !== undefined ? { target: row.target } : {}) });
  }

  /** Moves rows to another executed function (P2: the rule that owns the construct), with the new function's id. */
  private move(q: ConstructQuestionId, from: Working, to: Working, pred: (v: Violation) => boolean, message: (v: Violation) => string): void {
    const moving = from.violations.filter(pred);
    if (moving.length === 0) return;
    from.violations = from.violations.filter((v) => !pred(v));
    from.changed = true;
    for (const v of moving) {
      this.changes.push({ q, functionId: String(from.base.functionId), action: 'moved-out', file: v.filePath, ...(v.target !== undefined ? { target: v.target } : {}) });
      const functionId = to.base.functionId;
      const discriminator = [...(v.discriminator ?? [])];
      const id = computeViolationId({ functionId, filePath: v.filePath, target: v.target, line: v.line, discriminator });
      if (to.violations.some((x) => x.id === id)) continue;
      to.violations.push({ ...v, id, functionId, dimension: to.base.dimension, severity: to.fn?.severity ?? v.severity, message: message(v) });
      to.changed = true;
      this.changes.push({ q, functionId: String(functionId), action: 'moved-in', file: v.filePath, ...(v.target !== undefined ? { target: v.target } : {}) });
    }
  }

  private edgeRow(e: CgEdge, discriminator: string[] = [e.type]): { filePath: string; target: string; line?: number; isTypeOnly: boolean; discriminator: string[] } {
    return { filePath: e.from, target: e.to, ...(e.line !== undefined ? { line: e.line } : {}), isTypeOnly: e.typeOnly, discriminator };
  }

  private classesIn(file: string): CgClass[] {
    return this.g.classes.filter((c) => c.file === file);
  }

  private classById(id: string): CgClass | undefined {
    return this.g.classes.find((c) => c.id === id);
  }

  // ── the stage ──

  run(): void {
    const a = this.a;
    if (a.Q2 === 'B') this.q2TypeOnly();
    if (a.Q3 === 'B') this.q3InComponentCycles();
    if (a.Q4 === 'B') this.q4LayerCycles();
    if (a.Q5 === 'C' || a.Q5 === 'D') this.q5AdapterEdges();
    if (a.Q6 === 'B') this.q6ApplicationCore();
    if (a.Q9 === 'B' || a.Q9 === 'C') this.q9MissingImplements();
    if (a.Q7 === 'B') this.q7Consumers();
    if (a.Q10 === 'B') this.q10WebOnly();
    if (a.Q10 === 'C') this.q10PackageLayers();
    if (a.Q11 === 'B') this.q11CoreOneUnit();
    if (a.Q12 === 'B') this.q12UpwardNotSkip();
    if (a.Q13 === 'B') this.q13DeclaredOrder();
    if (a.Q17 === 'B') this.q17Resolved();
    if (a.Q17 === 'C') this.q17BarrelPublishesApplication();
    if (a.Q18 === 'B') this.q18AclChecked();
    if (a.Q19 === 'B') this.q19KeptReferences();
    if (a.Q20 === 'B') this.q20TransitivePurity();
    if (a.Q22 === 'B') this.q22CrossLayerDip();
    if (a.Q23 === 'B') this.q23EntityByLayer();
    if (a.Q24 === 'B') this.q24InwardBypass();
  }

  finish(): RowSwitchResult {
    const results = this.results.map((r) => {
      const w = this.work.get(String(r.functionId));
      if (!w?.changed) return r;
      return { ...r, violations: w.violations, passed: w.violations.length === 0 };
    });
    return { results, changes: this.changes };
  }

  /** Q2 B: a row that rests only on type-only import edges is not a dependency. */
  private q2TypeOnly(): void {
    const all = literalEdges(this.g);
    const runtime = new Set(all.filter((e) => !e.typeOnly).map((e) => `${e.from}|${e.to}`));
    const known = new Set(all.map((e) => `${e.from}|${e.to}`));
    for (const w of this.work.values()) {
      if (w.fn?.name === 'no-cyclic-deps') {
        this.drop('Q2', w, (v) => {
          const path = cyclePath(v);
          for (let i = 0; i + 1 < path.length; i++) {
            const k = `${String(path[i])}|${String(path[i + 1])}`;
            if (known.has(k) && !runtime.has(k)) return true;
          }
          return false;
        });
      } else {
        this.drop('Q2', w, (v) => v.isTypeOnly === true);
      }
    }
  }

  /** Q3 B: a cycle inside one layer and one module is outside FF-S02. */
  private q3InComponentCycles(): void {
    const layerOf = (f: string): string | null => this.layer(f);
    for (const w of this.byName('no-cyclic-deps')) {
      this.drop('Q3', w, (v) => cycleInOneComponent(cycleFiles(v.filePath, v.target), layerOf, this.style, this.ctx.layerModel));
    }
  }

  /** Q4 B: an edge against the allowed direction between two layers that also depend the other way, outside any file cycle. */
  private q4LayerCycles(): void {
    const ws = this.byName('no-cyclic-deps');
    if (ws.length === 0) return;
    const layered = this.edges.filter((e) => {
      const s = this.layer(e.from);
      const t = this.layer(e.to);
      return s !== null && t !== null && s !== t;
    });
    const pairs = new Set(layered.map((e) => `${String(this.layer(e.from))}>${String(this.layer(e.to))}`));
    const reach = reachability(this.edges);
    for (const e of layered) {
      const s = this.layer(e.from) ?? '';
      const t = this.layer(e.to) ?? '';
      if (this.view.allowed(s, t) || !pairs.has(`${t}>${s}`)) continue;
      if (reach(e.to).has(e.from)) continue; // a file cycle: FF-S02 already reports it
      for (const w of ws) {
        this.add('Q4', w, { ...this.edgeRow(e, ['layer-cycle', s, t]), filePath: `${e.from},${e.to}`, message: `Layer cycle ${s} <-> ${t}: ${e.from} imports ${e.to} against the allowed direction` }, 'no-cyclic-deps');
      }
    }
  }

  private isAdapterPair(v: Violation): boolean {
    const s = this.layer(v.filePath);
    const t = this.layer(v.target);
    return s !== null && t !== null && this.view.adapterLayers.includes(s) && this.view.adapterLayers.includes(t);
  }

  /** Q5 C: adapter -> adapter rows move from FF-S03 to FF-S01. Q5 D: to the new rule FF-S05 adapter-isolation. */
  private q5AdapterEdges(): void {
    if (this.style !== 'hexagonal' && this.style !== 'ddd') return;
    const to = this.a.Q5 === 'C' ? this.byName('dependency-direction-graph')[0] : this.byId(ADAPTER_ISOLATION_ID);
    if (to === undefined) return;
    for (const from of this.byName('layer-skip-graph')) {
      this.move('Q5', from, to, (v) => this.isAdapterPair(v), (v) =>
        `${v.filePath} (${String(this.layer(v.filePath))}) imports ${String(v.target)} (${String(this.layer(v.target))}): adapters talk only through ports`);
    }
  }

  /** Q6 B: in hexagonal the core is the domain and the application layers (FF-S04 core-isolation). */
  private q6ApplicationCore(): void {
    if (this.style !== 'hexagonal') return;
    const core = [...this.view.domainLayers, ...this.view.applicationLayers];
    for (const w of this.byName('core-isolation')) {
      this.drop('Q6', w, (v) => core.includes(this.layer(v.target) ?? ''));
      for (const e of this.edges) {
        const s = this.layer(e.from);
        const t = this.layer(e.to);
        if (s === null || t === null || !this.view.applicationLayers.includes(s) || core.includes(t)) continue;
        this.add('Q6', w, { ...this.edgeRow(e), message: `Core file ${e.from} imports from ${e.to} in ${t}` }, 'core-isolation');
      }
    }
  }

  private implementerRules(): Working[] {
    return [...this.byName('repository-pattern'), ...this.byName('port-adapter-pattern')];
  }

  private dipRules(): Working[] {
    return [...this.byName('dependency-inversion'), ...this.byName('port-dependency-inversion')];
  }

  /** Q9 B: a missing implements is also an FF-P02 finding. Q9 C: structural conformance plus wiring is enough. */
  private q9MissingImplements(): void {
    for (const p03 of this.implementerRules()) {
      if (this.a.Q9 === 'B') {
        for (const dip of this.dipRules()) {
          for (const v of p03.violations) {
            const cls = v.discriminator?.[0] ?? '';
            this.add('Q9', dip, { filePath: v.filePath, discriminator: [cls], message: `Violation in ${v.filePath}` }, dip.fn?.name ?? 'dependency-inversion');
          }
        }
      } else {
        const portLayers = [...this.view.domainLayers, ...this.view.applicationLayers];
        const ports = this.g.classes.filter((c) => c.kind === 'Interface' && portLayers.includes(c.layer ?? '') && c.methods.length > 0);
        const implementsAny = new Set(this.g.classEdges.filter((e) => e.type === 'IMPLEMENTS').map((e) => e.from));
        const importedFiles = new Set(this.g.edges.filter((e) => e.type === 'IMPORTS' && e.from !== e.to).map((e) => e.to));
        this.drop('Q9', p03, (v) => {
          const cls = this.classesIn(v.filePath).find((c) => c.name === v.discriminator?.[0]);
          if (cls === undefined || implementsAny.has(cls.id) || !importedFiles.has(cls.file)) return false;
          return ports.some((p) => p.methods.every((m) => cls.methods.includes(m)));
        });
      }
    }
  }

  /** Q7 B: a consumer of a concrete adapter breaks the port at its use site. */
  private q7Consumers(): void {
    const roles = /(Repository|Repo|Adapter|Gateway)(Impl)?$/;
    const infra = this.ctx.layerModel.layers.filter((l) => l.kind === 'infrastructure').map((l) => l.name);
    const adapters = this.g.classes.filter((c) => c.kind === 'Class' && infra.includes(c.layer ?? '') && roles.test(c.name));
    for (const w of this.implementerRules()) {
      const name = w.fn?.name ?? 'repository-pattern';
      for (const ad of adapters) {
        const consumers = new Set<string>();
        for (const e of this.edges) if (e.type === 'IMPORTS' && e.to === ad.file) consumers.add(e.from);
        for (const e of this.g.classEdges) {
          if (e.type !== 'CONSTRUCTOR_INJECTS' || e.to !== ad.id) continue;
          const c = this.classById(e.from);
          if (c !== undefined) consumers.add(c.file);
        }
        for (const f of [...consumers].sort()) {
          const l = this.layer(f);
          if (l === null || l === ad.layer || this.isCompositionRoot(f)) continue;
          this.add('Q7', w, { filePath: f, target: ad.file, discriminator: ['consumer', ad.name], message: `${f} depends on the concrete adapter ${ad.name} instead of its port` }, name);
        }
      }
    }
  }

  /** Q10 B: in layered FF-P01 keeps only web/UI framework packages. */
  private q10WebOnly(): void {
    if (this.style !== 'layered') return;
    for (const w of this.byName('domain-purity')) this.drop('Q10', w, (v) => !packageMatches(v.target ?? '', CONSTRUCT_WEB_UI_PACKAGES));
  }

  /** Q10 C: a declared package-to-layer mapping makes a package import a layer dependency for FF-S01. */
  private q10PackageLayers(): void {
    const mapping = CONSTRUCT_PACKAGE_LAYERS[this.style ?? ''];
    if (mapping === undefined) return;
    const typeOnlyOut = this.a.Q2 === 'B';
    for (const w of this.byName('dependency-direction')) {
      for (const p of this.g.packageEdges) {
        if (p.viaReExport || (typeOnlyOut && p.typeOnly)) continue;
        const mapped = mapping[p.pkg];
        const s = this.layer(p.from);
        if (mapped === undefined || s === null || s === mapped) continue;
        const si = this.view.order.indexOf(s);
        const ti = this.view.order.indexOf(mapped);
        if (si < 0 || ti < 0 || si >= ti) continue;
        this.add('Q10', w, {
          filePath: p.from, target: p.pkg, ...(p.line !== undefined ? { line: p.line } : {}), isTypeOnly: p.typeOnly, discriminator: ['IMPORTS', 'package-layer'],
          message: `${p.from} (${s}) imports from ${p.pkg} (${mapped}, declared package layer)`,
        }, 'dependency-direction');
      }
    }
  }

  /** Q11 B: the core is one unit; domain -> application is not a boundary crossing (hexagonal, ddd). */
  private q11CoreOneUnit(): void {
    if (this.style !== 'hexagonal' && this.style !== 'ddd') return;
    const inner = (v: Violation): boolean =>
      this.view.domainLayers.includes(this.layer(v.filePath) ?? '') && this.view.applicationLayers.includes(this.layer(v.target) ?? '');
    for (const w of [...this.byName('dependency-direction-graph'), ...this.byName('core-isolation')]) this.drop('Q11', w, inner);
  }

  /** Q12 B: FF-S03 (layered) reports only downward edges that pass over a layer, not upward ones. */
  private q12UpwardNotSkip(): void {
    if (this.style !== 'layered') return;
    for (const w of this.byName('no-layer-skip')) {
      this.drop('Q12', w, (v) => {
        const s = this.layer(v.filePath);
        const t = this.layer(v.target);
        return s !== null && t !== null && this.view.allowedTransitions.includes(`${t}>${s}`);
      });
    }
  }

  /** Q13 B: FF-P04 follows the declared order: a dependency on a layer below the use case is not a violation. */
  private q13DeclaredOrder(): void {
    const order = this.view.order;
    for (const w of this.byName('use-case-isolation')) {
      this.drop('Q13', w, (v) => {
        const uc = this.classesIn(v.filePath).find((c) => c.name === v.discriminator?.[0]);
        const ucLayer = uc?.layer ?? null;
        if (uc === undefined || ucLayer === null) return false;
        const depLayers = this.g.classEdges
          .filter((e) => e.type === 'CONSTRUCTOR_INJECTS' && e.from === uc.id)
          .map((e) => this.classById(e.to)?.layer ?? null)
          .filter((l): l is string => l !== null && !this.view.domainLayers.includes(l) && !this.view.applicationLayers.includes(l));
        return depLayers.length > 0 && depLayers.every((l) => order.indexOf(l) < order.indexOf(ucLayer));
      });
    }
  }

  private ddd(): { contextOf: (f: string) => string | undefined; isPublic: (f: string) => boolean; isAcl: (f: string) => boolean } | undefined {
    if (this.style !== 'ddd') return undefined;
    const bound = bindDddModel(this.ctx.layerModel);
    if (!bound.ok) return undefined;
    const rx = (list: readonly string[]): RegExp[] => list.map((p) => new RegExp(`^(?:${p})$`));
    const pub = rx(bound.binding.publicApiPatterns);
    const acl = rx(bound.binding.aclPatterns);
    return {
      contextOf: (f) => bound.binding.contextRoots.find((r) => f.startsWith(r)),
      isPublic: (f) => pub.some((r) => r.test(f)),
      isAcl: (f) => acl.some((r) => r.test(f)),
    };
  }

  /** Q17 B: the resolved target of a barrel import is what crosses the boundary (FF-DS02). */
  private q17Resolved(): void {
    const d = this.ddd();
    if (d === undefined) return;
    const typeOnlyOut = this.a.Q2 === 'B';
    for (const w of this.byName('context-isolation')) {
      for (const e of this.g.edges) {
        if (!e.viaReExport || (typeOnlyOut && e.typeOnly)) continue;
        const sc = d.contextOf(e.from);
        const tc = d.contextOf(e.to);
        if (sc === undefined || tc === undefined || sc === tc || d.isPublic(e.to) || d.isAcl(e.from)) continue;
        this.add('Q17', w, { ...this.edgeRow(e), message: `${e.from} (${sc}) imports ${e.to} through a public barrel, which is not in the public API of ${tc}` }, 'context-isolation');
      }
    }
  }

  /** Q17 C: new advisory rule FF-DS03: a public-API barrel that re-exports an application-layer file. */
  private q17BarrelPublishesApplication(): void {
    const d = this.ddd();
    const w = this.byId(BARREL_APPLICATION_ID);
    if (d === undefined || w === undefined) return;
    for (const e of this.g.edges) {
      if (e.type !== 'RE_EXPORTS' || !d.isPublic(e.from)) continue;
      const t = this.layer(e.to);
      if (t === null || this.view.kindOf(t) !== 'application') continue;
      this.add('Q17', w, { ...this.edgeRow(e), message: `Public API ${e.from} publishes the application-layer file ${e.to}`, type: 'PLACEMENT_CONVENTION' }, 'barrel-publishes-application');
    }
  }

  /** Q18 B: the ACL also goes through the other context's public API (FF-DS02 without the ACL exemption). */
  private q18AclChecked(): void {
    const d = this.ddd();
    if (d === undefined) return;
    for (const w of this.byName('context-isolation')) {
      for (const e of this.edges) {
        if (!d.isAcl(e.from)) continue;
        const sc = d.contextOf(e.from);
        const tc = d.contextOf(e.to);
        if (sc === undefined || tc === undefined || sc === tc || d.isPublic(e.to)) continue;
        this.add('Q18', w, { ...this.edgeRow(e), message: `${e.from} (${sc}) imports ${e.to}, which is not in the public API of ${tc}` }, 'context-isolation');
      }
    }
  }

  /** Q19 B: FF-DT01 reports only references a class of the importing file keeps (FLOWS_TO or CONSTRUCTOR_INJECTS). */
  private q19KeptReferences(): void {
    for (const w of this.byName('aggregate-boundary')) {
      this.drop('Q19', w, (v) => {
        const holders = new Set(this.classesIn(v.filePath).map((c) => c.id));
        const inner = new Set(this.classesIn(v.target ?? '').map((c) => c.id));
        return !this.g.classEdges.some((e) => (e.type === 'FLOWS_TO' || e.type === 'CONSTRUCTOR_INJECTS') && holders.has(e.from) && inner.has(e.to));
      });
    }
  }

  /** Q20 B: a domain file that reaches a forbidden package through project files depends on it. */
  private q20TransitivePurity(): void {
    const reach = reachability(this.edges);
    const typeOnlyOut = this.a.Q2 === 'B';
    const pkgs = new Map<string, Set<string>>();
    for (const p of this.g.packageEdges) {
      if (p.viaReExport || (typeOnlyOut && p.typeOnly)) continue;
      const s = pkgs.get(p.from) ?? new Set<string>();
      s.add(p.pkg);
      pkgs.set(p.from, s);
    }
    for (const w of this.byName('domain-purity')) {
      const forbidden = w.fn?.forbiddenImports ?? [];
      const domain = this.style === 'ddd' ? this.view.domainLayers : this.view.domainLayer !== undefined ? [this.view.domainLayer] : [];
      for (const [file, layer] of this.g.files) {
        if (layer === null || !domain.includes(layer)) continue;
        const direct = pkgs.get(file) ?? new Set<string>();
        const found = new Set<string>();
        for (const r of reach(file)) for (const p of pkgs.get(r) ?? []) if (!direct.has(p) && packageMatches(p, forbidden)) found.add(p);
        for (const p of [...found].sort()) {
          this.add('Q20', w, { filePath: file, target: p, discriminator: ['transitive'], message: `Domain file ${file} reaches forbidden package ${p} through project files` }, 'domain-purity');
        }
      }
    }
  }

  /**
   * Replaces a function's rows with the ones `build` adds (a re-definition of the rule), logging only the rows that
   * differ: a row present before and after is not a change.
   */
  private rebuild(q: ConstructQuestionId, w: Working, build: () => void): void {
    const old = w.violations;
    const mark = this.changes.length;
    w.violations = [];
    build();
    this.changes.splice(mark);
    // Rows another question added (Q9 B's FF-P02 row on an implementer) are not part of the rule being redefined:
    // they are kept, and logged by the question that added them (R08).
    for (const v of old) {
      const by = this.addedBy.get(v.id);
      if (by !== undefined && by !== q && !w.violations.some((x) => x.id === v.id)) w.violations.push(v);
    }
    const before = new Set(old.map((v) => v.id));
    const after = new Set(w.violations.map((v) => v.id));
    const fid = String(w.base.functionId);
    for (const v of old) if (!after.has(v.id)) this.changes.push({ q, functionId: fid, action: 'dropped', file: v.filePath, ...(v.target !== undefined ? { target: v.target } : {}) });
    for (const v of w.violations) if (!before.has(v.id)) this.changes.push({ q, functionId: fid, action: 'added', file: v.filePath, ...(v.target !== undefined ? { target: v.target } : {}) });
    if (this.changes.length > mark) w.changed = true;
    else w.violations = old;
  }

  /** Q22 B: FF-P02's ratio counts only dependencies in another layer (DIP across layers). */
  private q22CrossLayerDip(): void {
    for (const w of this.dipRules()) {
      const name = w.fn?.name ?? 'dependency-inversion';
      const threshold = w.fn?.threshold ?? 0.85;
      this.rebuild('Q22', w, () => {
        for (const c of this.g.classes) {
          if (c.kind !== 'Class' || c.layer === null || !this.view.applicationLayers.includes(c.layer)) continue;
          const deps = this.g.classEdges
            .filter((e) => e.type === 'CONSTRUCTOR_INJECTS' && e.from === c.id)
            .map((e) => this.classById(e.to))
            .filter((d): d is CgClass => d !== undefined && d.layer !== c.layer);
          if (deps.length === 0) continue;
          const ratio = deps.filter((d) => d.kind === 'Interface').length / deps.length;
          if (ratio >= threshold) continue;
          this.add('Q22', w, { filePath: c.file, discriminator: [c.name], message: `Violation in ${c.file}` }, name);
        }
      });
    }
  }

  /** Q23 B: FF-P05 selects entities by the declared domain layer, not by a name suffix (the reach is unchanged). */
  private q23EntityByLayer(): void {
    const ctrlLayer = this.view.controllerLayer;
    const domain = this.view.domainLayer;
    if (ctrlLayer === undefined || domain === undefined) return;
    const injects = new Map<string, string[]>();
    for (const e of this.g.classEdges) if (e.type === 'CONSTRUCTOR_INJECTS') injects.set(e.from, [...(injects.get(e.from) ?? []), e.to]);
    for (const w of this.byName('controller-no-entity')) {
      this.rebuild('Q23', w, () => {
        for (const ctrl of this.g.classes) {
          if (ctrl.kind !== 'Class' || ctrl.layer !== ctrlLayer) continue;
          const hit = new Set<string>();
          for (const m of injects.get(ctrl.id) ?? []) {
            hit.add(m);
            for (const n of injects.get(m) ?? []) hit.add(n);
          }
          const entities = [...hit].map((id) => this.classById(id)).filter((c): c is CgClass => c?.kind === 'Class' && c.layer === domain);
          for (const ent of entities.sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0))) {
            this.add('Q23', w, { filePath: ctrl.file, discriminator: [ctrl.name, ent.name], message: `Violation in ${ctrl.file}` }, 'controller-no-entity');
          }
        }
      });
    }
  }

  /** Q24 B: a controller or inbound-adapter file that imports a domain file directly bypasses the use-case layer. */
  private q24InwardBypass(): void {
    if (!['clean-architecture', 'nestjs', 'hexagonal'].includes(this.style ?? '')) return;
    if (this.view.applicationLayers.length === 0 || this.view.domainLayer === undefined) return;
    const fs03 = this.byId('FF-S03');
    if (fs03 === undefined) return;
    const presentation = this.ctx.layerModel.layers.filter((l) => l.kind === 'presentation').map((l) => l.name);
    const isController = (file: string): boolean => {
      const l = this.layer(file);
      if (l === null) return false;
      if (presentation.includes(l)) return true;
      return l === this.view.controllerLayer && this.classesIn(file).some((c) => c.name.endsWith("Controller"));
    };
    for (const e of this.edges) {
      const t = this.layer(e.to);
      if (t === null || !this.view.domainLayers.includes(t) || !isController(e.from) || this.isCompositionRoot(e.from)) continue;
      this.add('Q24', fs03, { ...this.edgeRow(e, ['bypass', e.type]), message: `${e.from} imports the domain file ${e.to} directly, bypassing the use-case layer` }, fs03.fn?.name ?? 'no-layer-skip');
    }
  }
}

/** The file path of a cycle row (the cycle column, or the `file` column split on commas). */
export function cyclePath(v: { readonly filePath: string; readonly discriminator?: readonly string[] }): string[] {
  const d = v.discriminator?.[0];
  if (d?.startsWith('[') === true) {
    try {
      const parsed = JSON.parse(d) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // fall through to the file column
    }
  }
  return v.filePath.split(',');
}

/** Files reachable from a file over the given edges (one or more hops). */
export function reachability(edges: readonly CgEdge[]): (from: string) => ReadonlySet<string> {
  const out = new Map<string, string[]>();
  for (const e of edges) out.set(e.from, [...(out.get(e.from) ?? []), e.to]);
  const memo = new Map<string, Set<string>>();
  return (from) => {
    const hit = memo.get(from);
    if (hit !== undefined) return hit;
    const seen = new Set<string>();
    const stack = [...(out.get(from) ?? [])];
    for (let n = stack.pop(); n !== undefined; n = stack.pop()) {
      if (seen.has(n)) continue;
      seen.add(n);
      for (const m of out.get(n) ?? []) stack.push(m);
    }
    memo.set(from, seen);
    return seen;
  };
}

export type { FunctionId };
