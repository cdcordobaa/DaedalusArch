import { sitesOf, violatedSites } from '../../../../scripts/v1.3/ise-e1.js';
import type { Finding } from '../../../../scripts/v1.3/ise-e1.js';
import { grid, primaryExt, primaryIcs, renderReport, summarise } from '../../../../scripts/v1.3/ise-e1-report.js';
import type { Cell } from '../../../../scripts/v1.3/ise-e1-report.js';
import { selfDeviations } from '../../../../scripts/v1.3/ise-e1-option1.js';
import { mineRules, unitStructure } from '../../../../src/ise/index.js';
import type { IseGraph } from '../../../../src/ise/index.js';

const graph: IseGraph = {
  files: ['src/a.ts', 'src/b.ts', 'src/main.ts'],
  edges: [
    { from: 'src/a.ts', to: 'src/b.ts', typeOnly: false },
    { from: 'src/b.ts', to: 'src/a.ts', typeOnly: false },
    { from: 'src/main.ts', to: 'src/a.ts', typeOnly: false },
  ],
  packageImports: [{ file: 'src/a.ts', pkg: 'express' }, { file: 'src/main.ts', pkg: 'express' }],
  declarations: [],
  typeEdges: [],
};
const layerOf = new Map([['src/a.ts', { layer: 'domain' }], ['src/b.ts', { layer: 'application' }], ['src/main.ts', { layer: null }]]);
const f = (functionId: string, filePath: string, target?: string, discriminator?: string[]): Finding =>
  ({ functionId, filePath, ...(target !== undefined ? { target } : {}), ...(discriminator !== undefined ? { discriminator } : {}) });

describe('ISE on E1: site ratio (§1.3)', () => {
  it('counts file and package sites from layered files only', () => {
    expect([...sitesOf(graph, layerOf)].sort()).toEqual(['src/a.ts->pkg:express', 'src/a.ts->src/b.ts', 'src/b.ts->src/a.ts']);
  });

  it('collects blocking sites: targets, cycle pairs, target-less per rule; skips advisory and the FF-P06 FLOWS_TO half', () => {
    const v = violatedSites([
      f('FF-S01', 'src/a.ts', 'src/b.ts'),
      f('FF-S04', 'src/a.ts', 'src/b.ts'),
      f('FF-S02', 'src/a.ts,src/b.ts,src/a.ts', 'src/b.ts'),
      f('FF-P03', 'src/b.ts'),
      f('FF-P06', 'src/a.ts', undefined, ['A', 'x', 'FLOWS_TO']),
      f('FF-C03', 'src/a.ts', 'src/b.ts'),
    ], new Set(['FF-S01', 'FF-S02', 'FF-S04', 'FF-P03', 'FF-P06']));
    expect([...v].sort()).toEqual(['src/a.ts->src/b.ts', 'src/b.ts#FF-P03', 'src/b.ts->src/a.ts']);
  });
});

const cell = (over: { level: string; ics: number | null; ext: number; abstains?: boolean; match?: boolean }): Cell => ({
  id: `m_t_${over.level}_r`, model: 'claude-x', task: 't', level: over.level, run: 'r', files: 4,
  ise: { style: 'clean-architecture', confidence: 1, totalPoints: 8, runnerUp: null, evidence: [], abstains: over.abstains ?? false, abstainReasons: over.abstains === true ? ['no style evidence'] : [], styleMatch: over.match ?? true, structureOnlyUnits: 0, unlayeredFiles: 0, units: [], specValid: true },
  extrinsic: { style: 'clean-architecture', verdict: over.ext === 1 ? 'pass' : 'fail', blockingAhs: over.ext, checkedSites: 10, violatedSites: [], siteRatio: 1, blockingFindings: over.ext === 1 ? 0 : 2, advisoryFindings: 4, blockingByRule: {} },
  intrinsic: { style: 'clean-architecture', verdict: 'pass', blockingAhs: 1, checkedSites: 10, violatedSites: [], siteRatio: over.ics, blockingFindings: 0, advisoryFindings: 4, blockingByRule: {} },
});

describe('ISE on E1: report (§1.5, §1.6)', () => {
  const cells = [cell({ level: 'none', ics: 1, ext: 1 }), cell({ level: 'none', ics: 0.9, ext: 0.8 }), cell({ level: 'full-aac', ics: 0.96, ext: 0.9, match: false }), cell({ level: 'full-aac', ics: null, ext: 1, abstains: true })];

  it('fills the 2x2 with the pre-stated thresholds and keeps n/a apart', () => {
    expect(grid(cells, primaryIcs, primaryExt)).toEqual({ hh: 1, hl: 1, lh: 0, ll: 1, na: 1 });
  });

  it('summarises a level x model group', () => {
    const r = summarise('none', 'claude-x', cells.slice(0, 2));
    expect(r.styleMatch).toBe(2);
    expect(r.meanIcs).toBeCloseTo(0.95);
    expect(r.extPass).toBe(1);
    expect(r.blockingPerFileExt).toBeCloseTo(0.25);
  });

  it('renders without throwing and reports abstentions', () => {
    const { md } = renderReport(cells);
    expect(md).toContain('no style evidence');
    expect(md).toContain('2×2 grids');
  });
});

describe('ISE on E1: Option 1 self-deviations (post-hoc)', () => {
  it('skips closed-world, applies majority rules back to the same graph and leaves sub-majority candidates unapplied', () => {
    const g: IseGraph = {
      files: ['src/app/a.ts', 'src/app/b.ts', 'src/app/c.ts', 'src/dom/x.ts'],
      edges: [
        { from: 'src/app/a.ts', to: 'src/dom/x.ts', typeOnly: false },
        { from: 'src/app/b.ts', to: 'src/dom/x.ts', typeOnly: false },
        { from: 'src/app/c.ts', to: 'src/dom/x.ts', typeOnly: false },
        { from: 'src/dom/x.ts', to: 'src/app/c.ts', typeOnly: false },
      ],
      packageImports: [],
      declarations: [],
      typeEdges: [],
    };
    const rules = selfDeviations(g, mineRules(g, unitStructure(g)));
    expect(rules.some((r) => r.kind === 'closed-world')).toBe(false);
    expect(rules.find((r) => r.kind === 'direction')).toMatchObject({ support: 0.75, applies: true, deviations: 1 });
  });
});
