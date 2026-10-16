/**
 * EXPLORATORY, NOT PRE-REGISTERED. A second-vendor neural rater (Gemini through the Antigravity CLI, `agy`) on the
 * same 138 CHECK-2 items, with exactly the v2.2 prompts and persona the Claude judge receives and the same verdict
 * schema. One run per item. Nothing here feeds the pre-fixed decision rule of `Docs/v1.3/judge-v22-plan.md` §5.
 *
 *   npx tsx scripts/v1.3/judge-v22-check2-gemini.ts record --tmp-root <neutral dir outside any repo> [--budget 160]
 *   npx tsx scripts/v1.3/judge-v22-check2-gemini.ts analyse
 *
 * record: the committed v2.2 prompts (`results/v1.3-judge-v22/prompts/check2-v2.2.json`, hashes checked), the
 *   persona `JUDGE_V22_PERSONA` (agy has no system channel, so `composeAgyPrompt` prepends it, as the labeller route
 *   does), the frozen verdict schema, through the cassette decorator in record mode, one call at a time.
 *   Cassettes: `tests/fixtures/judge-cassettes-v13/judge-v22/check2-gemini-v2.2/`. Resumable: stored entries are
 *   replayed. The provider's isolation pre-flight is reused except the version pin: agy self-updated past the
 *   labeller pin (`AGY_PINNED_VERSION`); the version found is accepted only if it is the one given in
 *   `--accept-version` and is stored in every cassette entry.
 * analyse: Gemini alone vs Claude v2.2 and v1 (majority of 3); Cohen's kappa of Gemini vs Claude v2.2 on the unit
 *   verdicts; two ensemble rules (fail if BOTH fail; fail if EITHER fails); per family, per style, the layered
 *   business clean units. Writes `results/v1.3-judge-v22/check2-gemini-analysis.md` and `.json`.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  AGY_HOME_DEFAULT, AgyCliProvider, buildAgyChildEnv, checkAgyHome, createAgyNeutralCwd, expandHome, parseAgyVersion,
} from '../../src/llm-critic/agy-cli-provider.js';
import type { AgyIsolation } from '../../src/llm-critic/agy-cli-provider.js';
import { CassetteLLMProvider, interpretTextAnswer } from '../../src/llm-critic/cassette-provider.js';
import { canonicalJSON, sha256Hex } from '../../src/llm-critic/canonical-json.js';
import { JUDGE_V22_PERSONA, computeJudgeV22Sha256 } from '../../src/llm-critic/judge-v22.js';
import { JUDGE_MAX_TOKENS } from '../../src/llm-critic/frozen.js';
import { VERDICT_SCHEMA_TEXT } from '../../src/llm-critic/verdict-schema.js';
import { DomainResult } from '../../src/shared/errors/domain-result.js';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { cohenKappa } from '../lib/stats.js';
import { CASSETTES22, FAMILIES, RESULTS22, readCheck2Split } from './judge-v22-check2.js';
import type { Check2Item, Check2Prompts } from './judge-v22-check2.js';
import { fmt, metricsOf } from './judge-v2-score.js';
import type { Metrics } from './judge-v2-score.js';
import type { ItemVerdict } from './judge-v2-run.js';
import type { SplitItem } from './judge-v2-split.js';

const REPO = process.cwd();
export const GEMINI_MODEL = 'gemini-4-argon-high'; // `agy models`: "Gemini 4 Argon (High)"
const LABEL = 'check2-gemini-v2.2';
const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');
const readJson = <T>(f: string): T => JSON.parse(fs.readFileSync(f, 'utf8')) as T;
function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
function arg(argv: readonly string[], name: string, dflt: string): string {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : dflt;
}

function loadV22Prompts(): Check2Prompts {
  const file = readJson<Check2Prompts>(path.resolve(REPO, RESULTS22, 'prompts', 'check2-v2.2.json'));
  if (file.itemsSha256 !== readCheck2Split().itemsSha256) throw new Error('prompts v2.2: harvested for another item list');
  if (file.textSha256 !== computeJudgeV22Sha256()) throw new Error('prompts v2.2: other v2.2 texts');
  for (const r of file.records) if (sha256(r.prompt) !== r.promptSha256) throw new Error(`prompts v2.2: ${r.itemId} was edited`);
  return file;
}

/** The labeller provider with its own pre-flight, except that the version found must equal `acceptVersion`. */
class ExploratoryAgyProvider extends AgyCliProvider {
  private prepared: Promise<DomainResult<AgyIsolation>> | null = null;
  constructor(private readonly home: string, private readonly acceptVersion: string, private readonly tmpRoot: string, private readonly runner: NodeProcessRunner, private readonly env: NodeJS.ProcessEnv) {
    super({ model: GEMINI_MODEL, home, mode: 'record' }, { runner, tmpRoot, parentEnv: env });
  }
  override prepare(): Promise<DomainResult<AgyIsolation>> {
    this.prepared ??= (async (): Promise<DomainResult<AgyIsolation>> => {
      const cwd = createAgyNeutralCwd(this.tmpRoot);
      if (!cwd.success) return DomainResult.fail(cwd.errors);
      const env = buildAgyChildEnv(this.env, this.home);
      const run = async (args: readonly string[]): Promise<string> => {
        const r = await this.runner.run('agy', args, { cwd: cwd.data, env, timeoutMs: 15_000, stdin: '' });
        return r.success ? r.data.stdout.trim() : '';
      };
      try {
        const found = parseAgyVersion(await run(['--version']));
        if (found !== this.acceptVersion) return DomainResult.fail([{ code: 'LLM_CLI_VERSION_DRIFT', message: `agy ${String(found)} is not the accepted ${this.acceptVersion}` }]);
        const home = checkAgyHome(this.home);
        if (home.problems.length > 0) return DomainResult.fail([{ code: 'LLM_CLI_ISOLATION', message: `agy home fails: ${home.problems.join('; ')}` }]);
        const mcp = await run(['mcp', 'list']);
        const plugins = await run(['plugin', 'list']);
        if (mcp !== 'No MCP servers configured.') return DomainResult.fail([{ code: 'LLM_CLI_ISOLATION', message: 'agy mcp list reports servers' }]);
        // agy 1.3.2 printed 'No imported plugins.'; 1.3.6 prints 'No plugins installed.'
        if (plugins !== 'No imported plugins.' && plugins !== 'No plugins installed.') return DomainResult.fail([{ code: 'LLM_CLI_ISOLATION', message: 'agy plugin list reports plugins' }]);
        const facts = { cliVersion: found, mcp, plugins, configListingSha256: home.configListingSha256 };
        return DomainResult.ok({ cliVersion: found, configListingSha256: home.configListingSha256, isolationProbeSha256: sha256Hex(canonicalJSON(facts)) });
      } finally {
        fs.rmSync(cwd.data, { recursive: true, force: true });
      }
    })();
    return this.prepared;
  }
}

