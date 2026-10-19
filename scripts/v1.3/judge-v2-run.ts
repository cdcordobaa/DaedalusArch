/**
 * Judge v2 development runs on the judge-catch items (TUNE / CHECK split). DEVELOPMENT SET ONLY.
 *
 * Phases (repository root):
 *   harvest <round> <work> --out <dir>
 *       For every target of `<work>/plan.json` (the re-seeded round, `judge-catch-run.ts plan`), a MOCK evaluate with
 *       `--judge-version v2` and the round's crafted baseline report: the product path builds the v2 prompts (graph
 *       view from Neo4j, cheap flags, v2 rubric) and the mock cassette stores them. No model call. Writes
 *       `<dir>/prompts-<round>.json`: one record per (target, function, unit) with its prompt.
 *   record --split <TUNE|CHECK> --runs <n> --label <name> --prompts <dir> [--budget <n>] [--ledger <file>]
 *       Judges every item of the split with the harvested prompts through ONE isolated Claude CLI provider (one
 *       ADR-018 pre-flight and init probe per process), wrapped in the cassette decorator (record mode, cassettes in
 *       `tests/fixtures/judge-cassettes-v13/judge-v2/<label>`). Run indices 0..n-1, the v2 persona as system prompt:
 *       the request is the pipeline's own, so `firewall evaluate --judge-version v2 --cassette-mode replay` answers
 *       from these cassettes. Writes `results/v1.3-judge-v2/<label>/verdicts.json`. A stop (usage limit, auth,
 *       isolation) ends the phase; rerun to resume (stored entries are reused, never re-called).
 * The call ledger (`results/v1.3-judge-v2/call-ledger.json`) counts every attempt and init probe of every phase.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseLLMOptions } from '../../src/cli/llm-options.js';
import { createJudgeProvider } from '../../src/llm-critic/provider-factory.js';
import { disposeJudgeProvider } from '../../src/llm-critic/judge-stage.js';
import { JUDGE_V2_PERSONA, JUDGE_V2_REVISION, computeJudgeV2Sha256 } from '../../src/llm-critic/judge-v2.js';
import type { CriticVerdict } from '../../src/llm-critic/types.js';
import { readSplit } from './judge-v2-split.js';
import type { SplitItem } from './judge-v2-split.js';

const REPO = process.cwd();
export const RESULTS = 'results/v1.3-judge-v2';
export const CASSETTES = 'tests/fixtures/judge-cassettes-v13/judge-v2';

interface PlanTarget { readonly id: string; readonly kind: string; readonly projectDir: string; readonly specPath: string; readonly units: Record<string, string[]> }

export interface PromptRecord {
  readonly round: string;
  readonly targetId: string;
  readonly functionId: string;
  readonly unitId: string;
  readonly prompt: string;
}

export interface ItemVerdict {
  readonly itemId: string;
  readonly runs: readonly { readonly runIndex: number; readonly valid: boolean; readonly pass?: boolean; readonly confidence?: number; readonly violations?: CriticVerdict['violations']; readonly reasoning?: string }[];
  /** Majority of the valid runs (`fail` / `pass` / `warning`, `invalid` with fewer than 1 valid run). */
  readonly verdict: 'pass' | 'fail' | 'warning' | 'invalid';
}

