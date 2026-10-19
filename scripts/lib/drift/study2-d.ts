/**
 * Study 2's D with REV-03 applied (D-1 to D-8 of `aidlc-docs/construction/v1.4/U4/functional-design/design.md`).
 *
 * D is the propagation of inherited step-1 blocking patterns to new slices (REV-03 finding 3,
 * `ops/notes/rev-03-study2-drift-fable.md`): the count of new blocking identities at steps kFrom..kTo against a shared
 * step-1 start, read beside Y1, the number of inherited step-1 identities. It is not "drift from a common state".
 *
 *   D = Σ_{t=kFrom..kTo} |E_t \ P_t|,   P_t = identities seen before t (`priorUnion`), carried through ρ under
 *   `renamePolicy: 'continue'`.
 *
 * The module never runs `check-correct`; Study 2 passes its `correct` label as the `counted` predicate. No test
 * statistic is computed here: inference stays in the Study 2 analysis. The registered memo outcome
 * (`runOutcomes().newBlockingTotal` in `scripts/lib/loop/pilot-metrics.ts`) is not touched (D-8). Pure.
 */
import type { StepRecord } from '../loop/types.js';
import { assertSameContext, fineKey, fromBlockingFinding, fromProbeFinding, keysFor, mapFinding, successorKey } from './identity.js';
import { D_CONSTRUCT, type DriftParams, type DriftRun, type IdFinding, type RenameMap, type Snapshot } from './types.js';

export interface StepInput {
  /** 1-based step number. */
  readonly step: number;
  /** The step's final snapshot; null when it was not evaluated (unscored, never 0). */
  readonly final: Snapshot | null;
  /** Every turn snapshot of the step (repair turns included), for `priorUnion: 'all-turns'`. */
  readonly turns?: readonly Snapshot[] | undefined;
  /** New slices added at this step (the denominator of D per new slice, Q7). */
  readonly newSlices?: number | undefined;
  /** KLOC added at this step. */
  readonly addedKloc?: number | undefined;
  /** ρ from the previous step's final snapshot to this one (`renamePolicy: 'continue'`). */
  readonly rename?: RenameMap | undefined;
}

export interface RunMeta {
  readonly runId: string;
  readonly blockId: string;
  readonly cell: string;
  /** D-6: a grouping key per finding (edge kind, rule family); D within and without each group is reported. */
  readonly groupBy?: ((f: IdFinding) => string) | undefined;
}

type IdMap = Map<string, IdFinding>;

function identities(s: Snapshot, params: DriftParams, counted: (f: IdFinding) => boolean): IdMap {
  const m: IdMap = new Map();
  for (const f of s.findings) {
    if (!counted(f)) continue;
    for (const k of keysFor(f, params)) if (!m.has(k)) m.set(k, f);
  }
  return m;
}

/** ρ applied to a set of identities (D-2): each identity re-keyed from its ρ-mapped finding. */
function carry(ids: IdMap, rho: RenameMap | undefined, params: DriftParams): IdMap {
  if (params.renamePolicy !== 'continue' || rho === undefined || rho.size === 0) return ids;
  const out: IdMap = new Map();
  for (const [k, f] of ids) {
    const mf = mapFinding(f, rho);
    const nk = successorKey(k, f, mf, rho, (x) => keysFor(x, params)); // ID-8: an edge key maps by ρ, not by position
    out.set(nk ?? k, mf);
  }
  return out;
}

const all = (): boolean => true;

