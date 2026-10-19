/**
 * v1.3 stage-0 instrument probe (Docs/v1.3/floor-escape-design-2026-10-16.md sections 3.6 and 4): zero model cost,
 * no Neo4j. Five TypeORM constructs, one per fixture, plus a clean control, each laid out for Clean
 * (specs/clean-arch.yaml) and Hexagonal (presets/hexagonal.yaml) under fixtures/v1.3-stage0-orm-probe/<case>/<layout>/.
 * Entry file: no exports.
 *
 *   npx tsx scripts/v1.3/stage0-orm-probe.ts [--out results/v1.3-stage0-orm-probe]
 *
 * Per fixture and spec it records:
 *   1. graph tier: `firewall evaluate --symbolic-only --engine cypher-interp --scoring v1.3` (the in-process
 *      interpreter, the same command as the floor-probe-3 and complementarity re-evaluations);
 *   2. check-correct: scripts/v1.3/check-correct.ts --jobs <out>/jobs.json --tiers blocking on those reports;
 *   3. check_file: the MCP handler (`checkFileTool`) on the planted file, fast path and `templates: true`
 *      (cypher-interp, whole project before and after), with the control tree of the same layout as the project
 *      root, i.e. the agent asking before it writes the planted file into the clean tree;
 *   4. check_import: the MCP handler (`checkImportTool`) on each planted import of 'typeorm'.
 * Output: <out>/results.json (timings, run ids and absolute paths stripped), <out>/reports/<case>.<layout>.json,
 * <out>/jobs.json, <out>/check-correct/correctness.{json,csv}. NEO4J_* variables are dropped from every child and
 * from the in-process context.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildContext } from '../../src/mcp-server/context.js';
import { checkFileTool, checkImportTool } from '../../src/mcp-server/tools.js';
import { findingsOfReport } from './lib/labelling/findings.js';

const REPO = process.cwd();
const FIXTURES = 'fixtures/v1.3-stage0-orm-probe';
const outIdx = process.argv.indexOf('--out');
const OUT = path.resolve(REPO, outIdx >= 0 ? (process.argv[outIdx + 1] ?? '') : 'results/v1.3-stage0-orm-probe');

const LAYOUTS = {
  clean: { spec: 'specs/clean-arch.yaml', persistence: 'src/infrastructure/persistence' },
  hexagonal: { spec: 'presets/hexagonal.yaml', persistence: 'src/adapters/outbound/persistence' },
} as const;
type Layout = keyof typeof LAYOUTS;

interface CaseDef {
  readonly id: string;
  readonly construct: string;
  /** The file(s) carrying the planted construct (the control: the reference files the cases change). */
  readonly planted: (layout: Layout) => readonly string[];
}

const CASES: readonly CaseDef[] = [
  { id: 'control', construct: 'none (TypeORM only in the persistence adapter behind a domain port)', planted: (l) => ['src/application/use-cases/place-order.ts', `${LAYOUTS[l].persistence}/order.orm-entity.ts`] },
  { id: 'decorated-domain-class', construct: '@Entity/@Column/@PrimaryGeneratedColumn on the domain Order (typeorm imported in src/domain)', planted: () => ['src/domain/entities/order.ts'] },
  { id: 'version-column', construct: '@VersionColumn() on the persistence entity OrderRecord; domain unchanged', planted: (l) => [`${LAYOUTS[l].persistence}/order.orm-entity.ts`] },
  { id: 'datasource-in-use-case', construct: 'PlaceOrderUseCase injects DataSource and calls dataSource.transaction', planted: () => ['src/application/use-cases/place-order.ts'] },
  { id: 'repository-without-port', construct: 'PlaceOrderUseCase injects Repository<Order> from typeorm; no port interface, EntitySchema mapping in persistence', planted: () => ['src/application/use-cases/place-order.ts'] },
  { id: 'querybuilder-in-logic', construct: 'OrderReportService (application) runs the large-order rule as manager.createQueryBuilder() SQL', planted: () => ['src/application/services/order-report.service.ts'] },
];

