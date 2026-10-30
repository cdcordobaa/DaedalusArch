/**
 * Session trees for the results commit (`run-study.ts --keep-trees`; RUNBOOK §2.6). The first final study kept no
 * trees (DEV-2), so nothing could be re-scored at a later instrument. This copies every session's step snapshots
 * (`<outRoot>/sessions/<id>/snap/step-00..n`, the driver's own copies) and its `session.json` to
 * `<resultsDir>/sessions/<id>/`, and checks before anything is written that:
 * - every step snapshot after the seed rebuilds to the tree sha256 the driver recorded (`session.json` steps);
 * - no file of a snapshot holds an isolation canary.
 * Prompts and envelopes are not copied. Zero calls.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

const sha256 = (b: string | Buffer): string => createHash('sha256').update(b).digest('hex');

/** A tree's files (no top-level `node_modules`), sorted POSIX paths: the driver's `filesOf`. */
function filesOf(dir: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (rel === '' && e.name === 'node_modules') continue;
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) walk(r);
      else if (e.isFile()) out.push(r);
    }
  };
  walk('');
  return out.sort();
}
/** The driver's tree hash (`treeSha` of `experiments/puzzle-01-baseline/run-baseline.ts`). */
export const treeSha = (dir: string): string => sha256(`${filesOf(dir).map((f) => `${f}\t${sha256(fs.readFileSync(path.join(dir, f)))}`).join('\n')}\n`);

export interface KeptSession { readonly id: string; readonly steps: number; readonly files: number }

export function keepSessionTrees(outRoot: string, resultsDir: string, canaries: readonly string[] = []): KeptSession[] {
  const src = path.join(outRoot, 'sessions');
  const ids = fs.existsSync(src) ? fs.readdirSync(src).filter((d) => fs.existsSync(path.join(src, d, 'session.json'))).sort() : [];
  const plan: { id: string; snaps: string[]; files: number }[] = [];
  for (const id of ids) {
    const sess = JSON.parse(fs.readFileSync(path.join(src, id, 'session.json'), 'utf8')) as { steps?: { step: string; treeSha256?: string }[] };
    const snapRoot = path.join(src, id, 'snap');
    const snaps = fs.existsSync(snapRoot) ? fs.readdirSync(snapRoot).filter((d) => /^step-\d\d$/.test(d)).sort() : [];
    let files = 0;
    for (const st of sess.steps ?? []) {
      if (st.treeSha256 === undefined) continue;
      const dir = path.join(snapRoot, st.step);
      if (!fs.existsSync(dir)) throw new Error(`${id} ${st.step}: snapshot missing`);
      if (treeSha(dir) !== st.treeSha256) throw new Error(`${id} ${st.step}: snapshot does not match the recorded tree sha256`);
    }
    for (const s of snaps) {
      for (const f of filesOf(path.join(snapRoot, s))) {
        files++;
        if (canaries.length === 0) continue;
        const body = fs.readFileSync(path.join(snapRoot, s, f), 'utf8');
        if (canaries.some((c) => c !== '' && body.includes(c))) throw new Error(`${id} ${s}: a snapshot file holds an isolation canary (${f})`);
      }
    }
    plan.push({ id, snaps, files });
  }
  for (const p of plan) {
    const to = path.join(resultsDir, 'sessions', p.id);
    fs.rmSync(to, { recursive: true, force: true });
    fs.mkdirSync(to, { recursive: true });
    for (const s of p.snaps) {
      const from = path.join(src, p.id, 'snap', s);
      for (const f of filesOf(from)) {
        const dst = path.join(to, 'snap', s, f);
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(path.join(from, f), dst);
      }
    }
    fs.copyFileSync(path.join(src, p.id, 'session.json'), path.join(to, 'session.json'));
  }
  return plan.map((p) => ({ id: p.id, steps: p.snaps.length, files: p.files }));
}
