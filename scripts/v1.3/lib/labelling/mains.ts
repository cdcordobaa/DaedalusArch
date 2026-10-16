/**
 * Entry logic of the v1.3 labelling CLIs (scripts/v1.3/{labelling-jobs,sample-findings,check-correct,
 * label-meaningful,audit-sheet}.ts). Each `*Main` takes argv and an io and returns an exit code; nothing here calls a
 * model unless `label-meaningful` runs with `--mode record` and a live provider.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadAllReferences } from '../reference-model.js';
import { materialiseVariant } from '../materialise.js';
import type { Finding, JobsFile, LabellingJob } from './findings.js';
import { loadFindings, loadJobs } from './findings.js';
import { sampleFindings } from './sampler.js';
import type { SampleFile, SampledFinding } from './sampler.js';
import { BLOCKING_COVERAGE, UNCOVERABLE, checkFinding } from './correctness.js';
import type { CorrectnessResult } from './correctness.js';
import { loadSpecView } from './spec-facts.js';
import type { SpecView } from './spec-facts.js';
import { SourceFactsCache } from './source-facts.js';
import { loadStyleSources } from './meaningful-prompt.js';
import { estimateCalls, labelItems, perRule } from './meaningful.js';
import type { MeaningfulItemLabel } from './meaningful.js';
import { CassetteMissError, CassetteStore, GEMINI_KEY_ENV, PROVIDER_IDS, ProviderError, codexProvider, geminiProvider, mockProvider } from './providers.js';
import type { MeaningfulProvider, ProviderId } from './providers.js';
import { AUDIT_MIN, answersTemplate, auditAgreement, auditKey, auditSheet, auditTable, parseAnswerTable, parseCsv, selectAudit, selectAuditStratified } from './audit.js';
import type { AuditKeyRow } from './audit.js';
import { wilson } from '../../../lib/stats.js';
import { unionAgreementMain, unionSheetMain } from './union-main.js';

export interface MainIo {
  readonly out: (t: string) => void;
  readonly err: (t: string) => void;
  readonly env: NodeJS.ProcessEnv;
}

export function parseArgs(argv: readonly string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? '';
    if (!a.startsWith('--')) throw new Error(`unexpected argument '${a}'`);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) m.set(a.slice(2), 'true');
    else { m.set(a.slice(2), next); i += 1; }
  }
  return m;
}

function need(args: ReadonlyMap<string, string>, name: string): string {
  const v = args.get(name);
  if (v === undefined || v === 'true') throw new Error(`--${name} <value> is required`);
  return v;
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function seedOf(args: ReadonlyMap<string, string>): number {
  const s = Number(need(args, 'seed'));
  if (!Number.isSafeInteger(s) || s < 0) throw new Error('--seed must be a non-negative integer');
  return s;
}

const csvCell = (s: string): string => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

// ── labelling-jobs ──────────────────────────────────────────────────────────

/**
 * `--reference <evidenceDir> --materialise <dir> --out jobs.json`: one job per reference variant with an evidence
 * file (`<evidenceDir>/<style>/<variant>.json`), the variant materialised under `<dir>`.
 * `--e1-runs <runsDir> (--e1-plan <plan.json> | --spec <spec.yaml>) [--e1-root <dir>] --out jobs.json`: one job per
 * accepted E1 cell; the report is `<runsDir>/../<reportPath>`, the spec the plan's task `specPath` (or `--spec`), the
 * project `<e1-root>/<projectId>` (default: the plan's `outcomesRoot`, else the report's `projectPath`, relative to the
 * repository root).
 */
