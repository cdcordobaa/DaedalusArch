/**
 * DETECT-01 symbolic evaluator (exploratory, zero model calls, no Neo4j). Runs the experimental rules
 * (`rules/*.cypher`) on the in-process Cypher interpreter over the instrument's facts plus the experimental facts
 * (`lib/extract.ts`).
 *
 * Usage (repository root):
 *   npx tsx experiments/detect-01/evaluate.ts --fixtures                          # dev fixtures → results/fixtures.json
 *   npx tsx experiments/detect-01/evaluate.ts --trees <manifest.json> --out <name> # other trees → results/<name>.json
 *
 * A trees manifest is `[{ "label": "...", "path": "<abs dir with src/>", "style": "hexddd" | "layered" }]`. Absolute
 * paths are replaced by `<tree>` in the output.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { executeQuery, parseCypher } from '../../src/cypher-interp/index.js';
import { toDriver } from '../../src/cypher-interp/driver-values.js';
import { buildGraph, writeTsconfig } from './lib/extract.js';
import type { Style } from './lib/layers.js';

const HERE = 'experiments/detect-01';
const FIXTURES = path.join(HERE, 'fixtures');
const RESULTS = path.join(HERE, 'results');

export interface Rule {
  readonly id: string;
  readonly family: string;
  readonly title: string;
  readonly file: string;
  readonly text: string;
}

export interface Finding {
  readonly rule: string;
  readonly family: string;
  readonly file: string;
  readonly line: number | null;
  readonly subject: string;
  readonly evidence: string;
  readonly path: readonly string[];
}

export function loadRules(): Rule[] {
  const dir = path.join(HERE, 'rules');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.cypher')).sort().map((f) => {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    const meta = (k: string): string => new RegExp(`^// ${k}: (.*)$`, 'm').exec(text)?.[1]?.trim() ?? '';
    return { id: meta('id'), family: meta('family'), title: meta('title'), file: f, text };
  });
}

export async function runTree(tree: string, style: Style, rules: readonly Rule[], scratch: string): Promise<{ findings: Finding[]; stats: Record<string, number> }> {
  const tsconfig = writeTsconfig(tree, scratch);
  const { graph, stats } = await buildGraph(tree, tsconfig, style);
  const findings: Finding[] = [];
  for (const r of rules) {
    const out = executeQuery(parseCypher(r.text), graph, new Map());
    for (const row of out.rows) {
      const o: Record<string, unknown> = {};
      out.columns.forEach((c, i) => { o[c] = toDriver(row[i] ?? null); });
      const line = o.line;
      findings.push({
        rule: r.id, family: r.family, file: String(o.file), subject: String(o.subject), evidence: String(o.evidence),
        line: typeof line === 'number' ? line : typeof line === 'object' && line !== null && 'toNumber' in line ? (line as { toNumber(): number }).toNumber() : null,
        path: Array.isArray(o.path) ? (o.path as unknown[]).map(String) : [],
      });
    }
  }
  return { findings, stats };
}

interface FixtureMeta { readonly family: string | null; readonly case: string | number; readonly positive: string | null; readonly twin: string | null; readonly clean?: string }

async function fixtures(): Promise<number> {
  const rules = loadRules();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-01-'));
  const families = [...new Set(rules.map((r) => r.family))].sort();
  const rows: Record<string, unknown>[] = [];
  const flagged = new Map<string, Set<string>>(); // `${fixture}/${variant}` → families flagged
  for (const fx of fs.readdirSync(FIXTURES).filter((d) => fs.existsSync(path.join(FIXTURES, d, 'fixture.json'))).sort()) {
    const meta = JSON.parse(fs.readFileSync(path.join(FIXTURES, fx, 'fixture.json'), 'utf8')) as FixtureMeta;
    for (const variant of [meta.positive, meta.twin, meta.clean].filter((v): v is string => typeof v === 'string')) {
      const tree = path.resolve(FIXTURES, fx, variant);
      const { findings } = await runTree(tree, 'hexddd', rules, scratch);
      const expected = variant === meta.positive ? meta.family : null;
      flagged.set(`${fx}/${variant}`, new Set(findings.map((f) => f.family)));
      rows.push({ fixture: fx, variant, case: meta.case, expectedFamily: expected, findings });
      process.stdout.write(`${fx}/${variant}: ${findings.map((f) => `${f.rule}@${f.file}:${f.line ?? '?'}`).join(', ') || '-'}\n`);
    }
  }
  // Per family-level detector: TP/FP/FN/TN over every variant; twin discrimination per pair of that family.
  const perFamily: Record<string, unknown> = {};
  for (const fam of families) {
    let tp = 0; let fp = 0; let fn = 0; let tn = 0;
    const pairs: { fixture: string; positiveFlagged: boolean; twinFlagged: boolean; discriminates: boolean }[] = [];
    for (const r of rows) {
      const hit = (flagged.get(`${r.fixture}/${r.variant}`) ?? new Set()).has(fam);
      const pos = r.expectedFamily === fam;
      if (pos && hit) tp++; else if (pos) fn++; else if (hit) fp++; else tn++;
    }
    for (const fx of new Set(rows.map((r) => String(r.fixture)))) {
      const meta = JSON.parse(fs.readFileSync(path.join(FIXTURES, fx, 'fixture.json'), 'utf8')) as FixtureMeta;
      if (meta.family !== fam || meta.positive === null || meta.twin === null) continue;
      const p = flagged.get(`${fx}/${meta.positive}`)?.has(fam) ?? false;
      const t = flagged.get(`${fx}/${meta.twin}`)?.has(fam) ?? false;
      pairs.push({ fixture: fx, positiveFlagged: p, twinFlagged: t, discriminates: p && !t });
    }
    perFamily[fam] = { rules: rules.filter((r) => r.family === fam).map((r) => r.id), tp, fp, fn, tn, pairs };
  }
  const out = { schema: 'detect-01-fixtures-v1', split: 'dev', modelCalls: 0, rules: rules.map(({ text: _t, ...r }) => r), perFamily, rows };
  fs.mkdirSync(RESULTS, { recursive: true });
  fs.writeFileSync(path.join(RESULTS, 'fixtures.json'), `${JSON.stringify(out, null, 1).split(path.resolve('.')).join('.')}\n`);
  process.stdout.write(`${JSON.stringify(perFamily, null, 1)}\n`);
  return 0;
}

async function trees(manifest: string, name: string): Promise<number> {
  const rules = loadRules();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-01-'));
  const list = JSON.parse(fs.readFileSync(manifest, 'utf8')) as { label: string; path: string; style: Style; note?: string }[];
  const rows: Record<string, unknown>[] = [];
  for (const t of list) {
    const { findings, stats } = await runTree(t.path, t.style, rules, scratch);
    rows.push({ label: t.label, style: t.style, ...(t.note ? { note: t.note } : {}), stats, findings });
    process.stdout.write(`${t.label}: ${findings.map((f) => `${f.rule}@${f.file}:${f.line ?? '?'} [${f.evidence}]`).join('; ') || '-'}\n`);
  }
  fs.mkdirSync(RESULTS, { recursive: true });
  fs.writeFileSync(path.join(RESULTS, `${name}.json`), `${JSON.stringify({ schema: 'detect-01-trees-v1', modelCalls: 0, rows }, null, 1)}\n`);
  return 0;
}

const argv = process.argv.slice(2);
const arg = (k: string): string | undefined => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const main = async (): Promise<number> => {
  if (argv.includes('--fixtures')) return fixtures();
  const m = arg('trees');
  if (m !== undefined) return trees(m, arg('out') ?? 'trees');
  process.stderr.write('usage: evaluate.ts --fixtures | --trees <manifest.json> --out <name>\n');
  return 2;
};
main().then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${String(e instanceof Error ? e.stack : e)}\n`); process.exitCode = 1; });
