/**
 * Filter-and-explain (FR-V8) on the v1.3 reference projects' symbolic findings. DEVELOPMENT SET ONLY.
 *
 * Input: `results/v1.3-reference/after-member-facts` (`evidence/<style>/<variant>.json` violations, `report.json`
 * comparisons). Labels per finding row, from the reference scoring:
 *   true      a scored row matched to a planted manifest finding (`comparisons[].matched`)
 *   false     a scored row the manifests do not expect (`comparisons[].mismatches`, kind `unexpected`):
 *             FF-P02 on nestjs n03 and FF-P04 on nestjs v07
 *   unscored  a row of a rule outside the reference scoring (metrics and conventions: FF-C0x, FF-CVxx); no label
 * APG v2 advisory rows: none in this run (the reference run predates APG v2 rules).
 *
 * Phases (repository root):
 *   plan  [--work <dir>]   materialise every variant, build every finding's FE prompt, dedupe identical prompts and
 *                          select: every scored row; every distinct unscored prompt except FF-CV05; 10 FF-CV05
 *                          prompts by sha256(seed|prompt) order; project-level rows (`<project>`, no file) skipped.
 *                          Writes results/v1.3-judge-v2/filter-explain/plan.json (no call).
 *   record [--budget n]    one FE call per selected distinct prompt (one init probe), cassettes in
 *                          tests/fixtures/judge-cassettes-v13/filter-explain; shares the judge-v2 call ledger.
 *   score [--na-partial] [--bare-lines longest|finding-file]
 *                          confirm / dismiss / rejected per label, precision and recall before and after, grounding.
 *                          Grounding counts only the files and lines each prompt rendered (R19; the same as the full
 *                          files for every committed prompt, none of which was truncated).
 *                          --na-partial (opt-in, R26): rows of a partial rule's N/A half (FF-P06 FLOWS_TO /
 *                          HOLDS_STATE_OF field rows, rule-tiers.md) are labelled 'n/a' and left out of the true/false
 *                          counts. Off by default because it changes the committed scores.json (66 -> 63 true rows).
 *                          --bare-lines finding-file (opt-in, R20): see `GroundingOptions.bareLines`.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseLLMOptions } from '../../src/cli/llm-options.js';
import { createLLMProvider } from '../../src/llm-critic/provider-factory.js';
import { disposeJudgeProvider } from '../../src/llm-critic/judge-stage.js';
import { renderLayerModel } from '../../src/llm-critic/context-assembler.js';
import {
  FE_PERSONA, FE_REVISION, FE_SCHEMA_TEXT, answerOfResponse, computeFilterExplainSha256,
  createFilterExplainProvider, findingKept, outcomeOf, renderFilterExplainPrompt, shownLineCounts,
} from '../../src/llm-critic/filter-explain.js';
import type { FilterExplainOutcome, GroundingOptions, ShownFile, ShownLines, SymbolicFinding } from '../../src/llm-critic/filter-explain.js';
import { RULE_TIERS } from '../../src/scoring-engine/rule-tiers.js';
import { relTypeOf } from '../../src/scoring-engine/tiered-scoring.js';
import type { Violation as TaxonomyViolation } from '../../src/shared/taxonomy/violation-types.js';
import { parseSpec } from '../../src/spec-parser/index.js';
import { wilson } from '../lib/stats.js';
import { loadAllReferences } from './lib/reference-model.js';
import { materialiseVariant } from './lib/materialise.js';
import { assignLayers } from './lib/layer-assignment.js';

const REPO = process.cwd();
const INPUT = 'results/v1.3-reference/after-member-facts';
const OUT = 'results/v1.3-judge-v2/filter-explain';
const CASSETTES = 'tests/fixtures/judge-cassettes-v13/filter-explain';
const LEDGER = 'results/v1.3-judge-v2/call-ledger.json';
export const FE_SAMPLE_SEED = 'daedalus-v1.3-fe-sample-20261016';
export const CV05_SAMPLE = 10;

type Label = 'true' | 'false' | 'unscored' | 'n/a';

export interface FilterExplainRow {
  readonly rowId: string;            // style/variant/#index
  readonly style: string;
  readonly variant: string;
  readonly label: Label;
  readonly tier: string;
  readonly finding: SymbolicFinding;
  readonly files: readonly string[];
  readonly promptSha: string;
}

type Row = FilterExplainRow;

export interface FilterExplainPlan {
  readonly feRevision: string;
  readonly feSha256: string;
  readonly rows: readonly Row[];
  /** `shown`: the files and line counts the prompt rendered (R19); absent in plans written before it. */
  readonly prompts: Readonly<Record<string, { prompt: string; files: ShownFile[]; shown?: readonly ShownLines[] }>>;
  readonly selected: readonly string[];   // prompt shas
  readonly skipped: readonly { rowId: string; reason: string }[];
}

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');
const readJson = <T>(f: string): T => JSON.parse(fs.readFileSync(f, 'utf8')) as T;
function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
function arg(argv: readonly string[], name: string, dflt: string): string {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : dflt;
}

