/**
 * DETECT-02 (v1.5-exp) symbolic evaluator, zero model calls, no Neo4j.
 *
 *   npx tsx experiments/detect-02/evaluate.ts --dev [--pilot-trees <dir>]   # dev set → results/dev.json
 *   npx tsx experiments/detect-02/evaluate.ts --trees <manifest.json> --out <name>   # any trees → results/<name>.json
 *
 * Dev set (design §5): PUZZLE-01 baseline session trees (steps 1-3) with the oracle FAILs as labels, the puzzle
 * solutions, the HEXDDD-01 step trees (rebuilt from seeds + diffs into `--pilot-trees`, layout
 * `<dir>/<task>/step-0N`), and the DETECT-01 fixtures. Families are scored at family level: a family is flagged when
 * any of its rules fires (D4 = R-D4 or R-XCTX). Absolute paths never reach the output.
 * A manifest is `[{ "label", "path", "spec"?, "style"? }]`.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadRules, runTree } from './lib/graph.js';
import type { Finding, Rule } from './lib/graph.js';

const HERE = 'experiments/detect-02';
const RESULTS = path.join(HERE, 'results');
export const FAMILIES = ['D4', 'D5', 'D9', 'H5', 'H4', 'RTX'] as const;

interface Case { readonly id: string; readonly family: string; readonly file: string; readonly line?: number; readonly note?: string }
interface DevTree {
  readonly label: string; readonly group: string; readonly path: string; readonly spec?: string; readonly style?: string;
  /** Labelled violations present in the tree. Families not listed are negatives for this tree. */
  readonly cases: readonly Case[];
  /** Families that are not labelled on this tree (unknown ground truth): excluded from FP counts. */
  readonly unlabelled?: readonly string[];
  readonly pair?: { readonly id: string; readonly role: 'positive' | 'twin' };
}

const PUZ = 'experiments/puzzle-01/puzzles';
const SESS = 'results/puzzle-01-baseline/sessions';

/** Oracle FAILs (results/puzzle-01-baseline/oracle-verdicts-to-read.md), hand-read proposals; c07 is legit-clean. */
const PUZZLE_FAILS: Record<string, Case[]> = {
  c10: [{ id: 'c10-SG1', family: 'D4', file: 'src/ledger/application/Transfer.ts' }, { id: 'c10-SG2', family: 'D5', file: 'src/ledger/application/Transfer.ts', line: 31 }],
  c11: [{ id: 'c11-SG1', family: 'D4', file: 'src/ledger/application/Transfer.ts' }],
  c13: [{ id: 'c13-SG1', family: 'D4', file: 'src/ledger/application/Transfer.ts' }],
  c15: [{ id: 'c15-SG1', family: 'D4', file: 'src/ledger/application/Transfer.ts' }],
  c16: [{ id: 'c16-SG1', family: 'D4', file: 'src/ledger/application/Transfer.ts' }, { id: 'c16-SG2', family: 'D5', file: 'src/ledger/application/Transfer.ts' }],
  c01: [{ id: 'c01-SG2', family: 'D4', file: 'src/sales/application/PlaceOrder.ts' }],
  c02: [{ id: 'c02-SG2', family: 'D4', file: 'src/sales/application/PlaceOrder.ts' }],
  c04: [{ id: 'c04-SG2', family: 'D4', file: 'src/sales/application/PlaceOrder.ts' }],
  c06: [{ id: 'c06-SG2', family: 'D4', file: 'src/sales/application/PlaceOrder.ts' }],
  c07: [],
};
/** First step at which each FAIL is present (all FAILs persist to step 3; the report gives the introducing step). */
const FAIL_FROM_STEP: Record<string, number> = { SG1: 1, SG2: 2 };
const P2_SG2_STEP = 3;

