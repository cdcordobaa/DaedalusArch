/**
 * Study 2 evasion check (M6): the analysis core. `analyseEvasion` reads the loaded runs of a loop out-root through an
 * injected `io` (snapshot trees, rename maps, diffs and specs), so the tests can plant trees, and builds the
 * `study2-evasion/v1` report of design §2.6 plus the blind packet. No model, network or Neo4j call (EV-09).
 *
 * Runs are processed one at a time in run-id order; at most two trees (t−1 and t) are held at once. The output is
 * deterministic: sorted keys and arrays, no clock field (EV-10: the out-root is a placeholder or repo-relative).
 */
import type { ParsedSpec } from '../../../../src/shared/types/spec.js';
import type { BlockingFinding, StepRecord, StepSpecRef } from '../../../lib/loop/types.js';
import { blockKey } from '../study2-analysis.js';
import type { LoadedRun } from '../study2-analysis.js';
import { acceptanceGap, cellAcceptance, cellOf, stepPasses, sortKeys, ACCEPTANCE_MIN_COVERAGE } from './acceptance-rate.js';
import type { AcceptanceGap, CellAcceptance } from './acceptance-rate.js';
import { importKindsByStep, mechanism, sizeByStep, treeKinds } from './extras.js';
import type { Mechanism, TreeKinds } from './extras.js';
import { IDENTITY_NAME, defaultIdentity, mapFinding } from './identity.js';
import type { IdentityName, IdentityOf, RenameMap } from './identity.js';
import {
  blockingFunctions,
  buildGraph,
  cmp,
  endpoints,
  guardIndex,
  isCycleFinding,
  normaliseFinding,
  observedPairsNotInSpec,
  parseTierTable,
  placementModel,
  placementOf,
  specGuardedPairs,
} from './import-graph.js';
import type { PlacementModel, Tree } from './import-graph.js';
import { MOVED_ONLY_CLASSES, SIGNAL_ORDER, analyseTransition } from './moved-only.js';
import type { DiffClass, Signal, Snapshot, TransitionCounts } from './moved-only.js';
import { OUT_OF_SCOPE_MARGIN, newOutOfScopeEdges, outOfScope } from './out-of-scope.js';
import { drawSample, renderPacket } from './sample.js';
import type { HumanRead, Packet, PacketInput } from './sample.js';

export const EVASION_SCHEMA = 'study2-evasion/v1';

export const NOT_HERE = Object.freeze({
  literalView: 's2d-01 §5.4: the literal-view re-score needs the firewall in a second view (U4 or the Study 2 analysis); not computed here',
  concentration: 's2d-01 §5.7: concentration needs D without the dominant family (the D analysis); not computed here',
});

export interface EvasionIO {
  /** The `src/` tree of a commit of the run's snapshot store. */
  readTree(runDir: string, commit: string): Tree;
  renameMap(runDir: string, a: string, b: string): RenameMap;
  /** The unified `src/` diff a → b (rename-detected). */
  diff(runDir: string, a: string, b: string): string;
  /** The parsed spec of a step's `evaluatorSpec` (or the fallback); null when it cannot be read. */
  readSpec(ref: Pick<StepSpecRef, 'kind' | 'path'>, runDir: string): Promise<ParsedSpec | null>;
}

export interface EvasionOptions {
  readonly fromStep: number;
  readonly seed: number;
  readonly perArm: number;
  /** Cells reported (default: every cell present). */
  readonly cells?: readonly string[];
  readonly h2: readonly [string, string];
  readonly h1: readonly [string, string];
  /** Repository-relative spec used when a step record names none. */
  readonly specFallback?: string;
  /** Placeholder or repo-relative label of the out-root. */
  readonly outRootLabel: string;
  /** The committed tier table (`Docs/v1.3/rule-tiers.md`, or the v1.4 post-seal table). */
  readonly tierSource: { readonly path: string; readonly text: string };
  readonly identityOf?: IdentityOf;
  readonly identityName?: IdentityName;
  readonly humanRead?: HumanRead | null;
}

export interface DiffRow {
  readonly runId: string;
  readonly step: number;
  readonly cell: string;
  readonly kind: 'removal' | 'avoided';
  readonly identities: readonly string[];
  readonly pairs: readonly string[];
  readonly signals: readonly Signal[];
  readonly class: DiffClass;
  readonly acceptancePassed: boolean;
}

