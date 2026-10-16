/**
 * v1.3 graph-fidelity harness (FR-V2): specifier collection, the tsc reference, the APG projection, agreement,
 * classification, dependency-cruiser parsing, seeded sampling, suggested verdicts and layer assignment.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractAPG, V12E_DEFAULT_OPTIONS } from '../../../../src/apg-extractor/index.js';
import {
  agreement, agreementStratum, classify, collectSpecifiers, depcruiseEdges, edgeKey, microAgreement, mulberry32,
  occurrencesByEdge, projectApg, readCompilerConfig, scopeOf, seededSample, stratifiedSample, suggestVerdict, toCsv,
  tscReference,
} from '../../../../scripts/v1.3/lib/graph-fidelity.js';
import type { ApgEdgeInfo, ClassifyContext, RefOccurrence } from '../../../../scripts/v1.3/lib/graph-fidelity.js';
import { assignLayers } from '../../../../scripts/v1.3/lib/layer-assignment.js';
import type { LayerModel } from '../../../../src/shared/types/spec.js';

const FILES: Record<string, string> = {
  'tsconfig.json': JSON.stringify({
    compilerOptions: { strict: true, target: 'ES2022', module: 'commonjs', moduleResolution: 'node', baseUrl: '.', paths: { '@app/*': ['src/*'] } },
    include: ['src/**/*.ts'],
  }),
  'src/domain/thing.ts': 'export class Thing { constructor(public readonly n: number) {} }\n',
  'src/domain/types.ts': 'export interface Shape { n: number }\n',
  'src/domain/index.ts': "export { Thing } from './thing';\nexport type { Shape } from './types';\n",
  'src/app/use.ts': [
    "import { Thing } from '../domain';",
    "import type { Shape } from '../domain/types';",
    "import { helper } from '@app/infra/helper';",
    'export async function run(s: Shape): Promise<number> {',
    "  const lazy = await import('../infra/lazy');",
    "  const req = require('../infra/req') as { v: number };",
    '  return new Thing(s.n).n + helper() + lazy.v + req.v;',
    '}',
    '',
  ].join('\n'),
  'src/infra/helper.ts': 'export function helper(): number { return 1; }\n',
  'src/infra/lazy.ts': 'export const v = 2;\n',
  'src/infra/req.ts': 'export const v = 3;\n',
  'src/infra/helper.spec.ts': "import { helper } from './helper';\nexport const t = helper();\n",
};

let root = '';