function puzzleTrees(): DevTree[] {
  const map = JSON.parse(fs.readFileSync('results/puzzle-01-baseline/private-id-map.json', 'utf8')) as { sessions: Record<string, { puzzle: string; verdict: string }> };
  const out: DevTree[] = [];
  for (const [s, v] of Object.entries(map.sessions)) {
    if (v.verdict !== 'done') continue;
    for (const step of [1, 2, 3]) {
      const p = path.join(SESS, s, 'snap', `step-0${step}`);
      if (!fs.existsSync(path.join(p, 'src'))) continue;
      const fails = (PUZZLE_FAILS[s] ?? []).filter((c) => {
        const sg = c.id.split('-')[1]!;
        const from = v.puzzle === 'p2-loyalty' ? P2_SG2_STEP : FAIL_FROM_STEP[sg]!;
        return step >= from;
      });
      out.push({ label: `puzzle/${v.puzzle}/${s}/step-0${step}`, group: step === 3 ? 'puzzle-final' : 'puzzle-intermediate', path: p, spec: path.join(PUZ, v.puzzle, 'spec.yaml'), cases: fails });
    }
  }
  const sol: [string, string, Case[]][] = [
    ['p1-transfers', 'clean', []],
    ['p1-transfers', 'trap', [{ id: 'p1-trap-SG1', family: 'D4', file: 'src/ledger/application/TransferMoney.ts' }, { id: 'p1-trap-SG2', family: 'D5', file: 'src/ledger/application/TransferMoney.ts' }]],
    ['p2-loyalty', 'clean', []],
    ['p2-loyalty', 'trap', [{ id: 'p2-trap-SG2', family: 'D4', file: 'src/sales/application/PlaceOrder.ts' }]],
    ['p2-loyalty', 'trap-alt', [{ id: 'p2-trapalt-SG2', family: 'D4', file: 'src/sales/application/PlaceOrder.ts' }]],
    ['p3-shipping-quotes', 'clean', []],
    ['p3-shipping-quotes', 'trap', [{ id: 'p3-trap-SG1', family: 'H5', file: '' }]],
    ['p4-library-holds', 'clean', []],
    ['p4-library-holds', 'trap', []],
  ];
  for (const [pz, kind, cases] of sol) {
    const p = path.join(PUZ, pz, 'solutions', kind);
    if (!fs.existsSync(path.join(p, 'src'))) continue;
    out.push({ label: `solution/${pz}/${kind}`, group: kind === 'clean' ? 'solution-clean' : 'solution-trap', path: p, spec: path.join(PUZ, pz, 'spec.yaml'), cases });
  }
  return out;
}

/** HEXDDD-01 hand-read cases (results/pilot-hexddd-01/hand-read-log.csv); D3 is out of every rule's scope. */
const PILOT_CASES: { task: string; step: number; c: Case }[] = [
  { task: 's1-hotel-bookings', step: 2, c: { id: 'case1', family: 'D5', file: 'src/application/services/BookRoomService.ts', line: 37, note: 'lock form' } },
  { task: 's1-hotel-bookings', step: 3, c: { id: 'case2', family: 'D4', file: 'src/application/ports/out/BookingRepository.ts', line: 11 } },
  { task: 's1-hotel-bookings', step: 4, c: { id: 'case3', family: 'D3', file: 'src/application/services/OccupancyReportService.ts', line: 39 } },
  { task: 's1-hotel-bookings', step: 5, c: { id: 'case4', family: 'H5', file: 'src/application/ports/out/BookingRepository.ts', line: 16 } },
  { task: 's2-orders-invoices', step: 1, c: { id: 'case5', family: 'D4', file: 'src/billing/application/RecordPayment.ts', line: 15 } },
  { task: 's2-orders-invoices', step: 2, c: { id: 'case6', family: 'D5', file: 'src/ordering/application/PlaceOrder.ts', line: 35 } },
  { task: 's2-orders-invoices', step: 4, c: { id: 'case7', family: 'D5', file: 'src/ordering/application/SetTaxRate.ts', line: 8 } },
  { task: 's2-orders-invoices', step: 5, c: { id: 'case8', family: 'D4', file: 'src/billing/application/IssueInvoice.ts', line: 20 } },
  { task: 's2-orders-invoices', step: 5, c: { id: 'case9', family: 'D9', file: 'src/ordering/domain/order/Order.ts', line: 89 } },
];

function pilotTrees(dir: string): DevTree[] {
  const out: DevTree[] = [];
  for (const [task, spec] of [['s1-hotel-bookings', 's1-hexagonal.yaml'], ['s2-orders-invoices', 's2-ddd.yaml']] as const) {
    for (let step = 0; step <= 5; step++) {
      const p = path.join(dir, task, `step-0${step}`);
      if (!fs.existsSync(p)) continue;
      out.push({
        label: `pilot/${task}/step-0${step}`, group: step === 0 ? 'pilot-seed' : 'pilot-step', path: p,
        spec: path.join('experiments/pilot-hexddd-01/specs', spec),
        cases: PILOT_CASES.filter((x) => x.task === task && x.step <= step).map((x) => x.c),
        // The pilot hand read covered the violations agents introduced; S1 step 5 also carries the Paystream charge
        // inside the lock (noted in the case-4 row), which is not a separate row: RTX is unlabelled there.
        unlabelled: task === 's1-hotel-bookings' && step === 5 ? ['RTX'] : [],
      });
    }
  }
  return out;
}