const SCORED_TIER: Readonly<Record<string, string>> = {
  'FF-S01': 'blocking', 'FF-S02': 'blocking', 'FF-S04': 'blocking', 'FF-P01': 'blocking', 'FF-P03': 'blocking', 'FF-P06': 'blocking',
  'FF-P02': 'advisory', 'FF-P04': 'advisory', 'FF-P05': 'advisory',
  'FF-DS01': 'blocking', 'FF-DS02': 'blocking', 'FF-DT01': 'blocking', 'FF-DT02': 'blocking', 'FF-DT03': 'blocking', 'FF-DT04': 'blocking',
  'FF-DT05': 'advisory', 'FF-DT06': 'advisory',
};

interface Comparison {
  style: string; variant: string;
  matched: { ruleId: string; file: string }[];
  mismatches: { kind: string; ruleId: string; file: string }[];
  unscored: { ruleId: string; file: string }[];
}

interface Violation {
  functionId: string; type: string; severity: string; filePath: string; message: string;
  discriminator?: string[]; evidence?: string[]; target?: string; lines?: number[]; line?: number;
}

async function plan(argv: readonly string[]): Promise<number> {
  const work = path.resolve(arg(argv, '--work', fs.mkdtempSync(path.join(os.tmpdir(), 'fe-ref-'))));
  const report = readJson<{ comparisons: Comparison[] }>(path.join(REPO, INPUT, 'report.json'));
  const comps = new Map(report.comparisons.map((c) => [`${c.style}/${c.variant}`, c]));
  const rows: Row[] = [];
  const prompts: Record<string, { prompt: string; files: ShownFile[]; shown: readonly ShownLines[] }> = {};
  const skipped: { rowId: string; reason: string }[] = [];
  for (const ref of loadAllReferences(REPO)) {
    const parsed = await parseSpec({ specFilePath: ref.specPath });
    if (!parsed.success) throw new Error(`${ref.specPath}: ${parsed.errors[0]?.message ?? 'spec'}`);
    const model = parsed.data.layerModel;
    const layerText = renderLayerModel(model.layers);
    for (const v of ref.variants) {
      const id = `${ref.style}/${v.manifest.variant}`;
      const evFile = path.join(REPO, INPUT, 'evidence', ref.style, `${v.manifest.variant}.json`);
      if (!fs.existsSync(evFile)) continue;
      const comp = comps.get(id);
      const ev = readJson<{ violations: Violation[] }>(evFile);
      const mat = materialiseVariant(ref, v, work);
      ev.violations.forEach((viol, index) => {
        const rowId = `${id}#${String(index)}`;
        const files = [...new Set([...viol.filePath.split(','), ...(viol.target !== undefined ? [viol.target] : [])])]
          .filter((f) => f !== '<project>' && fs.existsSync(path.join(mat.projectDir, f)));
        if (files.length === 0) {
          skipped.push({ rowId, reason: `no project file to show (${viol.functionId} on ${viol.filePath})` });
          return;
        }
        const own = viol.filePath.split(',');
        const isMatched = comp?.matched.some((m) => m.ruleId === viol.functionId && own.includes(m.file)) === true;
        const isFalse = comp?.mismatches.some((m) => m.kind === 'unexpected' && m.ruleId === viol.functionId && own.includes(m.file)) === true;
        const label: Label = isMatched ? 'true' : isFalse ? 'false' : 'unscored';
        const tier = SCORED_TIER[viol.functionId] ?? 'advisory (unscored)';
        const finding: SymbolicFinding = {
          functionId: viol.functionId, type: viol.type, severity: viol.severity, tier, filePath: viol.filePath, message: viol.message,
          ...(viol.discriminator !== undefined ? { discriminator: viol.discriminator } : {}),
          ...(viol.evidence !== undefined ? { evidence: viol.evidence } : {}),
          ...(viol.target !== undefined ? { target: viol.target } : {}),
          ...(viol.lines !== undefined ? { lines: viol.lines } : viol.line !== undefined ? { lines: [viol.line] } : {}),
        };
        const shown: ShownFile[] = files.map((f) => ({ path: f, content: fs.readFileSync(path.join(mat.projectDir, f), 'utf8') }));
        const layers = Object.fromEntries(assignLayers(files, model).assignments.map((a) => [a.file, a.layer]));
        const rendered = renderFilterExplainPrompt({ finding, files: shown, layerModel: layerText, fileLayers: layers });
        const prompt = rendered.prompt;
        const promptSha = sha(prompt);
        prompts[promptSha] = { prompt, files: shown, shown: rendered.shown };
        rows.push({ rowId, style: ref.style, variant: v.manifest.variant, label, tier, finding, files, promptSha });
      });
    }
  }
  // Selection: every scored row; distinct unscored prompts except FF-CV05; a seeded sample of FF-CV05.
  const selected = new Set<string>();
  for (const r of rows) if (r.label !== 'unscored') selected.add(r.promptSha);
  for (const r of rows) if (r.label === 'unscored' && r.finding.functionId !== 'FF-CV05') selected.add(r.promptSha);
  const cv05 = [...new Set(rows.filter((r) => r.label === 'unscored' && r.finding.functionId === 'FF-CV05').map((r) => r.promptSha))]
    .filter((s) => !selected.has(s))
    .sort((a, b) => (sha(`${FE_SAMPLE_SEED}|${a}`) < sha(`${FE_SAMPLE_SEED}|${b}`) ? -1 : 1));
  for (const s of cv05.slice(0, CV05_SAMPLE)) selected.add(s);
  const out: FilterExplainPlan ={ feRevision: FE_REVISION, feSha256: computeFilterExplainSha256(), rows, prompts, selected: [...selected].sort(), skipped };
  writeJson(path.join(REPO, OUT, 'plan.json'), out);
  const by = (l: Label): number => rows.filter((r) => r.label === l).length;
  process.stdout.write(`rows ${String(rows.length)} (true ${String(by('true'))}, false ${String(by('false'))}, unscored ${String(by('unscored'))}); distinct prompts ${String(Object.keys(prompts).length)}; selected ${String(selected.size)} (CV05 distinct ${String(cv05.length)}, sampled ${String(Math.min(CV05_SAMPLE, cv05.length))}); skipped ${String(skipped.length)}\n`);
  return 0;
}

