/**
 * SEM-GATE-3: the trees of the gate (shared by `census.ts`, `check-trees.ts` and `gate.ts`; zero model calls).
 *   - `cases.json`: the fresh form-C trees (built), the SEM-2 pilot trees (dev positives and pilot negatives, read from
 *     the results branch commit with `git archive`) and the hxpb1 / hxpb2 reference clean trees;
 *   - `experiments/sem-gate-2/cases.json` (20 cases) and `experiments/sem-gate/cases.json` (53 cases), unchanged.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const HERE = path.join('experiments', 'sem-gate-3');
export const KEPT_SESSIONS = 'results/v1.5-hx-study/hx-study/sessions';
export const PILOT_SESSIONS = 'results/v1.5-study/sem2-pilot/sessions';

export interface Case {
  id: string; source: 'built' | 'kept' | 'pilot' | 'reference'; task: string; tree?: string; sessions?: string[]; session?: string; step?: string;
  spec: string; baseline?: string; puzzle?: string;
  /** null: no target; every R-MIRROR-SEM violation in the tree counts (a negative tree). */
  target: { file: string; coreSet: string } | null; key?: string | null;
  label: 'positive' | 'negative'; form: 'A' | 'B' | 'C' | null; twin: boolean; note: string;
}
export type SetName = 'fresh' | 'dev' | 'extra' | 'sem-gate-2' | 'sem-gate';
export interface GateCase { c: Case; set: SetName; tree: string; baseline?: string }

interface Manifest { pilot?: { commit: string }; keptFrom?: { commit: string }; cases: Case[] }
const read = (f: string): Manifest => JSON.parse(fs.readFileSync(f, 'utf8')) as Manifest;

/** Every gate case with its tree on disk (pilot and kept trees are extracted into `scratch`). */
export function gateCases(scratch: string): GateCase[] {
  const own = read(path.join(HERE, 'cases.json'));
  const two = read(path.join('experiments', 'sem-gate-2', 'cases.json'));
  const one = read(path.join('experiments', 'sem-gate', 'cases.json'));
  const extract = (commit: string, paths: string[]): void => {
    if (paths.length === 0) return;
    const tar = path.join(scratch, `${commit.slice(0, 12)}.tar`);
    execFileSync('git', ['archive', '--output', tar, commit, ...paths]);
    execFileSync('tar', ['-x', '-f', tar, '-C', scratch]);
    fs.rmSync(tar);
  };
  const pilots = [...new Set(own.cases.filter((c) => c.source === 'pilot').map((c) => c.session!))].sort();
  extract(own.pilot!.commit, pilots.flatMap((s) => [`${PILOT_SESSIONS}/${s}/snap/step-00`, `${PILOT_SESSIONS}/${s}/snap/step-03`]));
  const kept = [...new Set([...one.cases, ...two.cases].filter((c) => c.source === 'kept').map((c) => c.sessions![0]!))].sort();
  extract(one.keptFrom!.commit, kept.flatMap((s) => [`${KEPT_SESSIONS}/${s}/snap/step-00`, `${KEPT_SESSIONS}/${s}/snap/step-03`]));
  const at = (c: Case, set: SetName): GateCase => {
    if (c.source === 'pilot') return { c, set, tree: path.join(scratch, PILOT_SESSIONS, c.session!, 'snap', c.step!), baseline: path.join(scratch, PILOT_SESSIONS, c.session!, 'snap', 'step-00') };
    if (c.source === 'kept') return { c, set, tree: path.join(scratch, KEPT_SESSIONS, c.sessions![0]!, 'snap', c.step!), baseline: path.join(scratch, KEPT_SESSIONS, c.sessions![0]!, 'snap', 'step-00') };
    return { c, set, tree: c.tree!, ...(c.baseline !== undefined ? { baseline: c.baseline } : {}) };
  };
  return [
    ...own.cases.map((c) => at(c, c.source === 'pilot' && c.label === 'positive' ? 'dev' : c.source === 'built' ? 'fresh' : 'extra')),
    ...two.cases.map((c) => at(c, 'sem-gate-2')),
    ...one.cases.map((c) => at(c, 'sem-gate')),
  ];
}
