/**
 * v1.3 `dynamicImports` on a reference fixture: `fixtures/unit/v13-dynamic-imports` (literal `await import()`,
 * `import().then()`, template literal, barrel, `paths` alias, `require()`, `.js` extension, non-literal specifiers,
 * a type-position `import('x').T` and an unresolvable specifier). The expected graph is hand-written
 * (`expected-graph.json`); the graph-fidelity tsc reference (`scripts/v1.3/lib/graph-fidelity.ts`) is the second check.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractAPG } from '../../../src/apg-extractor/index.js';
import { V12E_DEFAULT_OPTIONS, V13_DEFAULT_OPTIONS } from '../../../src/apg-extractor/types.js';
import type { APGResult } from '../../../src/shared/types/apg.js';
import { tscReference } from '../../../scripts/v1.3/lib/graph-fidelity.js';

const FIXTURE = path.resolve(__dirname, '../../../fixtures/unit/v13-dynamic-imports');
const TSCONFIG = path.join(FIXTURE, 'tsconfig.json');

interface ExpectedEdge {
  readonly from: string;
  readonly to: string;
  readonly lines: readonly number[];
  readonly kind: 'static' | 're-export' | 'dynamic' | 'import-type';
  readonly specifier: string;
}
interface Expected {
  readonly edges: readonly ExpectedEdge[];
  readonly nonLiteral: readonly { from: string; line: number }[];
  readonly unresolvable: readonly { from: string; line: number; specifier: string }[];
  readonly knownApgGaps: readonly { from: string; to: string; line: number }[];
}

const EXPECTED = JSON.parse(fs.readFileSync(path.join(FIXTURE, 'expected-graph.json'), 'utf8')) as Expected;
const key = (from: string, to: string): string => `${from} -> ${to}`;
const GAPS = new Set(EXPECTED.knownApgGaps.map((g) => key(g.from, g.to)));
const DYNAMIC_CALLS = EXPECTED.edges.filter((e) => e.kind === 'dynamic').length + 1 /* mixed.ts line 4 */;

interface FileEdge { readonly type: string; readonly key: string; readonly props: Record<string, unknown> }

function fileEdges(apg: APGResult): FileEdge[] {
  const files = new Map(apg.nodes.filter((n) => n.type === 'File').map((n) => [n.id, n.filePath]));
  return apg.edges
    .filter((e) => (e.type === 'IMPORTS' || e.type === 'RE_EXPORTS') && files.has(e.sourceId) && files.has(e.targetId))
    .map((e) => ({ type: e.type, key: key(files.get(e.sourceId) ?? '', files.get(e.targetId) ?? ''), props: e.properties }));
}

async function extract(options: object): Promise<APGResult> {
  const r = await extractAPG(FIXTURE, options, TSCONFIG);
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.data;
}

let v13: APGResult;
let v12e: APGResult;

beforeAll(async () => {
  v13 = await extract(V13_DEFAULT_OPTIONS);
  v12e = await extract(V12E_DEFAULT_OPTIONS);
}, 60_000);

describe('dynamicImports reference fixture (v1.3 defaults)', () => {
  it('gives exactly the hand-written edges, less the recorded gaps', () => {
    const want = EXPECTED.edges.map((e) => key(e.from, e.to)).filter((k) => !GAPS.has(k)).sort();
    expect([...new Set(fileEdges(v13).map((e) => e.key))].sort()).toEqual(want);
  });

  it.each(EXPECTED.edges.filter((e) => e.kind === 'dynamic'))('models $specifier from $from as IMPORTS, dynamic, names [*]', (e) => {
    const edge = fileEdges(v13).find((x) => x.key === key(e.from, e.to));
    expect(edge).toMatchObject({ type: 'IMPORTS', props: { dynamic: true, importedNames: ['*'], lines: e.lines, specifier: e.specifier } });
  });

  it('routes nothing through a dynamically imported barrel: the edge stops at src/domain/index.ts', () => {
    const fromLoader = fileEdges(v13).filter((e) => e.key.startsWith('src/application/loader.ts -> src/domain/'));
    expect(fromLoader.map((e) => e.key).sort()).toEqual([
      key('src/application/loader.ts', 'src/domain/index.ts'),
      key('src/application/loader.ts', 'src/domain/order.ts'),
    ]);
    expect(fromLoader.find((e) => e.key.endsWith('index.ts'))?.props.reExportHop).toBeUndefined();
  });

  it('merges a static import and an import() of the same file into one static edge', () => {
    const edge = fileEdges(v13).find((e) => e.key === key('src/application/mixed.ts', 'src/infrastructure/both.ts'));
    expect(edge?.props.dynamic).toBeUndefined();
    expect(edge?.props.lines).toEqual([1, 4]);
  });

  it('leaves the four non-literal specifiers unmodelled and counted (EXTRACTOR_009)', () => {
    expect(v13.importResolution.unsupportedDynamic).toBe(EXPECTED.nonLiteral.length);
    expect(v13.warnings).toContainEqual(expect.objectContaining({
      filePath: 'src/application/loader.ts', code: 'EXTRACTOR_009', message: `Unsupported dynamic import(s): ${String(EXPECTED.nonLiteral.length)}`,
    }));
    expect(fileEdges(v13).some((e) => e.key.includes('src/plugins/'))).toBe(false);
  });

  it('warns EXTRACTOR_002 for the unresolvable literal and emits no edge', () => {
    for (const u of EXPECTED.unresolvable) {
      expect(v13.warnings).toContainEqual(expect.objectContaining({ filePath: u.from, code: 'EXTRACTOR_002', message: `Unresolvable import: ${u.specifier}` }));
    }
  });

  it("known gap: a type-position import('x').T gives no edge", () => {
    expect(GAPS.size).toBe(1);
    for (const g of GAPS) expect(fileEdges(v13).some((e) => e.key === g)).toBe(false);
  });
});

describe('dynamicImports reference fixture (frozen v1.2E defaults)', () => {
  it('keeps only the static and re-export edges', () => {
    const want = EXPECTED.edges.filter((e) => e.kind === 'static' || e.kind === 're-export').map((e) => key(e.from, e.to)).sort();
    expect(fileEdges(v12e).map((e) => e.key).sort()).toEqual(want);
  });

  it('counts every import() / require() call as unsupported, the unresolvable one included', () => {
    expect(v12e.importResolution.unsupportedDynamic).toBe(DYNAMIC_CALLS + EXPECTED.nonLiteral.length + EXPECTED.unresolvable.length);
  });
});

describe('dynamicImports reference fixture against the graph-fidelity tsc reference', () => {
  it('tsc finds every hand-written edge; the APG misses only the recorded gaps', () => {
    const ref = tscReference(FIXTURE, TSCONFIG);
    const tscKeys = new Set(ref.occurrences.map((o) => key(o.source, o.target)));
    expect([...tscKeys].sort()).toEqual([...new Set(EXPECTED.edges.map((e) => key(e.from, e.to)))].sort());
    const apgKeys = new Set(fileEdges(v13).map((e) => e.key));
    expect([...tscKeys].filter((k) => !apgKeys.has(k))).toEqual([...GAPS]);
    expect(ref.occurrences.find((o) => GAPS.has(key(o.source, o.target)))?.kind).toBe('import-type');
  });
});
