/**
 * U3-R11: scrubbing everywhere (NFR-05; D-U0-6; BR-U3-58; TF-17). Warnings and audit entries on
 * entry to the pipeline context, failure messages, the whole report before validation, and one
 * definition of the Neo4j scrub policy (moved from the repository into src/shared/errors/scrub.ts).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ScrubbingFirewallContext } from '../../../src/pipeline/scrubbing-context.js';
import { AssembleReportCommand } from '../../../src/pipeline/commands/assemble-report-command.js';
import { evaluateSymbolic } from '../../../src/evaluation-engine/symbolic-evaluator.js';
import { neo4jScrubPolicy, scrubWithPolicy } from '../../../src/shared/errors/scrub.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import { ahsScore, avrScore, functionId, runId } from '../../../src/shared/types/value-objects.js';
import type { APGResult } from '../../../src/shared/types/apg.js';

const ROOT = path.resolve(__dirname, '../../..');
// Built at run time so no literal credential sits in the source.
const PW = ['tf17', 'Lane', 'Secret', '42'].join('-');
const URI = 'bolt://localhost:7687';
const POLICY = neo4jScrubPolicy({ neo4jUri: URI, neo4jUser: 'neo4j', neo4jPassword: PW });
const LEAK = `bolt://neo4j:${PW}@127.0.0.1:7687`;

function leaks(text: string): string[] {
  return [PW, '127.0.0.1:7687', URI].filter((s) => text.includes(s));
}

describe('TF-17: a warning and an audit entry carrying the credentialed URI are scrubbed on entry', () => {
  it('ScrubbingFirewallContext removes the password and the resolved address from warnings and audit entries', () => {
    const context = new ScrubbingFirewallContext(runId('r11'), POLICY);
    context.addWarning({ stage: 'ingest-apg', code: 'X', message: `connect to ${LEAK} failed`, context: { uri: LEAK, raw: `pw ${PW}` } });
    context.addAuditEntry({ timestamp: 't', stage: 'ingest-apg', event: `error at 127.0.0.1:7687 using ${URI}`, metadata: { errors: [{ message: LEAK }] } });
    const text = JSON.stringify({ warnings: context.warnings, audit: context.auditLog });
    expect(leaks(text)).toEqual([]);
    expect(text).toContain('[REDACTED]');
  });
});

describe('failure messages (BR-U3-58, FR-13)', () => {
  it('a FunctionFailure message and its warning carry neither the URI nor the password', async () => {
    const repo: GraphRepository = {
      executeQuery(): Promise<DomainResult<QueryResult>> {
        return Promise.resolve(DomainResult.fail<QueryResult>([{ code: 'ServiceUnavailable', message: `could not reach ${URI} as neo4j/${PW}` }]));
      },
      clearGraph() { return Promise.resolve(DomainResult.ok(undefined)); },
      healthCheck() { return Promise.resolve(true); },
      close() { return Promise.resolve(); },
    };
    const out = await evaluateSymbolic({
      queries: [{ functionId: functionId('FF-S01'), name: 'dependency-direction', cypher: 'RETURN 1', params: {}, dimension: 'structural', severity: 'major', route: 'symbolic', source: 'template' }],
      graphRepository: repo,
      knownSecrets: POLICY.secrets,
    });
    if (!out.success) throw new Error('evaluateSymbolic failed');
    expect(out.data.failures).toHaveLength(1);
    expect(leaks(JSON.stringify(out.data))).toEqual([]);
  });
});

describe('the assembled report is scrubbed before validation (BR-U3-58)', () => {
  it('a secret in a warning, a failure and a file path never reaches the report, which still validates', async () => {
    const context = new ScrubbingFirewallContext(runId('r11'), POLICY);
    const apg: APGResult = {
      nodes: [], edges: [], warnings: [],
      parseCoverage: { total: 1, parsed: 0, percentage: 0, skipped: [{ filePath: `src/${PW}.ts`, reason: `parse error at ${LEAK}` }] },
      importResolution: { resolvedInternal: 0, external: 0, unresolved: 0, unsupportedDynamic: 0, externalOutOfRootAlias: 0, droppedNoFileNode: 0 },
    };
    context.setApgResult(apg);
    context.setIngestionResult({
      graphStats: { nodeCount: 0, edgeCount: 0, layerCoverage: 0, nodeCountByType: {}, edgeCountByType: {} },
      layerAnnotationSummary: { mapped: 0, unmapped: 1, unmappedFiles: [`src/${PW}.ts`] },
    });
    context.setCompiledFunctions({
      symbolicQueries: [
        { functionId: functionId('FF-S01'), name: 'dependency-direction', cypher: 'RETURN 1', params: {}, dimension: 'structural', severity: 'major', route: 'symbolic', source: 'template' },
        { functionId: functionId('FF-S04'), name: 'no-domain-outward-dep', cypher: 'RETURN 1', params: {}, dimension: 'structural', severity: 'major', route: 'symbolic', source: 'template' },
      ],
      neuronalInstructions: [], hybridPairs: [], totalCompiled: 2, disabledFunctions: [], warnings: [],
    });
    context.setEvaluationResults({
      symbolicResults: [{ functionId: functionId('FF-S04'), dimension: 'structural', passed: true, violations: [], executionTimeMs: 1, deterministic: true, tag: 'structural' }],
      neuronalResults: [],
      failures: [{ functionId: functionId('FF-S01'), name: 'dependency-direction', code: 'EVAL_001', message: `Query failed: ${LEAK}` }],
    });
    context.setScoredReport({
      runId: runId('run'), projectPath: '/p', specVersion: '1', ahsDeterministic: ahsScore(1), verdict: 'pass',
      scoring: {
        weights: { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, integrity: 0 },
        thresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 }, confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
        verdictSource: 'ahsDeterministic',
      },
      perDimensionScores: [{ dimension: 'structural', avr: avrScore(0), violatedWeight: 0, weight: 1, effectiveWeight: 1, violationCount: 0, functionCount: 1 }],
      violations: [],
      universalMetrics: { cyclicDependencyCount: 0, maxFanOut: 0, maxFanIn: 0, abstractionRatio: null, averageInstability: null, orphanFileCount: 0 },
      evaluationMode: 'symbolic-only', durationMs: 1, droppedDimensions: [],
    });
    context.addWarning({ stage: 'evaluation-engine', code: 'EVAL_001', message: `Query failed: ${LEAK}` });

    const res = await new AssembleReportCommand({
      mode: 'symbolic-only', timingSource: () => ({ stages: [], totalMs: 0 }),
      compileFacts: { facts: { declared: 2, adrDerived: 0, dropped: [] } }, scrubPolicy: POLICY,
    }).execute(context);
    expect(res.success ? 'ok' : res.errors.map((e) => e.message)).toBe('ok');
    const text = JSON.stringify(context.getReport());
    expect(leaks(text)).toEqual([]);
    expect(context.getReport().functionExecution.failed[0]?.message).toContain('[REDACTED]');
  });
});

describe('one definition of the Neo4j scrub policy (BR-U3-58, bundled-patch reviewer note)', () => {
  it('scrubWithPolicy drops the password, the URI, host:port and resolved addresses', () => {
    const policy = neo4jScrubPolicy({ neo4jUri: 'bolt://db.internal:7690', neo4jUser: 'neo4j', neo4jPassword: PW });
    const text = scrubWithPolicy(`x ${PW} bolt://db.internal:7690 db.internal:7690 10.0.0.5:7690 [::1]:7690 ok:80`, policy);
    expect([PW, 'bolt://db.internal:7690', 'db.internal:7690', '10.0.0.5:7690', '[::1]:7690'].filter((s) => text.includes(s))).toEqual([]);
    expect(text).toContain('ok:80');
  });

  it('keeps short values, the user and scheme tokens out of the secret list (BR-U2-39)', () => {
    expect(neo4jScrubPolicy({ neo4jUri: 'bolt://localhost:7687', neo4jUser: 'neo4j-admin', neo4jPassword: 'neo4j-admin' }).secrets)
      .toEqual(['bolt://localhost:7687', 'localhost:7687']);
    expect(neo4jScrubPolicy({ neo4jUri: 'bolt://h', neo4jUser: 'neo4j', neo4jPassword: 'pw' }).secrets).toEqual(['bolt://h']);
  });

  it('the repository no longer defines its own policy (exists once, in src/shared/errors/scrub.ts)', () => {
    const repo = fs.readFileSync(path.join(ROOT, 'src/neo4j-ingestion/neo4j-repository.ts'), 'utf8');
    expect(repo).toContain('neo4jScrubPolicy');
    expect(repo).not.toMatch(/SCHEME_TOKENS|MIN_SECRET_LENGTH|new RegExp/);
  });
});