export function jobsMain(argv: readonly string[], repoRoot: string, io: MainIo): number {
  const args = parseArgs(argv);
  const out = need(args, 'out');
  let file: JobsFile;
  if (args.has('reference')) {
    const evidence = path.resolve(need(args, 'reference'));
    const dest = path.resolve(need(args, 'materialise'));
    const jobs: LabellingJob[] = [];
    for (const ref of loadAllReferences(repoRoot)) {
      for (const v of ref.variants) {
        const report = path.join(evidence, ref.style, `${v.manifest.variant}.json`);
        if (!fs.existsSync(report)) continue;
        const m = materialiseVariant(ref, v, dest);
        jobs.push({ projectId: `${ref.style}/${v.manifest.variant}`, projectRoot: m.projectDir, spec: path.resolve(repoRoot, ref.specPath), report, style: ref.style });
      }
    }
    file = { schemaVersion: 1, kind: 'reference', jobs };
  } else if (args.has('e1-runs')) {
    const runsDir = path.resolve(need(args, 'e1-runs'));
    // The plan's e1 block names each task's spec and the outcomes root (relative to the repository root).
    const plan = args.has('e1-plan') ? (readJson(need(args, 'e1-plan')) as { e1?: { outcomesRoot?: string; tasks?: { taskId: string; specPath: string }[] } }).e1 : undefined;
    const taskSpecs = new Map((plan?.tasks ?? []).map((t) => [t.taskId, path.resolve(repoRoot, t.specPath)]));
    const specOverride = args.get('spec');
    const e1Root = args.get('e1-root') ?? (plan?.outcomesRoot !== undefined ? path.resolve(repoRoot, plan.outcomesRoot) : undefined);
    const jobs: LabellingJob[] = [];
    for (const name of fs.readdirSync(runsDir).filter((n) => n.endsWith('.run.json')).sort()) {
      const rec = readJson(path.join(runsDir, name)) as { projectId?: string; status?: string; reportPath?: string };
      if (rec.status !== 'accepted' || rec.projectId === undefined || rec.reportPath === undefined) continue;
      const report = path.resolve(path.dirname(runsDir), rec.reportPath);
      const projectPath = e1Root !== undefined ? path.resolve(e1Root, rec.projectId)
        : path.resolve(repoRoot, (readJson(report) as { projectPath?: string }).projectPath ?? rec.projectId);
      const spec = specOverride !== undefined ? path.resolve(specOverride) : taskSpecs.get(rec.projectId.split('/')[1] ?? '');
      if (spec === undefined) throw new Error(`${rec.projectId}: no spec (give --e1-plan or --spec)`);
      jobs.push({ projectId: rec.projectId, projectRoot: projectPath, spec, report });
    }
    file = { schemaVersion: 1, kind: 'e1', jobs };
  } else {
    throw new Error('labelling-jobs: give --reference <evidenceDir> --materialise <dir>, or --e1-runs <runsDir> --e1-plan <plan.json>');
  }
  writeJson(out, file);
  const missing = file.jobs.filter((j) => !fs.existsSync(j.projectRoot)).length;
  io.out(`jobs: ${String(file.jobs.length)} (${file.kind})${missing > 0 ? `; ${String(missing)} project root(s) missing` : ''} -> ${out}\n`);
  return 0;
}

// ── sample-findings ─────────────────────────────────────────────────────────

/** `--jobs jobs.json --seed <n> --out sample.json [--tiers blocking|all]`. */
export function sampleMain(argv: readonly string[], io: MainIo): number {
  const args = parseArgs(argv);
  const tiers = args.get('tiers') ?? 'blocking';
  if (tiers !== 'blocking' && tiers !== 'all') throw new Error('--tiers must be blocking or all');
  const jobs = loadJobs(need(args, 'jobs'));
  const sample = sampleFindings(loadFindings(jobs.jobs), seedOf(args), tiers);
  writeJson(need(args, 'out'), sample);
  for (const r of sample.rules) io.out(`${r.rule.padEnd(40)} ${r.tier.padEnd(9)} population ${String(r.population).padStart(5)}  sampled ${String(r.sampled).padStart(3)}${r.exhaustive ? ' (all)' : ''}\n`);
  io.out(`sampled ${String(sample.items.length)} findings over ${String(sample.rules.length)} rules\n`);
  for (const [rule, n] of Object.entries(sample.excludedNotApplicable)) io.out(`excluded as N/A (rule-tiers.md): ${rule} ${String(n)}\n`);
  return 0;
}

// ── check-correct ───────────────────────────────────────────────────────────

export interface CorrectnessSummaryRow {
  readonly rule: string;
  readonly n: number;
  readonly correct: number;
  readonly incorrect: number;
  readonly notCheckable: number;
  readonly correctShare: number | null;
  readonly wilsonLow: number | null;
  readonly wilsonHigh: number | null;
}

export function summariseCorrectness(results: readonly (CorrectnessResult & { rule: string })[]): CorrectnessSummaryRow[] {
  const by = new Map<string, CorrectnessResult[]>();
  for (const r of results) by.set(r.rule, [...(by.get(r.rule) ?? []), r]);
  return [...by.keys()].sort().map((rule) => {
    const rs = by.get(rule) ?? [];
    const correct = rs.filter((r) => r.verdict === 'correct').length;
    const incorrect = rs.filter((r) => r.verdict === 'incorrect').length;
    const checkable = correct + incorrect;
    const ci = checkable > 0 ? wilson(correct, checkable) : null;
    return {
      rule, n: rs.length, correct, incorrect, notCheckable: rs.length - checkable,
      correctShare: checkable > 0 ? correct / checkable : null, wilsonLow: ci?.low ?? null, wilsonHigh: ci?.high ?? null,
    };
  });
}

