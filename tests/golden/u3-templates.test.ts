/**
 * U3 container tests (D-U3-14): FR-12 ids and locations, metric filters and the U3 templates
 * against the real Neo4j 5.26. Same skip and host guards as golden.test.ts (see golden-env.ts).
 * Each case runs the full symbolic pipeline, which wipes and re-ingests the graph itself.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import neo4jDriver from 'neo4j-driver';
import { extractAPG } from '../../src/apg-extractor/index.js';
import { evaluateSymbolic } from '../../src/evaluation-engine/symbolic-evaluator.js';
import { CYPHER_TEMPLATES } from '../../src/fitness-compiler/cypher-templates.js';
import { FileSystemSnapshotStore, Neo4jRepository, ingestAPG } from '../../src/neo4j-ingestion/index.js';
import type { Violation } from '../../src/shared/taxonomy/violation-types.js';
import type { LayerModel } from '../../src/shared/types/spec.js';
import { functionId } from '../../src/shared/types/value-objects.js';
import { compileFunctions } from '../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../src/fitness-compiler/compiler-input.js';
import { parseSpec } from '../../src/spec-parser/spec-parser.js';
import type { CypherQuery } from '../../src/shared/types/evaluation.js';
import { GOLDEN_CASES, REPO_ROOT } from './golden-cases.js';
import type { GoldenCase } from './golden-cases.js';
import { resolveGoldenEnv } from './golden-env.js';
import type { GoldenNeo4jConfig } from './golden-env.js';
import { runGoldenCase } from './golden-runner.js';
import { validateReport } from '../../src/scoring-engine/report-schema-validator.js';
import type { GoldenRun } from './golden-runner.js';

const goldenEnv = resolveGoldenEnv();

if (!goldenEnv.enabled) {
  console.warn(`[u3-templates] ${goldenEnv.reason}`);
}

const describeU3 = goldenEnv.enabled ? describe : describe.skip;

const RUN_TIMEOUT_MS = 240_000;

function neo4jConfig(): GoldenNeo4jConfig {
  if (!goldenEnv.enabled) throw new Error(goldenEnv.reason);
  return goldenEnv.neo4j;
}

function goldenCase(id: string): GoldenCase {
  const c = GOLDEN_CASES.find((g) => g.id === id);
  if (c === undefined) throw new Error(`golden case ${id} missing`);
  return c;
}

async function run(id: string): Promise<GoldenRun> {
  const result = await runGoldenCase(goldenCase(id), neo4jConfig());
  if (!result.success) throw new Error(`${id} failed: ${result.errors.map((e) => e.code).join(', ')}`);
  return result.data;
}

describeU3('U3-R2 FR-12 ids and locations (BR-U3-04, BR-U3-05)', () => {
  it('two runs on variant-a give identical violation id sets', async () => {
    const first = await run('variant-a-structural');
    const second = await run('variant-a-structural');
    const ids = (r: GoldenRun): string[] => r.report.violations.map((v) => v.id).sort();
    expect(ids(first).length).toBeGreaterThan(0);
    expect(ids(second)).toEqual(ids(first));
    expect(new Set(ids(first)).size).toBe(ids(first).length);
    for (const id of ids(first)) expect(id).toMatch(/^v-[0-9a-f]{16}$/);
  }, RUN_TIMEOUT_MS);

  it('variant-a: every structural violation has a numeric line and a target', async () => {
    const r = await run('variant-a-structural');
    const structural = r.report.violations.filter((v) => v.dimension === 'structural');
    expect(structural.length).toBeGreaterThan(0);
    for (const v of structural) {
      expect({ id: String(v.functionId), file: v.filePath, lineIsNumber: typeof v.line === 'number', hasTarget: typeof v.target === 'string' })
        .toEqual({ id: String(v.functionId), file: v.filePath, lineIsNumber: true, hasTarget: true });
      expect(v.tag).toBe(String(v.functionId) === 'FF-S02' ? 'topological' : 'structural');
    }
  }, RUN_TIMEOUT_MS);
});

const METRIC_TEMPLATES = ['dependency-inversion', 'domain-stability', 'abstraction-ratio'] as const;

/** The three metric queries of specs/clean-arch.yaml, compiled with or without `exclude_paths`. */
async function metricQueries(withExcludes: boolean): Promise<readonly CypherQuery[]> {
  const parsed = await parseSpec({ specFilePath: path.join(REPO_ROOT, 'specs/clean-arch.yaml') });
  if (!parsed.success) throw new Error('specs/clean-arch.yaml did not parse');
  const input = compilerInputFromSpec(parsed.data);
  // abstraction-ratio has no exclude marker (BR-U1-32): excludes on it are a compile error, so it runs without.
  const fitnessFunctions = input.fitnessFunctions.map((ff) =>
    (withExcludes && ff.name !== 'abstraction-ratio' && (METRIC_TEMPLATES as readonly string[]).includes(ff.name)
      ? { ...ff, excludePaths: ['src/x/**'] } : ff));
  const compiled = compileFunctions({ ...input, fitnessFunctions });
  if (!compiled.success) throw new Error(`did not compile: ${compiled.errors.map((e) => e.message).join('; ')}`);
  const queries = [...compiled.data.symbolicQueries, ...compiled.data.hybridPairs.map((h) => h.symbolicQuery)]
    .filter((q) => (METRIC_TEMPLATES as readonly string[]).includes(q.name));
  expect(queries.map((q) => q.name).sort()).toEqual([...METRIC_TEMPLATES].sort());
  return queries;
}

