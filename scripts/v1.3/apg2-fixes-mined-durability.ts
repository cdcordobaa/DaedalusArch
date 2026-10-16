/**
 * v1.3 APG v2 fixes-mined, post hoc durability check (Docs/DiagnosticRuns/v1.3-apg2-fixes-mined-2026-10-16.md §6):
 * of the credited removals at sampled pair i, how many reappear (same identity) at a later grid point (child snapshots
 * i+1..). A flag that comes back was not fixed; it flickered across a threshold (a near clone's similarity, a community
 * boundary). Reads the snapshot cache of the walk (scratch, never committed). Entry file: no exports.
 *
 * Usage: node --import tsx scripts/v1.3/apg2-fixes-mined-durability.ts --cache <dir> --repos <dir>
 * Writes results/v1.3-apg2-fixes-mined/durability.json.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { CREDITED, type ItemCause } from './lib/apg2-fixes-mined.js';

const REPO = process.cwd();
const OUT = path.join(REPO, 'results/v1.3-apg2-fixes-mined');
const readGz = <T>(p: string): T => JSON.parse(zlib.gunzipSync(fs.readFileSync(p)).toString('utf8')) as T;
const arg = (n: string): string | undefined => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };

interface Entry { id: string; root: string; tsconfig: string; historyPath?: string }
interface PairItem { key: string; rule: string; cause: ItemCause }
interface PairRecord { sha: string; parentOk: boolean; childOk: boolean; disappeared: PairItem[] }

const cache = path.resolve(arg('cache') ?? '');
const repos = path.resolve(arg('repos') ?? '');
const corpus = (JSON.parse(fs.readFileSync(path.join(REPO, 'results/v1.3-fixes-mined/corpus.json'), 'utf8')) as { entries: Entry[] }).entries;
const byRule: Record<string, { credited: number; reappear: number; lastPair: number }> = {};
for (const e of corpus) {
  const pf = path.join(OUT, 'repos', e.id, 'pairs.json.gz');
  if (!fs.existsSync(pf)) continue;
  const pairs = readGz<PairRecord[]>(pf);
  const hp = e.historyPath ?? e.root;
  const cfgPath = path.posix.join(e.root, e.tsconfig);
  const treeOf = (sha: string): string => {
    const g = (a: string[]): string => spawnSync('git', a, { cwd: path.join(repos, e.id), encoding: 'utf8' }).stdout.trim();
    const tree = g(['rev-parse', '-q', '--verify', `${sha}:${hp === '.' ? '' : hp}`]);
    if (tree === '') return 'absent';
    const cfg = g(['rev-parse', '-q', '--verify', `${sha}:${cfgPath}`]);
    return cfg === '' ? tree : `${tree}-${cfg.slice(0, 12)}`;
  };
  // Keys present at each later grid point, as a suffix union (key -> last grid index where present).
  const lastSeen = new Map<string, number>();
  pairs.forEach((p, i) => {
    const f = path.join(cache, e.id, `${treeOf(p.sha)}.json.gz`);
    if (!fs.existsSync(f)) return;
    const s = readGz<{ ok: boolean; items: { key: string }[] }>(f);
    if (!s.ok) return;
    for (const it of s.items) lastSeen.set(it.key, i);
  });
  pairs.forEach((p, i) => {
    if (!p.parentOk || !p.childOk) return;
    for (const d of p.disappeared) {
      if (!CREDITED.has(d.cause)) continue;
      const r = (byRule[d.rule] ??= { credited: 0, reappear: 0, lastPair: 0 });
      r.credited++;
      if (i === pairs.length - 1) r.lastPair++;
      if ((lastSeen.get(d.key) ?? -1) > i) r.reappear++;
    }
  });
}
fs.writeFileSync(path.join(OUT, 'durability.json'), JSON.stringify(byRule, null, 1) + '\n');
for (const [r, v] of Object.entries(byRule).sort()) process.stdout.write(`${r}\t${String(v.credited)}\t${String(v.reappear)}\t${(100 * v.reappear / v.credited).toFixed(1)}%\n`);
