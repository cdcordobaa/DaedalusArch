/**
 * Lineages over a snapshot sequence (ID-9 to ID-19 of `aidlc-docs/construction/v1.4/U4/functional-design/design.md`).
 *
 * `buildLineages(snapshots, transitions, opts, keyFn?)`:
 * - failed snapshots are skipped: neither a birth nor a death (ID-13); `transitions[i]` is the transition from the
 *   previous *valid* snapshot into snapshot i, so ρ for a gap is supplied for the two good snapshots;
 * - `renamePolicy: 'end'` (fix mining as committed): a lineage continues iff its key is present again; the cause comes
 *   from `classifyDisappearance` with ρ's domain (and the out-of-root renames) as `renamedFrom`. With no snapshot
 *   files and edges this reproduces `lineages()` of `scripts/v1.3/fixes-mined-run.ts` (born, ended, filesStay);
 * - `renamePolicy: 'continue'` (G08): ρ is applied to the finding and the result re-keyed; the lineage continues
 *   under the new key and records `renamedAt`. Causes run on the ρ-mapped files and edges with only the out-of-root
 *   renames as `renamedFrom`, so RENAMED means "moved out of scope" (ID-10, ID-11);
 * - MASS-OR-BOT changes the cause only, never the matching (ID-12);
 * - a key has at most one successor (split, ID-14); RE-POINTED (ID-15) and MERGED (ID-17) behind their options;
 *   cycle split and merge leave `derivedFrom` links (ID-16, ID-18);
 * - the key function returns a set, so one K can feed several E lineages under `explode-edges` (ID-8): an E lineage
 *   ends only when no live finding maps to it.
 * Pure.
 */
import { classifyDisappearance } from '../../v1.3/lib/fixes-mined.js';
import { assertSameContext, cycleMembers, findingEdges, findingFiles, keysFor, mapFinding, successorKey } from './identity.js';
import type { Cause, IdFinding, IdentityOptions, Lineage, Snapshot, Transition } from './types.js';

export type KeyFn = (f: IdFinding) => readonly string[];

export interface LineageResult {
  readonly lineages: readonly Lineage[];
  /** Transitions where git skipped rename detection (ID-9): ρ may be incomplete there. */
  readonly renameDetectionSkipped: number;
  /** Lineages whose cycle key is degraded (ID-4). */
  readonly degradedCycleKeys: number;
  readonly validSnapshots: number;
}

interface Occ { readonly f: IdFinding; readonly idx: number; readonly n: number }
interface Slot { occ: Occ; ruleIds: Set<string>; tier: 'blocking' | 'advisory' | undefined; degraded: boolean }
interface Open {
  readonly birthKey: string;
  curKey: string;
  readonly born: number;
  occ: Occ;
  readonly ruleIds: Set<string>;
  tier: 'blocking' | 'advisory' | undefined;
  readonly edgeShaped: boolean;
  readonly renamedAt: number[];
  readonly derivedFrom: string[];
  degraded: boolean;
}

const EMPTY_MAP: ReadonlyMap<string, string> = new Map();
const EMPTY_SET: ReadonlySet<string> = new Set();

function index(s: Snapshot, keyFn: KeyFn): Map<string, Slot> {
  const m = new Map<string, Slot>();
  for (const f of s.findings) {
    const ks = keyFn(f);
    ks.forEach((k, idx) => {
      const slot = m.get(k);
      if (slot === undefined) {
        m.set(k, { occ: { f, idx, n: ks.length }, ruleIds: new Set([f.functionId]), tier: f.tier, degraded: f.cycleMembersKnown === false });
      } else {
        slot.ruleIds.add(f.functionId);
        if (f.tier === 'blocking') slot.tier = 'blocking';
        else slot.tier ??= f.tier;
        if (f.cycleMembersKnown === false) slot.degraded = true;
      }
    });
  }
  return m;
}


const strictSubset = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => a.size < b.size && [...a].every((x) => b.has(x));

