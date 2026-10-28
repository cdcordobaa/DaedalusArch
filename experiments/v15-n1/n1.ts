/**
 * N1 (v1.5 final study, neuro-symbolic secondary, registered; `Docs/v1.5/final-study-preregistration.md` §4): do the
 * aggregate roots S3 names from the code alone preserve the admitted DDD rules' results?
 *
 *   npx tsx experiments/v15-n1/n1.ts --estimate [--cal03 | --snapshots <dir> [--spec <file>]]   0 calls; fixes the cap
 *   npx tsx experiments/v15-n1/n1.ts --cal03 [--replay] [--route judge|ambient] [--pin <cli>] [--out <file>]
 *   npx tsx experiments/v15-n1/n1.ts --snapshots <dir> [--spec <file>] [--replay] [--route ...] [--pin ...] [--out ...]
 *
 * S3 runs twice per tree (prompt `u4-s3-facts-v1`, unchanged); a root counts only when named and grounded in both runs.
 * `--cal03`: S3 on each CAL-03 domain's BASE tree (roots are a property of the base; a case is a small change to it),
 * then every case is scored with the base spec's `aggregates` replaced by those roots, and again with the declared
 * roots. `--snapshots`: S3 on each tree of the directory, the admitted rules with S3 roots vs declared roots on the same
 * tree. The call cap (2 × trees × 1.5) is written by `--estimate` before any call and read by every later run; a record
 * run without it refuses. `--replay` reads cassettes only; a miss is an error.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import YAML from 'yaml';
import { loadRules, runTree } from '../../src/v15-instrument/index.js';
import type { Rule } from '../../src/v15-instrument/index.js';
import { S3_VERSION, writeSpecWithAggregates } from '../../src/v15-instrument/s3-ownership.js';
import type { AggregateEntry } from '../../src/v15-instrument/s3-ownership.js';
import { ROW_RULES, frozenHits } from '../cal-01/score.js';
import {
  ADMITTED, ADMITTED_RULES, CassetteMiss, N1_MODEL, N1_VERSION, RUNS, agreement, batchesFor, capFor, cohenKappa,
  identityOf, ledgerCount, matches, s3Roots, sha, wilsonLower,
} from './lib.js';
import type { AskDeps, Budget, Mode, TreeInput, TreeS3 } from './lib.js';
import { ARGV_FLAGS, callerOf, cliVersion, routeOf } from './route.js';
import type { RouteKind } from './route.js';

const HERE = path.join('experiments', 'v15-n1');
const CAPS = path.join(HERE, 'caps.json');
const STORE = { cassettes: path.join(HERE, 'cassettes'), ledger: path.join(HERE, 'ledger.jsonl') };
const rel = (p: string): string => path.relative(process.cwd(), path.resolve(p)).split(path.sep).join('/');

interface Label { rule: string; label: 'violation' | 'clean'; file: string | null }
interface Hit { rule: string; file: string; line: number | null }
interface CapEntry { trees: number; batches: number; plannedCalls: number; cap: number; listingSha: string; fixedAt: string; n1Version: string; promptVersion: string; model: string }

// ── Trees ────────────────────────────────────────────────────────────────────────────────────────────────────────

function cal03Trees(dir: string, scratch: string): TreeInput[] {
  return fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'labels.json'))).sort()
    .map((d) => ({ id: `cal03/${d}`, tree: path.join(dir, d, 'base'), spec: path.join(dir, d, 'base', 'spec.yaml'), scratch }));
}

function snapshotTrees(dir: string, spec: string | undefined, scratch: string): TreeInput[] {
  return fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'src'))).sort().map((d) => {
    const tree = path.join(dir, d);
    const s = spec ?? path.join(tree, 'spec.yaml');
    if (!fs.existsSync(s)) throw new Error(`no spec for snapshot ${d}: pass --spec or put spec.yaml in the tree`);
    return { id: `snap/${d}`, tree, spec: s, scratch };
  });
}

// ── Scoring (zero calls) ─────────────────────────────────────────────────────────────────────────────────────────

async function admittedHits(tree: string, spec: string, rules: readonly Rule[], scratch: string): Promise<{ hits: Hit[]; rootSource: string; roots: string[] }> {
  const r = await runTree(tree, rules, { spec, scratch });
  const all: Hit[] = [...r.findings.filter((f) => f.status === 'violation').map((f) => ({ rule: f.rule, file: f.file, line: f.line })), ...(await frozenHits(tree, spec))];
  return { hits: all.filter((h) => matches(h.rule, ADMITTED_RULES)), rootSource: r.facts.rootSource, roots: r.facts.roots.map((x) => x.name).sort() };
}

const specWith = (declared: string, out: string, roots: readonly AggregateEntry[] | null): string => (roots === null ? declared : writeSpecWithAggregates(declared, out, roots));

interface CaseRow { domain: string; case: string; row: string | null; label: 'violation' | 'clean'; labelledFile: string | null; admittedRow: boolean; pass: boolean | null; hits: Hit[] }

async function scoreCal03(dir: string, domain: string, roots: readonly AggregateEntry[] | null, rules: readonly Rule[], scratch: string, cond: string): Promise<{ rows: CaseRow[]; rootSource: string; rootNames: string[] }> {
  const dd = path.join(dir, domain);
  const labels = JSON.parse(fs.readFileSync(path.join(dd, 'labels.json'), 'utf8')) as Record<string, Label>;
  const base = path.join(dd, 'base');
  const spec = specWith(path.join(base, 'spec.yaml'), path.join(scratch, cond, `${domain}.spec.yaml`), roots);
  const trees: [string, Label | null][] = [['base', null], ...Object.entries(labels).sort(([a], [b]) => a.localeCompare(b))];
  const rows: CaseRow[] = [];
  let rootSource = ''; let rootNames: string[] = [];
  for (const [c, lab] of trees) {
    const tree = path.join(scratch, cond, domain, c);
    fs.cpSync(base, tree, { recursive: true });
    if (c !== 'base') fs.cpSync(path.join(dd, 'cases', c), tree, { recursive: true });
    const r = await admittedHits(tree, spec, rules, path.join(scratch, '_s'));
    if (c === 'base') { rootSource = r.rootSource; rootNames = r.roots; }
    fs.rmSync(tree, { recursive: true, force: true });
    if (lab === null) { rows.push({ domain, case: c, row: null, label: 'clean', labelledFile: null, admittedRow: false, pass: r.hits.length === 0, hits: r.hits }); continue; }
    const ids = ADMITTED[lab.rule];
    if (ids === undefined) { rows.push({ domain, case: c, row: lab.rule, label: lab.label, labelledFile: lab.file, admittedRow: false, pass: null, hits: r.hits }); continue; }
    const mapped = r.hits.filter((h) => matches(h.rule, ids));
    const pass = lab.label === 'violation' ? mapped.some((h) => lab.file === null || h.file === lab.file || h.file.endsWith(lab.file)) : mapped.length === 0;
    rows.push({ domain, case: c, row: lab.rule, label: lab.label, labelledFile: lab.file, admittedRow: true, pass, hits: r.hits });
  }
  return { rows, rootSource, rootNames };
}

function summarise(rows: readonly CaseRow[]): Record<string, unknown> {
  const perRow: Record<string, { recall: string; fp: string; pos: number; posPass: number; clean: number; cleanFail: number }> = {};
  for (const k of Object.keys(ADMITTED)) {
    const pos = rows.filter((x) => x.row === k && x.label === 'violation');
    const neg = rows.filter((x) => x.row === k && x.label === 'clean');
    const posPass = pos.filter((x) => x.pass === true).length; const cleanFail = neg.filter((x) => x.pass === false).length;
    perRow[k] = { recall: `${String(posPass)}/${String(pos.length)}`, fp: `${String(cleanFail)}/${String(neg.length)}`, pos: pos.length, posPass, clean: neg.length, cleanFail };
  }
  const k = Object.values(perRow).reduce((a, r) => a + r.posPass, 0);
  const n = Object.values(perRow).reduce((a, r) => a + r.pos, 0);
  const incorrect = rows.filter((x) => x.admittedRow && x.label === 'clean' && x.pass === false).map((x) => `${x.domain}/${x.case}`);
  const crossRow = rows.filter((x) => x.label === 'clean' && !x.admittedRow && x.hits.length > 0).map((x) => ({ case: `${x.domain}/${x.case}`, rules: [...new Set(x.hits.map((h) => h.rule))].sort() }));
  return {
    perRow, pooled: { k, n, recall: n === 0 ? null : k / n, wilsonLower95: wilsonLower(k, n) },
    incorrectOnAdmittedClean: { count: incorrect.length, cases: incorrect },
    admittedRuleHitsOnOtherCleanCases: { count: crossRow.length, cases: crossRow },
  };
}

/** The declared roots as a complete two-run S3 result (control mode). */
function controlTree(t: TreeInput): TreeS3 {
  const doc = YAML.parse(fs.readFileSync(t.spec, 'utf8')) as { architecture: { ddd?: { aggregates?: AggregateEntry[] } } };
  const kept = [...(doc.architecture.ddd?.aggregates ?? [])];
  const run = (r: number): TreeS3['runs'][number] => ({ run: r, complete: true, roots: kept, verdicts: [], answers: [] });
  return { id: t.id, batches: 0, listedTypes: 0, complete: true, runs: [run(0), run(1)], kept, dropped: [], contextDiffers: [] };
}

