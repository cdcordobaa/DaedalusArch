/**
 * PUZZLE-01 instrument scorer (zero calls: no model, no Neo4j, no network).
 *
 * Evaluates one source tree the way `experiments/pilot-hexddd-01/score-pilot.ts` (branch pilot/hexddd-01) does:
 * `firewallEvaluator` (scoring v1.3, the switch-aware tier resolver) on the `cypher-interp` engine, the harness
 * tsconfig shape (`buildHarnessTsconfig`), the puzzle's own spec, and check-correct (`checkFinding`, ADR-032
 * tsconfig) on every blocking finding. The instrument is the code at the current checkout; nothing under `src/` or
 * `scripts/` is changed.
 *
 * Usage (repository root):
 *   npx tsx experiments/puzzle-01/tools/instrument-score.ts --spec <spec.yaml> --tree <dir> [--label <name>]
 * Prints one JSON object: verdict, blocking and advisory counts by rule, and every finding (repo-relative paths).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildContext } from '../../../src/mcp-server/context.js';
import { buildHarnessTsconfig } from '../../../scripts/lib/generators/harness-tsconfig.js';
import { engineDeps, engineEnv, taggedEvaluator } from '../../../scripts/lib/loop/engine-tee.js';
import { firewallEvaluator } from '../../../scripts/lib/loop/evaluator.js';
import type { StepEvaluation } from '../../../scripts/lib/loop/types.js';
import { checkFinding } from '../../../scripts/v1.3/lib/labelling/correctness.js';
import { findingsOfReport } from '../../../scripts/v1.3/lib/labelling/findings.js';
import { SourceFacts } from '../../../scripts/v1.3/lib/labelling/source-facts.js';
import { loadSpecView } from '../../../scripts/v1.3/lib/labelling/spec-facts.js';

const REPO = process.cwd();
const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

interface ReportRow { readonly id?: string; readonly functionId?: unknown; readonly filePath?: unknown; readonly target?: unknown; readonly line?: unknown; readonly message?: unknown }

async function main(): Promise<number> {
  const specArg = arg('spec');
  const treeArg = arg('tree');
  if (specArg === undefined || treeArg === undefined) {
    process.stderr.write('usage: instrument-score.ts --spec <spec.yaml> --tree <dir> [--label <name>]\n');
    return 2;
  }
  const specPath = path.resolve(specArg);
  // Copy the tree to scratch, link the repository's node_modules (for @types/node), write the harness tsconfig.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'puzzle-01-score-'));
  const tree = path.join(scratch, 'tree');
  fs.cpSync(path.resolve(treeArg), tree, { recursive: true });
  fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(tree, 'node_modules'));
  const tsconfig = `${tree}.tsconfig.json`;
  fs.writeFileSync(tsconfig, `${JSON.stringify(buildHarnessTsconfig(tree), null, 2)}\n`);
  const scrub = (s: string): string => s.split(scratch).join('<scratch>').split(REPO).join('.');
  try {
    const env = engineEnv(process.env, 'cypher-interp');
    const deps = engineDeps(buildContext({}, env).evaluateDeps, 'cypher-interp');
    const ev = taggedEvaluator(firewallEvaluator(specPath, env, deps, () => tsconfig), 'cypher-interp');
    const r = await ev.evaluate(tree, 'puzzle-01');
    if (!r.success) {
      process.stdout.write(`${JSON.stringify({ ok: false, errors: r.errors.map((e) => scrub(e.message)) })}\n`);
      return 1;
    }
    const e: StepEvaluation = r.data;
    const spec = await loadSpecView(specPath);
    const report = findingsOfReport({ violations: e.reportViolations ?? [] }, { projectId: arg('label') ?? 'tree' }, spec.style);
    const facts = new SourceFacts(tree, { tsconfig: 'adr-032' });
    const blocking = e.blockingFindings.map((b) => {
      const m = report.find((x) => x.violationId === b.violationId);
      const c = m === undefined ? { verdict: 'unmatched', reason: 'no report row' } : checkFinding(m, spec, facts);
      return { ruleId: b.ruleId, file: b.filePath, line: b.line ?? null, target: b.target ?? null, message: scrub(b.message), checkCorrect: c.verdict };
    });
    const blockingIds = new Set(e.blockingFindings.map((b) => b.violationId));
    const advisory = ((e.reportViolations ?? []) as ReportRow[])
      .filter((v) => typeof v.id === 'string' && !blockingIds.has(v.id) && (e.advisoryByRule?.[String(v.functionId)] ?? 0) > 0)
      .map((v) => ({ ruleId: String(v.functionId), file: String(v.filePath ?? ''), target: typeof v.target === 'string' ? v.target : null, message: scrub(String(v.message ?? '')) }));
    process.stdout.write(`${JSON.stringify({
      ok: true, label: arg('label') ?? null, verdict: e.verdict, engine: 'cypher-interp', scoringMode: 'v1.3',
      blockingCount: e.blockingViolationCount, blockingByRule: e.blockingByRule, advisoryByRule: e.advisoryByRule ?? {},
      blocking, advisory,
    })}\n`);
    return 0;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
    fs.rmSync(tsconfig, { force: true });
  }
}

main().then((c) => { process.exitCode = c; }, (err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exitCode = 2;
});
