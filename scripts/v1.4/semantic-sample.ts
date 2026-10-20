/**
 * Study 2a semantic scoring on the registered 12-snapshot sample (exploratory registration §9, Amendment 2).
 * A thin driver: it materialises the sample, then runs the existing runners (`scripts/v1.3/ontology-run.ts` for C1d,
 * `scripts/v1.4/c4-run.ts` for C4) one snapshot at a time, in one lane, under one run-wide call cap per path. It adds
 * no prompt and no scoring logic of its own; `analyse` only counts what the runners wrote (zero model calls).
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/semantic-sample.ts materialise --store <out-root> [--store <out-root> ...] --work <dir> \
 *     --node-modules <harness>/skeleton-install/node_modules
 *   npx tsx scripts/v1.4/semantic-sample.ts c1d --work <dir> --out <dir> --cap 700 [--only <slug,slug>] [--estimate]
 *   npx tsx scripts/v1.4/semantic-sample.ts c4  --work <dir> --out <dir> --cap 80  [--only <slug,slug>] [--estimate]
 *   npx tsx scripts/v1.4/semantic-sample.ts analyse --work <dir> --out <dir>
 *
 * Shared flags: --claude-bin <path> (C1d only; c4-run uses `claude` on PATH), --threshold 0.75 (analyse).
 * The cap is run-wide and persistent: `<out>/<path>-ledger.json` holds the calls spent so far, so a smoke run and the
 * full run share one cap. A snapshot starts with `--budget` = the cap minus what is spent; when that is 0 the snapshot
 * is recorded as not run (truncated by the cap). The cap is never raised by this script.
 *
 * Read-only on the out-roots (`git archive` from `snapshots.git`). Paths written to `<out>` are scrubbed: the work dir
 * becomes `<work>`, `/Users/Shared/` becomes `<shared>/`.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { harnessTsconfigText } from '../lib/generators/harness-tsconfig.js';
import { checkoutCommit } from '../lib/loop/replay.js';
import { loadFacts, prepareOntologyInput, runSemRules } from '../../src/apg-enrich/ontology/index.js';
import type { FactsFile } from '../../src/apg-enrich/ontology/index.js';
import { MemoryGraphRepository } from '../../src/cypher-interp/index.js';
import { parseSpec } from '../../src/spec-parser/index.js';

const ANALYSIS = 'results/v1.4-exploratory/stage-c/rescore/analysis.json';
const SPEC = 'presets/layered.yaml';

interface SampleEntry { readonly cell: string; readonly task: string; readonly id: string; readonly commit: string; readonly rep: number; readonly blocking: number }
interface Ledger { cap: number; spent: number; snapshots: Record<string, { calls: number; cacheHits: number; budgetSkipped: number; invalid: number; budgetGiven: number; status: string; line: string }> }

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
function args(argv: readonly string[], name: string): string[] {
  return argv.flatMap((a, i) => (a === name && argv[i + 1] !== undefined ? [argv[i + 1] as string] : []));
}
function out(line = ''): void {
  process.stdout.write(`${line}\n`);
}

export function sample(): SampleEntry[] {
  const a = JSON.parse(fs.readFileSync(ANALYSIS, 'utf8')) as { semanticSample: { snapshots: SampleEntry[] } };
  return a.semanticSample.snapshots;
}
/** `none@L2/ice-rink/rep1/step-05` → `none-L2__ice-rink__rep1__step-05` (the ids of the 2a `--estimate` files). */
export function slugOf(id: string): string {
  return id.replace('@', '-').split('/').join('__');
}

function scrubText(s: string, work: string): string {
  return s.split(path.resolve(work)).join('<work>').split('/Users/Shared/').join('<shared>/');
}
function scrubTree(dir: string, work: string): void {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) scrubTree(p, work);
    else if (/\.(json|txt|md)$/.test(e.name)) {
      const t = fs.readFileSync(p, 'utf8');
      const s = scrubText(t, work);
      if (s !== t) fs.writeFileSync(p, s);
    }
  }
}

