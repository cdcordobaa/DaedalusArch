/**
 * U3-R5 (FR-11; ADR-017 item 5; F14): `domain-purity` over Package nodes, IMPORTS|RE_EXPORTS
 * (U3 business-rules.md BR-U3-20 text §2.1, BR-U3-21 metadata and mapping). Static and stubbed;
 * the concrete golden rows (TF-01) and the re-export fixture (TF-05) are gated in
 * tests/golden/u3-templates.test.ts.
 */
import { evaluateSymbolic } from '../../../src/evaluation-engine/symbolic-evaluator.js';
import { CYPHER_TEMPLATES, getTemplateTag } from '../../../src/fitness-compiler/cypher-templates.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { Violation } from '../../../src/shared/taxonomy/violation-types.js';
import type { CypherQuery } from '../../../src/shared/types/evaluation.js';
import { functionId } from '../../../src/shared/types/value-objects.js';

/** §2.1, verbatim (BR-U3-20). */
const SECTION_2_1 = `MATCH (src:File)-[i:IMPORTS|RE_EXPORTS]->(p:Package)
WHERE src.layer = $domainLayer
  AND ANY(fp IN $forbiddenImports WHERE p.name = fp OR (fp ENDS WITH '/*' AND p.name STARTS WITH left(fp, size(fp) - 1))) /*EXCLUDE:src*/
RETURN src.filePath AS source, p.name AS target, type(i) AS relType,
       CASE type(i) WHEN 'IMPORTS' THEN 'imports' ELSE 're-exports' END AS verb,
       i.line AS line, i.lines AS lines, coalesce(i.isTypeOnly, false) AS isTypeOnly
ORDER BY source, target, relType`;

/** The message template of `domain-purity` before U3-R5 (HEAD `23392aa`). */
const HEAD_MESSAGE = 'Domain file {source} imports forbidden package {target}';

function template(): NonNullable<ReturnType<typeof CYPHER_TEMPLATES.get>> {
  const t = CYPHER_TEMPLATES.get('domain-purity');
  if (t === undefined) throw new Error('domain-purity missing');
  return t;
}

function render(messageTemplate: string, row: Readonly<Record<string, unknown>>): string {
  let message = messageTemplate;
  for (const [key, value] of Object.entries(row)) message = message.replace(`{${key}}`, String(value));
  return message;
}

function stubRepo(records: Record<string, unknown>[]): GraphRepository {
  return {
    executeQuery(): Promise<DomainResult<QueryResult>> {
      return Promise.resolve(DomainResult.ok({ records, summary: { counters: {} } }));
    },
    clearGraph() { return Promise.resolve(DomainResult.ok(undefined)); },
    healthCheck() { return Promise.resolve(true); },
    close() { return Promise.resolve(); },
  };
}

async function violationsOf(records: Record<string, unknown>[]): Promise<readonly Violation[]> {
  const q: CypherQuery = {
    functionId: functionId('FF-P01'), name: 'domain-purity', cypher: template().template,
    params: { domainLayer: 'domain', forbiddenImports: ['@nestjs/*', 'express'] },
    dimension: 'pattern', severity: 'critical', route: 'symbolic', source: 'template',
  };
  const out = await evaluateSymbolic({ queries: [q], graphRepository: stubRepo(records) });
  if (!out.success) throw new Error('evaluateSymbolic failed');
  return out.data.results[0]?.violations ?? [];
}

const IMPORT_ROW = {
  source: 'src/domain/entities/Task.ts', target: '@nestjs/common', relType: 'IMPORTS', verb: 'imports',
  line: 2, lines: [2], isTypeOnly: false,
};

describe('BR-U3-20 domain-purity text (§2.1, exact)', () => {
  it('equals §2.1 byte for byte', () => {
    expect(template().template).toBe(SECTION_2_1);
  });

  it('matches Package nodes over IMPORTS|RE_EXPORTS, never File targets or a CONTAINS substring', () => {
    const text = template().template;
    expect(text).toContain('[i:IMPORTS|RE_EXPORTS]->(p:Package)');
    expect(text).not.toContain('tgt:File');
    expect(text).not.toContain('CONTAINS');
  });

  it('keeps the OR inside ANY(…), so the predicate before the marker is a top-level conjunction (BR-U1-44)', () => {
    const where = template().template.split('\n').slice(1, 3).join('\n');
    const outside = where.replace(/ANY\(.*\)\)\)/, 'ANY(…)');
    expect(outside).not.toMatch(/\bOR\b/);
    expect(where).toContain('/*EXCLUDE:src*/');
  });
});

