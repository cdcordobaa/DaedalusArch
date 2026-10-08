import {
  ImportEdgeMerger,
  mergeImportProperties,
  mergeReExportProperties,
} from '../../../src/apg-extractor/import-edge-merger.js';
import type { ImportEdgeType, ImportOccurrence } from '../../../src/apg-extractor/import-edge-merger.js';
import { generateEdgeId } from '../../../src/apg-extractor/id-generator.js';
import type { ImportEdgeProperties, ReExportEdgeProperties } from '../../../src/shared/types/apg.js';

const SRC = 'src-file-id';
const X = 'x-file-id';

function occ(
  specifier: string,
  line: number,
  names: readonly string[],
  isTypeOnly = false,
  edgeType: ImportEdgeType = 'IMPORTS',
  targetId = X,
): ImportOccurrence {
  return {
    edgeType,
    sourceFileNodeId: SRC,
    target: { kind: 'file', fileNodeId: targetId },
    specifier,
    line,
    names,
    isTypeOnly,
  };
}

function mergeAll(occurrences: { o: ImportOccurrence; target?: string }[]): ReturnType<ImportEdgeMerger['edges']> {
  const m = new ImportEdgeMerger();
  for (const { o, target } of occurrences) m.add(o, target ?? (o.target.kind === 'file' ? o.target.fileNodeId : 'pkg'));
  return m.edges();
}

function imp(p: Partial<ImportEdgeProperties> & { line: number }): ImportEdgeProperties {
  return {
    specifier: p.specifier ?? `./s${String(p.line)}`,
    specifiers: p.specifiers ?? [p.specifier ?? `./s${String(p.line)}`],
    line: p.line,
    lines: p.lines ?? [p.line],
    isTypeOnly: p.isTypeOnly ?? false,
    importedNames: p.importedNames ?? [],
  };
}

describe('ImportEdgeMerger', () => {
  it('never merges IMPORTS and RE_EXPORTS of one pair; ids differ (BR-U2-17)', () => {
    const edges = mergeAll([
      { o: occ('./x', 1, ['A']) },
      { o: occ('./x', 2, ['A'], false, 'RE_EXPORTS') },
    ]);
    expect(edges).toHaveLength(2);
    expect(edges.map(e => e.type)).toEqual(['IMPORTS', 'RE_EXPORTS']);
    expect(edges[0]?.id).toBe(generateEdgeId('IMPORTS', SRC, X));
    expect(edges[1]?.id).toBe(generateEdgeId('RE_EXPORTS', SRC, X));
    expect(edges[0]?.id).not.toBe(edges[1]?.id);
    expect(edges[1]?.properties).toEqual({
      specifier: './x', specifiers: ['./x'], line: 2, lines: [2], isTypeOnly: false, exportedNames: ['A'],
    });
  });

  it('merges a duplicate pair: specifier at min line, specifiers in first-line order (BR-U2-18, 19)', () => {
    const edges = mergeAll([
      { o: occ('./x/index', 2, ['B']) },
      { o: occ('./x', 5, ['A']) },
    ]);
    expect(edges).toHaveLength(1);
    expect(edges[0]?.properties).toEqual({
      specifier: './x/index',
      specifiers: ['./x/index', './x'],
      line: 2,
      lines: [2, 5],
      isTypeOnly: false,
      importedNames: ['A', 'B'],
    });
  });

  it('orders by line, not by add order, and keeps the first emitted on a line tie', () => {
    const edges = mergeAll([
      { o: occ('./x', 5, ['A']) },
      { o: occ('./x/index', 2, ['B']) },
      { o: occ('./x/index.js', 2, ['C']) },
      { o: occ('./x', 5, ['A']) },
    ]);
    expect(edges[0]?.properties).toMatchObject({
      specifier: './x/index',
      specifiers: ['./x/index', './x/index.js', './x'],
      line: 2,
      lines: [2, 5],
    });
  });

  it('is type-only only when every occurrence is (BR-U2-20)', () => {
    const mixed = mergeAll([{ o: occ('./x', 1, ['A'], true) }, { o: occ('./x', 2, ['B'], false) }]);
    expect(mixed[0]?.properties).toMatchObject({ isTypeOnly: false });
    const allType = mergeAll([{ o: occ('./x', 1, ['A'], true) }, { o: occ('./x', 2, ['B'], true) }]);
    expect(allType[0]?.properties).toMatchObject({ isTypeOnly: true });
  });

  it('unions exported-name forms sorted in code-unit order (BR-U2-21)', () => {
    // import D, { A as B } from './x'  →  ['default', 'A'];  import * as ns from './x'  →  ['*']
    const edges = mergeAll([{ o: occ('./x', 1, ['default', 'A']) }, { o: occ('./x', 2, ['*']) }]);
    expect(edges[0]?.properties).toMatchObject({ importedNames: ['*', 'A', 'default'] });
  });

  it('gives a side-effect import empty names and isTypeOnly false', () => {
    const edges = mergeAll([{ o: occ('./x', 3, [], false) }]);
    expect(edges[0]?.properties).toEqual({
      specifier: './x', specifiers: ['./x'], line: 3, lines: [3], isTypeOnly: false, importedNames: [],
    });
  });

  it('emits slots in first-seen order', () => {
    const edges = mergeAll([
      { o: occ('./b', 1, ['b']), target: 'B' },
      { o: occ('./a', 2, ['a']), target: 'A' },
      { o: occ('./b2', 3, ['c']), target: 'B' },
      { o: occ('express', 4, ['Router'], false, 'IMPORTS'), target: 'P' },
    ]);
    expect(edges.map(e => e.targetId)).toEqual(['B', 'A', 'P']);
    expect(edges.every(e => e.sourceId === SRC)).toBe(true);
  });

  it('gives identical edges across two runs', () => {
    const input = [
      { o: occ('./b', 1, ['b']), target: 'B' },
      { o: occ('./a', 1, ['a']), target: 'A' },
      { o: occ('./a', 4, ['z']), target: 'A' },
    ];
    expect(mergeAll(input)).toEqual(mergeAll(input));
  });
});

