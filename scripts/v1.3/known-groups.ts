/**
 * v1.3 known-groups and discriminant validity (plan: Docs/DiagnosticRuns/v1.3-known-groups-plan.md; report:
 * Docs/DiagnosticRuns/v1.3-known-groups-2026-10-16.md). No Neo4j, no LLM. Entry file: no exports.
 *
 * Usage (repository root):
 *   node --import tsx scripts/v1.3/known-groups.ts sizes   --clones <scratch dir> [--external-ref origin/v1.3-external-set]
 *   node --import tsx scripts/v1.3/known-groups.ts analyse [--external-ref origin/v1.3-external-set]
 * `sizes` clones each pinned SHA (blobless, sparse `<root>/src`) under `--clones` and writes
 * results/v1.3-known-groups/sizes.json. `analyse` joins the sizes with the committed reports and writes
 * results/v1.3-known-groups/{analysis.json, per-repo.csv, scatter-*.svg}.
 *
 * The external set (PR #133) is read from its branch with `git show <ref>:<path>` (not merged), the wild set (PR #114)
 * from the working tree.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { cliffsDelta } from '../lib/stats.js';
import {
  countsAsSource, exactPermutation, exactStratifiedPermutation, groupOf, knownGroupsEffect, nonBlankLines,
  readKnownGroups, spearmanBootstrap, type Group,
} from './lib/known-groups.js';

const OUT = 'results/v1.3-known-groups';
const SEED = 20261016;
const RESAMPLES = 10_000;

interface Entry {
  readonly id: string; readonly repo: string; readonly url: string; readonly sha: string; readonly root: string;
  readonly style?: string; readonly styleGroup?: string; readonly styleClaim?: string; readonly ownDescription?: string;
  readonly srcTsFiles?: number;
}
type SetName = 'external' | 'wild';

/** Primary-rule groups fixed in plan §2; the script stops if the code disagrees. */
const PLAN_SHOWCASE: Record<SetName, readonly string[]> = {
  external: ['luizomf-clean-api', 'w3tec-express-boilerplate', 'vivify-nestjs-boilerplate', 'ddialar-hexagonal-boilerplate', 'event-sourcing-ddd'],
  wild: ['awesome-nest-boilerplate', 'ts-express-starter-prisma', 'mikro-orm-realworld'],
};

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const externalRef = arg('external-ref', 'origin/v1.3-external-set') as string;

function readExternal(rel: string): string {
  return execFileSync('git', ['show', `${externalRef}:results/v1.3-external/${rel}`], { encoding: 'utf8', maxBuffer: 1 << 28 });
}
function readWild(rel: string): string {
  return fs.readFileSync(path.join('results/v1.3-wild', rel), 'utf8');
}
function selection(set: SetName): Entry[] {
  const raw = set === 'external' ? readExternal('selection.json') : readWild('selection.json');
  return (JSON.parse(raw) as { entries: Entry[] }).entries;
}
const writeJson = (p: string, v: unknown): void => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 1) + '\n');
};

function groups(_set: SetName, entries: readonly Entry[], rule: 'name' | 'description'): Group[] {
  return entries.map((e) => groupOf([e.id, e.repo, e.url, ...(rule === 'description' ? [e.styleClaim, e.ownDescription] : [])]));
}

// ------------------------------------------------------------------------------------------------ sizes