function fixtureTrees(): DevTree[] {
  const fx = 'experiments/detect-01/fixtures';
  const out: DevTree[] = [];
  for (const d of fs.readdirSync(fx).sort()) {
    const mf = path.join(fx, d, 'fixture.json');
    if (!fs.existsSync(mf)) continue;
    const meta = JSON.parse(fs.readFileSync(mf, 'utf8')) as { family: string | null; positive: string | null; twin: string | null; clean?: string; provenance?: { handReadRow?: string } };
    const fam = meta.family;
    if (meta.positive) out.push({ label: `fixture/${d}/${meta.positive}`, group: 'fixture-pos', path: path.join(fx, d, meta.positive), style: 'hexddd', cases: fam ? [{ id: d, family: fam, file: meta.provenance?.handReadRow?.split(':')[0] ?? '' }] : [], pair: { id: d, role: 'positive' } });
    if (meta.twin) out.push({ label: `fixture/${d}/${meta.twin}`, group: 'fixture-twin', path: path.join(fx, d, meta.twin), style: 'hexddd', cases: [], pair: { id: d, role: 'twin' } });
    if (meta.clean) out.push({ label: `fixture/${d}/${meta.clean}`, group: 'fixture-clean', path: path.join(fx, d, meta.clean), style: 'hexddd', cases: [] });
  }
  return out;
}

const famOf = (rules: readonly Rule[], id: string): string => rules.find((r) => r.id === id)?.family ?? '?';

export interface ScoredRow { label: string; group: string; ms: number; rootSource: string; cases: Case[]; findings: Finding[]; flagged: string[]; caseHits: Record<string, boolean>; stats: Record<string, number> }

export function score(rows: readonly ScoredRow[], trees: readonly DevTree[]): Record<string, unknown> {
  const perFamily: Record<string, unknown> = {};
  for (const fam of FAMILIES) {
    let tp = 0; let fp = 0; let fn = 0; let tn = 0;
    const fps: string[] = []; const fns: string[] = [];
    for (const r of rows) {
      const t = trees.find((x) => x.label === r.label)!;
      if (t.unlabelled?.includes(fam)) continue;
      const pos = r.cases.some((c) => c.family === fam);
      const hit = r.flagged.includes(fam);
      if (pos && hit) tp++; else if (pos) { fn++; fns.push(r.label); } else if (hit) { fp++; fps.push(r.label); } else tn++;
    }
    const pairs: { pair: string; positive: boolean; twin: boolean; discriminates: boolean }[] = [];
    for (const t of trees.filter((x) => x.pair?.role === 'positive')) {
      const fam2 = t.cases[0]?.family;
      if (fam2 !== fam) continue;
      const tw = trees.find((x) => x.pair?.id === t.pair!.id && x.pair.role === 'twin');
      const p = rows.find((r) => r.label === t.label)?.flagged.includes(fam) ?? false;
      const w = tw ? rows.find((r) => r.label === tw.label)?.flagged.includes(fam) ?? false : false;
      pairs.push({ pair: t.pair!.id, positive: p, twin: w, discriminates: p && !w });
    }
    perFamily[fam] = { tp, fp, fn, tn, fpTrees: fps, fnTrees: fns, pairs };
  }
  return perFamily;
}

async function runAll(trees: readonly DevTree[], rules: readonly Rule[]): Promise<ScoredRow[]> {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-02-'));
  const rows: ScoredRow[] = [];
  for (const t of trees) {
    const r = await runTree(t.path, rules, { spec: t.spec, style: t.style, scratch });
    const vio = r.findings.filter((f) => f.status === 'violation');
    const flagged = [...new Set(vio.map((f) => famOf(rules, f.rule)))].sort();
    const caseHits: Record<string, boolean> = {};
    for (const c of t.cases) {
      caseHits[c.id] = vio.some((f) => famOf(rules, f.rule) === c.family && (c.file === '' || f.file === c.file || f.path.some((p) => p.startsWith(c.file))));
    }
    rows.push({ label: t.label, group: t.group, ms: r.ms, rootSource: r.facts.rootSource, cases: [...t.cases], findings: r.findings, flagged, caseHits, stats: r.stats });
    process.stdout.write(`${t.label} [${r.ms} ms, roots ${r.facts.rootSource}]: ${vio.map((f) => `${f.rule}@${f.file}:${f.line}`).join(', ') || '-'}${t.cases.length ? `  cases ${JSON.stringify(caseHits)}` : ''}\n`);
  }
  return rows;
}