// ── Main ─────────────────────────────────────────────────────────────────────────────────────────────────────────

function readCaps(): Record<string, CapEntry> { return fs.existsSync(CAPS) ? JSON.parse(fs.readFileSync(CAPS, 'utf8')) as Record<string, CapEntry> : {}; }

async function main(argv: readonly string[]): Promise<number> {
  const arg = (k: string): string | undefined => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const mode: Mode = argv.includes('--estimate') ? 'estimate' : argv.includes('--replay') ? 'replay' : 'record';
  const snapDir = arg('snapshots');
  const target = snapDir !== undefined ? `snapshots:${path.basename(path.resolve(snapDir))}` : 'cal03';
  const calDir = arg('dir') ?? path.join('experiments', 'cal-03');
  const routeKind = (arg('route') ?? 'judge') as RouteKind;
  if (routeKind !== 'judge' && routeKind !== 'ambient') { process.stderr.write('--route judge|ambient\n'); return 2; }
  // Sanity: the admitted map is ROW_RULES restricted to the admitted rows, K10 by R-D5S alone.
  for (const [row, ids] of Object.entries(ADMITTED)) {
    if (row === 'K10') continue;
    if (JSON.stringify([...(ROW_RULES[row] ?? [])]) !== JSON.stringify([...ids])) throw new Error(`ADMITTED ${row} differs from ROW_RULES`);
  }
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-n1-'));
  const trees = snapDir !== undefined ? snapshotTrees(snapDir, arg('spec'), scratch) : cal03Trees(calDir, scratch);
  const batches = trees.map((t) => batchesFor(t));
  const listingSha = sha(batches.flat().map((b) => `${b.repo}\n${b.context}\n${b.prompt}`).join('\n\0\n'));
  const caps = readCaps();
  const used = ledgerCount(STORE.ledger, target);

  if (mode === 'estimate') {
    const b: Budget = { mode, target, cap: Number.POSITIVE_INFINITY, used, planned: 0, stopped: null, truncated: [] };
    const deps: AskDeps = { caller: () => Promise.reject(new Error('estimate never calls')), store: STORE };
    for (const t of trees) await s3Roots(t, b, deps);
    const nb = batches.reduce((a, x) => a + x.length, 0);
    const entry: CapEntry = { trees: trees.length, batches: nb, plannedCalls: b.planned, cap: capFor(trees.length), listingSha, fixedAt: new Date().toISOString(), n1Version: N1_VERSION, promptVersion: S3_VERSION, model: N1_MODEL };
    const prev = caps[target];
    if (prev !== undefined && used > 0) {
      process.stdout.write(`cap for ${target} already fixed at ${String(prev.cap)} (${prev.fixedAt}) and ${String(used)} calls are on the ledger: not rewritten\n`);
    } else {
      caps[target] = entry;
      fs.writeFileSync(CAPS, `${JSON.stringify(caps, null, 1)}\n`);
    }
    for (let i = 0; i < trees.length; i++) process.stdout.write(`${trees[i]!.id}: ${String(batches[i]!.length)} batch(es), ${String(batches[i]!.reduce((a, x) => a + x.listed.length, 0))} listed types, ~${String(Math.round(batches[i]!.reduce((a, x) => a + x.prompt.length, 0) / 4))} prompt tokens per run\n`);
    process.stdout.write(`${target}: trees ${String(trees.length)}, batches ${String(nb)}, runs ${String(RUNS)}; planned calls ${String(b.planned)} (cassette misses, before retries); cap ${String(entry.cap)} = 2 x ${String(trees.length)} x 1.5; ledger ${String(used)}; model ${N1_MODEL}; prompt ${S3_VERSION}${b.planned > entry.cap ? '; WARNING planned calls exceed the cap: the run will truncate' : ''}\n`);
    fs.rmSync(scratch, { recursive: true, force: true });
    return 0;
  }

  // `--control`: zero calls; the declared roots go through the S3 path in place of the model's (a plumbing check: the
  // S3 condition must then reproduce the declared condition exactly). Needs no cap; never writes cassettes.
  const control = argv.includes('--control');
  const cap: CapEntry | undefined = control ? { trees: trees.length, batches: 0, plannedCalls: 0, cap: 0, listingSha, fixedAt: 'control', n1Version: N1_VERSION, promptVersion: S3_VERSION, model: 'none' } : caps[target];
  if (cap === undefined) { process.stderr.write(`no cap fixed for ${target}: run --estimate first\n`); return 2; }
  if (cap.listingSha !== listingSha) { process.stderr.write(`the listing of ${target} changed since the cap was fixed (${cap.fixedAt}): refuse\n`); return 2; }
  const route = routeOf(routeKind);
  let version: string | null = null;
  const pin = arg('pin');
  if (mode === 'record' && !control) {
    version = cliVersion(route);
    if (version === null) { process.stderr.write('claude --version unreadable under the route env: refuse\n'); return 2; }
    if (pin !== undefined && version !== pin) { process.stderr.write(`CLI ${version} is not the pin ${pin}: refuse\n`); return 2; }
  }
  const routeRec = { kind: route.kind, binary: 'claude', configDir: route.configDir, argv: ARGV_FLAGS, env: route.kind === 'judge' ? 'judge allow-list + CLAUDE_CONFIG_DIR + DISABLE_AUTOUPDATER=1' : 'parent env minus ANTHROPIC_API_KEY + DISABLE_AUTOUPDATER=1', cliVersion: version, pin: pin ?? null };
  const b: Budget = { mode, target, cap: cap.cap, used, planned: 0, stopped: null, truncated: [] };
  const deps: AskDeps = {
    caller: callerOf(route), store: STORE, route: routeRec,
    preCall: mode === 'record' ? () => { const v = cliVersion(route); return v === version ? null : `CLI version changed (${String(version)} -> ${String(v)})`; } : undefined,
  };
  const s3: TreeS3[] = [];
  try {
    for (const t of trees) s3.push(control ? controlTree(t) : await s3Roots(t, b, deps));
  } catch (e) {
    if (e instanceof CassetteMiss) { process.stderr.write(`${e.message}\n`); fs.rmSync(scratch, { recursive: true, force: true }); return 3; }
    throw e;
  }
  const models = [...new Set(s3.flatMap((t) => t.runs.flatMap((r) => r.answers.map((a) => a.model)).filter((m): m is string => m !== null)))].sort();
  const header = {
    schema: 'v15-n1-result-v1', n1Version: N1_VERSION, target, mode: control ? 'control (declared roots through the S3 path, 0 calls)' : mode, at: new Date().toISOString(), promptVersion: S3_VERSION,
    requestedModel: N1_MODEL, answeredModels: models, route: routeRec, runsPerTree: RUNS, rootRule: 'named and grounded in both runs',
    cap: cap.cap, capFixedAt: cap.fixedAt, callsOnLedger: b.used, truncated: b.stopped !== null || b.truncated.length > 0, stopped: b.stopped, truncatedAnswers: b.truncated,
    admittedRows: ADMITTED,
    s3: s3.map((t) => ({ id: t.id, batches: t.batches, listedTypes: t.listedTypes, complete: t.complete, kept: t.kept, dropped: t.dropped, contextDiffers: t.contextDiffers, runs: t.runs.map((r) => ({ run: r.run, complete: r.complete, roots: r.roots.map((x) => `${x.root}#${x.name}`), answers: r.answers })) })),
  };
  const rules = loadRules();
  let out: Record<string, unknown>;
  if (snapDir === undefined) {
    const declaredRows: CaseRow[] = []; const s3Rows: CaseRow[] = [];
    const domains: Record<string, unknown> = {};
    const notScored: string[] = [];
    for (const t of s3) {
      const domain = t.id.replace(/^cal03\//, '');
      const d = await scoreCal03(calDir, domain, null, rules, scratch, 'declared');
      declaredRows.push(...d.rows);
      if (!t.complete) { notScored.push(domain); domains[domain] = { declaredRoots: d.rootNames, s3: 'not scored: S3 incomplete' }; continue; }
      const m = await scoreCal03(calDir, domain, t.kept, rules, scratch, 's3');
      s3Rows.push(...m.rows);
      domains[domain] = { declaredRoots: d.rootNames, declaredRootSource: d.rootSource, s3Roots: m.rootNames, s3RootSource: m.rootSource };
    }
    const dSum = summarise(declaredRows); const sSum = summarise(s3Rows);
    const ids = (rows: readonly CaseRow[]): string[] => rows.filter((x) => !notScored.includes(x.domain)).flatMap((x) => x.hits.map((h) => identityOf(`${x.domain}/${x.case}`, h)));
    const sealed = fs.existsSync(path.join(calDir, 'result.json')) ? (JSON.parse(fs.readFileSync(path.join(calDir, 'result.json'), 'utf8')) as { perRow?: Record<string, unknown> }).perRow ?? {} : {};
    const pooled = sSum['pooled'] as { recall: number | null };
    const incorrect = (sSum['incorrectOnAdmittedClean'] as { count: number }).count;
    out = {
      ...header, calDir: rel(calDir), basis: 'S3 on each domain base tree; every case scored with the base spec aggregates replaced by those roots',
      domains, notScored,
      declared: dSum, s3Roots: sSum,
      findingAgreementOnCal03: notScored.length === trees.length ? null : agreement(ids(declaredRows), ids(s3Rows)),
      sealedRecordAdmittedRows: Object.fromEntries(Object.keys(ADMITTED).map((k) => [k, sealed[k] ?? null])),
      reading: notScored.length > 0 ? 'not reached (S3 incomplete)' : { recallAtLeast090: pooled.recall !== null && pooled.recall >= 0.9, zeroIncorrectOnClean: incorrect === 0 },
      cases: { declared: declaredRows, s3: s3Rows },
    };
    const pr = (s: Record<string, unknown>): string => Object.entries(s['perRow'] as Record<string, { recall: string; fp: string }>).map(([k, v]) => `${k} ${v.recall} fp ${v.fp}`).join('; ');
    process.stdout.write(`declared: ${pr(dSum)}\ns3:       ${notScored.length === trees.length ? 'not scored' : pr(sSum)}\npooled s3 recall ${String(pooled.recall)}, incorrect on admitted clean ${String(incorrect)}\n`);
  } else {
    const perTree: Record<string, unknown>[] = [];
    const D: string[] = []; const S: string[] = [];
    const cells: [boolean, boolean][] = [];
    for (const t of s3) {
      const tin = trees.find((x) => x.id === t.id)!;
      const copy = path.join(scratch, 'snap', path.basename(tin.tree));
      fs.cpSync(tin.tree, copy, { recursive: true });
      const d = await admittedHits(copy, tin.spec, rules, path.join(scratch, '_s'));
      if (!t.complete) { perTree.push({ id: t.id, s3: 'not scored: S3 incomplete', declaredHits: d.hits }); fs.rmSync(copy, { recursive: true, force: true }); continue; }
      const m = await admittedHits(copy, specWith(tin.spec, path.join(scratch, `${path.basename(tin.tree)}.s3.yaml`), t.kept), rules, path.join(scratch, '_s'));
      fs.rmSync(copy, { recursive: true, force: true });
      const di = d.hits.map((h) => identityOf(t.id, h)); const si = m.hits.map((h) => identityOf(t.id, h));
      D.push(...di); S.push(...si);
      for (const r of ADMITTED_RULES) cells.push([d.hits.some((h) => h.rule === r), m.hits.some((h) => h.rule === r)]);
      perTree.push({ id: t.id, declaredRoots: d.roots, s3Roots: m.roots, s3RootSource: m.rootSource, agreement: agreement(di, si), declaredHits: d.hits, s3Hits: m.hits });
    }
    const ag = agreement(D, S);
    out = {
      ...header, snapshots: rel(snapDir), spec: arg('spec') !== undefined ? rel(arg('spec')!) : 'spec.yaml per tree',
      agreement: ag,
      kappaTreeRuleCells: { kappa: cohenKappa(cells), cells: cells.length, note: 'supplementary: one cell per tree x admitted rule (fires anywhere in the tree), which has both-absent cells' },
      reading: s3.some((t) => !t.complete) ? 'not reached (S3 incomplete)' : { agreementAtLeast090: ag.share >= 0.9 },
      perTree,
    };
    process.stdout.write(`agreement: identical ${String(ag.identical)} of ${String(ag.union)} (share ${ag.share.toFixed(3)}${ag.vacuous ? ', vacuous' : ''}); kappa(union) ${String(ag.kappaUnion)}; kappa(cells) ${String(cohenKappa(cells))}\n`);
  }
  const file = arg('out') ?? path.join(HERE, 'results', `n1-${target.replace(/[^\w.-]+/g, '_')}${control ? '-control' : mode === 'replay' ? '-replay' : ''}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`);
  fs.rmSync(scratch, { recursive: true, force: true });
  process.stdout.write(`calls on ledger for ${target}: ${String(b.used)} of cap ${String(cap.cap)}${b.stopped !== null ? `; STOPPED: ${b.stopped}; truncated answers ${String(b.truncated.length)}` : ''}\nwrote ${rel(file)}\n`);
  return b.stopped !== null ? 4 : 0;
}

if (process.argv[1]?.endsWith('n1.ts')) {
  main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${String(e instanceof Error ? e.stack : e)}\n`); process.exitCode = 1; });
}