/**
 * `--jobs jobs.json --out <dir> [--sample sample.json] [--tiers blocking|all]`: checks the sampled findings (or every
 * finding of the jobs) and writes `<dir>/correctness.json` and `<dir>/correctness.csv`. `--coverage` prints the
 * blocking-rule coverage table and the uncoverable list.
 */
export async function checkMain(argv: readonly string[], io: MainIo): Promise<number> {
  const args = parseArgs(argv);
  if (args.has('coverage')) {
    for (const r of BLOCKING_COVERAGE) io.out(`${r.style.padEnd(19)} ${r.ruleId.padEnd(8)} ${r.template.padEnd(28)} ${r.coverage}${r.note !== undefined ? `  (${r.note})` : ''}\n`);
    io.out('\nuncoverable:\n');
    for (const u of UNCOVERABLE) io.out(`- ${u.rule}: ${u.reason}\n`);
    return 0;
  }
  const jobs = loadJobs(need(args, 'jobs')).jobs;
  const outDir = need(args, 'out');
  const tiers = args.get('tiers') ?? 'all';
  let findings: (Finding & { rule?: string })[];
  if (args.has('sample')) {
    findings = [...(readJson(need(args, 'sample')) as SampleFile).items];
  } else {
    findings = loadFindings(jobs).filter((f) => tiers === 'all' || f.tier === 'blocking');
  }
  const byProject = new Map(jobs.map((j) => [j.projectId, j]));
  const specs = new Map<string, SpecView>();
  const sources = new SourceFactsCache();
  const results: (CorrectnessResult & { rule: string })[] = [];
  // Checked project by project (the source cache keeps a few programs only), reported in the input order.
  const order = new Map(findings.map((f, i) => [f.key, i]));
  for (const f of [...findings].sort((a, b) => (a.projectId < b.projectId ? -1 : a.projectId > b.projectId ? 1 : 0))) {
    const job = byProject.get(f.projectId);
    const rule = f.rule ?? `${f.ruleId}/${f.template === '' ? '?' : f.template}`;
    if (job === undefined) {
      results.push({ key: f.key, projectId: f.projectId, ruleId: f.ruleId, template: f.template, tier: f.tier, file: f.file, verdict: 'not-checkable', reason: 'no job for the project', checks: [], rule });
      continue;
    }
    if (!fs.existsSync(job.projectRoot)) {
      results.push({ key: f.key, projectId: f.projectId, ruleId: f.ruleId, template: f.template, tier: f.tier, file: f.file, verdict: 'not-checkable', reason: `project source not present at ${job.projectRoot}`, checks: [], rule });
      continue;
    }
    let spec = specs.get(job.spec);
    if (spec === undefined) {
      spec = await loadSpecView(job.spec);
      specs.set(job.spec, spec);
    }
    results.push({ ...checkFinding(f, spec, sources.get(job.projectRoot, job.tsconfig ?? 'own')), rule });
  }
  results.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
  const summary = summariseCorrectness(results);
  writeJson(path.join(outDir, 'correctness.json'), { schemaVersion: 1, summary, results });
  const csv = ['key,projectId,rule,tier,file,verdict,reason', ...results.map((r) => [r.key, r.projectId, r.rule, r.tier, r.file, r.verdict, r.reason].map(csvCell).join(','))];
  fs.writeFileSync(path.join(outDir, 'correctness.csv'), `${csv.join('\n')}\n`);
  for (const s of summary) {
    io.out(`${s.rule.padEnd(40)} correct ${String(s.correct).padStart(4)}  incorrect ${String(s.incorrect).padStart(4)}  n/c ${String(s.notCheckable).padStart(4)}${s.wilsonLow !== null ? `  Wilson low ${s.wilsonLow.toFixed(3)}` : ''}\n`);
  }
  return 0;
}

// ── label-meaningful ────────────────────────────────────────────────────────

export interface LabelDeps {
  readonly provider?: (id: ProviderId, model: string, args: ReadonlyMap<string, string>) => MeaningfulProvider;
}