describe('mergeImportProperties / mergeReExportProperties', () => {
  const a = imp({ line: 2, specifier: './x/index', importedNames: ['B'], isTypeOnly: true });
  const b = imp({ line: 5, specifier: './x', importedNames: ['A'] });
  const c = imp({ line: 9, specifier: './x.js', importedNames: ['default', 'A'], isTypeOnly: true });

  it('applies the merge rules to two property sets', () => {
    expect(mergeImportProperties(a, b)).toEqual({
      specifier: './x/index', specifiers: ['./x/index', './x'], line: 2, lines: [2, 5], isTypeOnly: false, importedNames: ['A', 'B'],
    });
  });

  it('is commutative when lines differ', () => {
    expect(mergeImportProperties(a, b)).toEqual(mergeImportProperties(b, a));
    expect(mergeImportProperties(b, c)).toEqual(mergeImportProperties(c, b));
  });

  it('is associative (specifiers exactly when folded in line order, as a set otherwise)', () => {
    expect(mergeImportProperties(mergeImportProperties(a, b), c))
      .toEqual(mergeImportProperties(a, mergeImportProperties(b, c)));
    const left = mergeImportProperties(mergeImportProperties(c, a), b);
    const right = mergeImportProperties(c, mergeImportProperties(a, b));
    const { specifiers: ls, ...lRest } = left;
    const { specifiers: rs, ...rRest } = right;
    expect(lRest).toEqual(rRest);
    expect([...ls].sort()).toEqual([...rs].sort());
  });

  it('takes a on a line tie (the documented exception to commutativity)', () => {
    const t1 = imp({ line: 3, specifier: './p' });
    const t2 = imp({ line: 3, specifier: './q' });
    expect(mergeImportProperties(t1, t2).specifier).toBe('./p');
    expect(mergeImportProperties(t2, t1).specifier).toBe('./q');
    const { specifier: _s1, specifiers: _l1, ...rest1 } = mergeImportProperties(t1, t2);
    const { specifier: _s2, specifiers: _l2, ...rest2 } = mergeImportProperties(t2, t1);
    expect(rest1).toEqual(rest2);
  });

  it('agrees with the merger when folded in line order', () => {
    const occs = [occ('./x', 5, ['A']), occ('./x/index', 2, ['B'], true), occ('./x.js', 9, ['default', 'A'], true)];
    const edge = mergeAll(occs.map(o => ({ o })))[0];
    expect(edge?.properties).toEqual(mergeImportProperties(mergeImportProperties(a, b), c));
  });

  it('merges RE_EXPORTS with exportedNames and the same rules', () => {
    const r1: ReExportEdgeProperties = {
      specifier: './a', specifiers: ['./a'], line: 4, lines: [4], exportedNames: ['*'], isTypeOnly: true,
    };
    const r2: ReExportEdgeProperties = {
      specifier: './a/index', specifiers: ['./a/index'], line: 1, lines: [1], exportedNames: ['A'], isTypeOnly: true,
    };
    expect(mergeReExportProperties(r1, r2)).toEqual({
      specifier: './a/index', specifiers: ['./a/index', './a'], line: 1, lines: [1, 4], isTypeOnly: true, exportedNames: ['*', 'A'],
    });
    expect(mergeReExportProperties(r1, r2)).toEqual(mergeReExportProperties(r2, r1));
  });
});
