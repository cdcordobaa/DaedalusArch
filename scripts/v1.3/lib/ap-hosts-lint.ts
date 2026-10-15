/**
 * Static clean-base check of the anti-pattern host projects (`fixtures/unit/ap-hosts/`). DEVELOPMENT SET ONLY.
 *
 * A Neo4j-free approximation of the symbolic rules the host's spec enables, so a host can be checked for smells in
 * CI. It reads the extractor's APG (`extractAPG`, v1.3 defaults) through the in-memory mirrors where they exist
 * (`v13DependencyDirection`, `v13NoCyclicDeps`, `v13DomainPurity`) and re-states the remaining rules over the same APG,
 * the mutation import graph (`metricViolations`) or the ts-morph project. It is not the evaluator: the live run
 * (`judge-catch-run.ts full-mock`) evaluates the real Cypher templates. Each row names its rule and file.
 *
 * Rules: dependency direction (layer order; the allowed-dependency graph for hexagonal), import cycles, domain
 * purity (the spec's forbidden packages), domain / core outward imports, dependency inversion and use-case isolation
 * (constructor injections of application classes), controller → domain entity reach, repository / port-adapter
 * pattern, SRP and ISP proxies (method and dependency counts) and the file metrics the spec thresholds.
 *
 * Blocking scope as in the v1.3 reference projects (`tests/fixtures/v1.3-reference/<style>/reference.json`, `scopeRules` and
 * `outOfScope`): structural and pattern rules block; coupling metrics and SOLID proxies are advisory (FR-V6).
 */
import picomatch from 'picomatch';
import { extractAPG } from '../../../src/apg-extractor/index.js';
import { V13_DEFAULT_OPTIONS } from '../../../src/apg-extractor/types.js';
import { memGraph } from '../../../src/fitness-compiler/apg2-in-memory.js';
import { v13DependencyDirection, v13DomainPurity, v13NoCyclicDeps } from '../../../src/fitness-compiler/v13-in-memory-baselines.js';
import { compiledParams, compiledThresholds, loadCompiledSpec } from '../../lib/mutation/expected.js';
import { buildImportGraph, metricViolations, openImportGraphProject } from '../../lib/mutation/import-graph.js';
import { isMetricTemplate } from '../../lib/mutation/metrics.js';
import { isControllerFile, layerOfFile, projectFiles, relOf } from '../../lib/mutation/operators/common.js';
import type { MetricTemplate } from '../../lib/mutation/types.js';

export interface LintRow {
  readonly rule: string;
  readonly file: string;
  readonly detail: string;
  /** False for the advisory rules (coupling metrics, SOLID proxies). */
  readonly blocking: boolean;
}

const ADVISORY = new Set(['single-responsibility-proxy', 'interface-segregation-proxy', 'domain-stability', 'module-fan-out', 'component-instability', 'no-orphan-files']);

const ENTITY_ROLES = ['Entity', 'Aggregate', 'ValueObject'];
const ADAPTER_ROLES = ['Repository', 'Gateway', 'Adapter'];
const METRICS: readonly MetricTemplate[] = ['domain-stability', 'module-fan-out', 'component-instability', 'no-orphan-files'];