const scrub = (s: string): string => s.split(path.resolve('.')).join('.').split(os.tmpdir()).join('<tmp>');

async function dev(pilotDir: string | undefined): Promise<number> {
  const rules = loadRules();
  const trees = [...puzzleTrees(), ...(pilotDir ? pilotTrees(pilotDir) : []), ...fixtureTrees()];
  const rows = await runAll(trees, rules);
  const groups = [...new Set(trees.map((t) => t.group))];
  const byGroup = Object.fromEntries(groups.map((g) => [g, score(rows.filter((r) => r.group === g), trees)]));
  const cases = rows.flatMap((r) => Object.entries(r.caseHits).map(([id, hit]) => ({ tree: r.label, id, family: r.cases.find((c) => c.id === id)!.family, hit })));
  const out = {
    schema: 'detect-02-dev-v1', version: 'v1.5-exp', split: 'dev', modelCalls: 0,
    note: 'Development material: rules and facts were written and adjusted while looking at these trees. Not an accuracy estimate.',
    rules: rules.map(({ text: _t, ...r }) => r), all: score(rows, trees), byGroup, cases,
    latencyMs: { median: median(rows.map((r) => r.ms)), max: Math.max(...rows.map((r) => r.ms)) },
    rows: rows.map((r) => ({ ...r, path: undefined })),
  };
  fs.mkdirSync(RESULTS, { recursive: true });
  fs.writeFileSync(path.join(RESULTS, 'dev.json'), `${scrub(JSON.stringify(out, null, 1))}\n`);
  process.stdout.write(`${JSON.stringify({ all: out.all, latencyMs: out.latencyMs }, null, 1)}\n`);
  return 0;
}

export function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? 0 : s[Math.floor(s.length / 2)]!;
}

async function trees(manifest: string, name: string): Promise<number> {
  const rules = loadRules();
  const list = JSON.parse(fs.readFileSync(manifest, 'utf8')) as { label: string; path: string; spec?: string; style?: string }[];
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-02-'));
  const rows: Record<string, unknown>[] = [];
  let failed = 0;
  for (const t of list) {
    try {
      const r = await runTree(t.path, rules, { spec: t.spec, style: t.style, scratch, withApg: process.env.DETECT02_NO_APG !== '1' });
      rows.push({ label: t.label, ms: r.ms, rootSource: r.facts.rootSource, roots: r.facts.roots.map((x) => x.name), commands: r.facts.commands.length, findings: r.findings });
      const v = r.findings.filter((f) => f.status === 'violation');
      if (v.length > 0 || process.env.DETECT02_VERBOSE === '1') process.stdout.write(`${t.label} [${r.ms} ms]: ${v.map((f) => `${f.rule}@${f.file}:${f.line}`).join(', ') || '-'}\n`);
    } catch (e) {
      failed++;
      rows.push({ label: t.label, error: String(e instanceof Error ? e.message : e).slice(0, 300) });
    }
  }
  const hits = rows.filter((r) => Array.isArray(r.findings) && (r.findings as Finding[]).some((f) => f.status === 'violation'));
  const perRule: Record<string, number> = {};
  for (const r of rows) for (const f of (r.findings as Finding[] | undefined) ?? []) if (f.status === 'violation') perRule[f.rule] = (perRule[f.rule] ?? 0) + 1;
  const summary = { trees: list.length, failed, treesWithHits: hits.length, perRule, latencyMs: { median: median(rows.map((r) => Number(r.ms ?? 0))) } };
  fs.mkdirSync(RESULTS, { recursive: true });
  fs.writeFileSync(path.join(RESULTS, `${name}.json`), `${scrub(JSON.stringify({ schema: 'detect-02-trees-v1', version: 'v1.5-exp', modelCalls: 0, summary, rows }, null, 1))}\n`);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  return 0;
}

if (process.argv[1]?.endsWith('evaluate.ts')) {
  const argv = process.argv.slice(2);
  const arg = (k: string): string | undefined => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const main = async (): Promise<number> => {
    if (argv.includes('--dev')) return dev(arg('pilot-trees'));
    const m = arg('trees');
    if (m !== undefined) return trees(m, arg('out') ?? 'trees');
    process.stderr.write('usage: evaluate.ts --dev [--pilot-trees <dir>] | --trees <manifest.json> --out <name>\n');
    return 2;
  };
  main().then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${String(e instanceof Error ? e.stack : e)}\n`); process.exitCode = 1; });
}
