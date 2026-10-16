import { classify, eslintCheckOf, suppressedInline } from '../../../../scripts/v1.3/declared-rules-run.js';
import type { Evidence } from '../../../../scripts/v1.3/declared-rules-run.js';
import type { RefOccurrence } from '../../../../scripts/v1.3/lib/graph-fidelity.js';

const occ = (kind: RefOccurrence['kind'], alias = false): RefOccurrence => ({ source: 's.ts', target: 't.ts', specifier: alias ? '@x/t' : './t', line: 3, kind, alias, indexResolution: false });
const ev = (over: Partial<Evidence>): Evidence => ({
  tsc: [], apgLiteral: true, apgResolvedOnly: false, apgFiles: new Set(['s.ts', 't.ts']), theirGraph: false, family: 'boundaries',
  forbiddenByDecl: [], ourLayers: ['A', 'B'], ...over,
});

describe('declared-rules-run: disagreement classes', () => {
  it('classifies ours-only edges', () => {
    expect(classify('ours-only', 's.ts', 't.ts', ev({ tsc: [occ('dynamic-import')] })).cls).toBe('dynamic import');
    expect(classify('ours-only', 's.ts', 't.ts', ev({ tsc: [occ('re-export')] })).cls).toBe('re-export/barrel');
    expect(classify('ours-only', 's.ts', 't.ts', ev({ family: 'depcruise', tsc: [occ('import')], elidedOnCompile: true })).cls).toBe('type-only');
    expect(classify('ours-only', 's.ts', 't.ts', ev({ tsc: [occ('import', true)] })).cls).toBe('alias resolution');
    expect(classify('ours-only', 's.ts', 't.ts', ev({ tsc: [occ('import')], suppressedInline: true })).cls).toBe('rule translation gap');
    expect(classify('ours-only', 's.ts', 't.ts', ev({ tsc: [] })).cls).toBe('extractor gap');
    expect(classify('ours-only', 's.ts', 't.ts', ev({ tsc: [occ('import')] })).cls).toBe("their tool's gap");
  });

  it('classifies theirs-only edges', () => {
    expect(classify('theirs-only', 's.ts', 'ext:react', ev({})).cls).toBe('rule translation gap');
    expect(classify('theirs-only', 'x.spec.ts', 't.ts', ev({})).cls).toBe('extractor gap');
    expect(classify('theirs-only', 's.ts', 't.ts', ev({ ourLayers: ['A', 'A'], forbiddenByDecl: ['r'] })).reason).toMatch(/same-atom/);
    expect(classify('theirs-only', 's.ts', 't.ts', ev({ apgLiteral: false, apgResolvedOnly: true })).cls).toBe('re-export/barrel');
    expect(classify('theirs-only', 's.ts', 't.ts', ev({ apgLiteral: false, tsc: [occ('import')] })).cls).toBe('extractor gap');
    expect(classify('theirs-only', 's.ts', 't.ts', ev({ apgLiteral: false, tsc: [] })).cls).toBe('alias resolution');
  });

  it('detects inline eslint suppressions', () => {
    const text = ['import a from "a";', '// eslint-disable-next-line boundaries/element-types', 'import b from "b";', 'import c from "c"; // eslint-disable-line other/rule', '/* eslint-disable */', 'import d from "d";'].join('\n');
    expect(suppressedInline(text, 'boundaries/element-types', [1])).toBe(false);
    expect(suppressedInline(text, 'boundaries/element-types', [3])).toBe(true);
    expect(suppressedInline(text, 'boundaries/element-types', [4])).toBe(false);
    expect(suppressedInline(text, 'boundaries/element-types', [6])).toBe(true);
  });
});

describe('declared-rules-run: Nx message checks', () => {
  it('separates declared tag constraints from the built-in checks', () => {
    expect(eslintCheckOf('nx', 'A project tagged with "type:util" can only depend on libs tagged with "type:util"')).toBe('declared');
    expect(eslintCheckOf('nx', 'A project without tags matching at least one constraint cannot depend on any libraries')).toBe('declared');
    expect(eslintCheckOf('nx', 'Projects cannot be imported by a relative or absolute path, and must begin with a npm scope')).toBe('builtin:relative-or-absolute-import');
    expect(eslintCheckOf('nx', 'Imports of apps are forbidden')).toBe('builtin:imports-of-apps');
    expect(eslintCheckOf('boundaries', 'anything')).toBe('declared');
  });
});
