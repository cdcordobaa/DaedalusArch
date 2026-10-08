/**
 * K12 (FR-34 template part, ADR-015 item 8; BR-U1-35, BR-U1-36, BR-U1-28 c): the three dependency
 * templates and the cycle query traverse IMPORTS|RE_EXPORTS and the dependency rows carry a `verb`
 * column used by the message; coupling metrics stay IMPORTS-only. Graph behaviour is checked in
 * tests/golden/u1-templates.test.ts.
 */
import { evaluateSymbolic } from '../../../src/evaluation-engine/symbolic-evaluator.js';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import type { CypherTemplate } from '../../../src/fitness-compiler/types.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { CypherQuery } from '../../../src/shared/types/evaluation.js';
import { functionId } from '../../../src/shared/types/value-objects.js';

function template(name: string): CypherTemplate {
  const t = CYPHER_TEMPLATES.get(name);
  if (!t) throw new Error(`${name} template missing`);
  return t;
}

async function render(name: string, record: Record<string, unknown>): Promise<string> {
  const repo: GraphRepository = {
    executeQuery(): Promise<DomainResult<QueryResult>> {
      return Promise.resolve(DomainResult.ok({ records: [record], summary: { counters: {} } }));
    },
    clearGraph() { return Promise.resolve(DomainResult.ok(undefined)); },
    healthCheck() { return Promise.resolve(true); },
    close() { return Promise.resolve(); },
  };
  const query: CypherQuery = {
    functionId: functionId('FF-T01'), name, cypher: template(name).template, params: {},
    dimension: 'structural', severity: 'critical', route: 'symbolic', source: 'template',
  };
  const out = await evaluateSymbolic({ queries: [query], graphRepository: repo });
  if (!out.success) throw new Error('evaluateSymbolic failed');
  const message = out.data.results[0]?.violations[0]?.message;
  if (message === undefined) throw new Error('no violation rendered');
  return message;
}

const VERB_FORMS: Readonly<Record<string, readonly [string, string]>> = {
  'dependency-direction': ['imports', 're-exports'],
  'no-layer-skip': ['import', 're-export'],
  'no-domain-outward-dep': ['imports', 're-exports'],
};

const RE_EXPORTS_ROW = {
  source: 'src/application/utils/TaskUtils.ts', target: 'src/infrastructure/utils/InfraFormatters.ts',
  relType: 'RE_EXPORTS', line: 1, lines: [1], isTypeOnly: false,
};

describe('dependency templates follow RE_EXPORTS (BR-U1-35)', () => {
  it.each(Object.entries(VERB_FORMS))('%s matches -[i:IMPORTS|RE_EXPORTS]-> and returns the verb column', (name, [imp, reexp]) => {
    const text = template(name).template;
    expect(text).toContain('MATCH (src:File)-[i:IMPORTS|RE_EXPORTS]->(tgt:File)');
    expect(text).toContain(`CASE type(i) WHEN 'IMPORTS' THEN '${imp}' ELSE '${reexp}' END AS verb`);
    expect(template(name).resultMapping.messageTemplate).toContain('{verb}');
  });

  it('(b) a RE_EXPORTS row reads "re-exports from" / "skips layers to re-export"', async () => {
    expect(await render('dependency-direction', { ...RE_EXPORTS_ROW, verb: 're-exports', srcLayer: 'application', tgtLayer: 'infrastructure' }))
      .toBe('src/application/utils/TaskUtils.ts (application) re-exports from src/infrastructure/utils/InfraFormatters.ts (infrastructure)');
    expect(await render('no-layer-skip', { ...RE_EXPORTS_ROW, verb: 're-export', srcLayer: 'application', tgtLayer: 'infrastructure' }))
      .toBe('src/application/utils/TaskUtils.ts (application) skips layers to re-export src/infrastructure/utils/InfraFormatters.ts (infrastructure)');
    expect(await render('no-domain-outward-dep', { ...RE_EXPORTS_ROW, verb: 're-exports', source: 'src/domain/index.ts', violatingLayer: 'infrastructure' }))
      .toBe('Domain file src/domain/index.ts re-exports from src/infrastructure/utils/InfraFormatters.ts in infrastructure');
  });

  it('the cycle query traverses IMPORTS|RE_EXPORTS (BR-U1-28)', () => {
    expect(template('no-cyclic-deps').template).toContain('MATCH p = (f:File)-[:IMPORTS|RE_EXPORTS*2..10]->(f)');
  });
});

describe('coupling metrics stay IMPORTS-only (BR-U1-36)', () => {
  it.each(['module-fan-out', 'component-instability', 'max-fan-in', 'domain-stability', 'abstraction-ratio'])(
    '%s contains no RE_EXPORTS',
    (name) => {
      expect(template(name).template).not.toContain('RE_EXPORTS');
    },
  );
});