function defaultProvider(id: ProviderId, model: string, args: ReadonlyMap<string, string>, env: NodeJS.ProcessEnv): MeaningfulProvider {
  if (id === 'gemini') return geminiProvider(model, env);
  if (id === 'codex') {
    const effort = args.get('codex-effort');
    return codexProvider({
      model, codexHome: need(args, 'codex-home'), userHome: need(args, 'codex-user-home'),
      ...(effort !== undefined && { reasoningEffort: effort }),
    }, undefined, env);
  }
  return mockProvider();
}

/**
 * `--sample sample.json --jobs jobs.json --estimate`: prints the call count, calls nothing.
 * `--sample sample.json --jobs jobs.json --provider codex|gemini|mock --model <id> --mode record|replay
 *  --cassette-dir <dir> --seed <n> --out labels.json [--rule <rule>] [--limit <n>]`.
 */
export async function labelMain(argv: readonly string[], repoRoot: string, io: MainIo, deps: LabelDeps = {}): Promise<number> {
  const args = parseArgs(argv);
  let items: readonly SampledFinding[] = (readJson(need(args, 'sample')) as SampleFile).items;
  const rule = args.get('rule');
  if (rule !== undefined) items = items.filter((i) => i.rule === rule);
  const limit = args.get('limit');
  if (limit !== undefined) items = items.slice(0, Number(limit));
  if (args.has('estimate')) {
    io.out(`${estimateCalls(items.length).line}\n`);
    return 0;
  }
  const providerId = need(args, 'provider');
  if (!PROVIDER_IDS.includes(providerId as ProviderId)) throw new Error(`--provider must be one of ${PROVIDER_IDS.join(', ')}`);
  const mode = need(args, 'mode');
  if (mode !== 'record' && mode !== 'replay') throw new Error('--mode must be record or replay');
  const model = need(args, 'model');
  const jobs = loadJobs(need(args, 'jobs')).jobs;
  const secrets = [io.env[GEMINI_KEY_ENV] ?? ''].filter((s) => s !== '');
  const store = new CassetteStore(path.resolve(need(args, 'cassette-dir')), mode, secrets);
  // Replay never calls: the provider only names the cassette key (id and model).
  const provider: MeaningfulProvider = mode === 'replay'
    ? { id: providerId as ProviderId, model, call: () => Promise.reject(new CassetteMissError('replay never calls the provider')) }
    : (deps.provider ?? ((id, m, a) => defaultProvider(id, m, a, io.env)))(providerId as ProviderId, model, args);
  let labels: MeaningfulItemLabel[];
  try {
    labels = await labelItems(items, {
      seed: seedOf(args), repoRoot, styleDoc: loadStyleSources(repoRoot), store, provider,
      jobs: new Map(jobs.map((j) => [j.projectId, j])), log: (l) => { io.err(`${l}\n`); },
    });
  } catch (e) {
    if (e instanceof CassetteMissError || e instanceof ProviderError) {
      io.err(`${e instanceof ProviderError ? e.code : 'CASSETTE_MISS'}: ${e.message}\n`);
      return 1;
    }
    throw e;
  }
  const summary = perRule(labels);
  writeJson(need(args, 'out'), { schemaVersion: 1, provider: providerId, model, mode, summary, labels });
  for (const s of summary) {
    io.out(`${s.rule.padEnd(40)} n ${String(s.n).padStart(3)}  yes ${String(s.yes).padStart(3)}  no ${String(s.no).padStart(3)}  uncertain ${String(s.uncertain).padStart(3)}${s.wilsonLow !== null ? `  yes Wilson low ${s.wilsonLow.toFixed(3)}` : ''}\n`);
  }
  return 0;
}

// ── audit-sheet ─────────────────────────────────────────────────────────────

/**
 * `sheet --sample sample.json[,…] --jobs jobs.json[,…] --seed <n> --out <dir> [--n 30] [--labels labels.json[,…]]`: writes
 * audit-sheet.md, audit-answers.csv and audit-key.json (keep the key away from the author until the answers are in).
 * With `--labels` the draw is stratified by rule and labeller label; with `--format table --sheet-out <md> --key-out
 * <json>` the sheet is one Markdown table with an `[Answer]` column and the key goes to its own path.
 * `agreement` reads `--answers` as CSV, or as the filled table when the file ends in `.md`; `--labels` takes a list.
 * `agreement --key audit-key.json --answers audit-answers.csv --labels labels.json [--correctness correctness.json]
 *  --out agreement.json`.
 */
