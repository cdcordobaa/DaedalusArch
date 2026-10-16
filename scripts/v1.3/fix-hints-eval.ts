/**
 * Fix-hint validity on the 71-case v1.3 development set (Docs/v1.3/fix-hints.md §4). Entry file: no exports.
 *
 * For every variant of tests/fixtures/v1.3-reference: materialise it, run the symbolic-only v1.3 pipeline against Neo4j
 * (the same commands `firewall evaluate` runs), and take the TRUE blocking findings: the manifest findings the run
 * matches (scripts/v1.3/lib/compare.ts) whose rule is blocking under the v1.3 tiers for the style. For each, build the
 * hint twice: with graph facts (what `firewall evaluate --hints` prints) and from the spec alone (what the MCP tools
 * can build). Then, mechanically:
 *   1. target: the hinted layer/path is allowed by the spec (`checkTarget`, an independent reading of the spec);
 *   2. removed: the hint's graph edit, applied inside a Neo4j transaction, makes the finding's own rule (its compiled
 *      query, run through the real symbolic evaluator) stop reporting the finding;
 *   3. regressions: blocking findings present after the edit and absent before (all blocking rules re-run).
 * The transaction is always rolled back. A hint is VALID when 1 and 2 hold.
 *
 * Usage (repository root; Neo4j 5.26 + APOC; NEO4J_URI and NEO4J_PASSWORD in the environment):
 *   npx tsx scripts/v1.3/fix-hints-eval.ts --out results/v1.3-fix-hints [--style a,b]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import neo4j from 'neo4j-driver';
import type { ManagedTransaction } from 'neo4j-driver';
import { createPipeline } from '../../src/pipeline/pipeline-factory.js';
import { evaluateSymbolic } from '../../src/evaluation-engine/symbolic-evaluator.js';
import { DomainResult } from '../../src/shared/errors/domain-result.js';
import type { GraphRepository, QueryResult } from '../../src/shared/interfaces/graph-repository.js';
import type { CypherQuery } from '../../src/shared/types/evaluation.js';
import type { Violation } from '../../src/shared/taxonomy/violation-types.js';
import { ruleTier } from '../../src/scoring-engine/rule-tiers.js';
import { buildFixHint, findingOfViolation, graphFactsFromApg } from '../../src/fix-hints/index.js';
import type { FixHint } from '../../src/fix-hints/index.js';
import { compareVariant, cycleFileSet, CYCLE_RULE_IDS, normaliseFindingPath } from './lib/compare.js';
import type { ActualFinding } from './lib/compare.js';
import { makeTempRoot, materialiseVariant } from './lib/materialise.js';
import { REFERENCE_STYLES, isReferenceStyle, loadAllReferences } from './lib/reference-model.js';
import type { ReferenceStyle } from './lib/reference-model.js';
import { checkTarget, editToCypher, wrongLayerMutant } from './lib/fix-hints-sim.js';

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const outDir = path.resolve(opt('--out') ?? 'results/v1.3-fix-hints');
const styles = (opt('--style')?.split(',') ?? [...REFERENCE_STYLES]).filter(isReferenceStyle) as ReferenceStyle[];
const repoRoot = process.cwd();
const uri = process.env.NEO4J_URI ?? '';
const user = process.env.NEO4J_USER ?? 'neo4j';
const password = process.env.NEO4J_PASSWORD ?? '';
if (uri === '' || password === '') {
  process.stderr.write('fix-hints-eval needs Neo4j: set NEO4J_URI and NEO4J_PASSWORD\n');
  process.exit(2);
}

/** A GraphRepository over one open transaction, returning records as Neo4jRepository does. */
function txRepository(tx: ManagedTransaction): GraphRepository {
  return {
    async executeQuery(cypher, params) {
      try {
        const result = await tx.run(cypher, params ?? {});
        const records = result.records.map((r) => Object.fromEntries((r.keys as string[]).map((k) => [k, r.get(k)])));
        return DomainResult.ok<QueryResult>({ records, summary: { counters: {} } });
      } catch (e) {
        return DomainResult.fail([{ code: 'TX_QUERY_FAILED', message: e instanceof Error ? e.message : String(e) }]);
      }
    },
    clearGraph: () => Promise.resolve(DomainResult.ok(undefined)),
    healthCheck: () => Promise.resolve(true),
    close: () => Promise.resolve(),
  };
}