interface Ledger { calls: number; phases: { label: string; at: string; judgeAttempts: number; initProbes: number; hits: number; stop?: string }[] }

async function record(argv: readonly string[]): Promise<number> {
  const budget = Number(arg(argv, '--budget', '600'));
  const p = readJson<FilterExplainPlan>(path.join(REPO, OUT, 'plan.json'));
  if (p.feSha256 !== computeFilterExplainSha256()) {
    process.stderr.write('plan.json was built with other FE texts; re-plan\n');
    return 2;
  }
  const ledgerFile = path.join(REPO, LEDGER);
  const ledger: Ledger = fs.existsSync(ledgerFile) ? readJson<Ledger>(ledgerFile) : { calls: 0, phases: [] };
  if (ledger.calls + p.selected.length + 1 > budget) {
    process.stdout.write(`budget: ${String(ledger.calls)} used; FE needs up to ${String(p.selected.length + 1)}; refusing\n`);
    return 4;
  }
  const dir = path.resolve(REPO, CASSETTES);
  const parsed = parseLLMOptions(['--llm-provider=claude-cli', '--cassette-mode=record', `--cassette-dir=${dir}`], process.env, { projectRoot: os.tmpdir() });
  if (!parsed.success) {
    process.stderr.write(`${parsed.errors[0]?.message ?? 'options'}\n`);
    return 2;
  }
  const inner = createLLMProvider(parsed.data, { judgeConfigDir: parsed.data.judgeConfigDir });
  const phase: Ledger['phases'][number] = { label: 'filter-explain', at: new Date().toISOString(), judgeAttempts: 0, initProbes: 0, hits: 0 };
  const wrapped = await createFilterExplainProvider(inner, { mode: 'record', dir });
  if (!wrapped.success) {
    phase.stop = `${wrapped.errors[0]?.code ?? ''}: ${wrapped.errors[0]?.message ?? ''}`;
    phase.initProbes = /LLM_USAGE_LIMIT|LLM_AUTH|Init probe/.test(phase.stop) ? 1 : 0;
    ledger.calls += phase.initProbes;
    ledger.phases.push(phase);
    writeJson(ledgerFile, ledger);
    process.stdout.write(`pre-flight failed: ${phase.stop}\n`);
    return 3;
  }
  phase.initProbes = 1;
  ledger.calls += 1;
  const cassette = wrapped.data;
  const llm = parsed.data.run.llm;
  const answers: Record<string, { valid: boolean; response: string }> = {};
  let next = 0;
  let stopped: string | undefined;
  const jobs = [...p.selected];
  const worker = async (): Promise<void> => {
    while (stopped === undefined && next < jobs.length) {
      const s = jobs[next++];
      if (s === undefined) break;
      const pr = p.prompts[s];
      if (pr === undefined) continue;
      const res = await cassette.judge(pr.prompt, llm, { runIndex: 0, repetition: 0, functionId: 'filter-explain', unitId: s.slice(0, 16), systemPrompt: FE_PERSONA, responseSchema: FE_SCHEMA_TEXT });
      if (res.kind === 'stop') {
        stopped = `${res.stop}: ${res.message}`;
        break;
      }
      if (res.hit) phase.hits++;
      else phase.judgeAttempts += res.entry.attempts;
      answers[s] = { valid: res.outcome.kind === 'valid', response: res.entry.response };
      if ((phase.judgeAttempts + phase.hits) % 10 === 0) process.stderr.write(`fe: ${String(phase.judgeAttempts)} calls, ${String(phase.hits)} hits\n`);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  disposeJudgeProvider(cassette.innerProvider);
  ledger.calls += phase.judgeAttempts;
  if (stopped !== undefined) phase.stop = stopped.replace(/\/(Users|Volumes|private)\/[^\s'"]*/g, '<path>');
  ledger.phases.push(phase);
  writeJson(ledgerFile, ledger);
  writeJson(path.join(REPO, OUT, 'answers.json'), { feRevision: FE_REVISION, complete: stopped === undefined, answers });
  process.stdout.write(`fe: ${String(phase.judgeAttempts)} calls + 1 init probe, ${String(phase.hits)} hits; ledger ${String(ledger.calls)}${stopped !== undefined ? `; STOPPED ${phase.stop ?? ''}` : ''}\n`);
  return stopped === undefined ? 0 : 3;
}

function fmt(k: number, n: number): string {
  if (n === 0) return '0/0';
  const w = wilson(k, n);
  return `${String(k)}/${String(n)} = ${(k / n).toFixed(2)} [${w.low.toFixed(2)}, ${w.high.toFixed(2)}]`;
}

export interface ScoreOptions extends GroundingOptions {
  /** R26 (opt-in): label the rows of a partial rule's N/A half (FF-P06 FLOWS_TO / HOLDS_STATE_OF) 'n/a'. */
  readonly naPartial?: boolean;
}

/**
 * True when the finding is in a partial rule's N/A half: `RULE_TIERS` `partial.naRelTypes` against `relTypeOf`
 * (discriminator[2], else the message), as `countsAsBlocking` in lib/mcp-consistency.ts and splitPartial do.
 */
export function isPartialNa(finding: SymbolicFinding): boolean {
  const partial = RULE_TIERS.get(finding.functionId)?.partial;
  if (partial === undefined) return false;
  const rel = relTypeOf({ discriminator: finding.discriminator, message: finding.message } as unknown as TaxonomyViolation);
  return rel !== undefined && partial.naRelTypes.includes(rel);
}

export interface ScoredRow {
  readonly rowId: string;
  readonly label: Label;
  readonly tier: string;
  readonly functionId: string;
  readonly file: string;
  readonly status: FilterExplainOutcome['status'];
  readonly kept: boolean;
  readonly [extra: string]: unknown;
}

/** The score phase without I/O: per-row outcomes, the summary and the markdown table. */
export function scoreFilterExplain(
  p: FilterExplainPlan, a: Readonly<Record<string, { valid: boolean; response: string }>>, options: ScoreOptions = {},
): { rows: ScoredRow[]; summary: Record<string, number>; md: string } {
  const grounding: GroundingOptions = options.bareLines !== undefined ? { bareLines: options.bareLines } : {};
  const selected = new Set(p.selected);
  const outcome = new Map<string, FilterExplainOutcome>();
  for (const s of p.selected) {
    const ans = a[s];
    const pr = p.prompts[s];
    // R19: ground against what the prompt rendered (identical to the full files when nothing was truncated).
    const shown = pr?.shown ?? shownLineCounts(pr?.files ?? []);
    outcome.set(s, ans === undefined ? { status: 'invalid', cause: 'NOT_RUN' } : outcomeOf(ans.valid ? answerOfResponse(ans.response) : null, shown, 'PARSE_FAILURE', grounding));
  }
  const judged = p.rows.filter((r) => selected.has(r.promptSha));
  const rowsOut: ScoredRow[] = judged.map((r) => {
    const o = outcome.get(r.promptSha) ?? { status: 'invalid', cause: 'NOT_RUN' };
    const label: Label = options.naPartial === true && r.label !== 'unscored' && isPartialNa(r.finding) ? 'n/a' : r.label;
    return {
      rowId: r.rowId, label, tier: r.tier, functionId: r.finding.functionId, file: r.finding.filePath, status: o.status,
      kept: findingKept(o),
      ...(o.status !== 'invalid' ? { decision: o.answer.decision, grounded: o.grounding.grounded, problems: o.grounding.problems, explanation: o.answer.explanation, fix: o.answer.fix, citations: o.answer.citations } : { cause: o.cause }),
    };
  });
  const count = (pred: (r: ScoredRow) => boolean): number => rowsOut.filter(pred).length;
  const lines: string[] = [];
  const t = rowsOut.filter((r) => r.label === 'true');
  const f = rowsOut.filter((r) => r.label === 'false');
  const na = count((r) => r.label === 'n/a');
  const tp0 = t.length; const fp0 = f.length;
  const tp1 = t.filter((r) => r.kept).length; const fp1 = f.filter((r) => r.kept).length;
  lines.push(`| Label | Rows | Confirm (grounded) | Dismiss (grounded) | Rejected (ungrounded) | Invalid |`);
  lines.push('|---|---|---|---|---|---|');
  const labels: Label[] = ['true', 'false', 'unscored', ...(na > 0 ? ['n/a' as const] : [])];
  for (const label of labels) {
    const rs = rowsOut.filter((r) => r.label === label);
    lines.push(`| ${label} | ${String(rs.length)} | ${fmt(rs.filter((r) => r.status === 'confirm').length, rs.length)} | ${fmt(rs.filter((r) => r.status === 'dismiss').length, rs.length)} | ${String(rs.filter((r) => r.status === 'rejected').length)} | ${String(rs.filter((r) => r.status === 'invalid').length)} |`);
  }
  const prec0 = tp0 / Math.max(1, tp0 + fp0);
  const prec1 = tp1 / Math.max(1, tp1 + fp1);
  lines.push('');
  lines.push(`Scored rows: precision before ${fmt(tp0, tp0 + fp0)}, after ${fmt(tp1, tp1 + fp1)} (gain ${(prec1 - prec0).toFixed(3)}); recall kept ${fmt(tp1, tp0)} (recall loss ${fmt(tp0 - tp1, tp0)}).`);
  if (na > 0) lines.push(`N/A rows (a partial rule's N/A half, left out of the true/false counts): ${String(na)}.`);
  const answered = rowsOut.filter((r) => r.status !== 'invalid');
  lines.push(`Grounding: ${fmt(answered.filter((r) => 'grounded' in r && r.grounded).length, answered.length)} of the valid answers grounded; invalid answers ${String(count((r) => r.status === 'invalid'))}.`);
  const distinct = [...outcome.values()];
  const g = distinct.filter((o) => o.status !== 'invalid');
  lines.push(`Distinct prompts: ${String(distinct.length)}; grounded ${fmt(g.filter((o) => o.status !== 'rejected').length, g.length)}.`);
  const byTier: string[] = ['', '| Tier | Rows | Confirm | Dismiss | Rejected |', '|---|---|---|---|---|'];
  for (const tier of [...new Set(rowsOut.map((r) => r.tier))].sort()) {
    const rs = rowsOut.filter((r) => r.tier === tier);
    byTier.push(`| ${tier} | ${String(rs.length)} | ${String(rs.filter((r) => r.status === 'confirm').length)} | ${String(rs.filter((r) => r.status === 'dismiss').length)} | ${String(rs.filter((r) => r.status === 'rejected').length)} |`);
  }
  const byRule: string[] = ['', '| Rule | Label | Rows | Confirm | Dismiss | Rejected |', '|---|---|---|---|---|---|'];
  const keys = [...new Set(rowsOut.map((r) => `${r.functionId}|${r.label}`))].sort();
  for (const k of keys) {
    const [fn, label] = k.split('|');
    const rs = rowsOut.filter((r) => r.functionId === fn && r.label === label);
    byRule.push(`| ${fn ?? ''} | ${label ?? ''} | ${String(rs.length)} | ${String(rs.filter((r) => r.status === 'confirm').length)} | ${String(rs.filter((r) => r.status === 'dismiss').length)} | ${String(rs.filter((r) => r.status === 'rejected').length)} |`);
  }
  const md = [...lines, ...byTier, ...byRule].join('\n');
  const summary: Record<string, number> = {
    tp0, fp0, tp1, fp1, precisionBefore: prec0, precisionAfter: prec1, recallKept: tp1 / Math.max(1, tp0), ...(na > 0 ? { na } : {}),
  };
  return { rows: rowsOut, summary, md };
}

function score(argv: readonly string[]): number {
  const p = readJson<FilterExplainPlan>(path.join(REPO, OUT, 'plan.json'));
  const a = readJson<{ answers: Record<string, { valid: boolean; response: string }> }>(path.join(REPO, OUT, 'answers.json')).answers;
  const bare = arg(argv, '--bare-lines', 'longest');
  if (bare !== 'longest' && bare !== 'finding-file') {
    process.stderr.write('--bare-lines must be longest or finding-file\n');
    return 2;
  }
  const { rows, summary, md } = scoreFilterExplain(p, a, { naPartial: argv.includes('--na-partial'), bareLines: bare });
  writeJson(path.join(REPO, OUT, 'scores.json'), { feRevision: p.feRevision, rows, summary });
  fs.writeFileSync(path.join(REPO, OUT, 'scores.md'), `${md}\n`);
  process.stdout.write(`${md}\n`);
  return 0;
}

export async function main(argv: readonly string[]): Promise<number> {
  const [phase] = argv;
  if (phase === 'plan') return plan(argv);
  if (phase === 'record') return record(argv);
  if (phase === 'score') return score(argv);
  process.stderr.write('usage: filter-explain-run.ts plan|record|score\n');
  return 2;
}

if (process.argv[1]?.endsWith('filter-explain-run.ts') === true) void main(process.argv.slice(2)).then((c) => { process.exitCode = c; });