function findTurn(stores: readonly string[], commit: string): { gitDir: string } | null {
  const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return ['work', 'snapshots.git', 'node_modules', 'turns', 'calls', 'home', 'spec'].includes(e.name) ? [] : walk(p);
    return e.name === 'run.json' ? [p] : [];
  });
  for (const s of stores) {
    for (const rf of walk(path.join(s, 'runs'))) {
      const runDir = path.dirname(rf);
      const steps = path.join(runDir, 'steps');
      if (!fs.existsSync(steps)) continue;
      for (const f of fs.readdirSync(steps).filter((x) => /^step-\d+\.json$/.test(x))) {
        const step = JSON.parse(fs.readFileSync(path.join(steps, f), 'utf8')) as { turns: { snapshot: { commit: string } }[] };
        if (step.turns.some((t) => t.snapshot.commit === commit)) return { gitDir: path.join(runDir, 'snapshots.git') };
      }
    }
  }
  return null;
}

function materialise(argv: readonly string[]): number {
  const stores = args(argv, '--store');
  const work = arg(argv, '--work');
  const nodeModules = arg(argv, '--node-modules');
  if (stores.length === 0 || work === undefined || nodeModules === undefined) { out('materialise needs --store <dir> ..., --work <dir> and --node-modules <dir>'); return 2; }
  for (const s of sample()) {
    const into = path.resolve(work, slugOf(s.id));
    const t = findTurn(stores, s.commit);
    if (t === null) { out(`${s.id}: commit ${s.commit} not found in the stores`); return 1; }
    if (!fs.existsSync(into)) checkoutCommit(t.gitDir, s.commit, into);
    // As stage-c-rescore: the skeleton's node_modules linked in, and the harness tsconfig (the trees carry none).
    if (!fs.existsSync(path.join(into, 'node_modules'))) fs.symlinkSync(path.resolve(nodeModules), path.join(into, 'node_modules'));
    fs.writeFileSync(path.join(into, 'tsconfig.json'), harnessTsconfigText(into));
    out(`${slugOf(s.id)}: materialised from ${s.commit.slice(0, 12)}`);
  }
  return 0;
}

function readLedger(file: string, cap: number): Ledger {
  if (!fs.existsSync(file)) return { cap, spent: 0, snapshots: {} };
  const l = JSON.parse(fs.readFileSync(file, 'utf8')) as Ledger;
  if (l.cap !== cap) throw new Error(`${file}: the ledger's cap is ${String(l.cap)}, not ${String(cap)}; a cap is never changed mid-run`);
  return l;
}

/** The runner's per-snapshot result line: `calls N, cache hits N, invalid N, budget-skipped N`. */
export function parseCalls(stdout: string): { calls: number; cacheHits: number; invalid: number; budgetSkipped: number; line: string } | null {
  const m = /^(.*calls (\d+), cache hits (\d+), invalid (\d+), budget-skipped (\d+).*)$/m.exec(stdout);
  if (m === null) return null;
  return { line: m[1] ?? '', calls: Number(m[2]), cacheHits: Number(m[3]), invalid: Number(m[4]), budgetSkipped: Number(m[5]) };
}