describeU3('U3-R4 metric filters (BR-U3-10, 11, 12)', () => {
  it('correct-reference: FF-P02, FF-C01 and FF-C06 return 0 rows and pass', async () => {
    const r = await run('correct-reference');
    for (const id of ['FF-P02', 'FF-C01', 'FF-C06']) {
      const result = r.report.functionResults.find((x) => String(x.functionId) === id);
      expect({ id, rows: result?.violationCount, passed: result?.passed }).toEqual({ id, rows: 0, passed: true });
    }
  }, RUN_TIMEOUT_MS);

  it("variant-a: FF-C06 has one violation with filePath '<project>' and evidence ['ratio=0.2']", async () => {
    const r = await run('variant-a-structural');
    const c06 = r.report.violations.filter((v) => String(v.functionId) === 'FF-C06');
    expect(c06.map((v) => ({ filePath: v.filePath, evidence: v.evidence }))).toEqual([{ filePath: '<project>', evidence: ['ratio=0.2'] }]);
  }, RUN_TIMEOUT_MS);

  it('the three templates EXPLAIN with and without an exclude list (exclude-marker test of BR-U1-32)', async () => {
    const neo4j = neo4jConfig();
    const driver = neo4jDriver.driver(neo4j.uri, neo4jDriver.auth.basic(neo4j.user, neo4j.password));
    try {
      for (const withExcludes of [false, true]) {
        for (const q of await metricQueries(withExcludes)) {
          const session = driver.session();
          try {
            await session.run(`EXPLAIN ${q.cypher}`, q.params, { timeout: 30_000 });
            const excluded = q.cypher.includes('$excludePatterns');
            expect({ name: q.name, withExcludes, excluded })
              .toEqual({ name: q.name, withExcludes, excluded: withExcludes && q.name !== 'abstraction-ratio' });
          } finally {
            await session.close();
          }
        }
      }
    } finally {
      await driver.close();
    }
  }, RUN_TIMEOUT_MS);
});