const keyOf = (ruleId: string, file: string, target: string | undefined): string =>
  CYCLE_RULE_IDS.has(ruleId) ? `${ruleId}|{${cycleFileSet({ file, target })}}` : `${ruleId}|${file}|${target ?? ''}`;
const violationKey = (v: Violation): string => keyOf(String(v.functionId), v.filePath, v.target);

async function run(tx: ManagedTransaction, queries: readonly CypherQuery[]): Promise<Set<string>> {
  const res = await evaluateSymbolic({ queries, graphRepository: txRepository(tx) });
  if (!res.success) throw new Error(res.errors.map((e) => e.message).join('; '));
  if (res.data.failures.length > 0) throw new Error(res.data.failures.map((f) => f.message).join('; '));
  return new Set(res.data.results.flatMap((r) => r.violations.map(violationKey)));
}

interface Check {
  readonly hint: FixHint | undefined;
  readonly target: boolean;
  readonly targetReasons: readonly string[];
  readonly removed: boolean;
  readonly regressions: readonly string[];
  readonly valid: boolean;
}

interface Row {
  /** Control: the finding's own rule, re-run in a transaction before any edit, reports it (else the check is vacuous). */
  readonly reproduced: boolean;
  readonly style: string;
  readonly variant: string;
  readonly ruleId: string;
  readonly file: string;
  readonly target?: string;
  readonly cli: Check;
  readonly spec: Check;
  /** Control: the CLI hint with its new or moved file put next to the violating target (absent when not applicable). */
  readonly mutant?: Check;
}

async function simulate(
  driver: ReturnType<typeof neo4j.driver>,
  spec: Parameters<typeof checkTarget>[0],
  hint: FixHint | undefined,
  findingKey: string,
  ruleQuery: CypherQuery,
  blocking: readonly CypherQuery[],
  before: ReadonlySet<string>,
): Promise<Check> {
  if (hint === undefined) return { hint, target: false, targetReasons: ['no hint'], removed: false, regressions: [], valid: false };
  const t = checkTarget(spec, hint);
  const session = driver.session();
  let removed = false;
  let regressions: string[] = [];
  const tx = session.beginTransaction();
  try {
    for (const w of editToCypher(spec, hint.edit)) await tx.run(w.cypher, w.params);
    const own = await run(tx as unknown as ManagedTransaction, [ruleQuery]);
    removed = !own.has(findingKey);
    const after = await run(tx as unknown as ManagedTransaction, blocking);
    regressions = [...after].filter((k) => !before.has(k)).sort();
  } finally {
    await tx.rollback();
    await session.close();
  }
  return { hint, target: t.ok, targetReasons: t.reasons, removed, regressions, valid: t.ok && removed };
}

