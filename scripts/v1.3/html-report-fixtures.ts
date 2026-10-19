/**
 * Captures the inputs of the architect HTML report snapshot tests (`tests/unit/report/architect-html.test.ts`): for
 * each reference variant, the v1.3 symbolic-only evaluation report and the file-level import graph of its APG.
 * Needs Neo4j 5.26 with APOC; reads NEO4J_URI, NEO4J_USER and NEO4J_PASSWORD from the environment only.
 *
 * Usage: NEO4J_URI=bolt://localhost:7687 NEO4J_PASSWORD=... npx tsx scripts/v1.3/html-report-fixtures.ts [--out <dir>]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createPipeline } from '../../src/pipeline/pipeline-factory.js';
import type { PipelineConfig } from '../../src/pipeline/types.js';
import { graphInputFromApg } from '../../src/report/architect/index.js';

export const HTML_REPORT_VARIANTS = ['correct-reference', 'variant-a-structural', 'variant-b-pattern'] as const;
export const HTML_REPORT_SPEC = 'specs/clean-arch.yaml';

async function capture(variant: string, outDir: string, password: string): Promise<void> {
  const config: PipelineConfig = {
    projectPath: `fixtures/${variant}`,
    specFilePath: HTML_REPORT_SPEC,
    neo4jUri: process.env['NEO4J_URI'] ?? 'bolt://localhost:7687',
    neo4jUser: process.env['NEO4J_USER'] ?? 'neo4j',
    neo4jPassword: password,
    evaluationMode: 'symbolic-only',
    pipelineMode: 'stateless',
    persist: false,
    diff: false,
    verbose: false,
    apgStorePath: '.apg-store',
    instrumentVersion: 2,
    neuralAggregation: 'registered',
    scoringMode: 'v1.3',
  };
  const { executor, context, cleanup } = createPipeline({ ...config, postSealRules: false }); // v1.4 U2: the sealed v1.3 rule set (BR-U2-10)
  try {
    const result = await executor.execute();
    if (!result.success) throw new Error(`${variant}: ${result.errors.map((e) => e.message).join('; ')}`);
    const fixture = { variant, spec: HTML_REPORT_SPEC, report: result.data, graph: graphInputFromApg(context.getApgResult()) };
    writeFileSync(join(outDir, `${variant}.json`), `${JSON.stringify(fixture, null, 2)}\n`, 'utf-8');
    process.stderr.write(`${variant}: verdict ${result.data.verdict}, ${String(result.data.violations.length)} violations\n`);
  } finally {
    await cleanup();
  }
}

async function main(argv: readonly string[]): Promise<number> {
  const password = process.env['NEO4J_PASSWORD'];
  if (password === undefined || password === '') {
    process.stderr.write('NEO4J_PASSWORD is not set; this script needs Neo4j 5.26 with APOC.\n');
    return 2;
  }
  const at = argv.indexOf('--out');
  const outDir = resolve(at >= 0 ? (argv[at + 1] ?? '') : 'tests/fixtures/html-report');
  mkdirSync(outDir, { recursive: true });
  for (const v of HTML_REPORT_VARIANTS) await capture(v, outDir, password);
  return 0;
}

if (process.argv[1]?.endsWith('html-report-fixtures.ts') === true) {
  main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  });
}
