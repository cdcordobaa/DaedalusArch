/**
 * CLI of the judge model robustness experiment (ADR-038; `scripts/judge-robustness.ts`).
 * Usage (repository root):
 *   npx tsx scripts/judge-robustness-cli.ts select     write experiments/judge-robustness/sample.json (pure, seeded)
 *   npx tsx scripts/judge-robustness-cli.ts run        live Sonnet calls through the pinned judge route (resumable)
 *   npx tsx scripts/judge-robustness-cli.ts score      write results/judge-robustness/*.csv and summary.json
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createLLMProvider, wrapJudgeProvider } from '../src/llm-critic/provider-factory.js';
import { ClaudeCliProvider } from '../src/llm-critic/claude-cli-provider.js';
import { JUDGE_EFFORT, JUDGE_MAX_TOKENS, JUDGE_MODEL, RUNS_PER_EVALUATION } from '../src/llm-critic/frozen.js';
import { checkPreRegistration } from './lib/prereg.js';
import {
  BOOTSTRAP_SEED,
  CASSETTE_DIR,
  PER_STRATUM,
  RESULTS_DIR,
  ROBUSTNESS_MODEL,
  SAMPLE_FILE,
  SAMPLE_SEED,
  callOrder,
  drawSample,
  eligibleUnits,
  scoreRobustness,
} from './judge-robustness.js';
import type { Sample } from './judge-robustness.js';

const JUDGE_CLI = path.join(os.homedir(), '.firewall/judge-cli/node_modules/.bin/claude');
const USAGE_PAUSE_MS = 30 * 60_000;

function cliProvider(model: string, mode: 'record' | 'replay'): ClaudeCliProvider {
  const p = createLLMProvider({ provider: 'claude-cli', claudeCli: { binary: JUDGE_CLI, model }, cassette: { mode, dir: CASSETTE_DIR } } as never);
  if (!(p instanceof ClaudeCliProvider)) throw new Error('JUDGE_ROBUSTNESS: not the Claude CLI provider');
  return p;
}

const argvFlagsFor = (model: string): readonly string[] =>
  cliProvider(model, 'replay').requestArgvFlags({ model, effort: JUDGE_EFFORT, maxTokens: JUDGE_MAX_TOKENS }, { runIndex: 0, repetition: 0, functionId: '' });

async function main(argv: readonly string[], repoRoot: string): Promise<number> {
  const [cmd] = argv;
  const sampleFile = path.join(repoRoot, SAMPLE_FILE);
  if (cmd === 'select') {
    const { units, exclusions } = eligibleUnits(repoRoot, argvFlagsFor);
    const drawn = drawSample(units);
    const sample: Sample = {
      adr: 'ADR-038', model: ROBUSTNESS_MODEL, frozenModel: JUDGE_MODEL, effort: JUDGE_EFFORT, maxTokens: JUDGE_MAX_TOKENS,
      runsPerUnit: RUNS_PER_EVALUATION, seed: SAMPLE_SEED, bootstrapSeed: BOOTSTRAP_SEED, perStratum: PER_STRATUM,
      strata: drawn.strata, exclusions, units: drawn.units,
    };
    fs.mkdirSync(path.dirname(sampleFile), { recursive: true });
    fs.writeFileSync(sampleFile, `${JSON.stringify(sample, null, 2)}\n`);
    process.stdout.write(`${String(units.length)} eligible; strata ${JSON.stringify(drawn.strata)}; exclusions ${JSON.stringify(exclusions)}\n`);
    return 0;
  }
  const sample = JSON.parse(fs.readFileSync(sampleFile, 'utf8')) as Sample;
  if (cmd === 'run') {
    const gate = checkPreRegistration({ repoRoot, planPath: 'experiments/judge-robustness/plan.json', specPaths: [], records: [], now: new Date() });
    if (!gate.ok) {
      process.stderr.write(`${gate.code} (${gate.refusal}): ${gate.detail}\n`);
      return 1;
    }
    process.stdout.write(`pre-registration v${String(gate.prereg.version)} ok\n`);
    let made = 0;
    for (;;) {
      // The isolation pre-flight (ADR-018: CLI pin, config-dir allow-list, init probe) runs on every (re)start.
      const wrapped = await wrapJudgeProvider(cliProvider(ROBUSTNESS_MODEL, 'record'), { mode: 'record', dir: path.join(repoRoot, CASSETTE_DIR) });
      if (!wrapped.success) {
        const text = JSON.stringify(wrapped.errors);
        if (/USAGE_LIMIT/.test(text)) {
          process.stdout.write(`usage limit at the pre-flight; registered pause ${String(USAGE_PAUSE_MS / 60000)} min\n`);
          await new Promise((r) => setTimeout(r, USAGE_PAUSE_MS));
          continue;
        }
        process.stderr.write(`JUDGE_ROBUSTNESS_PREFLIGHT: ${text}\n`);
        return 1;
      }
      const provider = wrapped.data;
      let paused = false;
      for (const u of callOrder(sample)) {
        const prompt = (JSON.parse(fs.readFileSync(path.join(repoRoot, u.source === 'E7' ? 'experiments/e7-corpus/cassettes' : 'experiments/e1-grid/cassettes', u.opusRequestHash.slice(0, 2), `${u.opusRequestHash}-r0-0.json`), 'utf8')) as { prompt: string }).prompt;
        for (let runIndex = 0; runIndex < RUNS_PER_EVALUATION; runIndex++) {
          const options = { model: ROBUSTNESS_MODEL, effort: JUDGE_EFFORT, maxTokens: JUDGE_MAX_TOKENS };
          const call = { runIndex, repetition: 0, functionId: u.functionId, unitId: u.unitId };
          const keyed = provider.keyOf(prompt, options, call);
          if (keyed === null || keyed.key !== `${u.sonnetRequestHash}-r0-${String(runIndex)}`) {
            process.stderr.write(`JUDGE_ROBUSTNESS_KEY_MISMATCH: ${u.runId} ${u.unitId}\n`);
            return 1;
          }
          const r = await provider.judge(prompt, options, call);
          if (r.kind === 'stop') {
            if (r.stop === 'USAGE_LIMIT') {
              process.stdout.write(`usage limit after ${String(made)} new calls; registered pause ${String(USAGE_PAUSE_MS / 60000)} min, then resume\n`);
              await new Promise((res) => setTimeout(res, USAGE_PAUSE_MS));
              paused = true;
              break;
            }
            process.stderr.write(`JUDGE_ROBUSTNESS_STOP ${r.stop}: ${r.message}\n`);
            return 1;
          }
          if (!r.hit) {
            made++;
            process.stdout.write(`${String(made)} ${u.source} ${u.functionId} ${u.runId} ${u.unitId} r${String(runIndex)}: ${r.outcome.kind}${r.verdict !== null ? ` ${r.verdict.pass ? 'pass' : 'fail'}` : ''}\n`);
          }
        }
        if (paused) break;
      }
      if (!paused) break;
    }
    process.stdout.write(`done: ${String(made)} new calls\n`);
    return 0;
  }
  if (cmd === 'score') {
    process.stdout.write(`${JSON.stringify(scoreRobustness(repoRoot, sample, path.join(repoRoot, RESULTS_DIR)), null, 2)}\n`);
    return 0;
  }
  process.stderr.write('usage: judge-robustness-cli.ts select | run | score\n');
  return 2;
}

void main(process.argv.slice(2), process.cwd()).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
