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
 *   score                  confirm / dismiss / rejected per label, precision and recall before and after, grounding.
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
  createFilterExplainProvider, findingKept, outcomeOf, renderFilterExplainPrompt,
} from '../../src/llm-critic/filter-explain.js';
import type { FilterExplainOutcome, ShownFile, SymbolicFinding } from '../../src/llm-critic/filter-explain.js';
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

type Label = 'true' | 'false' | 'unscored';

interface Row {
  readonly rowId: string;            // style/variant/#index
  readonly style: string;
  readonly variant: string;
  readonly label: Label;
  readonly tier: string;
  readonly finding: SymbolicFinding;
  readonly files: readonly string[];
  readonly promptSha: string;
}

interface Plan {
  readonly feRevision: string;
  readonly feSha256: string;
  readonly rows: readonly Row[];
  readonly prompts: Readonly<Record<string, { prompt: string; files: readonly ShownFile[] }>>;
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
  const prompts: Record<string, { prompt: string; files: readonly ShownFile[] }> = {};
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
        // R19: ground against the files as the prompt rendered them (a truncated or omitted file is cut there too).
        const { prompt, shown: rendered } = renderFilterExplainPrompt({ finding, files: shown, layerModel: layerText, fileLayers: layers });
        const promptSha = sha(prompt);
        prompts[promptSha] = { prompt, files: rendered };
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
  const out: Plan = { feRevision: FE_REVISION, feSha256: computeFilterExplainSha256(), rows, prompts, selected: [...selected].sort(), skipped };
  writeJson(path.join(REPO, OUT, 'plan.json'), out);
  const by = (l: Label): number => rows.filter((r) => r.label === l).length;
  process.stdout.write(`rows ${String(rows.length)} (true ${String(by('true'))}, false ${String(by('false'))}, unscored ${String(by('unscored'))}); distinct prompts ${String(Object.keys(prompts).length)}; selected ${String(selected.size)} (CV05 distinct ${String(cv05.length)}, sampled ${String(Math.min(CV05_SAMPLE, cv05.length))}); skipped ${String(skipped.length)}\n`);
  return 0;
}

interface Ledger { calls: number; phases: { label: string; at: string; judgeAttempts: number; initProbes: number; hits: number; stop?: string }[] }

async function record(argv: readonly string[]): Promise<number> {
  const budget = Number(arg(argv, '--budget', '600'));
  const p = readJson<Plan>(path.join(REPO, OUT, 'plan.json'));
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

function score(): number {
  const p = readJson<Plan>(path.join(REPO, OUT, 'plan.json'));
  const a = readJson<{ answers: Record<string, { valid: boolean; response: string }> }>(path.join(REPO, OUT, 'answers.json')).answers;
  const selected = new Set(p.selected);
  const outcome = new Map<string, FilterExplainOutcome>();
  for (const s of p.selected) {
    const ans = a[s];
    const files = p.prompts[s]?.files ?? [];
    outcome.set(s, ans === undefined ? { status: 'invalid', cause: 'NOT_RUN' } : outcomeOf(ans.valid ? answerOfResponse(ans.response) : null, files));
  }
  const judged = p.rows.filter((r) => selected.has(r.promptSha));
  const rowsOut = judged.map((r) => {
    const o = outcome.get(r.promptSha) ?? { status: 'invalid', cause: 'NOT_RUN' };
    return {
      rowId: r.rowId, label: r.label, tier: r.tier, functionId: r.finding.functionId, file: r.finding.filePath, status: o.status,
      kept: findingKept(o),
      ...(o.status !== 'invalid' ? { decision: o.answer.decision, grounded: o.grounding.grounded, problems: o.grounding.problems, explanation: o.answer.explanation, fix: o.answer.fix, citations: o.answer.citations } : { cause: o.cause }),
    };
  });
  const count = (pred: (r: (typeof rowsOut)[number]) => boolean): number => rowsOut.filter(pred).length;
  const lines: string[] = [];
  const t = rowsOut.filter((r) => r.label === 'true');
  const f = rowsOut.filter((r) => r.label === 'false');
  const tp0 = t.length; const fp0 = f.length;
  const tp1 = t.filter((r) => r.kept).length; const fp1 = f.filter((r) => r.kept).length;
  lines.push(`| Label | Rows | Confirm (grounded) | Dismiss (grounded) | Rejected (ungrounded) | Invalid |`);
  lines.push('|---|---|---|---|---|---|');
  for (const label of ['true', 'false', 'unscored'] as const) {
    const rs = rowsOut.filter((r) => r.label === label);
    lines.push(`| ${label} | ${String(rs.length)} | ${fmt(rs.filter((r) => r.status === 'confirm').length, rs.length)} | ${fmt(rs.filter((r) => r.status === 'dismiss').length, rs.length)} | ${String(rs.filter((r) => r.status === 'rejected').length)} | ${String(rs.filter((r) => r.status === 'invalid').length)} |`);
  }
  const prec0 = tp0 / Math.max(1, tp0 + fp0);
  const prec1 = tp1 / Math.max(1, tp1 + fp1);
  lines.push('');
  lines.push(`Scored rows: precision before ${fmt(tp0, tp0 + fp0)}, after ${fmt(tp1, tp1 + fp1)} (gain ${(prec1 - prec0).toFixed(3)}); recall kept ${fmt(tp1, tp0)} (recall loss ${fmt(tp0 - tp1, tp0)}).`);
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
  writeJson(path.join(REPO, OUT, 'scores.json'), {
    feRevision: p.feRevision, rows: rowsOut,
    summary: { tp0, fp0, tp1, fp1, precisionBefore: prec0, precisionAfter: prec1, recallKept: tp1 / Math.max(1, tp0) },
  });
  fs.writeFileSync(path.join(REPO, OUT, 'scores.md'), `${md}\n`);
  process.stdout.write(`${md}\n`);
  return 0;
}

export async function main(argv: readonly string[]): Promise<number> {
  const [phase] = argv;
  if (phase === 'plan') return plan(argv);
  if (phase === 'record') return record(argv);
  if (phase === 'score') return score();
  process.stderr.write('usage: filter-explain-run.ts plan|record|score\n');
  return 2;
}

if (process.argv[1]?.endsWith('filter-explain-run.ts') === true) void main(process.argv.slice(2)).then((c) => { process.exitCode = c; });