/** Extracts and ingests a unit fixture (wipes the graph), then runs one template with `params` (D-U3-14). */
async function runTemplateOnFixture(
  fixtureDir: string,
  layerModel: LayerModel,
  name: string,
  id: string,
  params: Record<string, unknown>,
): Promise<{ rows: readonly Record<string, unknown>[]; violations: readonly Violation[] }> {
  const neo4j = neo4jConfig();
  const repo = new Neo4jRepository({ neo4jUri: neo4j.uri, neo4jUser: neo4j.user, neo4jPassword: neo4j.password });
  const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'u3-fixture-apg-'));
  try {
    const apg = await extractAPG(path.join(REPO_ROOT, fixtureDir));
    if (!apg.success) throw new Error(`extractAPG failed: ${apg.errors.map((e) => e.code).join(', ')}`);
    const ingested = await ingestAPG({ apgResult: apg.data, layerModel, mode: 'stateless' }, repo, new FileSystemSnapshotStore(storeDir));
    if (!ingested.success) throw new Error(`ingestAPG failed: ${ingested.errors.map((e) => e.code).join(', ')}`);
    const t = CYPHER_TEMPLATES.get(name);
    if (t === undefined) throw new Error(`${name} missing`);
    const raw = await repo.executeQuery(t.template, params);
    if (!raw.success) throw new Error(`${name} failed: ${raw.errors.map((e) => e.code).join(', ')}`);
    const q: CypherQuery = {
      functionId: functionId(id), name, cypher: t.template, params,
      dimension: 'pattern', severity: 'critical', route: 'symbolic', source: 'template',
    };
    const evaluated = await evaluateSymbolic({ queries: [q], graphRepository: repo });
    if (!evaluated.success) throw new Error('evaluateSymbolic failed');
    return { rows: raw.data.records, violations: evaluated.data.results[0]?.violations ?? [] };
  } finally {
    await repo.close();
    fs.rmSync(storeDir, { recursive: true, force: true });
  }
}

const DOMAIN_ONLY: LayerModel = {
  layers: [{ name: 'domain', directories: ['src/domain/**'], naming: [], role: 'domain' }],
};

describeU3('U3-R5 domain-purity over Package nodes (FR-11; BR-U3-20, TF-01, TF-05)', () => {
  const p01 = (r: GoldenRun): { file: string; target: string | undefined; relType: string | undefined; line: number | undefined }[] =>
    r.report.violations.filter((v) => String(v.functionId) === 'FF-P01')
      .map((v) => ({ file: v.filePath, target: v.target, relType: v.discriminator?.[0], line: v.line }));

  it('variant-b: exactly one row (Task.ts, @nestjs/common, IMPORTS, line 2)', async () => {
    expect(p01(await run('variant-b-pattern'))).toEqual([
      { file: 'src/domain/entities/Task.ts', target: '@nestjs/common', relType: 'IMPORTS', line: 2 },
    ]);
  }, RUN_TIMEOUT_MS);

  it('variant-c: exactly two rows on Task.ts (@nestjs/common line 2, express line 3)', async () => {
    expect(p01(await run('variant-c-everything'))).toEqual([
      { file: 'src/domain/entities/Task.ts', target: '@nestjs/common', relType: 'IMPORTS', line: 2 },
      { file: 'src/domain/entities/Task.ts', target: 'express', relType: 'IMPORTS', line: 3 },
    ]);
  }, RUN_TIMEOUT_MS);

  it.each(['correct-reference', 'variant-a-structural', 'variant-d-subtle'])('%s: no FF-P01 row', async (id) => {
    expect(p01(await run(id))).toEqual([]);
  }, RUN_TIMEOUT_MS);

  it("TF-05: a domain file with export { Router } from 'express' gives one RE_EXPORTS row, verb re-exports", async () => {
    const { rows, violations } = await runTemplateOnFixture('fixtures/unit/u3-reexport', DOMAIN_ONLY, 'domain-purity', 'FF-P01',
      { domainLayer: 'domain', forbiddenImports: ['@nestjs/*', 'express'] });
    expect(rows.map((r) => ({ source: r.source, target: r.target, relType: r.relType, verb: r.verb }))).toEqual([
      { source: 'src/domain/router.ts', target: 'express', relType: 'RE_EXPORTS', verb: 're-exports' },
    ]);
    expect(violations.map((v) => ({ message: v.message, line: v.line, disc: v.discriminator }))).toEqual([
      { message: 'Domain file src/domain/router.ts re-exports forbidden package express', line: 2, disc: ['RE_EXPORTS'] },
    ]);
  }, RUN_TIMEOUT_MS);
});

const DOMAIN_INFRA: LayerModel = {
  layers: [
    { name: 'domain', directories: ['src/domain/**'], naming: [], role: 'domain' },
    { name: 'infrastructure', directories: ['src/infrastructure/**'], naming: [], role: 'repository' },
  ],
};

