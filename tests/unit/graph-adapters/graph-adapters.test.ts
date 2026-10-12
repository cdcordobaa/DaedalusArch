/**
 * v1.3 graph adapters: synthetic exports of one small TypeScript project in each external format, mapped to the
 * APG. The ground-truth APG of the project (what the ts-morph extractor would yield): 6 File, 4 Class,
 * 1 Interface, 5 Method, 2 Package; IMPORTS 6 file + 2 package, DECLARES 5, CONTAINS 5, EXTENDS 1,
 * IMPLEMENTS 1, CALLS 1. Each format reaches a different subset of that.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { adaptExternalGraph, computeCoverageMatrix, EXTERNAL_FORMATS, FORMAT_CAPABILITIES } from '../../../src/graph-adapters/index.js';
import type { AdapterResult } from '../../../src/graph-adapters/index.js';
import { generateNodeId } from '../../../src/apg-extractor/id-generator.js';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { EDGE_TYPES } from '../../../src/shared/types/enums.js';
import { field } from '../../../src/graph-adapters/util.js';

const FX = join(__dirname, '..', '..', 'fixtures', 'graph-adapters');
const read = (...p: string[]): string => readFileSync(join(FX, ...p), 'utf8');

const graphify = (): AdapterResult => adaptExternalGraph('graphify-json', read('graphify.graph.json'));
const graphml = (): AdapterResult => adaptExternalGraph('graphify-graphml', read('graphify.graphml'));
const cgc = (): AdapterResult =>
  adaptExternalGraph('codegraphcontext', { nodesJsonl: read('codegraphcontext', 'nodes.ndjson'), edgesJsonl: read('codegraphcontext', 'edges.ndjson') }, { projectRoot: '/work/proj' });
const gitnexus = (): AdapterResult => adaptExternalGraph('gitnexus', read('gitnexus.graph.json'));

/** `TYPE source -> target`, files by path and everything else by name. */
function edgeList(r: AdapterResult, ...types: string[]): string[] {
  const name = new Map(r.nodes.map((n) => [n.id, n.type === 'File' ? n.filePath : n.name]));
  return r.edges.filter((e) => types.includes(e.type)).map((e) => `${e.type} ${name.get(e.sourceId) ?? '?'} -> ${name.get(e.targetId) ?? '?'}`).sort();
}

const FILE_IMPORTS = [
  'IMPORTS src/application/create-user.ts -> src/domain/user-repository.ts',
  'IMPORTS src/application/create-user.ts -> src/domain/user.ts',
  'IMPORTS src/domain/user.ts -> src/domain/base.ts',
  'IMPORTS src/index.ts -> src/application/create-user.ts',
  'IMPORTS src/index.ts -> src/domain/user.ts',
  'IMPORTS src/infrastructure/pg-user-repository.ts -> src/domain/user-repository.ts',
];
const PKG_IMPORTS = [
  'IMPORTS src/infrastructure/pg-user-repository.ts -> fs',
  'IMPORTS src/infrastructure/pg-user-repository.ts -> pg',
];
const DECLARES = [
  'DECLARES src/application/create-user.ts -> CreateUser',
  'DECLARES src/domain/base.ts -> Base',
  'DECLARES src/domain/user-repository.ts -> UserRepository',
  'DECLARES src/domain/user.ts -> User',
  'DECLARES src/infrastructure/pg-user-repository.ts -> PgUserRepository',
];
const CONTAINS = [
  'CONTAINS Base -> Base.id',
  'CONTAINS CreateUser -> CreateUser.execute',
  'CONTAINS PgUserRepository -> PgUserRepository.save',
  'CONTAINS User -> User.rename',
  'CONTAINS UserRepository -> UserRepository.save',
];