describe('BR-U3-21 domain-purity metadata and mapping', () => {
  it('keeps requiredParams, gains requiredLayerKinds [domain], all styles, tag pattern-proxy', () => {
    const t = template();
    expect(t.requiredParams).toEqual(['domainLayer', 'forbiddenImports']);
    expect(t.requiredLayerKinds).toEqual(['domain']);
    expect(t.applicableStyles).toBeUndefined();
    expect(t.tag).toBe('pattern-proxy');
    expect(getTemplateTag('domain-purity')).toBe('pattern-proxy');
  });

  it('maps per T-MAP: source, target, line, lines, isTypeOnly, disc [relType], no evidence', () => {
    const rm = template().resultMapping;
    expect({
      filePath: rm.filePathColumn, target: rm.targetColumn, line: rm.lineColumn, lines: rm.linesColumn,
      isTypeOnly: rm.isTypeOnlyColumn, disc: rm.discriminatorColumns, evid: rm.evidenceColumns,
      message: rm.messageTemplate,
    }).toEqual({
      filePath: 'source', target: 'target', line: 'line', lines: 'lines', isTypeOnly: 'isTypeOnly',
      disc: ['relType'], evid: undefined, message: 'Domain file {source} {verb} forbidden package {target}',
    });
  });

  it('renders the IMPORTS message byte-identically to the HEAD template', () => {
    const rm = template().resultMapping;
    expect(render(rm.messageTemplate, IMPORT_ROW)).toBe(render(HEAD_MESSAGE, IMPORT_ROW));
    expect(render(rm.messageTemplate, IMPORT_ROW)).toBe('Domain file src/domain/entities/Task.ts imports forbidden package @nestjs/common');
  });

  it('maps an IMPORTS row to one violation with target, line, lines, isTypeOnly, disc and tag', async () => {
    const [v, ...rest] = await violationsOf([IMPORT_ROW]);
    expect(rest).toEqual([]);
    expect(v).toMatchObject({
      filePath: 'src/domain/entities/Task.ts', target: '@nestjs/common', line: 2, lines: [2], isTypeOnly: false,
      discriminator: ['IMPORTS'], tag: 'pattern-proxy', type: 'DOMAIN_PURITY_VIOLATION', dimension: 'pattern',
      message: 'Domain file src/domain/entities/Task.ts imports forbidden package @nestjs/common',
    });
    expect(v?.evidence).toBeUndefined();
  });

  it('a RE_EXPORTS row (TF-05 shape) says re-exports and has its own id', async () => {
    const reexport = { ...IMPORT_ROW, target: 'express', relType: 'RE_EXPORTS', verb: 're-exports', line: 1, lines: [1] };
    const vs = await violationsOf([IMPORT_ROW, reexport]);
    expect(vs.map((v) => v.message)).toEqual([
      'Domain file src/domain/entities/Task.ts imports forbidden package @nestjs/common',
      'Domain file src/domain/entities/Task.ts re-exports forbidden package express',
    ]);
    expect(vs[1]?.discriminator).toEqual(['RE_EXPORTS']);
    expect(new Set(vs.map((v) => v.id)).size).toBe(2);
  });

  it('a type-only import counts (D3) and is marked isTypeOnly', async () => {
    const [v] = await violationsOf([{ ...IMPORT_ROW, isTypeOnly: true }]);
    expect(v?.isTypeOnly).toBe(true);
  });

  it('the same package imported and re-exported from one file gives two violations (relType discriminates)', async () => {
    const vs = await violationsOf([IMPORT_ROW, { ...IMPORT_ROW, relType: 'RE_EXPORTS', verb: 're-exports' }]);
    expect(vs).toHaveLength(2);
  });
});
