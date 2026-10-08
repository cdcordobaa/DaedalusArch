import { resolve } from 'node:path';
import { Node, Project } from 'ts-morph';
import picomatch from 'picomatch';
import { extractAPG } from '../../../src/apg-extractor/apg-extractor.js';
import { DEFAULT_EXCLUDE_PATTERNS } from '../../../src/apg-extractor/types.js';
import { annotateNodes } from '../../../src/neo4j-ingestion/layer-annotator.js';
import type { APGResult } from '../../../src/shared/types/apg.js';
import type { LayerModel } from '../../../src/shared/types/spec.js';

const FIXTURES = resolve(__dirname, '../../../fixtures');
const CASES = ['correct-reference', 'variant-a-structural', 'variant-b-pattern', 'variant-c-everything', 'variant-d-subtle'] as const;
type Case = typeof CASES[number];

const results = new Map<Case, APGResult>();

beforeAll(async () => {
  for (const name of CASES) {
    const r = await extractAPG(resolve(FIXTURES, name));
    if (!r.success) throw new Error(`extraction failed for ${name}`);
    results.set(name, r.data);
  }
}, 120_000);

function result(name: Case): APGResult {
  const r = results.get(name);
  if (r === undefined) throw new Error(`no result for ${name}`);
  return r;
}

/** Static import, `import x = require()` and `export … from` statements in the extracted files. */
function staticStatementCount(name: Case): number {
  const root = resolve(FIXTURES, name);
  const project = new Project({ tsConfigFilePath: resolve(root, 'tsconfig.json'), skipFileDependencyResolution: true });
  const isExcluded = picomatch(DEFAULT_EXCLUDE_PATTERNS, { dot: true });
  let n = 0;
  for (const sf of project.getSourceFiles()) {
    if (isExcluded(sf.getFilePath().slice(root.length + 1))) continue;
    for (const stmt of sf.getStatements()) {
      if (Node.isImportDeclaration(stmt) || Node.isImportEqualsDeclaration(stmt)) n++;
      else if (Node.isExportDeclaration(stmt) && stmt.getModuleSpecifierValue() !== undefined) n++;
    }
  }
  return n;
}

describe('FR-10 acceptance on correct-reference (BR-U2-19, D-U2-8)', () => {
  it('every IMPORTS edge carries the FR-10 properties with line === min(lines)', () => {
    const imports = result('correct-reference').edges.filter(e => e.type === 'IMPORTS');
    expect(imports.length).toBeGreaterThan(0);
    for (const e of imports) {
      const p = e.properties;
      expect(typeof p.specifier).toBe('string');
      expect(Array.isArray(p.specifiers)).toBe(true);
      expect(typeof p.isTypeOnly).toBe('boolean');
      expect(Array.isArray(p.importedNames)).toBe(true);
      const lines = p.lines as number[];
      expect(lines.length).toBeGreaterThan(0);
      expect(p.line).toBe(Math.min(...lines));
    }
  });

  it('the IMPORTS projection matches the committed snapshot', () => {
    const r = result('correct-reference');
    const byId = new Map(r.nodes.map(n => [n.id, n]));
    const projection = r.edges
      .filter(e => e.type === 'IMPORTS')
      .map(e => {
        const target = byId.get(e.targetId);
        return {
          source: byId.get(e.sourceId)?.filePath,
          target: target?.type === 'Package' ? target.name : target?.filePath,
          properties: e.properties,
        };
      });
    expect(projection).toMatchSnapshot();
  });
});

describe('fixture import facts (business-logic-model.md §6; BR-U2-22)', () => {
  it('variant-d has exactly one RE_EXPORTS edge TaskUtils.ts → InfraFormatters.ts', () => {
    const r = result('variant-d-subtle');
    const byId = new Map(r.nodes.map(n => [n.id, n]));
    const reExports = r.edges.filter(e => e.type === 'RE_EXPORTS');
    expect(reExports.map(e => ({
      source: byId.get(e.sourceId)?.filePath,
      target: byId.get(e.targetId)?.filePath,
      exportedNames: e.properties.exportedNames,
      line: e.properties.line,
      isTypeOnly: e.properties.isTypeOnly,
    }))).toEqual([{
      source: 'src/application/utils/TaskUtils.ts',
      target: 'src/infrastructure/utils/InfraFormatters.ts',
      exportedNames: ['formatDate'],
      line: 3,
      isTypeOnly: false,
    }]);
  });

  it.each([
    ['correct-reference', 0],
    ['variant-a-structural', 0],
    ['variant-b-pattern', 1],
    ['variant-c-everything', 3],
    ['variant-d-subtle', 0],
  ] as const)('%s: external %i, no unresolved / dropped / dynamic, resolvedInternal = statements − external', (name, external) => {
    const s = result(name).importResolution;
    expect(s.external).toBe(external);
    expect(s.externalOutOfRootAlias).toBe(0);
    expect(s.unresolved).toBe(0);
    expect(s.droppedNoFileNode).toBe(0);
    expect(s.unsupportedDynamic).toBe(0);
    expect(s.resolvedInternal).toBe(staticStatementCount(name) - external);
  });

  it.each(CASES)('%s: Package nodes have filePath "" and are not in mapped + unmapped', name => {
    const r = result(name);
    const packages = r.nodes.filter(n => n.type === 'Package');
    for (const p of packages) expect(p.filePath).toBe('');
    const layerModel: LayerModel = {
      layers: ['domain', 'application', 'infrastructure', 'presentation'].map(layer => ({
        name: layer, directories: [`src/${layer}/**`], naming: [], role: layer,
      })),
    };
    const { annotations, summary } = annotateNodes(r.nodes, layerModel);
    const files = r.nodes.filter(n => n.type === 'File').length;
    expect(summary.mapped + summary.unmapped).toBe(files);
    for (const p of packages) expect(annotations.get(p.id)?.layer ?? null).toBeNull();
  });
});