const STATE_PARAMS = { domainLayer: 'domain', infraLayer: 'infrastructure' };
const REPO_TARGET = 'src/infrastructure/InMemoryOrderRepository.ts';

describeU3('U3-R6 domain-state-purity (FR-21; BR-U3-22, 23; TF-02..04)', () => {
  const fixture = (name: string): string => `fixtures/unit/u3-state-purity/${name}`;
  const shape = (v: Violation): Record<string, unknown> => ({
    file: v.filePath, target: v.target, disc: v.discriminator, hasLine: 'line' in v, line: v.line, tag: v.tag,
  });

  it("TF-02: `private readonly repo = new InMemoryOrderRepository()` gives one FLOWS_TO violation with line and field 'repo'", async () => {
    const { rows, violations } = await runTemplateOnFixture(fixture('field-new'), DOMAIN_INFRA, 'domain-state-purity', 'FF-P06', STATE_PARAMS);
    expect(rows.map((r) => r.relType)).toEqual(['FLOWS_TO']);
    expect(violations.map(shape)).toEqual([
      { file: 'src/domain/Order.ts', target: REPO_TARGET, disc: ['Order', 'InMemoryOrderRepository', 'FLOWS_TO', 'repo'], hasLine: true, line: 5, tag: 'structural' },
    ]);
  }, RUN_TIMEOUT_MS);

  it("TF-03: constructor injection gives one CONSTRUCTOR_INJECTS violation, field 'repo', no line key", async () => {
    const { violations } = await runTemplateOnFixture(fixture('ctor-inject'), DOMAIN_INFRA, 'domain-state-purity', 'FF-P06', STATE_PARAMS);
    expect(violations.map(shape)).toEqual([
      { file: 'src/domain/Order.ts', target: REPO_TARGET, disc: ['Order', 'InMemoryOrderRepository', 'CONSTRUCTOR_INJECTS', 'repo'], hasLine: false, line: undefined, tag: 'structural' },
    ]);
  }, RUN_TIMEOUT_MS);

  it('TF-04 (fixture): two injected parameters of one type reach the graph as one CONSTRUCTOR_INJECTS edge (U2 keep-first), so one violation', async () => {
    // U2 keeps one CONSTRUCTOR_INJECTS edge per (class, target) (U2 business-logic-model.md step 5, keep-first addEdge);
    // the template-level expectation (two edges → two violations) is pinned by the seeded test below (plan Step 17 deviation).
    const { violations } = await runTemplateOnFixture(fixture('ctor-inject-two'), DOMAIN_INFRA, 'domain-state-purity', 'FF-P06', STATE_PARAMS);
    expect(violations.map((v) => v.discriminator?.[3])).toEqual(['a']);
  }, RUN_TIMEOUT_MS);

  it('TF-04 (seeded graph): two CONSTRUCTOR_INJECTS edges to one infrastructure type give two violations (field a, b)', async () => {
    const neo4j = neo4jConfig();
    const repo = new Neo4jRepository({ neo4jUri: neo4j.uri, neo4jUser: neo4j.user, neo4jPassword: neo4j.password });
    try {
      const cleared = await repo.clearGraph();
      if (!cleared.success) throw new Error('clearGraph failed');
      const seeded = await repo.executeQuery(
        `CREATE (c:APGNode:Class {id: 'c', name: 'Order', filePath: 'src/domain/Order.ts', layer: $domainLayer})
         CREATE (t:APGNode:Class {id: 't', name: 'InMemoryOrderRepository', filePath: $target, layer: $infraLayer})
         CREATE (c)-[:CONSTRUCTOR_INJECTS {parameterName: 'a'}]->(t)
         CREATE (c)-[:CONSTRUCTOR_INJECTS {parameterName: 'b'}]->(t)`,
        { ...STATE_PARAMS, target: REPO_TARGET },
      );
      if (!seeded.success) throw new Error('seed failed');
      const t = CYPHER_TEMPLATES.get('domain-state-purity');
      if (t === undefined) throw new Error('domain-state-purity missing');
      const q: CypherQuery = {
        functionId: functionId('FF-P06'), name: 'domain-state-purity', cypher: t.template, params: STATE_PARAMS,
        dimension: 'pattern', severity: 'critical', route: 'symbolic', source: 'template',
      };
      const out = await evaluateSymbolic({ queries: [q], graphRepository: repo });
      if (!out.success) throw new Error('evaluateSymbolic failed');
      const vs = out.data.results[0]?.violations ?? [];
      expect(vs.map((v) => ({ field: v.discriminator?.[3], hasLine: 'line' in v }))).toEqual([
        { field: 'a', hasLine: false }, { field: 'b', hasLine: false },
      ]);
      expect(new Set(vs.map((v) => v.id)).size).toBe(2);
    } finally {
      await repo.clearGraph();
      await repo.close();
    }
  }, RUN_TIMEOUT_MS);

  it('correct-reference: FF-P06 compiles, executes and has no violation', async () => {
    const r = await run('correct-reference');
    const p06 = r.report.functionResults.find((x) => String(x.functionId) === 'FF-P06');
    expect({ rows: p06?.violationCount, passed: p06?.passed }).toEqual({ rows: 0, passed: true });
  }, RUN_TIMEOUT_MS);
});