describe('graphify graph.json', () => {
  const r = graphify();

  it('maps files, classes, methods and packages; interfaces arrive as classes', () => {
    expect(r.report.nodeCountByType).toEqual({ File: 6, Class: 5, Method: 5, Package: 2 });
  });

  it('maps IMPORTS to files and packages, drops the alias import', () => {
    expect(edgeList(r, 'IMPORTS')).toEqual([...FILE_IMPORTS, ...PKG_IMPORTS].sort());
    expect(r.report.dropped['import-alias-not-package-shaped']).toBe(1);
  });

  it('maps DECLARES and CONTAINS', () => {
    expect(edgeList(r, 'DECLARES')).toEqual(DECLARES);
    expect(edgeList(r, 'CONTAINS')).toEqual(CONTAINS);
  });

  it('reads `implements` as EXTENDS (no interface kind) and produces no IMPLEMENTS', () => {
    expect(edgeList(r, 'EXTENDS')).toEqual([
      'EXTENDS PgUserRepository -> UserRepository',
      'EXTENDS User -> Base',
    ]);
    expect(edgeList(r, 'IMPLEMENTS')).toEqual([]);
  });

  it('keeps both CALLS by default and filters the AMBIGUOUS one at minConfidence 0.5', () => {
    expect(edgeList(r, 'CALLS')).toHaveLength(2);
    const strict = adaptExternalGraph('graphify-json', read('graphify.graph.json'), { minConfidence: 0.5 });
    expect(edgeList(strict, 'CALLS')).toEqual(['CALLS CreateUser.execute -> User.rename']);
    expect(strict.report.dropped['below-min-confidence']).toBe(1);
  });

  it('reports the unmappable edge types and the unmapped relation', () => {
    expect(r.report.unavailableEdgeTypes).toEqual(['IMPLEMENTS', 'CONSTRUCTOR_INJECTS', 'FLOWS_TO', 'RE_EXPORTS'].sort((a, b) => EDGE_TYPES.indexOf(a as never) - EDGE_TYPES.indexOf(b as never)));
    expect(r.report.missingEdgeTypes).toEqual(expect.arrayContaining(['CONSTRUCTOR_INJECTS', 'RE_EXPORTS', 'FLOWS_TO']));
    expect(r.report.unmappedRelations).toEqual({ uses: 1 });
  });

  it('drops the non-source file node and uses the extractor id scheme', () => {
    expect(r.report.dropped['non-source-file-node']).toBe(1);
    const f = r.nodes.find((n) => n.type === 'File' && n.filePath === 'src/domain/base.ts');
    expect(f?.id).toBe(generateNodeId('File', 'src/domain/base.ts', 'base.ts'));
  });

  it('flags the index.ts barrel by heuristic and keeps real files non-barrels', () => {
    const barrel = r.nodes.filter((n) => n.type === 'File' && field(n.properties, 'isBarrel') === true).map((n) => n.filePath);
    expect(barrel).toEqual(['src/index.ts']);
  });

  it('is deterministic', () => {
    expect(graphify()).toEqual(r);
  });
});

describe('graphify GraphML', () => {
  it('yields the same APG as graph.json', () => {
    const a = graphml();
    const b = graphify();
    expect(edgeList(a, ...EDGE_TYPES)).toEqual(edgeList(b, ...EDGE_TYPES));
    expect(a.report.nodeCountByType).toEqual(b.report.nodeCountByType);
    expect(a.nodes.map((n) => n.id).sort()).toEqual(b.nodes.map((n) => n.id).sort());
  });

  it('rejects a document with no nodes', () => {
    expect(() => adaptExternalGraph('graphify-graphml', '<graphml><graph/></graphml>')).toThrow(/no <node>/);
  });
});

describe('CodeGraphContext bundle', () => {
  const r = cgc();

  it('maps nodes, relativising absolute paths and naming methods from the class context', () => {
    expect(r.report.nodeCountByType).toEqual({ File: 6, Class: 4, Interface: 1, Method: 5, Package: 2 });
    expect(r.nodes.filter((n) => n.type === 'Method').map((n) => n.name).sort()).toEqual(
      ['Base.id', 'CreateUser.execute', 'PgUserRepository.save', 'User.rename', 'UserRepository.save'],
    );
  });

  it('resolves relative Module imports to files and the rest to packages', () => {
    expect(edgeList(r, 'IMPORTS')).toEqual([...FILE_IMPORTS, ...PKG_IMPORTS].sort());
    expect(r.report.dropped['import-alias-not-package-shaped']).toBe(1);
  });

  it('maps DECLARES, CONTAINS, EXTENDS, IMPLEMENTS and CALLS', () => {
    expect(edgeList(r, 'DECLARES')).toEqual(DECLARES);
    expect(edgeList(r, 'CONTAINS')).toEqual(CONTAINS);
    expect(edgeList(r, 'EXTENDS')).toEqual(['EXTENDS User -> Base']);
    expect(edgeList(r, 'IMPLEMENTS')).toEqual(['IMPLEMENTS PgUserRepository -> UserRepository']);
    expect(edgeList(r, 'CALLS')).toEqual(['CALLS CreateUser.execute -> User.rename']);
  });

  it('records import lines', () => {
    const e = r.edges.find((x) => x.type === 'IMPORTS' && (field(x.properties, 'specifier') === '../domain/user'));
    expect(e === undefined ? undefined : field(e.properties, 'line')).toBe(1);
  });

  it('counts the directory edge and the file-to-method edges it cannot place', () => {
    expect(r.report.dropped['contains-endpoint-not-extracted']).toBe(1);
    expect(r.report.dropped['contains-File-to-Method']).toBe(5);
  });

  it('ids match the extractor scheme', () => {
    expect(r.nodes.find((n) => n.type === 'Class' && n.name === 'User')?.id).toBe(generateNodeId('Class', 'src/domain/user.ts', 'User'));
  });
});