interface RunWork {
  readonly run: LoadedRun;
  readonly cell: string;
  readonly diffs: DiffRow[];
  readonly commits: Map<number, string>;
  newOos: number;
  snapshotsCounted: number;
  atK: { unmappedFiles: number; unmappedShare: number | null; edges: number; declared: number } | null;
}

const round = (v: number): number => Math.round(v * 1e6) / 1e6;

function lastFindings(s: StepRecord): readonly BlockingFinding[] | null {
  const ev = s.turns[s.turns.length - 1]?.snapshot.evaluation ?? null;
  return ev === null ? null : ev.blockingFindings;
}

/** JSON with object keys sorted at every level (deterministic bytes). */
export function stableStringify(v: unknown): string {
  const norm = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(norm);
    if (x !== null && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      return Object.fromEntries(Object.keys(o).sort(cmp).filter((k) => o[k] !== undefined).map((k) => [k, norm(o[k])]));
    }
    return x;
  };
  return `${JSON.stringify(norm(v), null, 2)}\n`;
}

export interface EvasionResult {
  readonly report: Record<string, unknown>;
  readonly packet: Packet;
  readonly diffs: readonly DiffRow[];
}

/** The evasion analysis of the loaded runs (module header). */
export async function analyseEvasion(runs: readonly LoadedRun[], runDirOf: (runId: string) => string, o: EvasionOptions, io: EvasionIO): Promise<EvasionResult> {
  const identityOf = o.identityOf ?? defaultIdentity;
  const tiers = parseTierTable(o.tierSource.text);
  const excluded = { evaluationMissing: 0, snapshotMissing: 0, specMissing: 0, endpointUnresolved: 0, cycleMembersUnknown: 0 };
  const counts: TransitionCounts = { endpointUnresolved: 0, cycleMembersUnknown: 0, edgeless: 0 };
  let unresolvedSpecifiers = 0;
  let renameSkipped = 0;
  const specPairs = new Map<string, [string, string]>();
  const specSources = new Set<string>();
  const observed: [string, string][] = [];
  const kindsByCell = new Map<string, { step: number; kinds: TreeKinds }[]>();
  const works: RunWork[] = [];
  const sorted = [...runs].sort((a, b) => cmp(a.run.runId, b.run.runId));

  for (const lr of sorted) {
    const runDir = runDirOf(lr.run.runId);
    const cell = cellOf(lr.run);
    const w: RunWork = { run: lr, cell, diffs: [], commits: new Map(), newOos: 0, snapshotsCounted: 0, atK: null };
    works.push(w);
    const steps = [...lr.steps].sort((a, b) => a.stepIndex - b.stepIndex);
    for (const s of steps) w.commits.set(s.stepIndex + 1, s.finalCommit);
    const ref = steps.find((s) => s.evaluatorSpec !== undefined)?.evaluatorSpec ?? (o.specFallback !== undefined ? { kind: 'static' as const, path: o.specFallback } : undefined);
    const spec = ref === undefined ? null : await io.readSpec(ref, runDir);
    if (spec === null || ref === undefined) {
      excluded.specMissing++;
      continue;
    }
    specSources.add(ref.kind === 'static' ? ref.path : `<run>/${ref.path}`);
    const model: PlacementModel = placementModel(spec);
    const pairs = specGuardedPairs(model, blockingFunctions(spec, tiers));
    for (const p of pairs) specPairs.set(`${p.source}\t${p.target}`, [p.source, p.target]);
    const guard = guardIndex(pairs);
    const ctx = { model, guard, identityOf };

    let prev: { snap: Snapshot; findings: readonly BlockingFinding[] | null; commit: string } | null = null;
    let history: BlockingFinding[] = [];
    const oosSeries: { edges: readonly string[]; rho: RenameMap; step: number }[] = [];
    for (const s of steps) {
      const step = s.stepIndex + 1;
      let tree: Tree;
      try {
        tree = io.readTree(runDir, s.finalCommit);
      } catch {
        excluded.snapshotMissing++;
        prev = null;
        continue;
      }
      const snap: Snapshot = { tree, graph: buildGraph(tree) };
      const findings = lastFindings(s);
      if (findings !== null) {
        for (const f of findings) {
          const n = normaliseFinding(f, tree);
          if (isCycleFinding(n)) continue;
          const e = endpoints(n, tree);
          if (e.source !== null && e.target !== null && e.target !== 'edgeless') observed.push([placementOf(model, e.source), placementOf(model, e.target)]);
        }
      }
      let rho: RenameMap = { map: new Map(), renameDetection: 'full' };
      if (prev !== null) {
        rho = io.renameMap(runDir, prev.commit, s.finalCommit);
        if (rho.renameDetection === 'skipped' && step >= o.fromStep) renameSkipped++;
      }
      const oos = outOfScope(tree, snap.graph, model, guard);
      oosSeries.push({ edges: oos.outOfScopeEdges, rho, step });
      if (step >= o.fromStep) {
        unresolvedSpecifiers += snap.graph.unresolved;
        const list = kindsByCell.get(cell) ?? [];
        list.push({ step, kinds: treeKinds(tree) });
        kindsByCell.set(cell, list);
      }
      if (step === lr.run.steps) w.atK = { unmappedFiles: oos.unmappedFiles, unmappedShare: oos.unmappedShare, edges: oos.outOfScopeEdges.length, declared: oos.declaredOutsideEdges };
      if (step >= 2) {
        if (prev === null || prev.findings === null || findings === null) {
          if (step >= o.fromStep) excluded.evaluationMissing++;
        } else {
          const local: TransitionCounts = { endpointUnresolved: 0, cycleMembersUnknown: 0, edgeless: 0 };
          const r = analyseTransition(ctx, { prev: prev.snap, cur: snap, rho, prevFindings: prev.findings, curFindings: findings, history }, local);
          history = [...history.map((f) => mapFinding(f, rho)), ...r.prevMapped];
          if (step >= o.fromStep) {
            counts.endpointUnresolved += local.endpointUnresolved;
            counts.cycleMembersUnknown += local.cycleMembersUnknown;
            counts.edgeless += local.edgeless;
            if (r.kind !== null) {
              w.diffs.push({
                runId: lr.run.runId,
                step,
                cell,
                kind: r.kind,
                identities: [...new Set(r.removed.flatMap((x) => x.keys))].sort(cmp),
                pairs: r.kind === 'removal' ? [...new Set(r.removed.flatMap((x) => x.pairs))].sort(cmp) : r.inheritedPairs,
                signals: r.signals,
                class: r.class,
                acceptancePassed: stepPasses(s),
              });
            }
          }
        }
      }
      prev = { snap, findings, commit: s.finalCommit };
    }
    const fresh = newOutOfScopeEdges(oosSeries);
    oosSeries.forEach((x, i) => {
      if (x.step >= o.fromStep) {
        w.newOos += fresh[i] ?? 0;
        w.snapshotsCounted++;
      }
    });
  }
  excluded.endpointUnresolved = counts.endpointUnresolved;
  excluded.cycleMembersUnknown = counts.cycleMembersUnknown;

  // ── Per cell ──
  const present = [...new Set(works.map((w) => w.cell))].sort(cmp);
  const cells = o.cells !== undefined ? [...o.cells] : present;
  const runsByCell = new Map<string, LoadedRun[]>();
  for (const w of works) runsByCell.set(w.cell, [...(runsByCell.get(w.cell) ?? []), w.run]);
  const acceptance: Record<string, CellAcceptance> = {};
  for (const c of cells) acceptance[c] = cellAcceptance(runsByCell.get(c) ?? [], o.fromStep);
  const gapH2: AcceptanceGap = acceptanceGap(runsByCell, o.h2, o.fromStep);
  const gapH1 = acceptanceGap(runsByCell, o.h1, o.fromStep);
  const acceptanceIncomplete = cells.some((c) => {
    const a = acceptance[c];
    return a === undefined || a.coverage === null || a.coverage < ACCEPTANCE_MIN_COVERAGE;
  });

  const allDiffs = works.flatMap((w) => w.diffs);
  const movedOnly: Record<string, unknown> = {};
  for (const c of cells) {
    const d = allDiffs.filter((x) => x.cell === c);
    const byClass: Record<string, number> = {};
    for (const x of d) byClass[x.class] = (byClass[x.class] ?? 0) + 1;
    movedOnly[c] = {
      eligible: d.length,
      byKind: sortKeys({ removal: d.filter((x) => x.kind === 'removal').length, avoided: d.filter((x) => x.kind === 'avoided').length }),
      byClass: sortKeys(byClass),
      movedOnlyHeuristic: d.filter((x) => (MOVED_ONLY_CLASSES as readonly string[]).includes(x.class)).length,
    };
  }
  movedOnly.H2PairedDiff = pairedMean(works, o.h2, (w) => w.diffs.filter((x) => (MOVED_ONLY_CLASSES as readonly string[]).includes(x.class)).length);

  const outOfScopeOut: Record<string, unknown> = {};
  for (const c of cells) {
    const ws = works.filter((w) => w.cell === c && w.atK !== null);
    const mean = (f: (w: RunWork) => number | null): number | null => {
      const v = ws.map(f).filter((x): x is number => x !== null);
      return v.length === 0 ? null : round(v.reduce((a, b) => a + b, 0) / v.length);
    };
    outOfScopeOut[c] = {
      runs: ws.length,
      unmappedFilesAtK: mean((w) => w.atK?.unmappedFiles ?? null),
      unmappedShareAtK: mean((w) => w.atK?.unmappedShare ?? null),
      outOfScopeEdgesAtK: mean((w) => w.atK?.edges ?? null),
      declaredOutsideEdgesAtK: mean((w) => w.atK?.declared ?? null),
      newOutOfScopeEdges: works.filter((w) => w.cell === c).reduce((a, w) => a + w.newOos, 0),
    };
  }
  const excess = pairedMean(works, o.h2, (w) => (w.snapshotsCounted === 0 ? null : w.newOos / w.snapshotsCounted));
  outOfScopeOut.H2ExcessPerSnapshot = excess;
  outOfScopeOut.margin = OUT_OF_SCOPE_MARGIN;
  outOfScopeOut.marginStatus = 'design proposal (author question Q2), not a registered figure';
  outOfScopeOut.flag = excess !== null && excess > OUT_OF_SCOPE_MARGIN;

  const size: Record<string, unknown> = {};
  const importKinds: Record<string, unknown> = {};
  const mech: Record<string, Mechanism> = {};
  for (const c of cells) {
    const recs = (runsByCell.get(c) ?? []).map((r) => r.steps);
    size[c] = sizeByStep(recs, o.fromStep);
    importKinds[c] = importKindsByStep(kindsByCell.get(c) ?? []);
    if (c.startsWith('daedalus-mcp@')) mech[c] = mechanism(recs, o.fromStep);
  }

  // ── Sample and packet ──
  const pool = allDiffs
    .filter((d) => (d.cell === o.h2[0] || d.cell === o.h2[1]) && d.acceptancePassed)
    .map((d) => ({ id: `${d.runId}#${String(d.step)}`, cell: d.cell, flagged: (MOVED_ONLY_CLASSES as readonly string[]).includes(d.class) }));
  const draw = drawSample(pool, [o.h2[0], o.h2[1]], { perArm: o.perArm, seed: o.seed });
  const byId = new Map(allDiffs.map((d) => [`${d.runId}#${String(d.step)}`, d]));
  const inputs: PacketInput[] = [];
  for (const it of draw.items) {
    const d = byId.get(it.poolId);
    if (d === undefined) continue;
    const w = works.find((x) => x.run.run.runId === d.runId);
    const a = w?.commits.get(d.step - 1);
    const b = w?.commits.get(d.step);
    const spec = w?.run.run.spec;
    inputs.push({
      item: it,
      runId: d.runId,
      step: d.step,
      kind: d.kind,
      heuristicClass: d.class,
      signals: d.signals,
      diff: a !== undefined && b !== undefined ? io.diff(runDirOf(d.runId), a, b) : '',
      pairs: d.pairs,
      deny: [d.runId, d.cell, o.h2[0], o.h2[1], ...(spec !== undefined ? [spec.adapterId, spec.modelId, spec.taskId] : [])],
    });
  }
  const packet = renderPacket(inputs, { seed: o.seed });

  const observedNot = observedPairsNotInSpec(guardIndex([...specPairs.values()].map(([source, target]) => ({ source, target, functions: [] }))), observed);
  const human = o.humanRead ?? null;
  const report = {
    schema: EVASION_SCHEMA,
    outRoot: o.outRootLabel,
    identity: o.identityName ?? IDENTITY_NAME,
    identityNote: (o.identityName ?? IDENTITY_NAME) === 'pilot-metrics' ? 'per-rule identity: a dry-run artefact only; final figures need u4-edge (design R8)' : null,
    fromStep: o.fromStep,
    seed: o.seed,
    cells,
    contrasts: { H2: [...o.h2], H1: [...o.h1] },
    guardedPairs: {
      source: o.tierSource.path,
      specs: [...specSources].sort(cmp),
      spec: [...specPairs.values()].sort((x, y) => cmp(x.join('\t'), y.join('\t'))),
      observedNotInSpec: observedNot,
    },
    acceptance,
    acceptanceGap: { H2: gapH2, H1: { blocks: gapH1.blocks, gapPoints: gapH1.gapPoints } },
    movedOnly,
    signalOrder: SIGNAL_ORDER,
    diffs: allDiffs,
    outOfScope: outOfScopeOut,
    size,
    importKinds,
    mechanism: mech,
    notHere: NOT_HERE,
    unresolvedSpecifiers,
    edgeless: counts.edgeless,
    renameDetectionSkipped: renameSkipped,
    excluded,
    sample: { perArm: o.perArm, pool: pool.length, drawn: draw.drawn, shortfall: draw.shortfall, keySha256: packet.keySha256 },
    humanRead: human,
    flags: {
      acceptanceGap: gapH2.flag,
      acceptanceGapTwoSided: gapH2.flagTwoSided,
      acceptanceIncomplete,
      outOfScope: excess !== null && excess > OUT_OF_SCOPE_MARGIN,
      guardedPairsIncomplete: observedNot.length > 0,
      noMechanism: Object.values(mech).some((m) => m.noMechanism),
      evasionHumanRead: human === null ? null : human.treatedMovedOnly > 0,
      evasionHumanReadBroad: human === null ? null : human.treatedMovedOnlyBroad > 0,
    },
  };
  return { report, packet, diffs: allDiffs };
}