function runPath(kind: 'c1d' | 'c4', argv: readonly string[]): number {
  const work = arg(argv, '--work');
  const outDir = arg(argv, '--out');
  const cap = Number(arg(argv, '--cap') ?? 'NaN');
  if (work === undefined || outDir === undefined || !Number.isFinite(cap)) { out(`${kind} needs --work, --out and --cap`); return 2; }
  const estimate = argv.includes('--estimate');
  const only = arg(argv, '--only')?.split(',');
  const entries = sample().filter((s) => (kind === 'c1d' || s.blocking > 0) && (only === undefined || only.includes(slugOf(s.id))));
  const order = only === undefined ? entries : only.map((o) => entries.find((e) => slugOf(e.id) === o)).filter((e): e is SampleEntry => e !== undefined);
  const pathOut = path.join(outDir, kind);
  const cassettes = path.join(outDir, 'cassettes', kind);
  const ledgerFile = path.join(outDir, `${kind}-ledger.json`);
  const ledger = estimate ? { cap, spent: 0, snapshots: {} } as Ledger : readLedger(ledgerFile, cap);
  fs.mkdirSync(pathOut, { recursive: true });
  let exit = 0;
  for (const s of order) {
    const slug = slugOf(s.id);
    const done = ledger.snapshots[slug];
    if (!estimate && done !== undefined && done.status === 'complete') { out(`${slug}: complete earlier (${String(done.calls)} calls)`); continue; }
    const remaining = cap - ledger.spent;
    if (!estimate && remaining <= 0) {
      ledger.snapshots[slug] = { calls: 0, cacheHits: 0, budgetSkipped: 0, invalid: 0, budgetGiven: 0, status: 'not-run-cap', line: 'cap reached before this snapshot' };
      out(`${slug}: NOT RUN, the cap of ${String(cap)} is spent`);
      continue;
    }
    const project = path.join(work, slug);
    const common = ['--project', project, '--spec', SPEC, '--provider', 'claude-cli', '--exploratory', '--runs', '2', '--budget', String(estimate ? cap : remaining), '--cassettes', cassettes, '--out', pathOut];
    const script = kind === 'c1d' ? 'scripts/v1.3/ontology-run.ts' : 'scripts/v1.4/c4-run.ts';
    const extra = kind === 'c1d' && arg(argv, '--claude-bin') !== undefined ? ['--claude-bin', arg(argv, '--claude-bin') as string] : [];
    const r = spawnSync('npx', ['tsx', script, ...common, ...extra, ...(estimate ? ['--estimate'] : [])], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const stdout = r.stdout ?? '';
    process.stdout.write(scrubText(stdout, work));
    if (r.stderr !== '') process.stderr.write(scrubText(r.stderr, work));
    if (estimate) continue;
    const c = parseCalls(stdout);
    if (c === null) { out(`${slug}: no result line (exit ${String(r.status)}); stopping`); exit = 1; break; }
    ledger.spent += c.calls;
    const status = c.budgetSkipped > 0 ? 'truncated-cap' : r.status === 0 ? 'complete' : `exit-${String(r.status)}`;
    ledger.snapshots[slug] = { ...c, line: scrubText(c.line, work), budgetGiven: remaining, status };
    fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
    out(`[ledger] ${kind} spent ${String(ledger.spent)} of ${String(cap)}; ${slug} ${status}`);
    if (status !== 'complete') { exit = r.status === 0 ? 4 : (r.status ?? 1); if (status === 'truncated-cap') continue; break; }
  }
  if (!estimate) fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  scrubTree(pathOut, work);
  return exit;
}

// ── analyse (zero calls) ────────────────────────────────────────────────────────────────────────────────────────────

interface C4RunOut { readonly output?: { readonly intentMatch?: { status?: string }; readonly exceptionClaim?: { claimed?: boolean; citation?: { path?: string; startLine?: number; quote?: string } | null }; readonly severityClass?: string } | null }

/** Files in a tree that the agent did not write: the skeleton's and the task's. Everything else is agent-written. */
function citationProvenance(citedPath: string): 'agent-written' | 'spec' {
  return citedPath.startsWith('.daedalus/') ? 'spec' : 'agent-written';
}

async function analyse(argv: readonly string[]): Promise<number> {
  const work = arg(argv, '--work');
  const outDir = arg(argv, '--out');
  const threshold = Number(arg(argv, '--threshold') ?? '0.75');
  if (work === undefined || outDir === undefined) { out('analyse needs --work and --out'); return 2; }
  const parsed = await parseSpec({ specFilePath: SPEC });
  if (!parsed.success) throw new Error('spec');
  const layers = parsed.data.layerModel;
  const a = JSON.parse(fs.readFileSync(ANALYSIS, 'utf8')) as { countedIdentities: { cell: string; block: string; step: number; ruleId: string; file: string; target: string }[] };
  const rows: unknown[] = [];
  for (const s of sample()) {
    const slug = slugOf(s.id);
    const factsFile = path.join(outDir, 'c1d', slug, 'facts.json');
    const row: Record<string, unknown> = { id: s.id, cell: s.cell, task: s.task, rep: s.rep, blocking: s.blocking };
    if (fs.existsSync(factsFile)) {
      const facts = JSON.parse(fs.readFileSync(factsFile, 'utf8')) as FactsFile;
      const model = facts.facts.filter((f) => f.source === 'model');
      const hi = model.filter((f) => f.confidence !== null && f.confidence >= threshold);
      const byPred = (fs1: typeof model): Record<string, number> => fs1.reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.predicate]: (acc[f.predicate] ?? 0) + 1 }), {});
      const conf = model.map((f) => f.confidence).filter((c): c is number => c !== null).sort((x, y) => x - y);
      const input = await prepareOntologyInput(path.join(work, slug), { layerModel: layers });
      const sem = async (ff: FactsFile): Promise<unknown> => {
        const repo = new MemoryGraphRepository();
        const loaded = await loadFacts(input.apg, layers, ff, repo);
        if (!loaded.success) return { error: loaded.errors.map((e) => e.message).join('; ') };
        const v = await runSemRules(repo, ff, ff.producer.factPolicy);
        return v.success ? v.data.map((x) => ({ rule: x.rule, sites: x.sites.map((id) => input.apg.nodes.find((n) => n.id === id)?.name ?? id), ...(x.verified !== undefined ? { verified: x.verified } : {}) })) : { error: v.errors.map((e) => e.message).join('; ') };
      };
      const filtered: FactsFile = { ...facts, facts: facts.facts.filter((f) => f.source !== 'model' || (f.confidence !== null && f.confidence >= threshold)) };
      row.c1d = {
        factsTotal: facts.facts.length, parserFacts: facts.facts.length - model.length, modelFacts: model.length,
        modelByPredicate: byPred(model), modelByAgreement: model.reduce<Record<string, number>>((acc, f) => ({ ...acc, [String(f.agreement)]: (acc[String(f.agreement)] ?? 0) + 1 }), {}),
        confidence: conf.length === 0 ? null : { min: conf[0], median: conf[Math.floor(conf.length / 2)], max: conf[conf.length - 1] },
        atOrAboveThreshold: { threshold, modelFacts: hi.length, byPredicate: byPred(hi) },
        semVerdictsAll: await sem(facts), semVerdictsThreshold: await sem(filtered),
      };
    } else row.c1d = null;
    const a5File = path.join(outDir, 'c4', slug, 'interpretations.json');
    if (fs.existsSync(a5File)) {
      const a5 = JSON.parse(fs.readFileSync(a5File, 'utf8')) as { entries: { findingId: string; finding: { rule: string; files: readonly string[] }; runs: readonly C4RunOut[]; merged: { exception: { claimed: boolean; stability: string; citation: { path: string; startLine: number; quote: string } | null } } & Record<string, unknown> }[] };
      const findings = a5.entries.map((e) => ({
        findingId: e.findingId, rule: e.finding.rule, files: e.finding.files,
        runs: e.runs.map((r) => ({ intent: r.output?.intentMatch?.status ?? null, exception: r.output?.exceptionClaim?.claimed ?? null, severity: r.output?.severityClass ?? null })),
        merged: e.merged,
        stableException: e.merged.exception.claimed && e.merged.exception.stability === 'agreed' && e.merged.exception.citation !== null,
        citationProvenance: e.merged.exception.citation === null ? null : citationProvenance(e.merged.exception.citation.path),
      }));
      const block = `${s.task}/rep${String(s.rep)}`;
      const counted = a.countedIdentities.filter((c) => c.cell === s.cell && c.block === block);
      const excused = (legitOnly: boolean): number => counted.filter((c) => findings.some((f) => f.stableException && (!legitOnly || f.citationProvenance === 'spec') && f.files.includes(c.file) && f.files.includes(c.target))).length;
      row.c4 = { findings, D: counted.length, D_sem: counted.length - excused(true), D_semAnyCitation: counted.length - excused(false), evasionCandidates: findings.filter((f) => f.stableException && f.citationProvenance === 'agent-written').length };
    }
    rows.push(row);
  }
  const file = path.join(outDir, 'analysis.json');
  fs.writeFileSync(file, `${scrubText(JSON.stringify({ threshold, spec: SPEC, rows }, null, 2), work)}\n`);
  out(`wrote ${file}`);
  return 0;
}

export async function main(argv: readonly string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (cmd === 'materialise') return materialise(rest);
  if (cmd === 'c1d' || cmd === 'c4') return runPath(cmd, rest);
  if (cmd === 'analyse') return analyse(rest);
  out('commands: materialise | c1d | c4 | analyse');
  return 2;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]).endsWith(path.join('scripts', 'v1.4', 'semantic-sample.ts'))) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
}