describe('GitNexus graph', () => {
  const r = gitnexus();

  it('maps all node types but Package', () => {
    expect(r.report.nodeCountByType).toEqual({ File: 6, Class: 4, Interface: 1, Method: 5 });
  });

  it('maps IMPORTS, DECLARES, CONTAINS (HAS_METHOD and name-derived), EXTENDS, IMPLEMENTS', () => {
    expect(edgeList(r, 'IMPORTS')).toEqual(FILE_IMPORTS);
    expect(edgeList(r, 'DECLARES')).toEqual(DECLARES);
    expect(edgeList(r, 'CONTAINS')).toEqual(CONTAINS);
    expect(edgeList(r, 'EXTENDS')).toEqual(['EXTENDS User -> Base']);
    expect(edgeList(r, 'IMPLEMENTS')).toEqual(['IMPLEMENTS PgUserRepository -> UserRepository']);
  });

  it('filters CALLS by confidence and counts MEMBER_OF as unmapped', () => {
    expect(edgeList(r, 'CALLS')).toHaveLength(2);
    const strict = adaptExternalGraph('gitnexus', read('gitnexus.graph.json'), { minConfidence: 0.5 });
    expect(edgeList(strict, 'CALLS')).toEqual(['CALLS CreateUser.execute -> User.rename']);
    expect(r.report.unmappedRelations).toEqual({ MEMBER_OF: 1 });
  });

  it('cannot produce CONSTRUCTOR_INJECTS, RE_EXPORTS or FLOWS_TO', () => {
    expect(r.report.unavailableEdgeTypes).toEqual(['CONSTRUCTOR_INJECTS', 'FLOWS_TO', 'RE_EXPORTS'].sort((a, b) => EDGE_TYPES.indexOf(a as never) - EDGE_TYPES.indexOf(b as never)));
  });

  it('rejects a document without relationships', () => {
    expect(() => adaptExternalGraph('gitnexus', { nodes: [] })).toThrow(/relationships/);
  });
});

describe('capability table agrees with what the adapters produce', () => {
  const results: Record<string, AdapterResult> = { 'graphify-json': graphify(), 'graphify-graphml': graphml(), codegraphcontext: cgc(), gitnexus: gitnexus() };
  it.each(EXTERNAL_FORMATS)('%s: an `absent` edge type has no edge, a produced one is not `absent`', (f) => {
    const counts = results[f]?.report.edgeCountByType ?? {};
    for (const t of EDGE_TYPES) {
      if (FORMAT_CAPABILITIES[f].edges[t] === 'absent') expect(counts[t]).toBeUndefined();
      else expect(counts[t]).toBeGreaterThan(0);
    }
  });
});

describe('fitness-function coverage matrix', () => {
  const m = computeCoverageMatrix();

  it('has a row per compiled template and a cell per format', () => {
    expect(Object.keys(m).sort()).toEqual([...CYPHER_TEMPLATES.keys()].sort());
    for (const row of Object.values(m)) expect(Object.keys(row).sort()).toEqual([...EXTERNAL_FORMATS].sort());
  });

  it('blocks the rules that need CONSTRUCTOR_INJECTS or FLOWS_TO on every format', () => {
    for (const fn of ['dependency-inversion', 'use-case-isolation', 'domain-state-purity']) {
      for (const f of EXTERNAL_FORMATS) expect(m[fn][f].status).toBe('blocked');
    }
  });

  it('runs controller-no-entity on IMPORTS alone, blind to the injection hop', () => {
    for (const f of EXTERNAL_FORMATS) expect(m['controller-no-entity'][f].status).toBe('partial');
  });

  it('degrades the import rules for missing RE_EXPORTS but runs them', () => {
    for (const f of EXTERNAL_FORMATS) {
      expect(m['dependency-direction'][f].status).toBe('partial');
      expect(m['module-fan-out'][f].status).toBe('full');
    }
  });

  it('separates the formats on interfaces and implements', () => {
    expect(m['interface-segregation-proxy']['graphify-json'].status).toBe('blocked');
    expect(m['interface-segregation-proxy'].gitnexus.status).toBe('full');
    expect(m['abstraction-ratio']['graphify-json'].status).toBe('blocked');
    expect(m['repository-pattern']['graphify-json'].status).toBe('blocked');
    expect(m['repository-pattern'].codegraphcontext.status).toBe('degraded');
    expect(m['repository-pattern'].gitnexus.status).toBe('full');
  });

  it('blocks domain-purity where no Package nodes exist', () => {
    expect(m['domain-purity'].gitnexus.status).toBe('blocked');
    expect(m['domain-purity'].codegraphcontext.status).toBe('partial');
  });
});