/** Mean over paired blocks of value(treated) − value(reference); null with no paired block. */
function pairedMean(works: readonly RunWork[], contrast: readonly [string, string], value: (w: RunWork) => number | null): number | null {
  const index = (cell: string): Map<string, RunWork> => new Map(works.filter((w) => w.cell === cell).map((w) => [blockKey(w.run.run), w]));
  const ref = index(contrast[0]);
  const treated = index(contrast[1]);
  const d: number[] = [];
  for (const k of [...ref.keys()].sort(cmp)) {
    const a = ref.get(k);
    const b = treated.get(k);
    if (a === undefined || b === undefined) continue;
    const va = value(a);
    const vb = value(b);
    if (va === null || vb === null) continue;
    d.push(vb - va);
  }
  return d.length === 0 ? null : round(d.reduce((x, y) => x + y, 0) / d.length);
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '–';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3);
  return String(v);
}

/** `evasion.md`: the report as tables (the only file with a timestamp). */
export function renderEvasionMd(report: Record<string, unknown>, generatedAt: string): string {
  const r = report as {
    outRoot: string; identity: string; identityNote: string | null; fromStep: number; seed: number; cells: string[];
    contrasts: { H2: string[]; H1: string[] };
    guardedPairs: { source: string; specs: string[]; spec: string[][]; observedNotInSpec: string[][] };
    acceptance: Record<string, CellAcceptance>;
    acceptanceGap: { H2: AcceptanceGap; H1: { blocks: number; gapPoints: number | null } };
    movedOnly: Record<string, { eligible: number; byKind: Record<string, number>; byClass: Record<string, number>; movedOnlyHeuristic: number } | number | null>;
    outOfScope: Record<string, unknown>;
    mechanism: Record<string, Mechanism>;
    excluded: Record<string, number>; unresolvedSpecifiers: number; edgeless: number; renameDetectionSkipped: number;
    sample: { perArm: number; pool: number; drawn: Record<string, number>; shortfall: Record<string, number>; keySha256: string };
    flags: Record<string, boolean | null>;
    notHere: Record<string, string>;
  };
  const lines: string[] = [];
  lines.push('# Study 2 evasion check report', '');
  lines.push(`Generated ${generatedAt}. Out-root: \`${r.outRoot}\`. Identity: \`${r.identity}\`${r.identityNote !== null ? ` (${r.identityNote})` : ''}. Steps ${String(r.fromStep)}..k. Seed ${String(r.seed)}.`, '');
  lines.push(`Contrasts: H2 = ${r.contrasts.H2.join(' vs ')}; H1 = ${r.contrasts.H1.join(' vs ')}. Guarded pairs from the spec(s) ${r.guardedPairs.specs.map((s) => `\`${s}\``).join(', ') || '–'} and the tier table \`${r.guardedPairs.source}\`: ${String(r.guardedPairs.spec.length)} pairs; observed pairs outside the spec: ${String(r.guardedPairs.observedNotInSpec.length)}.`, '');
  lines.push('## A1 acceptance', '', '| Cell | Steps with record | Ran | Passing | Pass rate | Coverage | Not passing |', '|---|---|---|---|---|---|---|');
  for (const c of r.cells) {
    const a = r.acceptance[c];
    if (a === undefined) continue;
    lines.push(`| ${c} | ${String(a.stepsWithRecord)} | ${String(a.stepsRan)} | ${String(a.stepsPassing)} | ${fmt(a.passRate)} | ${fmt(a.coverage)} | ${Object.entries(a.byStatus).map(([k, v]) => `${k} ${String(v)}`).join(', ') || '–'} |`);
  }
  const g = r.acceptanceGap.H2;
  lines.push('', `H2 gap: ${fmt(g.gapPoints)} points over ${String(g.blocks)} paired blocks (bar ${String(g.bar)}; one-sided flag ${String(g.flag)}, two-sided flag ${String(g.flagTwoSided)}; Q5 open). H1 gap (descriptive): ${fmt(r.acceptanceGap.H1.gapPoints)}.`, '');
  lines.push('## A2 moved-only heuristic', '', '| Cell | Eligible | Removal | Avoided | Moved-only (heuristic) | By class |', '|---|---|---|---|---|---|');
  for (const c of r.cells) {
    const m = r.movedOnly[c];
    if (m === undefined || m === null || typeof m === 'number') continue;
    lines.push(`| ${c} | ${String(m.eligible)} | ${String(m.byKind.removal ?? 0)} | ${String(m.byKind.avoided ?? 0)} | ${String(m.movedOnlyHeuristic)} | ${Object.entries(m.byClass).map(([k, v]) => `${k} ${String(v)}`).join(', ') || '–'} |`);
  }
  lines.push('', `H2 paired difference in heuristic moved-only diffs per block: ${fmt(r.movedOnly.H2PairedDiff)}. The registered bar sits on the human read, not on this count.`, '');
  lines.push('## A3 out of scope', '', '| Cell | Unmapped files at k | Unmapped share at k | Out-of-scope edges at k | New out-of-scope edges (steps from) |', '|---|---|---|---|---|');
  for (const c of r.cells) {
    const x = r.outOfScope[c] as { unmappedFilesAtK: number | null; unmappedShareAtK: number | null; outOfScopeEdgesAtK: number | null; newOutOfScopeEdges: number } | undefined;
    if (x === undefined) continue;
    lines.push(`| ${c} | ${fmt(x.unmappedFilesAtK)} | ${fmt(x.unmappedShareAtK)} | ${fmt(x.outOfScopeEdgesAtK)} | ${String(x.newOutOfScopeEdges)} |`);
  }
  lines.push('', `H2 excess per snapshot: ${fmt(r.outOfScope.H2ExcessPerSnapshot)} (margin ${fmt(r.outOfScope.margin)}, a design proposal; Q2 open).`, '');
  lines.push('## Mechanism (s2d-01 §5.6)', '');
  const mechCells = Object.keys(r.mechanism);
  if (mechCells.length === 0) lines.push('No `daedalus-mcp` cell.', '');
  for (const c of mechCells) {
    const m = r.mechanism[c];
    if (m !== undefined) lines.push(`- ${c}: ${String(m.withCalls)} of ${String(m.steps - m.noLog)} logged steps with a tool call (share ${fmt(m.share)}); ${String(m.noLog)} steps without a log.`);
  }
  lines.push('', '## Not computed here', '', `- ${r.notHere.literalView ?? ''}`, `- ${r.notHere.concentration ?? ''}`, '');
  lines.push('## Exclusions and counts', '', `Excluded: ${Object.entries(r.excluded).map(([k, v]) => `${k} ${String(v)}`).join(', ')}. Unresolved relative specifiers: ${String(r.unresolvedSpecifiers)}. Edgeless removals: ${String(r.edgeless)}. Rename detection skipped: ${String(r.renameDetectionSkipped)}.`, '');
  lines.push('## Blind sample', '', `Pool ${String(r.sample.pool)}; drawn ${Object.entries(r.sample.drawn).map(([k, v]) => `${k} ${String(v)}`).join(', ') || '–'}; shortfall ${Object.entries(r.sample.shortfall).map(([k, v]) => `${k} ${String(v)}`).join(', ') || 'none'}. Key sha256 \`${r.sample.keySha256}\`.`, '');
  lines.push('## Flags', '', ...Object.entries(r.flags).map(([k, v]) => `- ${k}: ${String(v)}`), '');
  return `${lines.join('\n')}\n`;
}
