/**
 * The offline re-score from results/v1.3-reference/after-member-facts (no Neo4j, no extraction):
 * - with the switch default (every question at A) it reproduces the after-member-facts report byte for byte;
 * - the transforming path, forced at the status quo, gives the same figures;
 * - Q8 B lists the FLOWS_TO half of FF-P06 as N/A instead of scoring it.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CONSTRUCT_ANSWERS, isStatusQuo, STATUS_QUO_ANSWERS, withAnswers } from '../../../src/shared/construct-switches.js';
import { EMPTY_CONSTRUCT_GRAPH } from '../../../src/construct-switches/graph.js';
import { applyConstructRows } from '../../../src/construct-switches/rows.js';
import { main as validateReference } from '../../../scripts/v1.3/lib/validate-reference-main.js';
import { readRaw, rescore, toFinding, writeRescore } from '../../../scripts/v1.3/lib/construct-rescore.js';
import type { Violation } from '../../../src/shared/taxonomy/violation-types.js';

const REPO = path.resolve(__dirname, '../../..');
const BASE_REL = 'results/v1.3-reference/after-member-facts';
const BASE = path.join(REPO, BASE_REL);
const HEADER = `# v1.3 reference validation (from saved outputs in ${BASE_REL}/raw)`;
const emptyGraphs = (): Promise<typeof EMPTY_CONSTRUCT_GRAPH> => Promise.resolve(EMPTY_CONSTRUCT_GRAPH);

describe('construct re-score of after-member-facts', () => {
  let tmp: string;
  beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'construct-rescore-')); });
  afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('the switch file is at the status quo', () => {
    expect(isStatusQuo(CONSTRUCT_ANSWERS)).toBe(true);
  });

  it('the row stage at the switch default leaves every saved row as it is: the projection of the evidence is the raw file, byte for byte', () => {
    let files = 0;
    for (const style of fs.readdirSync(path.join(BASE, 'raw'))) {
      for (const f of fs.readdirSync(path.join(BASE, 'raw', style))) {
        const variant = f.replace(/\.json$/, '');
        const evidence = (JSON.parse(fs.readFileSync(path.join(BASE, 'evidence', style, f), 'utf8')) as { violations: Violation[] }).violations;
        const out = applyConstructRows(
          [{ functionId: 'X' as never, dimension: 'structural', passed: false, violations: evidence, executionTimeMs: 0, deterministic: true }],
          { answers: CONSTRUCT_ANSWERS, style, layerModel: { layers: [] }, functions: [], graph: EMPTY_CONSTRUCT_GRAPH },
        );
        const findings = out.results.flatMap((r) => r.violations).map(toFinding);
        expect(JSON.stringify({ style, variant, findings }, null, 2) + '\n').toBe(fs.readFileSync(path.join(BASE, 'raw', style, f), 'utf8'));
        files += 1;
      }
    }
    expect(files).toBe(71);
  });

  it('with the switch default, report.json and report.md are byte-identical to the --from-raw replay, and report.md to the live report (header aside)', async () => {
    const replay = path.join(tmp, 'replay');
    const code = await validateReference(['--from-raw', `${BASE_REL}/raw`, '--out', replay], REPO, { env: {}, out: () => undefined, err: () => undefined });
    expect(code).toBe(0);
    const result = await rescore({ repoRoot: REPO, base: BASE, answers: CONSTRUCT_ANSWERS });
    const mine = path.join(tmp, 'rescore');
    writeRescore(mine, result, HEADER, CONSTRUCT_ANSWERS);
    for (const f of ['report.json', 'report.md']) {
      expect(fs.readFileSync(path.join(mine, f), 'utf8')).toBe(fs.readFileSync(path.join(replay, f), 'utf8'));
    }
    expect(fs.existsSync(path.join(mine, 'construct-switches.json'))).toBe(false);
    const live = fs.readFileSync(path.join(BASE, 'report.md'), 'utf8').split('\n').slice(1);
    expect(fs.readFileSync(path.join(mine, 'report.md'), 'utf8').split('\n').slice(1)).toEqual(live);
  });

  it('the transforming path, forced at the status quo, gives the same figures', async () => {
    const plain = await rescore({ repoRoot: REPO, base: BASE, answers: STATUS_QUO_ANSWERS });
    const forced = await rescore({ repoRoot: REPO, base: BASE, answers: STATUS_QUO_ANSWERS, forceGeneralPath: true, graphs: emptyGraphs });
    expect(forced.run.metrics).toEqual(plain.run.metrics);
    // Every saved row is accounted for: the unscored rows are the same multiset in both paths.
    const unscored = (r: typeof plain): string[] => r.run.comparisons.flatMap((c) => c.unscored.map((u) => `${c.style}/${c.variant} ${JSON.stringify(u)}`)).sort();
    expect(unscored(forced)).toEqual(unscored(plain));
    expect(unscored(plain).length).toBeGreaterThan(0);
    expect(readRaw(path.join(BASE, 'raw'), 'clean-architecture', 'clean').length).toBeGreaterThan(0);
  });

  it('Q8 B: the three FLOWS_TO detections of FF-P06 are listed N/A with their manifest rows, not scored', async () => {
    const r = await rescore({ repoRoot: REPO, base: BASE, answers: withAnswers({ Q8: 'B' }), graphs: emptyGraphs });
    const na = Object.entries(r.extras.notApplicable);
    expect(na.map(([k]) => k).sort()).toEqual([
      'clean-architecture/v08-domain-service-holds-infrastructure-clock',
      'hexagonal/v10-domain-service-holds-adapter',
      'nestjs/v10-domain-policy-holds-repository',
    ]);
    for (const [, v] of na) {
      expect(v.tool.every((t) => t.ruleId === 'FF-P06')).toBe(true);
      expect(v.expected.every((e) => e.ruleId === 'FF-P06')).toBe(true);
    }
    const p06 = (style: string): { tp: number } | undefined => r.run.metrics.find((m) => m.style === style)?.rules.find((x) => x.ruleId === 'FF-P06');
    const before = await rescore({ repoRoot: REPO, base: BASE, answers: STATUS_QUO_ANSWERS });
    const p06b = (style: string): { tp: number } | undefined => before.run.metrics.find((m) => m.style === style)?.rules.find((x) => x.ruleId === 'FF-P06');
    for (const s of ['clean-architecture', 'nestjs', 'hexagonal']) expect((p06(s)?.tp ?? 0)).toBe((p06b(s)?.tp ?? 0) - 1);
  });
});