/** The five run-specific paths of BR-U3-61, set to 0 so two reports of one run state compare equal. */
function withoutRunValues(report: unknown): unknown {
  const r = JSON.parse(JSON.stringify(report)) as {
    runId: string;
    durationMs: number;
    timings: { totalMs: number; stages: { durationMs: number }[] };
    functionResults: { executionTimeMs: number }[];
  };
  r.runId = '<run>';
  r.durationMs = 0;
  r.timings.totalMs = 0;
  for (const s of r.timings.stages) s.durationMs = 0;
  for (const f of r.functionResults) f.executionTimeMs = 0;
  return r;
}

describeU3('U3-R9 one assembly point (BR-U3-50, 55, 56, 64)', () => {
  it('variant-a: evaluate --format json deep-equals executor.execute() (run-specific values aside)', async () => {
    const c = goldenCase('variant-a-structural');
    const pipelineReport = (await run(c.id)).report;
    const neo4j = neo4jConfig();
    const apgStore = fs.mkdtempSync(path.join(os.tmpdir(), 'u3-r9-cli-'));
    try {
      // Credentials travel in the environment only, never on argv.
      const out = spawnSync(path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx'), [
        path.join(REPO_ROOT, 'bin', 'firewall.ts'), 'evaluate',
        '--project', c.projectPath, '--spec', c.specPath, '--symbolic-only', '--format', 'json', '--neo4j-uri', neo4j.uri,
      ], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, NEO4J_USER: neo4j.user, NEO4J_PASSWORD: neo4j.password, APG_STORE_PATH: apgStore },
        maxBuffer: 64 * 1024 * 1024,
      });
      expect(out.error).toBeUndefined();
      const cliReport = JSON.parse(out.stdout) as unknown;
      expect(withoutRunValues(cliReport)).toEqual(withoutRunValues(pipelineReport));
      // U3-R10: the printed JSON validates against the frozen schema (FR-14 acceptance).
      expect(validateReport(cliReport).success).toBe(true);
    } finally {
      fs.rmSync(apgStore, { recursive: true, force: true });
    }
  }, RUN_TIMEOUT_MS);

  it.each(GOLDEN_CASES.map((g) => g.id))('%s: one COMPILER_004 naming FF-S03; disabledFunctions lists FF-CV01, FF-CV04 (ADR-016 b, BT-E1) and FF-S03; last stage assemble-report', async (id) => {
    const r = await run(id);
    const c004 = r.report.warnings.filter((w) => w.code === 'COMPILER_004');
    expect(c004.map((w) => w.message.includes('FF-S03'))).toEqual([true]);
    expect(r.report.disabledFunctions.map((d) => String(d.functionId))).toEqual(['FF-CV01', 'FF-CV04', 'FF-S03']); // BT-E1: ADR-016 b exclusions
    expect(r.report.functionExecution.failed).toEqual([]);
    expect(r.report.timings.stages.map((s) => s.name)).not.toContain('assemble-report');
    expect(r.report.timings.stages.at(-1)?.name).toBe('compute-scores');
  }, RUN_TIMEOUT_MS);

  it('variant-c: importResolution.external === 3 and graphStats.edgeCountByType.FLOWS_TO present', async () => {
    const r = await run('variant-c-everything');
    expect(r.report.importResolution.external).toBe(3);
    expect(r.report.graphStats.edgeCountByType).toHaveProperty('FLOWS_TO');
  }, RUN_TIMEOUT_MS);
});