async function main(): Promise<void> {
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  const tmp = makeTempRoot('v13-fix-hints-');
  const apgStore = path.join(tmp, '.apg-store');
  const rows: Row[] = [];
  const problems: string[] = [];
  try {
    for (const ref of loadAllReferences(repoRoot, styles)) {
      const scope = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
      const runs = new Map<string, Awaited<ReturnType<typeof evaluateVariant>>>();
      const clean = ref.variants.find((v) => v.manifest.kind === 'clean');
      const order = clean === undefined ? ref.variants : [clean, ...ref.variants.filter((v) => v !== clean)];
      for (const v of order) {
        const m = materialiseVariant(ref, v, tmp);
        const r = await evaluateVariant(m.projectDir, ref.specPath, apgStore);
        runs.set(v.manifest.variant, r);
        const cleanActual = clean === undefined ? undefined : runs.get(clean.manifest.variant)?.actual;
        const cmp = compareVariant(ref.style, v.manifest, r.actual, scope, cleanActual);
        const trueBlocking = cmp.matched.filter((e) => ruleTier(e.ruleId, ref.style).tier === 'blocking');
        if (trueBlocking.length === 0) continue;

        const graph = graphFactsFromApg(r.apg, (p) => normaliseFindingPath(p, m.projectDir));
        const blockingQueries = r.queries.filter((q) => ruleTier(String(q.functionId), ref.style).tier === 'blocking');
        const session = driver.session();
        const before = await session.executeRead((tx) => run(tx, blockingQueries));
        await session.close();
        for (const e of trueBlocking) {
          const v0 =
            r.violations.find((x) => String(x.functionId) === e.ruleId && violationKey(x) === keyOf(e.ruleId, e.file, e.target)) ??
            r.violations.find((x) => String(x.functionId) === e.ruleId && (CYCLE_RULE_IDS.has(e.ruleId) ? cycleFileSet({ file: x.filePath, target: x.target }) === cycleFileSet(e) : x.filePath === e.file));
          const query = r.queries.find((q) => String(q.functionId) === e.ruleId);
          if (v0 === undefined || query === undefined) {
            problems.push(`${ref.style}/${v.manifest.variant} ${e.ruleId}: no ${v0 === undefined ? 'violation' : 'query'} for the matched finding`);
            continue;
          }
          const key = violationKey(v0);
          const reproduced = before.has(key);
          if (!reproduced) problems.push(`${ref.style}/${v.manifest.variant} ${e.ruleId}: the re-run does not reproduce the finding`);
          const finding = findingOfViolation(v0, m.projectDir);
          const cliHint = buildFixHint(r.spec, finding, graph);
          const specHint = buildFixHint(r.spec, finding);
          const mutant = cliHint === undefined ? undefined : wrongLayerMutant(r.spec, cliHint, finding.target);
          rows.push({
            ...(mutant !== undefined ? { mutant: await simulate(driver, r.spec, mutant, key, query, blockingQueries, before) } : {}),
            reproduced,
            style: ref.style, variant: v.manifest.variant, ruleId: e.ruleId, file: e.file, ...(e.target !== undefined ? { target: e.target } : {}),
            cli: await simulate(driver, r.spec, cliHint, key, query, blockingQueries, before),
            spec: await simulate(driver, r.spec, specHint, key, query, blockingQueries, before),
          });
          process.stderr.write(`${ref.style}/${v.manifest.variant} ${e.ruleId}: cli ${rows[rows.length - 1]?.cli.valid === true ? 'valid' : 'INVALID'}, spec ${rows[rows.length - 1]?.spec.valid === true ? 'valid' : 'INVALID'}\n`);
        }
      }
    }
  } finally {
    await driver.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  write(rows, problems);
}

async function evaluateVariant(projectDir: string, specPath: string, apgStorePath: string) {
  const { executor, context, cleanup } = createPipeline({
    projectPath: projectDir, specFilePath: specPath, neo4jUri: uri, neo4jUser: user, neo4jPassword: password,
    evaluationMode: 'symbolic-only', pipelineMode: 'stateless', persist: false, diff: false, verbose: false,
    apgStorePath, llmConfig: undefined, instrumentVersion: 2, neuralAggregation: 'registered', scoringMode: 'v1.3',
  });
  try {
    const result = await executor.execute();
    if (!result.success) throw new Error(`${projectDir}: ${result.errors.map((e) => e.message).join('; ')}`);
    const violations = result.data.violations.map((v) => ({
      ...v,
      filePath: v.filePath.split(',').map((p) => normaliseFindingPath(p, projectDir)).join(','),
      ...(v.target !== undefined ? { target: normaliseFindingPath(v.target, projectDir) } : {}),
    }));
    const actual: ActualFinding[] = violations.map((v) => ({ ruleId: String(v.functionId), file: v.filePath, ...(v.target !== undefined && v.target !== '' ? { target: v.target } : {}) }));
    return { violations, actual, apg: context.getApgResult(), queries: context.getCompiledFunctions().symbolicQueries, spec: context.getParsedSpec() };
  } finally {
    await cleanup();
  }
}

function rate(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${String(n)}/${String(d)} (${((100 * n) / d).toFixed(0)}%)`;
}

function write(rows: readonly Row[], problems: readonly string[]): void {
  fs.mkdirSync(outDir, { recursive: true });
  const byRule = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.style}|${r.ruleId}`;
    byRule.set(k, [...(byRule.get(k) ?? []), r]);
  }
  const table = [...byRule.entries()].map(([k, rs]) => {
    const [style, ruleId] = k.split('|');
    const count = (pick: (r: Row) => Check, f: (c: Check) => boolean): number => rs.filter((r) => f(pick(r))).length;
    const side = (pick: (r: Row) => Check) => ({
      hinted: count(pick, (c) => c.hint !== undefined),
      target: count(pick, (c) => c.target),
      removed: count(pick, (c) => c.removed),
      valid: count(pick, (c) => c.valid),
      noRegression: count(pick, (c) => c.valid && c.regressions.length === 0),
    });
    return { style, ruleId, ruleName: rs[0]?.cli.hint?.ruleName ?? '', findings: rs.length, cli: side((r) => r.cli), spec: side((r) => r.spec) };
  });
  const total = (pick: 'cli' | 'spec', f: 'hinted' | 'target' | 'removed' | 'valid' | 'noRegression'): number => table.reduce((s, t) => s + t[pick][f], 0);
  const n = rows.length;
  const summary = {
    findings: n,
    reproducedBeforeEdit: rows.filter((r) => r.reproduced).length,
    mutants: rows.filter((r) => r.mutant !== undefined).length,
    mutantsRejected: rows.filter((r) => r.mutant !== undefined && !(r.mutant.valid && r.mutant.regressions.length === 0)).length,
    mutantsRejectedBySpec: rows.filter((r) => r.mutant !== undefined && !r.mutant.target).length,
    cli: { hinted: total('cli', 'hinted'), target: total('cli', 'target'), removed: total('cli', 'removed'), valid: total('cli', 'valid'), noRegression: total('cli', 'noRegression') },
    spec: { hinted: total('spec', 'hinted'), target: total('spec', 'target'), removed: total('spec', 'removed'), valid: total('spec', 'valid'), noRegression: total('spec', 'noRegression') },
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ summary, perRule: table, problems }, null, 2) + '\n');
  fs.writeFileSync(path.join(outDir, 'hints.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const md: string[] = [
    '# Fix-hint validity on the v1.3 development set (71 variants)',
    '',
    'True blocking findings: manifest findings the run matches whose rule is blocking under the v1.3 tiers for the style. Valid = the target is allowed by the spec AND the simulated edit removes the finding from its own rule. "No regression" also requires that no other blocking finding appears after the edit. CLI = `firewall evaluate --hints` (graph + spec); MCP = the spec-only hint `check_file`/`check_diff` build.',
    '',
    `Control 1: the unedited graph reproduces ${rate(summary.reproducedBeforeEdit, n)} of the findings (an edit can only count as removing a finding that the re-run first reports).`,
    '',
    `Control 2 (wrong-layer mutants): the CLI hint with its new or moved file put next to the violating target instead is rejected (invalid or with a regression) in ${rate(summary.mutantsRejected, summary.mutants)} of the applicable cases; by the spec check alone in ${rate(summary.mutantsRejectedBySpec, summary.mutants)}.`,
    '',
    `Overall: CLI valid ${rate(summary.cli.valid, n)}, no regression ${rate(summary.cli.noRegression, n)}; MCP (spec-only) valid ${rate(summary.spec.valid, n)}, no regression ${rate(summary.spec.noRegression, n)}.`,
    '',
    '| Style | Rule | Name | True blocking | CLI hinted | CLI target ok | CLI edge removed | CLI valid | CLI no regression | MCP valid | MCP no regression |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...table.map((t) => `| ${t.style ?? ''} | ${t.ruleId ?? ''} | ${t.ruleName} | ${String(t.findings)} | ${String(t.cli.hinted)} | ${String(t.cli.target)} | ${String(t.cli.removed)} | ${rate(t.cli.valid, t.findings)} | ${rate(t.cli.noRegression, t.findings)} | ${rate(t.spec.valid, t.findings)} | ${rate(t.spec.noRegression, t.findings)} |`),
    '',
    '## Per finding',
    '',
    '| Style | Variant | Rule | File | CLI action | CLI target | CLI valid | Regressions (CLI) | Notes |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.style} | ${r.variant} | ${r.ruleId} | ${r.file} | ${r.cli.hint?.fix.action ?? '-'} | ${r.cli.hint?.target.path ?? r.cli.hint?.target.folder ?? '-'} | ${r.cli.valid ? 'yes' : 'NO'} | ${r.cli.regressions.join('<br>') || '-'} | ${[...r.cli.targetReasons, r.cli.removed ? '' : 'finding still reported'].filter((x) => x !== '').join('; ') || '-'} |`),
    '',
    ...(problems.length > 0 ? ['## Problems', '', ...problems.map((p) => `- ${p}`), ''] : []),
  ];
  fs.writeFileSync(path.join(outDir, 'report.md'), md.join('\n'));
  process.stdout.write(`${md[4] ?? ''}\n${md[6] ?? ''}\n${md[8] ?? ''}\n`);
}

void main().catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
});