beforeAll(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gf-test-')));
  for (const [rel, text] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('collectSpecifiers', () => {
  it('finds every specifier kind with its line', () => {
    const src = [
      "import a from './a';",
      "import './side';",
      "import type { T } from './t';",
      "import { type U } from './u';",
      "export * from './re';",
      "export type { V } from './v';",
      "import e = require('./eq');",
      "const r = require('./req');",
      "const d = import('./dyn');",
      "let x: import('./it').X;",
      'const c = require(name);',
    ].join('\n');
    const got = collectSpecifiers('x.ts', src).map((s) => `${String(s.line)}:${s.kind}:${s.specifier}`);
    expect(got).toEqual([
      '1:import:./a', '2:side-effect:./side', '3:type-import:./t', '4:type-import:./u', '5:re-export:./re',
      '6:type-re-export:./v', '7:import-equals:./eq', '8:require:./req', '9:dynamic-import:./dyn', '10:import-type:./it',
    ]);
  });
});

describe('tscReference and the APG projection on a fixture', () => {
  it('resolves alias, index, type-only, dynamic and require edges', () => {
    const ref = tscReference(root, path.join(root, 'tsconfig.json'));
    const keys = new Set(occurrencesByEdge(ref.occurrences).keys());
    expect(keys).toContain(edgeKey('src/app/use.ts', 'src/domain/index.ts'));
    expect(keys).toContain(edgeKey('src/app/use.ts', 'src/infra/helper.ts'));
    expect(keys).toContain(edgeKey('src/app/use.ts', 'src/infra/lazy.ts'));
    expect(keys).toContain(edgeKey('src/app/use.ts', 'src/infra/req.ts'));
    expect(keys).toContain(edgeKey('src/infra/helper.spec.ts', 'src/infra/helper.ts'));
    const toIndex = ref.occurrences.find((o) => o.target === 'src/domain/index.ts');
    expect(toIndex?.indexResolution).toBe(true);
    expect(ref.occurrences.find((o) => o.specifier === '@app/infra/helper')?.alias).toBe(true);
  });

  it('classifies the disagreements between the v1.2E extractor and the tsc reference', async () => {
    // v1.3 branch: `{}` means the v1.3 defaults; this case pins the v1.2E extractor.
    const res = await extractAPG(root, V12E_DEFAULT_OPTIONS);
    expect(res.success).toBe(true);
    if (!res.success) return;
    const apg = projectApg(res.data);
    const apgFiles = new Set(apg.files);
    expect(apgFiles.has('src/infra/helper.spec.ts')).toBe(false);
    // Barrel routing: the named import of `../domain` lands on the declaring file.
    expect(apg.edges.has(edgeKey('src/app/use.ts', 'src/domain/thing.ts'))).toBe(true);
    expect(apg.edges.has(edgeKey('src/app/use.ts', 'src/domain/index.ts'))).toBe(false);

    const ref = tscReference(root, path.join(root, 'tsconfig.json'));
    const byEdge = occurrencesByEdge(ref.occurrences);
    const tscBySource = new Map<string, RefOccurrence[]>();
    for (const o of ref.occurrences) tscBySource.set(o.source, [...(tscBySource.get(o.source) ?? []), o]);
    const apgBySource = new Map<string, { target: string; info: ApgEdgeInfo }[]>();
    for (const [k, info] of apg.edges) {
      const [s, t] = k.split('\t') as [string, string];
      apgBySource.set(s, [...(apgBySource.get(s) ?? []), { target: t, info }]);
    }
    const ctx: ClassifyContext = { apgFiles, tscBySource, apgBySource };
    const cls = (s: string, t: string, side: 'apg' | 'ref'): string => {
      const k = edgeKey(s, t);
      return classify({ key: k, tsc: byEdge.get(k) ?? [], dc: undefined, apg: apg.edges.get(k) }, side, ctx);
    };
    expect(cls('src/app/use.ts', 'src/domain/index.ts', 'apg')).toBe('re-export/barrel');
    expect(cls('src/app/use.ts', 'src/domain/thing.ts', 'ref')).toBe('re-export/barrel');
    expect(cls('src/app/use.ts', 'src/infra/lazy.ts', 'apg')).toBe('dynamic-import');
    expect(cls('src/app/use.ts', 'src/infra/req.ts', 'apg')).toBe('require');
    expect(cls('src/infra/helper.spec.ts', 'src/infra/helper.ts', 'apg')).toBe('excluded-file');
    expect(scopeOf('src/x.d.ts', apgFiles)).toBe('dts');
    expect(scopeOf('../other/x.ts', apgFiles)).toBe('out-of-root');
    // The alias and the type-only import agree.
    expect(apg.edges.has(edgeKey('src/app/use.ts', 'src/infra/helper.ts'))).toBe(true);
    expect(apg.edges.has(edgeKey('src/app/use.ts', 'src/domain/types.ts'))).toBe(true);

    const options = readCompilerConfig(path.join(root, 'tsconfig.json')).options;
    const k1 = edgeKey('src/app/use.ts', 'src/infra/helper.ts');
    expect(suggestVerdict(root, { key: k1, tsc: byEdge.get(k1) ?? [], dc: undefined, apg: apg.edges.get(k1) }, ctx, options).verdict)
      .toBe('exists-resolves-to-target');
    const k2 = edgeKey('src/app/use.ts', 'src/domain/thing.ts');
    const sv = suggestVerdict(root, { key: k2, tsc: [], dc: undefined, apg: apg.edges.get(k2) }, ctx, options);
    expect(sv.verdict).toBe('exists-via-barrel');
    expect(sv.line).toBe(1);
  });
});

describe('agreement', () => {
  it('computes coverage, confirmation and Jaccard, with empty sets as 1', () => {
    const a = agreement(new Set(['x', 'y', 'z']), new Set(['y', 'z', 'w', 'v']));
    expect(a).toMatchObject({ both: 2, onlyApg: 1, onlyRef: 2 });
    expect(a.refCoveredByApg).toBeCloseTo(0.5);
    expect(a.apgConfirmedByRef).toBeCloseTo(2 / 3);
    expect(a.jaccard).toBeCloseTo(2 / 5);
    expect(agreement(new Set(), new Set()).jaccard).toBe(1);
    const m = microAgreement([a, agreement(new Set(['q']), new Set(['q']))]);
    expect(m).toMatchObject({ apgEdges: 4, refEdges: 5, both: 3 });
  });
});

describe('depcruiseEdges', () => {
  it('keeps internal resolved edges and their dependency types', () => {
    const e = depcruiseEdges([
      { source: 'src/a.ts', dependencies: [
        { resolved: 'src/b.ts', module: './b', dependencyTypes: ['local', 'import'] },
        { resolved: 'fs', module: 'fs', coreModule: true, dependencyTypes: ['core'] },
        { resolved: 'node_modules/x/index.js', module: 'x', dependencyTypes: ['npm'] },
        { resolved: './gone', module: './gone', couldNotResolve: true },
      ] },
    ]);
    expect([...e.keys()]).toEqual([edgeKey('src/a.ts', 'src/b.ts')]);
    expect(e.get(edgeKey('src/a.ts', 'src/b.ts'))?.dependencyTypes).toEqual(['import', 'local']);
  });
});

describe('seeded sampling', () => {
  it('is deterministic for a seed and stratifies with redistribution', () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    expect(seededSample(items, 5, mulberry32(7))).toEqual(seededSample(items, 5, mulberry32(7)));
    const strata = new Map<string, number[]>([['a', [1, 2]], ['b', items], ['c', [100]]]);
    const s = stratifiedSample(strata, 10, mulberry32(1));
    expect(s).toHaveLength(10);
    expect(s.filter((x) => x.stratum === 'a')).toHaveLength(2);
    expect(s.filter((x) => x.stratum === 'c')).toHaveLength(1);
    expect(s.filter((x) => x.stratum === 'b')).toHaveLength(7);
  });

  it('assigns an agreement stratum by the rarest feature', () => {
    const o = (kind: RefOccurrence['kind'], alias = false): RefOccurrence => ({ source: 'a', target: 'b', specifier: 'x', line: 1, kind, alias, indexResolution: false });
    expect(agreementStratum([o('import'), o('dynamic-import')])).toBe('dynamic-import');
    expect(agreementStratum([o('type-import')])).toBe('type-only');
    expect(agreementStratum([o('import', true)])).toBe('path-alias');
    expect(agreementStratum([o('import')])).toBe('static-relative');
  });
});

describe('assignLayers', () => {
  it('uses the instrument annotator and recovers the matching glob', () => {
    const model = {
      layers: [
        { name: 'domain', directories: ['src/domain/**'], naming: [], role: 'entity' },
        { name: 'infrastructure', directories: ['src/infra/**'], naming: [], role: 'controller' },
      ],
    } as unknown as LayerModel;
    const r = assignLayers(['src/domain/a.ts', 'src/infra/b.ts', 'src/other/c.ts'], model);
    expect(r.assigned).toBe(2);
    expect(r.fractionAssigned).toBeCloseTo(2 / 3);
    expect(r.assignments.map((a) => a.glob)).toEqual(['src/domain/**', 'src/infra/**', '']);
    expect(r.inconsistencies).toEqual([]);
  });
});

describe('toCsv', () => {
  it('quotes cells with commas, quotes and newlines, and joins arrays', () => {
    expect(toCsv(['a', 'b'], [['x,y', ['p', 'q']], ['say "hi"', 1]])).toBe('a,b\n"x,y",p;q\n"say ""hi""",1\n');
  });
});