/** One run's D, Y1 and the secondaries (D-1 to D-7). */
export function driftRun(steps: readonly StepInput[], params: DriftParams, counted: (f: IdFinding) => boolean = all, meta: RunMeta = { runId: '', blockId: '', cell: '' }): DriftRun {
  const sorted = [...steps].sort((a, b) => a.step - b.step);
  const snaps: Snapshot[] = [];
  for (const s of sorted) {
    if (s.final !== null) snaps.push(s.final);
    for (const t of s.turns ?? []) snaps.push(t);
  }
  // ID-1 over the evaluated snapshots (an unevaluated one carries no engine of record).
  assertSameContext(snaps.filter((s) => s.ok));
  const byStep = new Map(sorted.map((s) => [s.step, s]));
  const s1 = byStep.get(1);
  const E1 = s1?.final != null ? identities(s1.final, params, counted) : null;
  const Y1fine = s1?.final != null ? new Set(s1.final.findings.filter(counted).map(fineKey)).size : null;
  // Degraded cycle keys (ID-4) among the counted findings of the step-final snapshots (a final is also a turn, so the
  // turns are not added again).
  const degradedCycleKeys = sorted.reduce((a, s) => a + (s.final?.findings.filter((f) => f.cycleMembersKnown === false && counted(f)).length ?? 0), 0);

  // P after step 1.
  let prior: IdMap = new Map();
  const absorb = (s: StepInput): void => {
    if (s.final !== null) for (const [k, f] of identities(s.final, params, counted)) if (!prior.has(k)) prior.set(k, f);
    if (params.priorUnion === 'all-turns') for (const t of s.turns ?? []) if (t.ok) for (const [k, f] of identities(t, params, counted)) if (!prior.has(k)) prior.set(k, f);
  };
  if (s1 !== undefined) absorb(s1);
  let inherited: IdMap | null = E1;

  const perStep: { step: number; newCount: number | null; afterUnscored?: true }[] = [];
  const inheritedRemovedPerStep: { step: number; removed: number | null }[] = [];
  let renameMapMissing = false;
  let incomplete = false;
  let lastE: IdMap | null = E1;
  let lastStep = s1 !== undefined ? 1 : 0;
  const unscored = (s: StepInput | undefined): boolean => s === undefined || (s.final === null && (s.turns ?? []).every((x) => !x.ok));
  let prevUnscored = unscored(s1);
  let slices = 0;
  let slicesKnown = true;
  let kloc = 0;
  let klocKnown = true;
  for (let t = params.kFrom; t <= params.kTo; t++) {
    const s = byStep.get(t);
    if (s === undefined) {
      if (sorted.some((x) => x.step > t)) throw new Error(`driftRun: step ${String(t)} missing inside the run`);
      incomplete = params.kTo !== Number.MAX_SAFE_INTEGER;
      break;
    }
    if (params.renamePolicy === 'continue') {
      if (s.rename === undefined) renameMapMissing = true;
      prior = carry(prior, s.rename, params);
      if (inherited !== null) inherited = carry(inherited, s.rename, params);
    }
    const after = prevUnscored ? { afterUnscored: true as const } : {};
    if (s.newSlices === undefined) slicesKnown = false; else slices += s.newSlices;
    if (s.addedKloc === undefined) klocKnown = false; else kloc += s.addedKloc;
    if (s.final === null) {
      perStep.push({ step: t, newCount: null, ...after });
      inheritedRemovedPerStep.push({ step: t, removed: null });
      lastE = null;
    } else {
      const Et = identities(s.final, params, counted);
      let n = 0;
      for (const k of Et.keys()) if (!prior.has(k)) n++;
      perStep.push({ step: t, newCount: n, ...after });
      inheritedRemovedPerStep.push({ step: t, removed: inherited === null ? null : [...inherited.keys()].filter((k) => !Et.has(k)).length });
      lastE = Et;
    }
    absorb(s);
    prevUnscored = unscored(s);
    lastStep = t;
  }
  const D = E1 === null || perStep.some((p) => p.newCount === null) ? null : perStep.reduce((a, p) => a + (p.newCount ?? 0), 0);
  const Y1 = E1 === null ? null : E1.size;
  const inheritedRemoved = inheritedRemovedPerStep.length === 0 ? (E1 === null ? null : 0) : (inheritedRemovedPerStep.at(-1)?.removed ?? null);
  const first = perStep.find((p) => p.newCount !== null && p.newCount > 0);
  const stepsCounted = lastStep - 1;
  let byGroup: DriftRun['byGroup'];
  if (meta.groupBy !== undefined) {
    const g = meta.groupBy;
    const groups = new Set<string>();
    for (const s of snaps) for (const f of s.findings) if (counted(f)) groups.add(g(f));
    const plain = { runId: meta.runId, blockId: meta.blockId, cell: meta.cell };
    byGroup = Object.fromEntries([...groups].sort().map((name) => [name, {
      D: driftRun(steps, params, (f) => counted(f) && g(f) === name, plain).D,
      Dwithout: driftRun(steps, params, (f) => counted(f) && g(f) !== name, plain).D,
    }]));
  }
  return {
    construct: D_CONSTRUCT,
    runId: meta.runId,
    blockId: meta.blockId,
    cell: meta.cell,
    Y1,
    Y1fine,
    Yk: lastE === null ? null : lastE.size,
    eligible: Y1 === null ? null : Y1 >= params.y1Min,
    D,
    perStep,
    inheritedRemoved,
    inheritedRemovedPerStep,
    DnoInheritedRemoval: inheritedRemoved === 0 ? D : null,
    DperNewSlice: D !== null && slicesKnown && perStep.length > 0 && slices > 0 ? D / slices : null,
    DperStep: D !== null && stepsCounted > 0 ? D / stepsCounted : null,
    DperAddedKloc: D !== null && klocKnown && perStep.length > 0 && kloc > 0 ? D / kloc : null,
    stepsToFirstNew: first === undefined ? null : first.step - 1,
    incomplete,
    degradedCycleKeys,
    renameMapMissing,
    ...(byGroup !== undefined && { byGroup }),
    params,
  };
}

