/**
 * TIER-A2 item 5 (C1e/C5): re-score N123, the one-year survival of blocking findings in the fix-mining histories,
 * with the G08 violation identity (`ops/notes/g08-violation-identity.md` §2.2): a rename continues a violation instead
 * of ending it. Zero model calls, no Neo4j, local git only.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/tier-a/n123-rename-rescore.ts --collect <clonesDir>   # step 1: ρ between grid points (git)
 *   npx tsx scripts/v1.4/tier-a/n123-rename-rescore.ts                          # step 2: re-score from committed data
 *
 * Step 1 needs one clone per corpus entry at `<clonesDir>/<id>` (a blob-less clone is enough; git fetches the blobs
 * rename detection needs). For each pair of consecutive *valid* grid points it runs the walkers' own command,
 * `git diff --name-status -M50% -l5000 <a> <b> -- <historyPath>` (`renameMapBetween`, `scripts/lib/drift/git-rename.ts`),
 * one diff between the two grid points, never composed per commit (G08 §2.2). It writes
 * results/v1.4-tier-a/item05-rename-maps.json.gz.
 *
 * Step 2 reads results/v1.3-fixes-mined/{corpus.json, repos/<id>/{lineages,pairs}.json.gz} and the maps, and stitches
 * the committed grid lineages: a lineage that ends at grid point j continues as the lineage born at j whose key equals
 * its key with ρ applied (`mapFinding` + `fineKey` of `scripts/lib/drift/identity.ts`; for an unflagged edge `s|t`,
 * `ρ(s)|ρ(t)`). A born-at-j lineage is claimed at most once, by the earliest-born predecessor, ties to the smaller key
 * (G08 §2.3, §2.4). The unflagged-edge baseline is stitched the same way, so both sides of the comparison lose the
 * rename bias. Survival is then the published `survival()` (`scripts/lib/drift/metrics.ts`), unchanged.
 * Writes results/v1.4-tier-a/item05-n123-rescore.json: per group, old (rename ends) vs new (rename continues), KM
 * S(365) with a Greenwood log-log 95% interval and a repository-cluster bootstrap interval (2,000 resamples, seed
 * 20261019), under the published left-censoring (`grid-index-0`) and the S1 sensitivity (`first-valid`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { canonicalize } from '../../lib/canonical-json.js';
import { renameMapBetween } from '../../lib/drift/git-rename.js';
import {
  forEachMinedRepo, kmRow, poolSamples, survival, SURVIVAL_GROUPS_5A, SURVIVAL_GROUPS_C5,
  type MinedRepo, type SurvivalSample,
} from '../../lib/drift/metrics.js';
import { clusterBootstrap, seededRandom } from '../../v1.3/lib/fixes-mined.js';
import { kmGreenwood365, stitch, type MapTransition, type StitchStats } from './lib/n123-stitch.js';

const MINED = 'results/v1.3-fixes-mined';
const OUT = 'results/v1.4-tier-a';
const MAPS = path.join(OUT, 'item05-rename-maps.json.gz');
const SEED = 20261019;
const REPS = 2000;

interface CorpusRow { id: string; url: string; sha: string; root: string; historyPath?: string }
type MapFile = Record<string, MapTransition[]>;

// ── Step 1: rename maps ─────────────────────────────────────────────────────

function collect(clonesDir: string): void {
  const corpus = (JSON.parse(fs.readFileSync(path.join(MINED, 'corpus.json'), 'utf8')) as { entries: CorpusRow[] }).entries;
  const out: MapFile = {};
  forEachMinedRepo(MINED, (r) => {
    const e = corpus.find((c) => c.id === r.entry.id);
    if (e === undefined) throw new Error(`no corpus row for ${r.entry.id}`);
    const clone = path.join(clonesDir, e.id);
    const hp = e.historyPath ?? e.root;
    const ts: MapTransition[] = [];
    let prev: number | null = null;
    r.ok.forEach((ok, i) => {
      if (!ok) return;
      if (prev !== null) {
        const a = r.grid[prev]?.sha ?? '';
        const b = r.grid[i]?.sha ?? '';
        const rb = renameMapBetween(clone, a, b, hp, e.root);
        ts.push({ from: prev, to: i, rename: [...rb.rename].sort((x, y) => (x[0] < y[0] ? -1 : 1)), skipped: rb.renameDetection === 'skipped' });
      }
      prev = i;
    });
    out[e.id] = ts;
    process.stderr.write(`${e.id}: ${ts.length} transitions, ${ts.reduce((s, t) => s + t.rename.length, 0)} renames\n`);
  });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(MAPS, zlib.gzipSync(Buffer.from(canonicalize(out)), { level: 9 }));
}

const r4 = (x: number): number => Number(x.toFixed(4));

function main(): void {
  const ci = process.argv.indexOf('--collect');
  if (ci >= 0) { collect(process.argv[ci + 1] ?? ''); return; }
  const maps = JSON.parse(zlib.gunzipSync(fs.readFileSync(MAPS)).toString('utf8')) as MapFile;
  const groups = [...SURVIVAL_GROUPS_5A, ...SURVIVAL_GROUPS_C5];
  const modes = ['grid-index-0', 'first-valid'] as const;
  // per mode, per policy, per group: one sample per repository (the bootstrap clusters).
  const perRepo: Record<string, SurvivalSample[]> = {};
  const repoStats: Record<string, StitchStats & { renames: number; transitions: number }> = {};
  const push = (k: string, s: SurvivalSample): void => { (perRepo[k] ??= []).push(s); };
  forEachMinedRepo(MINED, (r: MinedRepo) => {
    const m = maps[r.entry.id];
    if (m === undefined) throw new Error(`no rename map for ${r.entry.id}`);
    const st = stitch(r.lineages, m);
    repoStats[r.entry.id] = { ...st.stats, renames: m.reduce((s, t) => s + t.rename.length, 0), transitions: m.length };
    for (const mode of modes) {
      for (const [policy, ls] of [['end', r.lineages], ['continue', st.lineages]] as const) {
        for (const g of groups) push(`${mode}|${policy}|${g.name}`, survival(ls, r.grid, g.pick, r.capped, { leftCensor: mode, firstValid: r.firstValid }));
      }
    }
  });
  const rows: unknown[] = [];
  for (const mode of modes) {
    for (const g of groups) {
      const row: Record<string, unknown> = { group: g.name, leftCensor: mode };
      for (const policy of ['end', 'continue'] as const) {
        const xs = perRepo[`${mode}|${policy}|${g.name}`] ?? [];
        const pooled = poolSamples(xs);
        const km = kmRow(pooled);
        const gw = kmGreenwood365(pooled.obs);
        const boot = clusterBootstrap(xs, (cs) => kmGreenwood365(poolSamples(cs).obs).s365, REPS, seededRandom(SEED));
        row[policy] = { n: km.n, ended: km.ended, median: km.median, s365: r4(gw.s365), greenwood95: [r4(gw.lo), r4(gw.hi)], repoBootstrap95: [r4(boot.lo), r4(boot.hi)], inPlacePct: km.inPlacePct };
      }
      rows.push(row);
    }
  }
  // the N123 contrast: blocking edge-shaped without FF-S02 minus unflagged cross-layer, with a paired cluster bootstrap.
  const contrast: Record<string, unknown> = {};
  for (const mode of modes) {
    for (const policy of ['end', 'continue'] as const) {
      const a = perRepo[`${mode}|${policy}|blocking, edge-shaped, without FF-S02 cycles`] ?? [];
      const b = perRepo[`${mode}|${policy}|unflagged cross-layer import edges`] ?? [];
      const idx = a.map((_, i) => i);
      const diff = (is: readonly number[]): number => kmGreenwood365(poolSamples(is.map((i) => a[i] as SurvivalSample)).obs).s365 - kmGreenwood365(poolSamples(is.map((i) => b[i] as SurvivalSample)).obs).s365;
      const boot = clusterBootstrap(idx, diff, REPS, seededRandom(SEED));
      contrast[`${mode}|${policy}`] = { blockingNoCyclesMinusCrossLayer: r4(diff(idx)), repoBootstrap95: [r4(boot.lo), r4(boot.hi)] };
    }
  }
  const tot = Object.values(repoStats).reduce((s, x) => ({
    renames: s.renames + x.renames, transitions: s.transitions + x.transitions, skippedTransitions: s.skippedTransitions + x.skippedTransitions,
    endingsSeen: s.endingsSeen + x.endingsSeen, stitched: s.stitched + x.stitched, unparsed: s.unparsed + x.unparsed,
    blockingEndings: s.blockingEndings + x.blockingEndings, blockingStitched: s.blockingStitched + x.blockingStitched,
  }), { renames: 0, transitions: 0, skippedTransitions: 0, endingsSeen: 0, stitched: 0, unparsed: 0, blockingEndings: 0, blockingStitched: 0 });
  const out = {
    item: 'TIER-A2 item 5: N123 re-scored with the G08 rename continuation',
    sources: { lineages: `${MINED}/repos/<id>/lineages.json.gz`, pairs: `${MINED}/repos/<id>/pairs.json.gz`, renameMaps: MAPS, identity: 'ops/notes/g08-violation-identity.md §2.2' },
    params: { renameCommand: 'git diff --name-status -M50% -l5000 <grid a> <grid b> -- <historyPath>', bootstrap: { reps: REPS, seed: SEED, cluster: 'repository' }, km: 'Kaplan-Meier, S(365) with Greenwood log-log 95% interval', policies: { end: 'rename ends the lineage (published N123)', continue: 'rename continues the lineage (G08)' } },
    totals: tot,
    perRepo: repoStats,
    rows,
    contrast,
  };
  fs.writeFileSync(path.join(OUT, 'item05-n123-rescore.json'), `${JSON.stringify(JSON.parse(canonicalize(out)), null, 1)}\n`);
  for (const row of rows as Record<string, Record<string, unknown>>[]) process.stdout.write(`${String(row.leftCensor)} | ${String(row.group)} | end ${JSON.stringify(row.end)} | continue ${JSON.stringify(row.continue)}\n`);
  process.stdout.write(`${JSON.stringify(contrast)}\n${JSON.stringify(tot)}\n`);
}

main();