function git(cwd: string, ...args: string[]): void {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${r.stderr}`);
}

function walk(dir: string, rel = ''): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel === '' ? d.name : `${rel}/${d.name}`;
    if (d.isDirectory()) out.push(...walk(path.join(dir, d.name), r));
    else if (d.isFile()) out.push(r);
  }
  return out;
}

function sizes(): void {
  const clones = arg('clones');
  if (clones === undefined) throw new Error('--clones <dir> is required');
  const rows: Record<string, unknown>[] = [];
  for (const set of ['external', 'wild'] as const) {
    for (const e of selection(set)) {
      const dir = path.resolve(clones, set, e.id);
      const src = e.root === '.' ? 'src' : `${e.root}/src`;
      if (!fs.existsSync(path.join(dir, '.git'))) {
        fs.mkdirSync(dir, { recursive: true });
        git(dir, 'init', '-q');
        git(dir, 'remote', 'add', 'origin', e.url);
        git(dir, 'sparse-checkout', 'set', '--no-cone', `/${src}/`);
        git(dir, 'fetch', '-q', '--depth', '1', '--filter=blob:none', 'origin', e.sha);
        git(dir, 'checkout', '-q', e.sha);
      }
      const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
      const files = walk(path.join(dir, src)).filter(countsAsSource).sort();
      const loc = files.reduce((s, f) => s + nonBlankLines(fs.readFileSync(path.join(dir, src, f), 'utf8')), 0);
      rows.push({ set, id: e.id, sha: head, src, files: files.length, loc, selectionSrcTsFiles: e.srcTsFiles ?? null });
      process.stdout.write(`${set} ${e.id}: ${String(files.length)} files, ${String(loc)} LOC\n`);
      if (head !== e.sha) throw new Error(`${e.id}: checked out ${head}, expected ${e.sha}`);
    }
  }
  writeJson(path.join(OUT, 'sizes.json'), {
    date: '2026-10-16',
    rule: '<root>/src/**/*.ts minus *.d.ts, *.spec.ts, *.test.ts and __tests__/test/tests segments; LOC = non-blank lines',
    rows,
  });
}

// ------------------------------------------------------------------------------------------------ analyse

interface Violation { readonly functionId: string }
interface TierRule { readonly functionId: string }
interface Report {
  readonly violations: readonly Violation[];
  readonly tiers: { readonly blocking: { readonly rules: readonly TierRule[] }; readonly advisory: { readonly rules: readonly TierRule[] } };
}

interface Row {
  readonly set: SetName; readonly id: string; readonly style: string; readonly group: Group; readonly groupDesc: Group;
  readonly files: number; readonly loc: number; readonly measures: Record<string, number>;
}

const C_RULES = /^FF-C0[1-6]$/;

function externalMeasures(id: string): Record<string, number> {
  const r = JSON.parse(readExternal(`findings/${id}.json`)) as Report;
  const blocking = new Set(r.tiers.blocking.rules.map((t) => t.functionId));
  const advisory = new Set(r.tiers.advisory.rules.map((t) => t.functionId));
  let B = 0; let A = 0; let C = 0; let CV05 = 0;
  for (const v of r.violations) {
    if (blocking.has(v.functionId)) B += 1;
    else if (advisory.has(v.functionId)) A += 1;
    if (C_RULES.test(v.functionId)) C += 1;
    if (v.functionId === 'FF-CV05') CV05 += 1;
  }
  return { B, C, CV05, A };
}

function wildMeasures(id: string): Record<string, number> {
  const sum = (o: Record<string, number>): number => Object.values(o).reduce((s, x) => s + x, 0);
  const apg2 = JSON.parse(readWild(`repos/${id}/apg2.json`)) as { counts: Record<string, number> };
  const cheap = JSON.parse(readWild(`repos/${id}/cheap.json`)) as { counts: Record<string, number> };
  return { G: sum(apg2.counts), P: sum(cheap.counts) };
}

const r4 = (x: number): number => Math.round(x * 1e4) / 1e4;
const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
};

function knownGroups(rows: readonly Row[], measure: string, grp: (r: Row) => Group, strata?: (r: Row) => string): Record<string, unknown> {
  const v = rows.map((r) => r.measures[measure] as number);
  const g = rows.map(grp);
  const perm = exactPermutation(v, g);
  const delta = knownGroupsEffect(v, g);
  const app = v.filter((_, i) => g[i] === 'application');
  const show = v.filter((_, i) => g[i] === 'showcase');
  const out: Record<string, unknown> = {
    measure, nApplication: app.length, nShowcase: show.length,
    meanApplication: r4(app.reduce((s, x) => s + x, 0) / app.length), meanShowcase: r4(show.reduce((s, x) => s + x, 0) / show.length),
    medianApplication: r4(median(app)), medianShowcase: r4(median(show)),
    observedMeanDiff: r4(perm.observed), p: r4(perm.p), labelings: perm.labelings, atLeastAsExtreme: perm.atLeastAsExtreme,
    cliffsDelta: r4(delta), reading: readKnownGroups(perm.p, delta),
  };
  if (strata !== undefined) {
    const st = exactStratifiedPermutation(v, g, rows.map(strata));
    out['stratified'] = { p: r4(st.p), labelings: st.labelings, atLeastAsExtreme: st.atLeastAsExtreme };
  }
  return out;
}

function discriminant(rows: readonly Row[], measures: readonly string[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  let k = 0;
  for (const m of measures) {
    for (const size of ['loc', 'files'] as const) {
      const ci = spearmanBootstrap(rows.map((r) => r.measures[m] as number), rows.map((r) => r[size]), { seed: SEED + k, resamples: RESAMPLES });
      k += 1;
      out.push({ measure: m, size, rho: r4(ci.rho), lo: r4(ci.lo), hi: r4(ci.hi), resamples: ci.resamples, skipped: ci.skipped, seed: SEED + k - 1 });
    }
  }
  return out;
}

function scatter(file: string, title: string, rows: readonly Row[], measure: string): void {
  const W = 520; const H = 360; const L = 60; const B = 44; const T = 30; const R = 16;
  const xs = rows.map((r) => r.loc); const ys = rows.map((r) => r.measures[measure] as number);
  const xmax = Math.max(...xs) * 1.05 || 1; const ymax = Math.max(...ys) * 1.1 || 1;
  const px = (x: number): number => L + (x / xmax) * (W - L - R);
  const py = (y: number): number => H - B - (y / ymax) * (H - B - T);
  const pts = rows.map((r, i) => {
    const fill = r.group === 'showcase' ? '#d9822b' : '#2b6cb0';
    const shape = r.group === 'showcase'
      ? `<rect x="${(px(xs[i] as number) - 4).toFixed(1)}" y="${(py(ys[i] as number) - 4).toFixed(1)}" width="8" height="8" fill="${fill}"/>`
      : `<circle cx="${px(xs[i] as number).toFixed(1)}" cy="${py(ys[i] as number).toFixed(1)}" r="4.5" fill="${fill}"/>`;
    return `${shape}<title>${r.id}: LOC ${String(r.loc)}, ${measure} ${String(r4(ys[i] as number))}</title>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(W)}" height="${String(H)}" font-family="sans-serif" font-size="11">
