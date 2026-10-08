/**
 * U3-R4 (FR-14, BR-U1-40): metric templates return violating rows only, `'<project>'` is the only
 * project-level key, and one pass rule (U3 business-rules.md BR-U3-10, BR-U3-11, BR-U3-12; §2.3).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { evaluateSymbolic } from '../../../src/evaluation-engine/symbolic-evaluator.js';
import { PROJECT_FILE_PATH } from '../../../src/evaluation-engine/index.js';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import type { CypherTemplate } from '../../../src/fitness-compiler/types.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { CypherQuery, SymbolicFunctionResult } from '../../../src/shared/types/evaluation.js';
import { functionId } from '../../../src/shared/types/value-objects.js';

const ROOT = path.resolve(__dirname, '../../..');

function template(name: string): CypherTemplate {
  const t = CYPHER_TEMPLATES.get(name);
  if (t === undefined) throw new Error(`${name} template missing`);
  return t;
}

/** Whitespace-normalised text. */
function flat(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The text after the exclude marker (or, without one, after the last `WHERE total > 0`). */
function tailOf(name: string): string {
  const text = template(name).template;
  const marker = text.indexOf('*/');
  const from = marker >= 0 ? marker + 2 : text.indexOf('WHERE total > 0') + 'WHERE total > 0'.length;
  return flat(text.slice(from));
}

/** §2.3 tails, verbatim. */
const TAILS: Readonly<Record<string, string>> = {
  'dependency-inversion': 'WITH c, toFloat(interfaceDeps) / totalDeps AS ratio WHERE ratio < $threshold RETURN c.name AS class, c.filePath AS filePath, ratio ORDER BY filePath, class',
  'domain-stability': 'WITH f, toFloat(fanOut) / (fanIn + fanOut) AS instability WHERE instability > $threshold RETURN f.filePath AS filePath, f.name AS name, instability ORDER BY filePath',
  'abstraction-ratio': "WITH toFloat(interfaces) / total AS ratio WHERE ratio < $threshold RETURN '<project>' AS filePath, ratio ORDER BY ratio",
};

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

async function evaluate(name: string, id: string, records: Record<string, unknown>[], threshold?: number): Promise<SymbolicFunctionResult> {
  const q: CypherQuery = {
    functionId: functionId(id), name, cypher: template(name).template, params: {}, dimension: 'coupling',
    severity: 'major', route: 'symbolic', source: 'template', ...(threshold !== undefined ? { threshold } : {}),
  };
  const out = await evaluateSymbolic({ queries: [q], graphRepository: stubRepo(records) });
  if (!out.success) throw new Error('evaluateSymbolic failed');
  const result = out.data.results[0];
  if (result === undefined) throw new Error('no result');
  return result;
}

describe('BR-U3-11 metric row filters (static, §2.3 tails)', () => {
  it.each(Object.keys(TAILS))('%s ends with its exact §2.3 tail', (name) => {
    expect(tailOf(name)).toBe(TAILS[name]);
  });

  it('dependency-inversion and domain-stability keep U1 text up to and including the marker', () => {
    expect(flat(template('dependency-inversion').template)).toContain('WHERE totalDeps > 0 /*EXCLUDE:c*/ WITH c, toFloat');
    expect(flat(template('domain-stability').template)).toContain('WHERE fanIn + fanOut > 0 /*EXCLUDE:f*/ WITH f, toFloat');
    expect(template('abstraction-ratio').template).not.toContain('/*EXCLUDE');
  });
});

describe('BR-U3-10 single pass rule', () => {
  it.each([...CYPHER_TEMPLATES.keys()])('%s: no RETURN clause names a violation column', (name) => {
    const text = template(name).template;
    expect(text).not.toMatch(/\bAS violation\b/);
  });

  it('computePassFail has one branch (no violation-column or ratio-column branch in the evaluator)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/evaluation-engine/symbolic-evaluator.ts'), 'utf8');
    const body = src.slice(src.indexOf('function computePassFail('));
    const fn = body.slice(0, body.indexOf('\n}\n') + 2);
    expect(fn).toContain('return violations.length === 0;');
    expect(fn).not.toMatch(/\bif\b/);
    expect(src).not.toContain("'violation' in");
    expect(src).not.toContain("'ratio' in");
  });

  it('a row with a legacy violation:false column still fails (pass exactly when no violations)', async () => {
    const r = await evaluate('domain-stability', 'FF-C01', [{ filePath: 'src/domain/a.ts', name: 'a.ts', instability: 0.9, violation: false }], 0.5);
    expect(r.passed).toBe(false);
    expect(r.violations).toHaveLength(1);
  });

  it('no rows passes, also with a threshold', async () => {
    const r = await evaluate('dependency-inversion', 'FF-P02', [], 0.5);
    expect(r.passed).toBe(true);
    expect(r.violations).toEqual([]);
  });
});

describe('BR-U3-12 project-level key', () => {
  it('no template maps filePathColumn "ratio"', () => {
    for (const [name, t] of CYPHER_TEMPLATES) {
      expect({ name, col: t.resultMapping.filePathColumn === 'ratio' }).toEqual({ name, col: false });
    }
  });

  it("'<project>' is the only project-level key, and only abstraction-ratio returns it", () => {
    expect(PROJECT_FILE_PATH).toBe('<project>');
    const withLiteral = [...CYPHER_TEMPLATES].filter(([, t]) => /'<[^>]+>' AS filePath/.test(t.template)).map(([n]) => n);
    expect(withLiteral).toEqual(['abstraction-ratio']);
    expect(template('abstraction-ratio').template).toContain("'<project>' AS filePath");
  });

  it('an abstraction-ratio row maps to filePath <project>, evidence ratio, message unchanged', async () => {
    const r = await evaluate('abstraction-ratio', 'FF-C06', [{ filePath: '<project>', ratio: 0.2 }], 0.3);
    expect(r.passed).toBe(false);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.filePath).toBe('<project>');
    expect(r.violations[0]?.evidence).toEqual(['ratio=0.2']);
    expect(r.violations[0]?.message).toBe('Abstraction ratio 0.2 below threshold');
  });

  it('dependency-inversion and domain-stability rows carry their measured value as evidence', async () => {
    const di = await evaluate('dependency-inversion', 'FF-P02', [{ class: 'CreateTask', filePath: 'src/app/c.ts', ratio: 0 }], 0.5);
    expect(di.violations[0]?.evidence).toEqual(['ratio=0']);
    expect(di.violations[0]?.discriminator).toEqual(['CreateTask']);
    const ds = await evaluate('domain-stability', 'FF-C01', [{ filePath: 'src/domain/t.ts', name: 't.ts', instability: 0.6666666666666666 }], 0.5);
    expect(ds.violations[0]?.evidence).toEqual(['instability=0.6666666666666666']);
  });
});
