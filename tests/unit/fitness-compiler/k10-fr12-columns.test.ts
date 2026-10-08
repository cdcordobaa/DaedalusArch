/**
 * K10 (FR-12 template part; BR-U1-28 FR-12 columns, BR-U1-35 columns): the three dependency templates
 * return `relType`, `line`, `lines`, `isTypeOnly` and `target` (IMPORTS only at K10; K12 widened the
 * edge to IMPORTS|RE_EXPORTS and added `verb`, see k12-re-exports.test.ts), and the cycle row returns
 * `target = cycle[1]` and the first-edge `line`. The columns stay unmapped until U3, so IMPORTS messages
 * are unchanged. Graph behaviour is checked in tests/golden/u1-templates.test.ts.
 */
import { evaluateSymbolic } from '../../../src/evaluation-engine/symbolic-evaluator.js';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import type { CypherTemplate } from '../../../src/fitness-compiler/types.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { CypherQuery } from '../../../src/shared/types/evaluation.js';
import { functionId } from '../../../src/shared/types/value-objects.js';

const DEPENDENCY_TEMPLATES = ['dependency-direction', 'no-layer-skip', 'no-domain-outward-dep'] as const;
const FR12_COLUMNS = ['relType', 'line', 'lines', 'isTypeOnly'] as const;

function template(name: string): CypherTemplate {
  const t = CYPHER_TEMPLATES.get(name);
  if (!t) throw new Error(`${name} template missing`);
  return t;
}

/** The text after the last RETURN (the final projection and its ORDER BY). */
function finalProjection(text: string): string {
  return text.slice(text.lastIndexOf('RETURN'));
}

/** Messages rendered from one row through the real symbolic evaluator (message rendering is U0 code). */
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

const IMPORTS_ROW = {
  source: 'src/domain/Task.ts', target: 'src/infrastructure/Db.ts',
  relType: 'IMPORTS', line: 3, lines: [3], isTypeOnly: false,
};

describe('K10 dependency templates return the FR-12 columns (BR-U1-35)', () => {
  it.each(DEPENDENCY_TEMPLATES)('%s binds the edge as i and returns relType, line, lines, isTypeOnly, target', (name) => {
    const text = template(name).template;
    expect(text).toContain('-[i:IMPORTS|RE_EXPORTS]->');
    const ret = finalProjection(text);
    expect(ret).toContain('tgt.filePath AS target');
    expect(ret).toContain('type(i) AS relType');
    expect(ret).toContain('i.line AS line');
    expect(ret).toContain('i.lines AS lines');
    expect(ret).toContain('coalesce(i.isTypeOnly, false) AS isTypeOnly');
    expect(ret).toMatch(/ORDER BY source, target, relType\s*$/);
  });

  it.each(DEPENDENCY_TEMPLATES)('%s: every WITH before the RETURN projects i (static)', (name) => {
    const text = template(name).template;
    const body = text.slice(0, text.lastIndexOf('RETURN'));
    const withs = body.split('\n').filter((l) => /^\s*WITH\b/.test(l) && !/^\s*WITH \$/.test(l));
    for (const w of withs) expect({ name, w, projectsI: /\bi\b/.test(w) }).toEqual({ name, w, projectsI: true });
  });

  it.each(DEPENDENCY_TEMPLATES)('%s: metadataColumns gain relType, line, lines, isTypeOnly', (name) => {
    const cols = template(name).resultMapping.metadataColumns ?? [];
    expect(cols).toContain('target');
    expect(cols.slice(-FR12_COLUMNS.length)).toEqual([...FR12_COLUMNS]);
  });

  it('message templates use {verb} from K12 (pinned)', () => {
    expect(template('dependency-direction').resultMapping.messageTemplate).toBe('{source} ({srcLayer}) {verb} from {target} ({tgtLayer})');
    expect(template('no-layer-skip').resultMapping.messageTemplate).toBe('{source} ({srcLayer}) skips layers to {verb} {target} ({tgtLayer})');
    expect(template('no-domain-outward-dep').resultMapping.messageTemplate).toBe('Domain file {source} {verb} from {target} in {violatingLayer}');
  });

  it('an IMPORTS row renders the same message as before K10 (extra columns ignored; BR-U1-35 b)', async () => {
    expect(await render('dependency-direction', { ...IMPORTS_ROW, verb: 'imports', srcLayer: 'domain', tgtLayer: 'infrastructure' }))
      .toBe('src/domain/Task.ts (domain) imports from src/infrastructure/Db.ts (infrastructure)');
    expect(await render('no-layer-skip', { ...IMPORTS_ROW, verb: 'import', srcLayer: 'domain', tgtLayer: 'infrastructure' }))
      .toBe('src/domain/Task.ts (domain) skips layers to import src/infrastructure/Db.ts (infrastructure)');
    expect(await render('no-domain-outward-dep', { ...IMPORTS_ROW, verb: 'imports', violatingLayer: 'infrastructure' }))
      .toBe('Domain file src/domain/Task.ts imports from src/infrastructure/Db.ts in infrastructure');
  });
});

describe('K10 cycle row returns target and first-edge line (BR-U1-28)', () => {
  const text = template('no-cyclic-deps').template;

  it('groups by cycle and takes the smallest first-edge line', () => {
    expect(text).toContain('WITH DISTINCT [n IN nodes(p) | n.filePath] AS cycle, relationships(p)[0].line AS firstLine');
    expect(text).toContain('WITH cycle, min(firstLine) AS line');
    expect(finalProjection(text)).toMatch(/^RETURN cycle, cycle\[1\] AS target, line\nORDER BY cycle\nLIMIT 101$/);
  });

  it('carries no relType or isTypeOnly and keeps the message and filePathColumn', () => {
    expect(finalProjection(text)).not.toContain('relType');
    expect(finalProjection(text)).not.toContain('isTypeOnly');
    const rm = template('no-cyclic-deps').resultMapping;
    expect(rm.filePathColumn).toBe('cycle');
    expect(rm.messageTemplate).toBe('Circular dependency: {cycle}');
  });
});