<rect width="100%" height="100%" fill="#fff"/>
<text x="${String(L)}" y="18" font-size="13">${title}</text>
<line x1="${String(L)}" y1="${String(H - B)}" x2="${String(W - R)}" y2="${String(H - B)}" stroke="#333"/>
<line x1="${String(L)}" y1="${String(T)}" x2="${String(L)}" y2="${String(H - B)}" stroke="#333"/>
<text x="${String((W + L) / 2)}" y="${String(H - 10)}" text-anchor="middle">LOC (non-blank, src/**/*.ts) — max ${String(Math.round(xmax))}</text>
<text x="14" y="${String((H - B + T) / 2)}" transform="rotate(-90 14 ${String((H - B + T) / 2)})" text-anchor="middle">${measure} — max ${String(r4(ymax))}</text>
<text x="${String(W - R - 150)}" y="${String(T + 10)}"><tspan fill="#2b6cb0">● application</tspan>  <tspan fill="#d9822b">■ showcase</tspan></text>
${pts.join('\n')}
</svg>
`;
  fs.writeFileSync(path.join(OUT, file), svg);
}

function analyse(): void {
  const sz = JSON.parse(fs.readFileSync(path.join(OUT, 'sizes.json'), 'utf8')) as { rows: { set: SetName; id: string; files: number; loc: number; selectionSrcTsFiles: number | null }[] };
  const sizeOf = new Map(sz.rows.map((r) => [`${r.set}/${r.id}`, r]));
  const rows: Row[] = [];
  const groupCheck: Record<string, unknown> = {};
  for (const set of ['external', 'wild'] as const) {
    const entries = selection(set);
    const gName = groups(set, entries, 'name');
    const gDesc = groups(set, entries, 'description');
    const showcase = entries.filter((_, i) => gName[i] === 'showcase').map((e) => e.id).sort();
    if (JSON.stringify(showcase) !== JSON.stringify([...PLAN_SHOWCASE[set]].sort())) {
      throw new Error(`${set}: name-rule groups ${showcase.join(',')} differ from the plan`);
    }
    groupCheck[set] = {
      showcaseByName: showcase,
      showcaseByDescription: entries.filter((_, i) => gDesc[i] === 'showcase').map((e) => e.id).sort(),
    };
    entries.forEach((e, i) => {
      const s = sizeOf.get(`${set}/${e.id}`);
      if (s === undefined) throw new Error(`no size for ${set}/${e.id}`);
      const base = set === 'external' ? externalMeasures(e.id) : wildMeasures(e.id);
      const kloc = s.loc / 1000;
      const per: Record<string, number> = { ...base };
      for (const [k, v] of Object.entries(base)) per[`${k}/KLOC`] = v / kloc;
      rows.push({ set, id: e.id, style: e.style ?? e.styleGroup ?? '', group: gName[i] as Group, groupDesc: gDesc[i] as Group, files: s.files, loc: s.loc, measures: per });
    });
  }
  const ext = rows.filter((r) => r.set === 'external');
  const wild = rows.filter((r) => r.set === 'wild');
  const descDiffers = (rs: readonly Row[]): boolean => rs.some((r) => r.group !== r.groupDesc);

  const result = {
    banner: 'Development-set, exploratory. Small n; groups from names; no causal reading. Status-quo scoring, no construct switch.',
    plan: 'Docs/DiagnosticRuns/v1.3-known-groups-plan.md', externalRef,
    externalCommit: execFileSync('git', ['rev-parse', externalRef], { encoding: 'utf8' }).trim(),
    seed: SEED, resamples: RESAMPLES, groupCheck,
    sizeCheck: ext.map((r) => ({ id: r.id, files: r.files, selectionSrcTsFiles: sizeOf.get(`external/${r.id}`)?.selectionSrcTsFiles })).filter((x) => x.files !== x.selectionSrcTsFiles),
    K1: knownGroups(ext, 'B/KLOC', (r) => r.group, (r) => r.style),
    K3: descDiffers(ext) ? knownGroups(ext, 'B/KLOC', (r) => r.groupDesc) : 'description rule gives the same groups as the name rule',
    K4: knownGroups(wild, 'G/KLOC', (r) => r.group),
    K4desc: descDiffers(wild) ? knownGroups(wild, 'G/KLOC', (r) => r.groupDesc) : 'description rule gives the same groups as the name rule',
    K2perStyle: [...new Set(ext.map((r) => r.style))].sort().map((s) => ({
      style: s,
      repos: ext.filter((r) => r.style === s).map((r) => ({ id: r.id, group: r.group, 'B/KLOC': r4(r.measures['B/KLOC'] as number) })),
    })),
    D1: discriminant(ext, ['B', 'B/KLOC', 'C', 'C/KLOC', 'CV05']),
    D2: discriminant(wild, ['G', 'G/KLOC', 'P', 'P/KLOC']),
    descriptiveDeltas: {
      'external C/KLOC': r4(cliffsDelta(ext.filter((r) => r.group === 'application').map((r) => r.measures['C/KLOC'] as number), ext.filter((r) => r.group === 'showcase').map((r) => r.measures['C/KLOC'] as number))),
    },
  };
  writeJson(path.join(OUT, 'analysis.json'), result);

  const keys = ['B', 'B/KLOC', 'C', 'C/KLOC', 'CV05', 'A', 'G', 'G/KLOC', 'P', 'P/KLOC'];
  const csv = [['set', 'id', 'style', 'groupName', 'groupDescription', 'files', 'loc', ...keys].join(',')];
  for (const r of rows) csv.push([r.set, r.id, r.style, r.group, r.groupDesc, r.files, r.loc, ...keys.map((k) => (r.measures[k] === undefined ? '' : String(r4(r.measures[k] as number))))].join(','));
  fs.writeFileSync(path.join(OUT, 'per-repo.csv'), csv.join('\n') + '\n');

  for (const m of ['B', 'B/KLOC', 'C', 'C/KLOC', 'CV05']) scatter(`scatter-external-${m.replace('/', '-per-')}.svg`, `External (n=15): ${m} vs LOC`, ext, m);
  for (const m of ['G', 'G/KLOC', 'P', 'P/KLOC']) scatter(`scatter-wild-${m.replace('/', '-per-')}.svg`, `Wild (n=14, exploratory): ${m} vs LOC`, wild, m);
  process.stdout.write(JSON.stringify({ K1: result.K1, K3: result.K3, K4: result.K4, K4desc: result.K4desc }, null, 1) + '\n');
}

const cmd = process.argv[2];
if (cmd === 'sizes') sizes();
else if (cmd === 'analyse') analyse();
else throw new Error('usage: known-groups.ts sizes --clones <dir> | analyse');