function arg(argv: readonly string[], name: string, dflt: string): string {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : dflt;
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

const safe = (id: string): string => id.replace(/[/:]/g, '__');

function entriesIn(dir: string): { functionId: string; unitId?: string; prompt?: string; runIndex: number }[] {
  const out: { functionId: string; unitId?: string; prompt?: string; runIndex: number }[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const sub of fs.readdirSync(dir)) {
    const p = path.join(dir, sub);
    if (sub === '_incomplete' || !fs.statSync(p).isDirectory()) continue;
    for (const f of fs.readdirSync(p).filter((x) => x.endsWith('.json'))) out.push(readJson(path.join(p, f)));
  }
  return out;
}

function harvest(round: string, work: string, outDir: string, version: 'v1' | 'v2'): number {
  const { targets } = readJson<{ targets: PlanTarget[] }>(path.join(work, 'plan.json'));
  const records: PromptRecord[] = [];
  const tsx = path.resolve(REPO, 'node_modules/.bin/tsx');
  for (const t of targets) {
    const cas = path.join(work, `${version}-harvest-cassettes`, safe(t.id));
    fs.rmSync(cas, { recursive: true, force: true });
    const args = ['bin/firewall.ts', 'evaluate', '--post-seal', 'off', '--project', t.projectDir, '--spec', t.specPath, '--format', 'json',
      '--neo4j-uri', process.env['NEO4J_URI'] ?? '', '--engine', 'neo4j', '--llm-provider', 'mock', '--judge-version', version,
      '--cassette-dir', cas, '--judge-baseline-report', path.join(work, 'baseline', `${safe(t.id)}.json`)];
    const r = spawnSync(tsx, args, { cwd: REPO, env: process.env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 3_600_000 });
    const got = entriesIn(cas).filter((e) => e.runIndex === 0 && e.prompt !== undefined);
    const want = Object.entries(t.units).flatMap(([fn, us]) => us.map((u) => `${fn}|${u}`));
    const seen = new Set(got.map((e) => `${e.functionId}|${e.unitId ?? ''}`));
    const missing = want.filter((w) => !seen.has(w));
    if (missing.length > 0) {
      process.stderr.write(`${t.id}: exit ${String(r.status)}; no v2 prompt for ${missing.join(', ')}: ${r.stderr.slice(-600)}\n`);
      return 1;
    }
    for (const e of got) {
      if (!want.includes(`${e.functionId}|${e.unitId ?? ''}`)) continue;
      records.push({ round, targetId: t.id, functionId: e.functionId, unitId: e.unitId ?? '', prompt: e.prompt ?? '' });
    }
    const flagsWarn = /JUDGE_V2_FLAGS_UNAVAILABLE/.test(r.stdout + r.stderr);
    process.stderr.write(`${t.id}: ${String(got.length)} prompt(s)${flagsWarn ? ' (FLAGS UNAVAILABLE)' : ''}\n`);
  }
  records.sort((a, b) => (`${a.targetId}|${a.functionId}|${a.unitId}` < `${b.targetId}|${b.functionId}|${b.unitId}` ? -1 : 1));
  writeJson(path.join(outDir, `prompts-${round}.json`), { judgeVersion: version, revision: version === 'v2' ? JUDGE_V2_REVISION : 'v1-frozen', judgeV2Sha256: computeJudgeV2Sha256(), records });
  process.stdout.write(`${round}: ${String(records.length)} prompts\n`);
  return 0;
}

interface Ledger { calls: number; phases: { label: string; at: string; judgeAttempts: number; initProbes: number; hits: number; stop?: string }[] }

function majority(runs: ItemVerdict['runs']): ItemVerdict['verdict'] {
  const valid = runs.filter((r) => r.valid);
  if (valid.length === 0) return 'invalid';
  const fails = valid.filter((r) => r.pass === false).length;
  if (fails * 2 > valid.length) return 'fail';
  if ((valid.length - fails) * 2 > valid.length) return 'pass';
  return 'warning';
}

async function record(argv: readonly string[]): Promise<number> {
  const splitName = arg(argv, '--split', '');
  const runs = Number(arg(argv, '--runs', '1'));
  const label = arg(argv, '--label', '');
  const promptsDir = arg(argv, '--prompts', '');
  const budget = Number(arg(argv, '--budget', '600'));
  const only = arg(argv, '--only', '');
  const version = arg(argv, '--judge-version', 'v2') as 'v1' | 'v2';
  const ledgerFile = path.resolve(REPO, arg(argv, '--ledger', `${RESULTS}/call-ledger.json`));
  if ((splitName !== 'TUNE' && splitName !== 'CHECK') || label === '' || promptsDir === '') {
    process.stderr.write('record needs --split TUNE|CHECK --label <name> --prompts <dir>\n');
    return 2;
  }
  const split = readSplit(path.resolve(REPO, `${RESULTS}/split.json`));
  let items: SplitItem[] = split.items.filter((i) => i.split === splitName);
  if (only !== '') {
    const allow = new Set(only.split(','));
    items = items.filter((i) => allow.has(i.itemId));
  }
  const prompts = new Map<string, PromptRecord>();
  for (const f of fs.readdirSync(promptsDir).filter((x) => x.startsWith('prompts-'))) {
    const file = readJson<{ revision: string; judgeVersion?: string; records: PromptRecord[] }>(path.join(promptsDir, f));
    if ((file.judgeVersion ?? 'v2') !== version) {
      process.stderr.write(`${f}: harvested for ${file.judgeVersion ?? 'v2'}, this phase judges ${version}\n`);
      return 2;
    }
    if (version === 'v2' && file.revision !== JUDGE_V2_REVISION) {
      process.stderr.write(`${f}: harvested with revision ${file.revision}, the code is ${JUDGE_V2_REVISION}; re-harvest\n`);
      return 2;
    }
    for (const r of file.records) prompts.set(`${r.round}|${r.targetId}|${r.functionId}|${r.unitId}`, r);
  }
  const missing = items.filter((i) => !prompts.has(i.itemId));
  if (missing.length > 0) {
    process.stderr.write(`${String(missing.length)} item(s) without a harvested prompt, e.g. ${missing[0]?.itemId ?? ''}\n`);
    return 2;
  }
  const ledger: Ledger = fs.existsSync(ledgerFile) ? readJson<Ledger>(ledgerFile) : { calls: 0, phases: [] };
  // Projected calls: distinct (prompt, runIndex) pairs not yet in the cassette dir are at most items × runs.
  const distinct = new Set(items.map((i) => prompts.get(i.itemId)?.prompt ?? '')).size;
  if (ledger.calls + distinct * runs + 1 > budget) {
    process.stdout.write(`budget: ${String(ledger.calls)} used; this phase needs up to ${String(distinct * runs + 1)}; refusing\n`);
    return 4;
  }

  const cassetteDir = path.resolve(REPO, CASSETTES, label);
  const parsed = parseLLMOptions(['--llm-provider=claude-cli', '--cassette-mode=record', `--cassette-dir=${cassetteDir}`], process.env, { projectRoot: path.resolve(promptsDir) });
  if (!parsed.success) {
    process.stderr.write(`${parsed.errors[0]?.message ?? 'bad options'}\n`);
    return 2;
  }
  const config = parsed.data;
  const wrapped = await createJudgeProvider(config, { judgeConfigDir: config.judgeConfigDir }, {});
  const phase: Ledger['phases'][number] = { label, at: new Date().toISOString(), judgeAttempts: 0, initProbes: 0, hits: 0 };
  if (!wrapped.success) {
    const e = wrapped.errors[0];
    phase.stop = `${e?.code ?? ''}: ${e?.message ?? ''}`;
    // A pre-flight that reached the init probe made one call (a version or listing failure made none).
    phase.initProbes = /LLM_USAGE_LIMIT|LLM_AUTH|Init probe/.test(phase.stop) ? 1 : 0;
    ledger.calls += phase.initProbes;
    ledger.phases.push(phase);
    writeJson(ledgerFile, ledger);
    process.stdout.write(`pre-flight failed: ${phase.stop}\n`);
    return 3;
  }
  const cassette = wrapped.data;
  phase.initProbes = 1;
  ledger.calls += 1;
  const llm = config.run.llm;
  const out = new Map<string, ItemVerdict['runs'][number][]>();
  const jobs: { item: SplitItem; runIndex: number }[] = [];
  for (const item of items) for (let runIndex = 0; runIndex < runs; runIndex++) jobs.push({ item, runIndex });
  let next = 0;
  let stopped: string | undefined;
  const worker = async (): Promise<void> => {
    while (stopped === undefined && next < jobs.length) {
      const job = jobs[next++];
      if (job === undefined) break;
      const p = prompts.get(job.item.itemId);
      if (p === undefined) continue;
      const res = await cassette.judge(p.prompt, llm, {
        runIndex: job.runIndex, repetition: 0, functionId: job.item.functionId, unitId: job.item.unitId,
        ...(version === 'v2' ? { systemPrompt: JUDGE_V2_PERSONA } : {}),
      });
      if (res.kind === 'stop') {
        stopped = `${res.stop}: ${res.message}`;
        break;
      }
      if (res.hit) phase.hits++;
      else phase.judgeAttempts += res.entry.attempts;
      const v = res.verdict;
      const run = res.outcome.kind === 'valid' && v !== null
        ? { runIndex: job.runIndex, valid: true, pass: v.pass, confidence: v.confidence, violations: v.violations, reasoning: v.reasoning }
        : { runIndex: job.runIndex, valid: false };
      out.set(job.item.itemId, [...(out.get(job.item.itemId) ?? []), run]);
      if ((phase.judgeAttempts + phase.hits) % 10 === 0) process.stderr.write(`${label}: ${String(phase.judgeAttempts)} calls, ${String(phase.hits)} hits\n`);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  disposeJudgeProvider(cassette.innerProvider);
  ledger.calls += phase.judgeAttempts;
  if (stopped !== undefined) phase.stop = stopped.replace(/\/(Users|Volumes|private)\/[^\s'"]*/g, '<path>');
  ledger.phases.push(phase);
  writeJson(ledgerFile, ledger);
  const verdicts: ItemVerdict[] = items.map((i) => {
    const rs = [...(out.get(i.itemId) ?? [])].sort((a, b) => a.runIndex - b.runIndex);
    return { itemId: i.itemId, runs: rs, verdict: majority(rs) };
  });
  writeJson(path.resolve(REPO, `${RESULTS}/${label}/verdicts.json`), {
    split: splitName, runs, judgeVersion: version, revision: version === 'v2' ? JUDGE_V2_REVISION : 'v1-frozen', judgeV2Sha256: computeJudgeV2Sha256(), complete: stopped === undefined, verdicts,
  });
  process.stdout.write(`${label}: ${String(phase.judgeAttempts)} calls + 1 init probe, ${String(phase.hits)} hits; ledger ${String(ledger.calls)}${stopped !== undefined ? `; STOPPED ${phase.stop ?? ''}` : ''}\n`);
  return stopped === undefined ? 0 : 3;
}

export async function main(argv: readonly string[]): Promise<number> {
  const [phase, a, b] = argv;
  if (phase === 'harvest' && a !== undefined && b !== undefined) {
    return harvest(a, path.resolve(b), path.resolve(arg(argv, '--out', '')), arg(argv, '--judge-version', 'v2') as 'v1' | 'v2');
  }
  if (phase === 'record') return record(argv);
  process.stderr.write('usage: judge-v2-run.ts harvest <round> <work> --out <dir> | record --split TUNE|CHECK --runs n --label l --prompts dir\n');
  return 2;
}

if (process.argv[1]?.endsWith('judge-v2-run.ts') === true) void main(process.argv.slice(2)).then((c) => { process.exitCode = c; });