export function auditMain(argv: readonly string[], io: MainIo, repoRoot: string = process.cwd()): number {
  const [sub, ...rest] = argv;
  const args = parseArgs(rest);
  // Blind union sheet and its multi-rater agreement (human-labelling-protocol.md): union-main.ts.
  if (sub === 'union') return unionSheetMain(args, repoRoot, io);
  if (sub === 'union-agreement') return unionAgreementMain(args, io);
  if (sub === 'sheet') {
    // --sample and --jobs take a comma-separated list (one audit over several sets, e.g. E1 and the reference runs).
    const list = (name: string): string[] => need(args, name).split(',').filter((x) => x !== '');
    const items = list('sample').flatMap((f) => (readJson(f) as SampleFile).items);
    const jobs = new Map(list('jobs').flatMap((f) => loadJobs(f).jobs).map((j) => [j.projectId, j]));
    const n = Number(args.get('n') ?? String(AUDIT_MIN));
    const labelFiles = args.get('labels')?.split(',').filter((x) => x !== '');
    const labelOf = labelFiles === undefined ? undefined
      : new Map(labelFiles.flatMap((f) => (readJson(f) as { labels: MeaningfulItemLabel[] }).labels).map((l) => [l.key, l.label]));
    const chosen = labelOf === undefined ? selectAudit(items, n, seedOf(args)) : selectAuditStratified(items, n, seedOf(args), labelOf);
    const sourceOf = (f: SampledFinding): string | null => {
      const j = jobs.get(f.projectId);
      if (j === undefined) return null;
      try { return fs.readFileSync(path.join(j.projectRoot, f.file), 'utf8'); } catch { return null; }
    };
    const key = { schemaVersion: 1, seed: seedOf(args), stratifiedBy: labelOf === undefined ? 'rule' : 'rule x labeller label', rows: auditKey(chosen) };
    if (args.get('format') === 'table') {
      // --sheet-out <file.md> --key-out <file.json>: the sheet and its key in separate places.
      const sheetOut = need(args, 'sheet-out');
      fs.mkdirSync(path.dirname(path.resolve(sheetOut)), { recursive: true });
      fs.writeFileSync(sheetOut, auditTable(chosen, sourceOf));
      writeJson(need(args, 'key-out'), key);
      io.out(`audit: ${String(chosen.length)} items over ${String(new Set(chosen.map((c) => c.rule)).size)} rules -> ${sheetOut}\n`);
      return 0;
    }
    const outDir = need(args, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'audit-sheet.md'), auditSheet(chosen, sourceOf));
    fs.writeFileSync(path.join(outDir, 'audit-answers.csv'), answersTemplate(chosen));
    writeJson(path.join(outDir, 'audit-key.json'), key);
    io.out(`audit: ${String(chosen.length)} items over ${String(new Set(chosen.map((c) => c.rule)).size)} rules -> ${outDir}\n`);
    return 0;
  }
  if (sub === 'agreement') {
    const key = (readJson(need(args, 'key')) as { rows: AuditKeyRow[] }).rows;
    const answersFile = need(args, 'answers');
    const answersText = fs.readFileSync(answersFile, 'utf8');
    const answers = answersFile.endsWith('.md') ? parseAnswerTable(answersText) : parseCsv(answersText);
    const labels = need(args, 'labels').split(',').filter((x) => x !== '').flatMap((f) => (readJson(f) as { labels: MeaningfulItemLabel[] }).labels);
    const corr = args.get('correctness');
    const correctnessOf = corr !== undefined
      ? new Map(corr.split(',').filter((x) => x !== '').flatMap((f) => (readJson(f) as { results: CorrectnessResult[] }).results).map((r) => [r.key, r.verdict])) : undefined;
    const report = auditAgreement(key, answers, new Map(labels.map((l) => [l.key, l.label])), correctnessOf);
    writeJson(need(args, 'out'), report);
    const m = report.meaningful;
    io.out(`meaningful: n ${String(m.n)}, kappa ${m.kappa?.toFixed(3) ?? 'n/a'}, AC1 ${m.ac1?.toFixed(3) ?? 'n/a'}, agreement ${m.observed?.toFixed(3) ?? 'n/a'} [${m.observedLow?.toFixed(3) ?? '-'}, ${m.observedHigh?.toFixed(3) ?? '-'}]\n`);
    io.out(`gate (kappa >= ${String(report.gate.threshold)}, n >= ${String(AUDIT_MIN)}): ${report.gate.pass ? 'PASS' : 'FAIL'}\n`);
    if (report.unanswered.length > 0) io.out(`unanswered: ${report.unanswered.join(', ')}\n`);
    return 0;
  }
  throw new Error('audit-sheet: subcommand sheet, agreement, union or union-agreement');
}