export interface AggregateD {
  readonly kept: readonly DriftRun[];
  readonly excluded: readonly DriftRun[];
  /** Runs kept although their block has Y1 < y1Min (`report-only`). */
  readonly flagged: readonly string[];
  readonly blocks: number;
  /** Blocks whose shared step-1 tree has Y1 = 0 (REV-03's registered falsifier): always reported. */
  readonly y1ZeroBlocks: number;
  readonly ineligibleBlocks: number;
  /** ΣD per cell over the kept runs (null when a kept run of the cell has D null). */
  readonly sumDByCell: Readonly<Record<string, number | null>>;
}

/**
 * Groups runs by `blockId` (every cell of a block branches from one step-1 tree, so Y1 must be equal across them; it
 * throws otherwise) and applies the Y1 condition (D-4).
 */
export function aggregateD(runs: readonly DriftRun[], opts: { readonly conditionOnY1: 'exclude' | 'report-only' }): AggregateD {
  const blocks = new Map<string, DriftRun[]>();
  for (const r of runs) blocks.set(r.blockId, [...(blocks.get(r.blockId) ?? []), r]);
  const kept: DriftRun[] = [];
  const excluded: DriftRun[] = [];
  const flagged: string[] = [];
  let y1Zero = 0;
  let inel = 0;
  for (const [id, rs] of blocks) {
    const ys = new Set(rs.map((r) => r.Y1).filter((y): y is number => y !== null));
    if (ys.size > 1) throw new Error(`aggregateD: block ${id} has unequal Y1 across its cells (${[...ys].join(', ')}): the shared start is broken`);
    const y1 = [...ys][0];
    const y1Min = rs[0]?.params.y1Min ?? 1;
    const ineligible = y1 !== undefined && y1 < y1Min;
    if (y1 === 0) y1Zero++;
    if (ineligible) inel++;
    if (ineligible && opts.conditionOnY1 === 'exclude') excluded.push(...rs);
    else {
      kept.push(...rs);
      if (ineligible) flagged.push(...rs.map((r) => r.runId));
    }
  }
  const sumDByCell: Record<string, number | null> = {};
  for (const r of kept) {
    const cur = sumDByCell[r.cell];
    sumDByCell[r.cell] = cur === null || r.D === null ? null : (cur ?? 0) + r.D;
  }
  return { kept, excluded, flagged, blocks: blocks.size, y1ZeroBlocks: y1Zero, ineligibleBlocks: inel, sumDByCell };
}

/** D-5: the pilot bar line (REV-03's proposed bar, not a registered one); every number is a parameter. */
export function y1Gate(runs: readonly DriftRun[], opts: { readonly minEligible: number; readonly ofRuns: number; readonly y1Min: number }): { readonly pass: boolean; readonly eligible: number; readonly runs: number; readonly ofRuns: number; readonly minEligible: number } {
  const eligible = runs.filter((r) => r.Y1 !== null && r.Y1 >= opts.y1Min).length;
  return { pass: eligible >= opts.minEligible, eligible, runs: runs.length, ofRuns: opts.ofRuns, minEligible: opts.minEligible };
}

// ── Loaders (pure; they take parsed JSON) ───────────────────────────────────

/** A probe-1 step file (`results/v1.3-floor-probe/<task>/<arm>/step-NN.json`). ρ is empty for probe 1 (ID-9). */
export interface ProbeStepFile {
  readonly spec: string;
  readonly engine: string;
  readonly scoringMode: string;
  readonly instrumentVersion: number;
  readonly step: number;
  readonly blockingFindings: readonly { readonly rule: string; readonly file: string; readonly target?: string }[];
}

export function fromProbeStepFile(json: ProbeStepFile): StepInput {
  return {
    step: json.step,
    final: {
      id: `step-${String(json.step).padStart(2, '0')}`,
      contextId: JSON.stringify([json.spec, json.engine, json.instrumentVersion, json.scoringMode]),
      ok: true,
      findings: json.blockingFindings.map(fromProbeFinding),
    },
  };
}

/**
 * A loop step record (`steps/step-NN.json`). `reports` optionally holds each turn's report violations
 * (`turns/step-NN/report-<turnId>.json`) by turn id, which give a cycle its member list (ID-4).
 */
export function fromStepRecord(r: StepRecord, reports?: ReadonlyMap<string, readonly unknown[]>): StepInput {
  const snap = (t: StepRecord['turns'][number]): Snapshot => {
    const ev = t.snapshot.evaluation;
    return {
      id: t.snapshot.commit,
      contextId: JSON.stringify([r.evaluatorSpec?.path ?? null, r.evaluatorSpec?.sha256 ?? null, ev?.engineOfRecord ?? null, 'v1.3']),
      ok: ev !== null,
      findings: ev === null ? [] : ev.blockingFindings.map((b) => fromBlockingFinding(b, reports?.get(t.turnId))),
      files: t.snapshot.sourceFiles,
    };
  };
  const turns = r.turns.map(snap);
  const last = turns.at(-1);
  return { step: r.stepIndex + 1, final: last?.ok === true ? last : null, turns };
}