describeU3('U3-R10 frozen schema (BR-U3-59, 60)', () => {
  it.each(GOLDEN_CASES.map((g) => g.id))('%s: the assembled report and its JSON validate against the frozen schema', async (id) => {
    const r = await run(id);
    const asObject = validateReport(r.report);
    const asJson = validateReport(JSON.parse(JSON.stringify(r.report)) as unknown);
    expect([asObject.success ? 'ok' : asObject.errors.map((e) => e.message), asJson.success ? 'ok' : asJson.errors.map((e) => e.message)]).toEqual(['ok', 'ok']);
    expect(r.report.judge).toEqual({ provider: 'none', model: 'none', runsPerUnit: 0 });
    expect(r.report).not.toHaveProperty('neuralResults');
  }, RUN_TIMEOUT_MS);
});

describeU3('U3-R11 scrubbing (NFR-05, BR-U3-58)', () => {
  it.each(GOLDEN_CASES.map((g) => g.id))('%s: the report JSON and the context warnings contain neither the URI nor the password (counts only)', async (id) => {
    const r = await run(id);
    const neo4j = neo4jConfig();
    const text = JSON.stringify({ report: r.report, warnings: r.warnings });
    const count = (needle: string): number => text.split(needle).length - 1;
    expect({ uri: count(neo4j.uri), password: count(neo4j.password) }).toEqual({ uri: 0, password: 0 });
  }, RUN_TIMEOUT_MS);
});

describeU3('U3-R12 batch rows from the assembled report (FR-16; BR-U3-83)', () => {
  it('batch --dir fixtures --spec presets/clean-architecture.yaml --format json gives five rows with the four report fields', () => {
    const neo4j = neo4jConfig();
    const apgStore = fs.mkdtempSync(path.join(os.tmpdir(), 'u3-r12-batch-'));
    try {
      // Credentials travel in the environment only, never on argv. No mode flag: batch is symbolic-only.
      const out = spawnSync(path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx'), [
        path.join(REPO_ROOT, 'bin', 'firewall.ts'), 'batch',
        '--dir', 'fixtures', '--spec', 'presets/clean-architecture.yaml', '--format', 'json', '--neo4j-uri', neo4j.uri,
      ], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, NEO4J_USER: neo4j.user, NEO4J_PASSWORD: neo4j.password, APG_STORE_PATH: apgStore },
        maxBuffer: 64 * 1024 * 1024,
      });
      expect(out.error).toBeUndefined();
      const parsed = JSON.parse(out.stdout) as { totalProjects: number; errorCount: number; rows: Record<string, unknown>[] };
      expect({ total: parsed.totalProjects, errors: parsed.errorCount, rows: parsed.rows.length }).toEqual({ total: 5, errors: 0, rows: 5 });
      for (const row of parsed.rows) {
        expect({
          violations: Array.isArray(row.violations),
          perDimensionScores: Array.isArray(row.perDimensionScores),
          functionExecution: typeof row.functionExecution === 'object' && row.functionExecution !== null,
          droppedDimensions: Array.isArray(row.droppedDimensions),
          violationCount: (row.violations as unknown[]).length === row.violationCount,
        }).toEqual({ violations: true, perDimensionScores: true, functionExecution: true, droppedDimensions: true, violationCount: true });
      }
      const text = out.stdout + out.stderr;
      expect(text.split(neo4j.password).length - 1).toBe(0);
    } finally {
      fs.rmSync(apgStore, { recursive: true, force: true });
    }
  }, RUN_TIMEOUT_MS * 3);
});