export function buildLineages(
  snapshots: readonly Snapshot[],
  transitions: readonly (Transition | undefined)[],
  opts: IdentityOptions,
  keyFn: KeyFn = (f) => keysFor(f, opts),
): LineageResult {
  assertSameContext(snapshots);
  const out: Lineage[] = [];
  let open: Open[] = [];
  let prev: number | undefined;
  let skipped = 0;
  let valid = 0;

  const close = (o: Open, ended: number | null, cause?: Cause, filesStay?: boolean): void => {
    out.push({
      key: o.birthKey,
      ...(o.curKey !== o.birthKey && { finalKey: o.curKey }),
      ruleIds: [...o.ruleIds].sort(),
      edgeShaped: o.edgeShaped,
      ...(o.tier !== undefined && { tier: o.tier }),
      born: o.born,
      ended,
      ...(cause !== undefined && { cause }),
      ...(filesStay !== undefined && { filesStay }),
      ...(o.renamedAt.length > 0 && { renamedAt: [...o.renamedAt] }),
      ...(o.derivedFrom.length > 0 && { derivedFrom: [...o.derivedFrom] }),
      ...(o.degraded && { cycleMembersKnown: false as const }),
    });
  };
  const openFrom = (k: string, slot: Slot, born: number, derivedFrom: string[] = []): Open => ({
    birthKey: k, curKey: k, born, occ: slot.occ, ruleIds: new Set(slot.ruleIds), tier: slot.tier,
    edgeShaped: findingEdges(slot.occ.f).length > 0, renamedAt: [], derivedFrom, degraded: slot.degraded,
  });

  snapshots.forEach((snap, i) => {
    if (!snap.ok) return;
    valid++;
    const cur = index(snap, keyFn);
    if (prev === undefined) {
      for (const [k, slot] of cur) open.push(openFrom(k, slot, i));
      prev = i;
      return;
    }
    const tr = transitions[i] ?? {};
    if (tr.renameDetection === 'skipped') skipped++;
    const rho = tr.rename ?? EMPTY_MAP;
    const outOfRoot = tr.outOfRoot ?? EMPTY_SET;
    const childFiles = snap.files !== undefined ? new Set(snap.files) : undefined;
    const childEdges = snap.edges !== undefined ? new Set(snap.edges) : undefined;
    const renamedFrom = opts.renamePolicy === 'end' ? new Set([...rho.keys(), ...outOfRoot]) : outOfRoot;

    interface Ending { readonly o: Open; readonly mapped: IdFinding; cause?: Cause }
    const endings: Ending[] = [];
    const claims = new Map<string, { o: Open; mapped: IdFinding }[]>();
    for (const o of open) {
      let mapped = o.occ.f;
      let succ: string | undefined = o.curKey;
      if (opts.renamePolicy === 'continue') {
        if (findingFiles(o.occ.f).some((f) => outOfRoot.has(f))) {
          endings.push({ o, mapped, cause: 'RENAMED' });
          continue;
        }
        mapped = mapFinding(o.occ.f, rho);
        succ = successorKey(o.curKey, o.occ.f, mapped, rho, keyFn); // ID-8: an edge key maps by ρ, not by position
      }
      if (succ !== undefined && cur.has(succ)) {
        const c = claims.get(succ) ?? [];
        c.push({ o, mapped });
        claims.set(succ, c);
      } else endings.push({ o, mapped });
    }
    const next: Open[] = [];
    const claimed = new Set<string>();
    for (const [succ, cl] of claims) {
      cl.sort((a, b) => a.o.born - b.o.born || (a.o.birthKey < b.o.birthKey ? -1 : a.o.birthKey > b.o.birthKey ? 1 : 0));
      const [win, ...losers] = cl;
      if (win === undefined) continue;
      const slot = cur.get(succ);
      if (slot === undefined) continue; // claims hold only keys present in `cur`
      if (succ !== win.o.curKey) { win.o.renamedAt.push(i); win.o.curKey = succ; }
      win.o.occ = slot.occ;
      for (const r of slot.ruleIds) win.o.ruleIds.add(r);
      if (slot.tier === 'blocking') win.o.tier = 'blocking';
      if (slot.degraded) win.o.degraded = true;
      next.push(win.o);
      claimed.add(succ);
      for (const l of losers) endings.push({ o: l.o, mapped: l.mapped, ...(opts.merged && { cause: 'MERGED' as const }) });
    }

    // Births: keys present now that no open lineage continues into.
    const births: Open[] = [];
    for (const [k, slot] of cur) if (!claimed.has(k)) births.push(openFrom(k, slot, i));

    for (const e of endings) {
      const files = findingFiles(e.mapped);
      const filesStay = childFiles !== undefined ? files.every((f) => childFiles.has(f)) : undefined;
      let cause = e.cause;
      if (cause === undefined && childFiles !== undefined && childEdges !== undefined) {
        cause = classifyDisappearance({ files, edges: findingEdges(e.mapped), childFiles, childEdges, renamedFrom, massOrBot: tr.massOrBot === true });
      }
      const isCycle = cycleMembers(e.mapped) !== undefined;
      // ID-15 RE-POINTED: same rule and source, a new target born at this step, both files in place.
      if (opts.rePointed && cause === 'FIXED-BY-DEV' && e.o.edgeShaped && !isCycle && filesStay === true) {
        const re = births.filter((b) => {
          const f = b.occ.f;
          return cycleMembers(f) === undefined && findingEdges(f).length > 0 && e.o.ruleIds.has(f.functionId)
            && f.filePath === e.mapped.filePath && f.target !== e.mapped.target;
        });
        if (re.length > 0) {
          cause = 'RE-POINTED';
          for (const b of re) b.derivedFrom.push(e.o.birthKey);
        }
      }
      // ID-16 cycle split and ID-18 cycle merge: links only, the ended cycle keeps its cause.
      if (isCycle) {
        const ne = new Set(files);
        for (const b of births) {
          if (cycleMembers(b.occ.f) === undefined) continue;
          const nb = new Set(findingFiles(b.occ.f));
          if (strictSubset(nb, ne) || strictSubset(ne, nb)) b.derivedFrom.push(e.o.birthKey);
        }
      }
      close(e.o, i, cause, filesStay);
    }
    open = [...next, ...births];
    prev = i;
  });
  for (const o of open) close(o, null);
  out.sort((a, b) => a.born - b.born || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return {
    lineages: out,
    renameDetectionSkipped: skipped,
    degradedCycleKeys: out.filter((l) => l.cycleMembersKnown === false).length,
    validSnapshots: valid,
  };
}