/** The child and in-process environment: no Neo4j credentials, so cypher-interp is the only engine reachable. */
const ENV: NodeJS.ProcessEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('NEO4J_')));
const CHILD_ENV: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' };

/** Drops run ids, wall times, timestamps and cache states, recursively (the results must be byte-stable). */
function strip(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(strip);
  if (typeof v !== 'object' || v === null) return v;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) {
    if (k === 'runId' || k === 'projectPath' || k === 'timings' || k === 'cache' || /Ms$/.test(k) || /At$/.test(k)) continue;
    out[k] = strip(x);
  }
  return out;
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

interface TierRule { functionId: string; name: string; violationCount: number }
interface Report {
  violations: { functionId: string; type: string; filePath: string; target?: string; line?: number; message: string }[];
  tiers: { style: string; verdict: string; blocking: { rules: TierRule[]; violationCount: number }; advisory: { rules: TierRule[]; violationCount: number }; notApplicable?: unknown };
  parseCoverage?: unknown;
}

/** The CLI exits non-zero on a failing verdict; the JSON report on stdout is the result either way. */
function evaluate(dir: string, spec: string): Report {
  let out: Buffer;
  try {
    out = execFileSync('npx', ['tsx', path.join(REPO, 'bin/firewall.ts'), 'evaluate', '--post-seal', 'off', '--project', dir, '--spec', spec, '--symbolic-only', '--engine', 'cypher-interp', '--scoring', 'v1.3', '--format', 'json'], {
      cwd: REPO, env: CHILD_ENV, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    const err = e as { stdout?: Buffer; stderr?: Buffer };
    const text = err.stdout?.toString('utf8') ?? '';
    if (!text.trimStart().startsWith('{')) throw new Error(`evaluate failed for ${dir}: ${err.stderr?.toString('utf8') ?? String(e)}`);
    out = Buffer.from(text);
  }
  return JSON.parse(out.toString('utf8')) as Report;
}

const counts = (rules: readonly TierRule[]): Record<string, number> =>
  Object.fromEntries(rules.filter((r) => r.violationCount > 0).map((r) => [r.functionId, r.violationCount]));

/** Advisory counts minus the control's of the same layout (only rules that differ). */
function delta(a: Record<string, number>, control: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(control)])].sort()) {
    const d = (a[k] ?? 0) - (control[k] ?? 0);
    if (d !== 0) out[k] = d;
  }
  return out;
}