interface Ledger { calls: number; phases: { at: string; attempts: number; hits: number; preflight: number; stop?: string }[] }

async function record(argv: readonly string[]): Promise<number> {
  const tmpRoot = path.resolve(arg(argv, '--tmp-root', ''));
  const accept = arg(argv, '--accept-version', '1.3.6');
  const cap = Number(arg(argv, '--budget', '160'));
  if (!fs.existsSync(tmpRoot)) {
    process.stderr.write('record needs --tmp-root <existing dir outside any repository>\n');
    return 2;
  }
  const file = loadV22Prompts();
  const ledgerFile = path.resolve(REPO, RESULTS22, 'gemini-call-ledger.json');
  const ledger: Ledger = fs.existsSync(ledgerFile) ? readJson<Ledger>(ledgerFile) : { calls: 0, phases: [] };
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? '', USER: process.env.USER ?? '', LOGNAME: process.env.LOGNAME ?? '', TMPDIR: process.env.TMPDIR ?? '', LANG: 'en_US.UTF-8' };
  const home = expandHome(process.env.LABELLER_AGY_HOME ?? AGY_HOME_DEFAULT);
  const runner = new NodeProcessRunner();
  const agy = new ExploratoryAgyProvider(home, accept, tmpRoot, runner, env);
  const pre = await agy.prepare();
  if (!pre.success) {
    process.stdout.write(`pre-flight failed: ${pre.errors[0]?.code ?? ''} ${pre.errors[0]?.message ?? ''}\n`);
    return 3;
  }
  const dir = path.resolve(REPO, CASSETTES22, LABEL);
  const cassette = new CassetteLLMProvider(agy, {
    mode: 'record', dir, cliVersion: pre.data.cliVersion, isolationProbeSha256: pre.data.isolationProbeSha256,
    configListingSha256: pre.data.configListingSha256, knownSecrets: [], interpret: interpretTextAnswer,
  });
  const llm = { model: GEMINI_MODEL, maxTokens: JUDGE_MAX_TOKENS };
  const phase: Ledger['phases'][number] = { at: new Date().toISOString(), attempts: 0, hits: 0, preflight: 0 };
  const verdicts: ItemVerdict[] = [];
  let stopped: string | undefined;
  for (const rec of file.records) {
    if (stopped !== undefined) break;
    if (ledger.calls + phase.attempts >= cap) { stopped = `BUDGET: ${String(cap)} reached`; break; }
    const res = await cassette.judge(rec.prompt, llm, { runIndex: 0, repetition: 0, functionId: rec.functionId, unitId: rec.unitId, systemPrompt: JUDGE_V22_PERSONA, responseSchema: VERDICT_SCHEMA_TEXT });
    if (res.kind === 'stop') { stopped = `${res.stop}: ${res.message}`.replace(/\/(Users|Volumes|private|home)\/[^\s'"]*/g, '<path>'); break; }
    if (res.hit) phase.hits++;
    else phase.attempts += res.entry.attempts;
    const v = res.verdict;
    const run = res.outcome.kind === 'valid' && v !== null
      ? { runIndex: 0, valid: true, pass: v.pass, confidence: v.confidence, violations: v.violations, reasoning: v.reasoning }
      : { runIndex: 0, valid: false };
    verdicts.push({ itemId: rec.itemId, runs: [run], verdict: run.valid ? (run.pass === true ? 'pass' : 'fail') : 'invalid' } as ItemVerdict);
    if ((phase.attempts + phase.hits) % 10 === 0) process.stderr.write(`${LABEL}: ${String(phase.attempts)} calls, ${String(phase.hits)} hits\n`);
  }
  ledger.calls += phase.attempts;
  if (stopped !== undefined) phase.stop = stopped;
  ledger.phases.push(phase);
  writeJson(ledgerFile, ledger);
  writeJson(path.resolve(REPO, RESULTS22, LABEL, 'verdicts.json'), {
    set: 'CHECK-2', exploratory: true, preRegistered: false, runs: 1, rater: 'gemini via agy', model: GEMINI_MODEL, cliVersion: pre.data.cliVersion,
    prompts: 'check2-v2.2 (committed), persona JUDGE_V22_PERSONA prepended', textSha256: file.textSha256, complete: stopped === undefined && verdicts.length === file.records.length, verdicts,
  });
  process.stdout.write(`${LABEL}: ${String(phase.attempts)} call attempts, ${String(phase.hits)} hits; ledger ${String(ledger.calls)}${stopped !== undefined ? `; STOPPED ${stopped} (rerun to resume)` : ''}\n`);
  return stopped === undefined ? 0 : 3;
}

// ── analyse ──

type V = 'pass' | 'fail' | 'warning' | 'invalid' | 'missing';

function verdictMap(label: string): Map<string, V> {
  const f = path.resolve(REPO, RESULTS22, label, 'verdicts.json');
  const file = readJson<{ verdicts: ItemVerdict[] }>(f);
  return new Map(file.verdicts.map((x) => [x.itemId, x.verdict as V]));
}

function row(name: string, m: Metrics): string {
  return `| ${name} | ${fmt(m.caught, m.seeds)} | ${fmt(m.pairedCaught, m.seeds)} | ${fmt(m.twinFail, m.twins)} | ${fmt(m.cleanFail, m.cleanUnits)} | ${String(m.invalidUnits)} |`;
}

function analyse(): number {
  const items = readCheck2Split().items;
  const c1 = verdictMap('check2-v1');
  const c22 = verdictMap('check2-v2.2');
  const g = verdictMap(LABEL);
  const get = (m: Map<string, V>) => (i: SplitItem): V => m.get(i.itemId) ?? 'missing';
  const v1 = get(c1); const v22 = get(c22); const gem = get(g);
  const both = (i: SplitItem): V => {
    const a = v22(i); const b = gem(i);
    if (a === 'fail' && b === 'fail') return 'fail';
    if ((a === 'pass' || a === 'fail') && (b === 'pass' || b === 'fail')) return 'pass';
    return a === 'pass' || b === 'pass' ? 'pass' : 'invalid';
  };
  const either = (i: SplitItem): V => {
    const a = v22(i); const b = gem(i);
    if (a === 'fail' || b === 'fail') return 'fail';
    if (a === 'pass' && b === 'pass') return 'pass';
    return 'invalid';
  };
  const raters: [string, (i: SplitItem) => V][] = [
    ['Claude v1 (maj. of 3)', v1], ['Claude v2.2 (maj. of 3)', v22], ['Gemini v2.2 (1 run)', gem],
    ['Ensemble BOTH fail (v2.2 + Gemini)', both], ['Ensemble EITHER fails (v2.2 + Gemini)', either],
  ];
  const L: string[] = [];
  const out: Record<string, unknown> = { exploratory: true, preRegistered: false };
  L.push('EXPLORATORY, NOT PRE-REGISTERED. Gemini rater and both ensemble rules were added after the decision rule was fixed and do not enter it.', '');
  L.push('| Rater | Catch | Paired catch | Twin false fail | Clean false fail (units) | Invalid units |', '|---|---|---|---|---|---|');
  const overall: Record<string, Metrics> = {};
  for (const [n, f] of raters) { const m = metricsOf(items, f); overall[n] = m; L.push(row(n, m)); }
  out.overall = overall;
  // Agreement: unit verdicts where both are pass/fail.
  let pp = 0; let pf = 0; let fp = 0; let ff = 0;
  let excluded = 0;
  for (const i of items) {
    const a = v22(i); const b = gem(i);
    if ((a !== 'pass' && a !== 'fail') || (b !== 'pass' && b !== 'fail')) { excluded++; continue; }
    if (a === 'pass' && b === 'pass') pp++;
    else if (a === 'pass') pf++;
    else if (b === 'pass') fp++;
    else ff++;
  }
  const t = [[pp, pf], [fp, ff]];
  const n = pp + pf + fp + ff;
  const kappa = cohenKappa(t);
  const agree = (pp + ff) / n;
  out.agreement = { table: t, n, excluded, kappa, observed: agree };
  L.push('', `Agreement, Claude v2.2 vs Gemini (unit verdicts, ${String(n)} units with a pass/fail from both; ${String(excluded)} excluded): observed ${agree.toFixed(3)}, Cohen's kappa ${kappa.toFixed(3)}.`, '');
  L.push('| | Gemini pass | Gemini fail |', '|---|---|---|', `| Claude v2.2 pass | ${String(pp)} | ${String(pf)} |`, `| Claude v2.2 fail | ${String(fp)} | ${String(ff)} |`);
  // Per family.
  L.push('', '| Family | Rater | Catch | Twin false fail |', '|---|---|---|---|');
  const fam: Record<string, Record<string, Metrics>> = {};
  for (const f of FAMILIES.map((x) => x.family)) {
    const its = items.filter((i) => i.kind === 'clean' || (i as Check2Item).family === f);
    fam[f] = {};
    for (const [nm, vf] of raters) { const m = metricsOf(its, vf); (fam[f] as Record<string, Metrics>)[nm] = m; L.push(`| ${f} | ${nm} | ${fmt(m.caught, m.seeds)} | ${fmt(m.twinFail, m.twins)} |`); }
  }
  out.perFamily = fam;
  // Per style.
  L.push('', '| Style | Rater | Catch | Twin false fail | Clean false fail |', '|---|---|---|---|---|');
  const sty: Record<string, Record<string, Metrics>> = {};
  for (const s of [...new Set(items.map((i) => (i as Check2Item).style))]) {
    const its = items.filter((i) => (i as Check2Item).style === s);
    sty[s] = {};
    for (const [nm, vf] of raters) { const m = metricsOf(its, vf); (sty[s] as Record<string, Metrics>)[nm] = m; L.push(`| ${s} | ${nm} | ${fmt(m.caught, m.seeds)} | ${fmt(m.twinFail, m.twins)} | ${fmt(m.cleanFail, m.cleanUnits)} |`); }
  }
  out.perStyle = sty;
  // Layered business clean units (the §8 construct).
  const lb = items.filter((i) => i.kind === 'clean' && (i as Check2Item).layeredBusiness);
  L.push('', `Layered business clean units (n = ${String(lb.length)}), false fails:`, '');
  const lbo: Record<string, number> = {};
  for (const [nm, vf] of raters) { const k = lb.filter((i) => vf(i) === 'fail').length; lbo[nm] = k; L.push(`- ${nm}: ${fmt(k, lb.length)}`); }
  out.layeredBusinessClean = { n: lb.length, falseFails: lbo };
  // Disagreements.
  L.push('', 'Units where Claude v2.2 and Gemini disagree:');
  for (const i of items) if (v22(i) !== gem(i)) L.push(`- ${i.kind} ${(i as Check2Item).family || 'clean'} ${(i as Check2Item).style} ${i.targetId} ${i.functionId} ${i.unitId}: v2.2 ${v22(i)}, Gemini ${gem(i)}`);
  fs.writeFileSync(path.resolve(REPO, RESULTS22, 'check2-gemini-analysis.md'), `${L.join('\n')}\n`);
  writeJson(path.resolve(REPO, RESULTS22, 'check2-gemini-analysis.json'), out);
  process.stdout.write(`${L.join('\n')}\n`);
  return 0;
}

export async function main(argv: readonly string[]): Promise<number> {
  switch (argv[0]) {
    case 'record': return record(argv);
    case 'analyse': return analyse();
    default:
      process.stderr.write('usage: judge-v22-check2-gemini.ts record --tmp-root <dir> [--accept-version 1.3.6] [--budget 160] | analyse\n');
      return 2;
  }
}

if (process.argv[1]?.endsWith('judge-v22-check2-gemini.ts') === true) void main(process.argv.slice(2)).then((c) => { process.exitCode = c; });
