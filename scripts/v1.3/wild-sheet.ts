/**
 * v1.3 real-world ("wild") evidence run: aggregation and the human review sheet (Docs/DiagnosticRuns/v1.3-wild-2026-10-16.md).
 * Reads results/v1.3-wild/{selection.json, repos/<id>/*, fidelity/<id>/*} and the clones (for code excerpts). Entry
 * file: no exports.
 *
 * Usage (repository root): node --import tsx scripts/v1.3/wild-sheet.ts --repos <clones dir> [--seed 20261016]
 * Writes results/v1.3-wild/summary.json, review-sheet.md (unlabelled candidates, no rule ids) and review-key.json
 * (item id → APG v2 template or cheap proxy, with the source row).
 *
 * Sampling: per APG v2 template and per cheap proxy, the pool is every row or flag of every repository (repository,
 * file, line, JSON order); `diverseSample` takes up to 5 with `mulberry32(seed + index of the rule)`, spreading over
 * repositories first. The items are then shuffled with `mulberry32(seed)` and numbered W01.., so the sheet's order
 * says nothing about the rule.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { APG2_IN_MEMORY } from '../../src/fitness-compiler/apg2-in-memory.js';
import { PROXY_IDS } from '../../src/apg-enrich/cheap/types.js';
import { mulberry32, seededSample } from './lib/graph-fidelity.js';
import { apg2Claim, cell, cheapClaim, diverseSample, excerpt } from './lib/wild.js';

const REPO = process.cwd();
const OUT = path.join(REPO, 'results/v1.3-wild');
const PER_RULE = 5;

type Json = Record<string, unknown>;
interface Sel { id: string; repo: string; sha: string; root: string; styleGroup: string; ownDescription: string }
interface Item { rule: string; family: 'apg2' | 'cheap'; repo: string; file: string; line: number; claim: string; source: Json; related?: { file: string; line: number } }

const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;
const opt = <T>(p: string): T | undefined => (fs.existsSync(p) ? readJson<T>(p) : undefined);
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function cheapFlags(dir: string, cheap: Json): Json[] {
  if (Array.isArray(cheap.flags)) return cheap.flags as Json[];
  if (typeof cheap.flagsFile === 'string') return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, cheap.flagsFile))).toString('utf8')) as Json[];
  return [];
}

function main(): void {
  const reposDir = path.resolve(arg('repos') ?? '');
  const seed = Number(arg('seed') ?? 20261016);
  const sel = readJson<{ entries: Sel[] }>(path.join(OUT, 'selection.json')).entries;
  const templates = [...APG2_IN_MEMORY.keys()];
  const proxies = PROXY_IDS.filter((p) => p !== 'doc-text');

  const pools = new Map<string, Item[]>();
  for (const r of [...templates, ...proxies]) pools.set(r, []);
  const perRepo: Json[] = [];
  for (const e of sel) {
    const dir = path.join(OUT, 'repos', e.id);
    const ise = opt<Json>(path.join(dir, 'ise.json'));
    const apg2 = opt<Json>(path.join(dir, 'apg2.json'));
    const cheap = opt<Json>(path.join(dir, 'cheap.json'));
    const cost = opt<Json>(path.join(dir, 'cost.json'));
    const err = opt<Json>(path.join(dir, 'error.json'));
    const fid = opt<Json>(path.join(OUT, 'fidelity', e.id, 'projects', `${e.id}.json`));
    const fidCost = opt<Json>(path.join(OUT, 'fidelity', e.id, 'cost.json'));
    const harness = opt<Json>(path.join(dir, 'harness.json'));
    const rows = (apg2?.rows ?? {}) as Record<string, Json[]>;
    for (const t of templates) {
      for (const row of rows[t] ?? []) {
        const file = typeof row._file === 'string' ? row._file : '';
        if (file === '') continue;
        pools.get(t)!.push({ rule: t, family: 'apg2', repo: e.id, file, line: Number(row._line ?? 0), claim: apg2Claim(t, row), source: row });
      }
    }
    const flags = cheap !== undefined ? cheapFlags(dir, cheap) : [];
    for (const f of flags) {
      const ev = f.evidence as { file: string; startLine: number };
      const rel = f.related as { file: string; startLine: number } | undefined;
      const claim = cheapClaim(f as unknown as Parameters<typeof cheapClaim>[0]);
      pools.get(String(f.proxy))?.push({ rule: String(f.proxy), family: 'cheap', repo: e.id, file: ev.file, line: ev.startLine, claim, source: f, ...(rel !== undefined ? { related: { file: rel.file, line: rel.startLine } } : {}) });
    }
    const counts = (apg2?.counts ?? {}) as Record<string, number>;
    const seen = (t: string, flag = '_importGraphSees'): { total: number; invisible: number } => {
      const list = rows[t] ?? [];
      return { total: list.length, invisible: list.filter((r) => r[flag] === false).length };
    };
    const clonePairs = flags.filter((f) => f.proxy === 'clones' || f.proxy === 'shared-literals');
    perRepo.push({
      id: e.id, styleGroup: e.styleGroup, ownDescription: e.ownDescription,
      harness: harness !== undefined ? { sourceFiles: harness.sourceFiles, notes: harness.notes } : null,
      error: err?.error ?? null,
      ise: ise !== undefined ? { style: ise.style, confidence: ise.confidence, runnerUp: (ise.ranked as Json[])[1] ?? null, evidence: (ise.ranked as Json[])[0]?.evidence ?? [], specValid: ise.specValid, layers: [...new Set(((ise.mapping as Json).units as Json[]).map((u) => u.layer))].filter((l) => l !== null) } : null,
      apg2: apg2 !== undefined ? { counts, stats: apg2.stats, components: (apg2.components as Json[]).length, parseCoverage: apg2.parseCoverage } : null,
      cheap: cheap !== undefined ? { counts: cheap.counts, kinds: cheap.kinds, failures: (cost?.failures ?? []) } : null,
      importGraphInvisible: apg2 !== undefined ? {
        'boundary-type-leak': seen('boundary-type-leak'),
        'undeclared-async-coupling': seen('undeclared-async-coupling'),
        'io-outside-adapters': seen('io-outside-adapters'),
        'nondeterminism-in-core': seen('nondeterminism-in-core'),
        'cross-component clone/literal pairs': { total: clonePairs.length, invisible: clonePairs.filter((f) => f._importGraphSees === false).length },
      } : null,
      fidelity: fid !== undefined ? { ok: fid.ok, error: fid.error ?? null, files: (fid.meta as Json).files, tsc: { unresolved: ((fid.meta as Json).tsc as Json).unresolved }, depcruiseError: (fid.meta as Json).depcruiseError ?? null, agreement: fid.agreement, classes: fid.classes } : null,
      cost: {
        analyse: cost !== undefined ? { wallMs: cost.wallMs, peakRssMb: cost.peakRssMb, files: cost.files, nodes: cost.nodes, edges: cost.edges } : null,
        fidelity: fidCost !== undefined ? { wallMs: fidCost.wallMs, peakRssMb: fidCost.peakRssMb, exit: fidCost.exit } : null,
      },
    });
  }

  // Sample per rule, then shuffle all items.
  const rules = [...templates, ...proxies];
  const picked: Item[] = [];
  rules.forEach((r, i) => {
    const pool = pools.get(r)!.sort((a, b) => (a.repo + '\t' + a.file + '\t' + String(a.line).padStart(6, '0') + JSON.stringify(a.source) < b.repo + '\t' + b.file + '\t' + String(b.line).padStart(6, '0') + JSON.stringify(b.source) ? -1 : 1));
    picked.push(...diverseSample(pool, PER_RULE, mulberry32(seed + i + 1), (x) => x.repo));
  });
  const items = seededSample(picked, picked.length, mulberry32(seed)).map((it, i) => ({ id: `W${String(i + 1).padStart(2, '0')}`, ...it }));

  const shaOf = new Map(sel.map((e) => [e.id, e]));
  const read = (repo: string, file: string): string => {
    const e = shaOf.get(repo)!;
    const p = path.join(reposDir, repo, e.root, file);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  };
  const md: string[] = [
    '# v1.3 wild run: candidates for human review',
    '',
    `Generated by \`scripts/v1.3/wild-sheet.ts\` (seed ${String(seed)}). Each row is an **unlabelled candidate** produced by one of the tool's detectors on a public repository at a pinned commit (\`results/v1.3-wild/selection.json\`). The detector is hidden on purpose (\`review-key.json\` maps item ids to detectors); judge the claim against the code only.`,
    '',
    'Verdict values: `TP` (the claim is true and is an architectural concern worth a reviewer\'s attention), `TRUE-BENIGN` (the claim is factually true but not a concern here), `FP` (the claim is false), `?` (cannot tell from the code). Excerpts have comments stripped; line numbers are the file\'s own; `>` marks the cited line.',
    '',
    '| id | repo | location | claim | verdict | note |',
    '|---|---|---|---|---|---|',
    ...items.map((it) => `| ${it.id} | ${it.repo} | \`${it.file}:${String(it.line)}\` | ${cell(it.claim)} |  |  |`),
    '',
    '## Excerpts',
    '',
  ];
  for (const it of items) {
    const e = shaOf.get(it.repo)!;
    const url = `https://github.com/${e.repo}/blob/${e.sha}/${e.root === '.' ? '' : `${e.root}/`}${it.file}#L${String(Math.max(1, it.line))}`;
    md.push(`### ${it.id}: ${it.repo} \`${it.file}:${String(it.line)}\``, '', `Claim: ${it.claim}`, '', `Source: ${url}`, '', '```ts', excerpt(read(it.repo, it.file), Math.max(1, it.line)), '```', '');
    if (it.related !== undefined) md.push(`Other end \`${it.related.file}:${String(it.related.line)}\`:`, '', '```ts', excerpt(read(it.repo, it.related.file), Math.max(1, it.related.line)), '```', '');
    const ev = it.source._evidence;
    if (Array.isArray(ev)) {
      for (const x of (ev as { file: string; target: string; line: number }[]).slice(1)) {
        md.push(`Further import \`${x.file}:${String(x.line)}\` → \`${x.target}\`:`, '', '```ts', excerpt(read(it.repo, x.file), Math.max(1, x.line), 0, 0, 1), '```', '');
      }
    } else if (ev !== undefined && typeof ev === 'object') {
      md.push(`Component files: ${String((ev as Json).files)} (first: ${((ev as Json).sample as string[]).map((f) => `\`${f}\``).join(', ')})`, '');
    }
  }
  fs.writeFileSync(path.join(OUT, 'review-sheet.md'), md.join('\n'));
  fs.writeFileSync(path.join(OUT, 'review-key.json'), JSON.stringify({
    seed, perRule: PER_RULE, note: 'Key to review-sheet.md: do not open before judging the sheet.',
    poolSizes: Object.fromEntries(rules.map((r) => [r, pools.get(r)!.length])),
    items: items.map((it) => ({ id: it.id, family: it.family, rule: it.rule, kind: it.source.kind ?? null, repo: it.repo, file: it.file, line: it.line, source: it.source })),
  }, null, 1) + '\n');

  // Totals.
  const sum = (f: (r: Json) => Record<string, number> | undefined): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const r of perRepo) for (const [k, v] of Object.entries(f(r) ?? {})) out[k] = (out[k] ?? 0) + v;
    return out;
  };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({
    seed, repos: perRepo.length,
    totals: {
      apg2: sum((r) => (r.apg2 as Json | null)?.counts as Record<string, number> | undefined),
      cheap: sum((r) => (r.cheap as Json | null)?.counts as Record<string, number> | undefined),
      cheapKinds: sum((r) => (r.cheap as Json | null)?.kinds as Record<string, number> | undefined),
    },
    review: { items: items.length, poolSizes: Object.fromEntries(rules.map((r) => [r, pools.get(r)!.length])) },
    perRepo,
  }, null, 1) + '\n');
  process.stdout.write(`${String(items.length)} review items; pools ${JSON.stringify(Object.fromEntries(rules.map((r) => [r, pools.get(r)!.length])))}\n`);
}

main();