/** Line numbers of `import ... from 'typeorm'` statements in a file. */
function typeormImportLines(content: string): number[] {
  return content.split('\n').flatMap((l, i) => (/^\s*import\b.*from\s+['"]typeorm['"]/.test(l) ? [i + 1] : []));
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const rows: Record<string, unknown>[] = [];
  const jobs: { projectId: string; projectRoot: string; spec: string; report: string }[] = [];
  const controlAdvisory = new Map<Layout, Record<string, number>>();

  // 1. graph tier
  const graph = new Map<string, Record<string, unknown>>();
  for (const c of CASES) {
    for (const layout of Object.keys(LAYOUTS) as Layout[]) {
      const dir = path.join(REPO, FIXTURES, c.id, layout);
      const spec = path.join(REPO, LAYOUTS[layout].spec);
      const report = strip(evaluate(dir, spec)) as Report;
      const reportFile = path.join(OUT, 'reports', `${c.id}.${layout}.json`);
      writeJson(reportFile, report);
      const projectId = `${c.id}/${layout}`;
      jobs.push({ projectId, projectRoot: path.relative(OUT, dir), spec: path.relative(OUT, spec), report: path.relative(OUT, reportFile) });
      const blockingIds = new Set(report.tiers.blocking.rules.map((r) => r.functionId));
      const findings = findingsOfReport(report, { projectId }, report.tiers.style);
      const advisory = counts(report.tiers.advisory.rules);
      if (c.id === 'control') controlAdvisory.set(layout, advisory);
      graph.set(projectId, {
        verdict: report.tiers.verdict,
        blockingCount: report.tiers.blocking.violationCount,
        blockingByRule: counts(report.tiers.blocking.rules),
        advisoryCount: report.tiers.advisory.violationCount,
        advisoryByRule: advisory,
        advisoryDeltaVsControl: delta(advisory, controlAdvisory.get(layout) ?? {}),
        blockingFindings: findings.filter((f) => blockingIds.has(f.ruleId)).map((f) => ({ key: f.key, ruleId: f.ruleId, template: f.template, file: f.file, ...(f.line !== undefined && { line: f.line }), ...(f.target !== undefined && { target: f.target }), message: f.message })),
        parseCoverage: report.parseCoverage,
      });
    }
  }

  // 2. check-correct on the blocking findings, through its documented CLI
  const jobsFile = path.join(OUT, 'jobs.json');
  writeJson(jobsFile, { schemaVersion: 1, kind: 'custom', jobs });
  const ccDir = path.join(OUT, 'check-correct');
  execFileSync('npx', ['tsx', path.join(REPO, 'scripts/v1.3/check-correct.ts'), '--jobs', jobsFile, '--tiers', 'blocking', '--out', ccDir], { cwd: REPO, env: CHILD_ENV, stdio: ['ignore', 'pipe', 'inherit'] });
  const cc = JSON.parse(fs.readFileSync(path.join(ccDir, 'correctness.json'), 'utf8')) as { results: { key: string; projectId: string; ruleId: string; verdict: string; reason: string }[] };

  // 3./4. check_file and check_import through the MCP handlers, project root = the control tree of the layout
  for (const c of CASES) {
    for (const layout of Object.keys(LAYOUTS) as Layout[]) {
      const projectId = `${c.id}/${layout}`;
      const dir = path.join(REPO, FIXTURES, c.id, layout);
      const controlDir = path.join(REPO, FIXTURES, 'control', layout);
      const spec = path.join(REPO, LAYOUTS[layout].spec);
      const ctx = buildContext({ spec, project: controlDir, engine: 'cypher-interp' }, ENV);
      const files: Record<string, unknown>[] = [];
      for (const rel of c.planted(layout)) {
        const content = fs.readFileSync(path.join(dir, rel), 'utf8');
        const fast = await checkFileTool(ctx, { path: rel, content });
        const tmpl = await checkFileTool(ctx, { path: rel, content, templates: true });
        if (!fast.ok || !tmpl.ok) throw new Error(`${projectId} ${rel}: check_file failed: ${fast.ok ? '' : fast.message} ${tmpl.ok ? '' : tmpl.message}`);
        const t = tmpl.data.templates;
        const imports: Record<string, unknown>[] = [];
        for (const line of typeormImportLines(content)) {
          const ci = await checkImportTool(ctx, { from: rel, module: 'typeorm' });
          if (!ci.ok) throw new Error(`${projectId} ${rel}: check_import failed: ${ci.message}`);
          imports.push({
            line, module: 'typeorm', verdict: ci.data.verdict, blockingVerdict: ci.data.blockingVerdict, fromLayer: ci.data.from.layer,
            violations: ci.data.violations.map((v) => ({ ruleId: v.ruleId, ruleName: v.ruleName, tier: v.tier })), notes: ci.data.notes,
          });
        }
        files.push({
          file: rel,
          layer: fast.data.layer,
          checkFile: {
            verdict: fast.data.verdict, blockingVerdict: fast.data.blockingVerdict, blockingCount: fast.data.blockingCount, advisoryCount: fast.data.advisoryCount,
            findings: fast.data.findings.map((f) => ({ ruleId: f.ruleId, tier: f.tier, line: f.line, subject: f.subject })),
            hints: fast.data.hints.map((f) => ({ ruleId: f.ruleId, tier: f.tier, line: f.line, subject: f.subject })),
            notChecked: fast.data.notChecked,
          },
          checkFileTemplates: t === undefined ? null : {
            status: t.status, ...(t.reason !== undefined && { reason: t.reason }), blockingVerdict: t.blockingVerdict, clearedCount: t.clearedCount,
            introduced: t.introduced.map((f) => strip(f)),
          },
          checkImport: imports,
        });
      }
      const g = graph.get(projectId) ?? {};
      const labels = cc.results.filter((r) => r.projectId === projectId).map((r) => ({ key: r.key, ruleId: r.ruleId, verdict: r.verdict, reason: r.reason }));
      const c0 = CASES.find((x) => x.id === c.id);
      rows.push({ case: c.id, layout, spec: LAYOUTS[layout].spec, construct: c0?.construct, graph: g, checkCorrect: labels, files });
    }
  }

  const summary = rows.map((r) => {
    const g = r.graph as { blockingCount: number; blockingByRule: Record<string, number>; advisoryDeltaVsControl: Record<string, number> };
    const files = r.files as { checkFile: { blockingVerdict: string; findings: { ruleId: string; tier: string }[]; hints: { ruleId: string }[] }; checkFileTemplates: { blockingVerdict: string } | null; checkImport: { blockingVerdict?: string }[] }[];
    const labels = r.checkCorrect as { verdict: string }[];
    return {
      case: r.case, layout: r.layout,
      graphBlocking: g.blockingCount, graphBlockingByRule: g.blockingByRule, advisoryDeltaVsControl: g.advisoryDeltaVsControl,
      checkCorrect: labels.length === 0 ? 'n/a (no blocking finding)' : labels.map((l) => l.verdict).join(','),
      checkFile: files.map((f) => f.checkFile.blockingVerdict).join(','),
      checkFileAdvisory: [...new Set(files.flatMap((f) => [...f.checkFile.findings.filter((x) => x.tier !== 'blocking').map((x) => x.ruleId), ...f.checkFile.hints.map((x) => x.ruleId)]))].sort(),
      checkFileTemplates: files.map((f) => f.checkFileTemplates?.blockingVerdict ?? 'n/a').join(','),
      checkImport: files.flatMap((f) => f.checkImport.map((i) => i.blockingVerdict ?? 'n/a')).join(',') || 'n/a (no typeorm import)',
    };
  });
  const blockingCases = [...new Set(summary.filter((s) => s.case !== 'control' && s.graphBlocking > 0).map((s) => s.case))];
  const prediction = {
    statement: 'Only decorated-domain-class is blocking (floor-escape design section 3.6).',
    blockingCases,
    holds: blockingCases.length === 1 && blockingCases[0] === 'decorated-domain-class' && summary.filter((s) => s.case === 'decorated-domain-class').every((s) => s.graphBlocking > 0) && summary.filter((s) => s.case === 'control').every((s) => s.graphBlocking === 0),
  };
  writeJson(path.join(OUT, 'results.json'), { schemaVersion: 1, probe: 'v1.3-stage0-orm-probe', engine: 'cypher-interp', scoring: 'v1.3', fixtures: FIXTURES, prediction, summary, rows });
  for (const s of summary) process.stdout.write(`${`${s.case}/${s.layout}`.padEnd(36)} graph blocking ${String(s.graphBlocking)} ${JSON.stringify(s.graphBlockingByRule)}  check-correct ${s.checkCorrect}  check_file ${s.checkFile}/${s.checkFileTemplates}  check_import ${s.checkImport}\n`);
  process.stdout.write(`prediction holds: ${String(prediction.holds)} (blocking cases: ${blockingCases.join(', ') || 'none'})\n`);
}

main().catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
});