/** Lints one host. `repoRoot` resolves the spec path as the pipeline does. */
export async function lintHost(repoRoot: string, dir: string, specPath: string): Promise<LintRow[]> {
  const compiled = await loadCompiledSpec(repoRoot, specPath);
  if (!compiled.success) throw new Error(compiled.errors.map((e) => e.message).join('; '));
  const spec = compiled.data.spec;
  const style = spec.style;
  const enabled = compiled.data.enabled;
  const params = compiledParams(compiled.data);
  const thresholds = compiledThresholds(compiled.data);
  const apg = await extractAPG(dir, V13_DEFAULT_OPTIONS);
  if (!apg.success) throw new Error(apg.errors.map((e) => e.message).join('; '));
  const g = memGraph(apg.data, spec.layerModel);
  const layers = spec.layerModel.layers;
  const domain = layers.find((l) => l.kind === 'domain')?.name;
  const allowed = spec.layerModel.allowedDependencies ?? [];
  // The hexagonal composition root (a layer that may import every other one) is not a use-case layer.
  const roots = new Set(allowed.filter((a) => allowed.filter((b) => b.from === a.from).length === layers.length - 1).map((a) => a.from));
  const appLayers = new Set(layers.filter((l) => l.kind === 'application' && !roots.has(l.name)).map((l) => l.name));
  const rows: LintRow[] = [];
  const add = (rule: string, file: unknown, detail: string): void => {
    rows.push({ rule, file: String(file), detail, blocking: !ADVISORY.has(rule) });
  };

  // Structural.
  if (style === 'hexagonal') {
    for (const e of g.edges) {
      if (e.type !== 'IMPORTS' && e.type !== 'RE_EXPORTS') continue;
      const s = g.node(e.sourceId);
      const t = g.node(e.targetId);
      if (s.type !== 'File' || t.type !== 'File') continue;
      const sl = g.layer.get(s.id) ?? null;
      const tl = g.layer.get(t.id) ?? null;
      if (sl === null || tl === null || sl === tl) continue;
      if (!allowed.some((a) => a.from === sl && a.to === tl)) add('dependency-direction-graph', s.filePath, `${sl} -> ${tl} (${t.filePath})`);
    }
  } else {
    for (const r of v13DependencyDirection(g, layers.map((l) => l.name))) add('dependency-direction', r.source, `imports ${String(r.target)}`);
  }
  for (const r of v13NoCyclicDeps(g)) add('no-cyclic-deps', r.source, `cycle ${JSON.stringify(r.cycle)}`);
  const forbidden = (params['domain-purity']?.forbiddenImports as readonly string[] | undefined) ?? [];
  for (const r of v13DomainPurity(g, domain, forbidden)) add('domain-purity', r.source, `imports ${String(r.target)}`);
  for (const e of g.edges) {
    if (e.type !== 'IMPORTS' && e.type !== 'RE_EXPORTS') continue;
    const s = g.node(e.sourceId);
    const t = g.node(e.targetId);
    if (s.type !== 'File' || t.type !== 'File' || g.layer.get(s.id) !== domain) continue;
    const tl = g.layer.get(t.id) ?? null;
    if (tl !== null && tl !== domain) add('domain-outward-dep', s.filePath, `imports ${t.filePath} (${tl})`);
  }

  // Pattern: constructor injections of application classes.
  const threshold = thresholds['dependency-inversion'] ?? thresholds['port-dependency-inversion'] ?? 0.85;
  for (const c of g.nodes.filter((n) => n.type === 'Class' && appLayers.has(g.layer.get(n.id) ?? ''))) {
    const deps = g.edgesOf('CONSTRUCTOR_INJECTS').filter((e) => e.sourceId === c.id).map((e) => g.node(e.targetId));
    if (deps.length > 0) {
      const ratio = deps.filter((d) => d.type === 'Interface').length / deps.length;
      if (ratio < threshold) add('dependency-inversion', c.filePath, `${c.name} injects ${deps.map((d) => d.name).join(', ')} (ratio ${ratio.toFixed(2)})`);
    }
    for (const d of deps) {
      const dl = g.layer.get(d.id) ?? null;
      if (dl !== null && dl !== domain && !appLayers.has(dl)) add('use-case-isolation', c.filePath, `${c.name} injects ${d.name} (${dl})`);
    }
  }

  // Controller → domain entity within two hops (IMPORTS | CONSTRUCTOR_INJECTS).
  const controllerLayer = layers.find((l) => l.kind === 'presentation')?.name ?? layers.find((l) => l.kind === 'infrastructure')?.name;
  const out = (id: string): string[] => g.edges.filter((e) => (e.type === 'IMPORTS' || e.type === 'CONSTRUCTOR_INJECTS') && e.sourceId === id).map((e) => e.targetId);
  for (const ctrl of g.nodes.filter((n) => n.type === 'Class' && g.layer.get(n.id) === controllerLayer)) {
    const reach = new Set(out(ctrl.id).flatMap((x) => [x, ...out(x)]));
    for (const id of reach) {
      const n = g.node(id);
      if (n.type === 'Class' && g.layer.get(id) === domain && ENTITY_ROLES.some((r) => n.name.includes(r))) add('controller-no-entity', ctrl.filePath, `${ctrl.name} reaches ${n.name}`);
    }
  }

  // Repository / port-adapter pattern: infrastructure classes in an adapter role implement a domain or application interface.
  const infra = layers.find((l) => l.kind === 'infrastructure')?.name;
  const portLayers = new Set([domain, ...appLayers]);
  for (const c of g.nodes.filter((n) => n.type === 'Class' && g.layer.get(n.id) === infra && ADAPTER_ROLES.some((r) => n.name.includes(r)))) {
    const ok = g.edgesOf('IMPLEMENTS').some((e) => e.sourceId === c.id && g.node(e.targetId).type === 'Interface' && portLayers.has(g.layer.get(e.targetId) ?? ''));
    if (!ok) add('port-adapter-pattern', c.filePath, `${c.name} implements no port`);
  }

  // SOLID proxies, as the templates count them: CONTAINS methods and CONSTRUCTOR_INJECTS targets per class.
  const srp = params['single-responsibility-proxy'] ?? {};
  const maxMethods = Number(srp.maxPublicMethods ?? 10);
  const maxDeps = Number(srp.maxDependencies ?? 5);
  const maxIface = Number(params['interface-segregation-proxy']?.maxInterfaceMethods ?? 5);
  const contained = (id: string): number => g.edgesOf('CONTAINS').filter((e) => e.sourceId === id && g.node(e.targetId).type === 'Method').length;
  for (const c of g.nodes.filter((n) => n.type === 'Class')) {
    const methods = contained(c.id);
    const deps = new Set(g.edgesOf('CONSTRUCTOR_INJECTS').filter((e) => e.sourceId === c.id).map((e) => e.targetId)).size;
    if (methods > maxMethods || deps > maxDeps) add('single-responsibility-proxy', c.filePath, `${c.name}: ${String(methods)} methods, ${String(deps)} dependencies`);
  }
  for (const i of g.nodes.filter((n) => n.type === 'Interface')) {
    if (contained(i.id) > maxIface) add('interface-segregation-proxy', i.filePath, `${i.name} declares ${String(contained(i.id))} methods`);
  }
  const handle = openImportGraphProject(dir, 'tsconfig.json');
  const view = { layers: compiled.data.layers, binding: compiled.data.binding };
  for (const sf of projectFiles(handle)) {
    const rel = relOf(handle, sf);
    const layer = layerOfFile(view, rel);
    if (layer !== null && isControllerFile(sf, rel) && layer !== controllerLayer) add('controller-placement', rel, `controller in ${layer}, not ${String(controllerLayer)}`);
  }

  // File metrics with the spec's thresholds (exclude paths of the function applied).
  const ig = buildImportGraph(handle, compiled.data.layers);
  for (const m of METRICS) {
    if (!enabled.has(m) || !isMetricTemplate(m)) continue;
    const excluded = picomatch([...(spec.fitnessFunctions.find((f) => f.name === m)?.excludePaths ?? [])], { dot: true });
    for (const [file, value] of metricViolations(ig, m, thresholds[m], compiled.data.domainLayer)) {
      if (excluded(file)) continue;
      add(m, file, `value ${value.toFixed(2)}`);
    }
  }
  return rows.sort((a, b) => (a.rule === b.rule ? (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) : a.rule < b.rule ? -1 : 1));
}
