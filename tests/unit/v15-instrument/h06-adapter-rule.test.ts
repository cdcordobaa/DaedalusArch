/**
 * H06 R-ADAPTER-RULE v1.5.7 (2026-11-02, development; `experiments/h06-adapter-rule-dev/README.md`). Two parts, zero
 * model calls, no Neo4j:
 *   1. Every H06 case of HCAL-01..HCAL-04 (development data now; each set was scored once before): the positive is
 *      reported in its labelled file, and the twins, legitimate cases and bases are clean. A case is its domain's base
 *      with the case folder overlaid, and the base is the baseline, as the admission scorer runs it.
 *   2. Synthetic shapes on the CN-04 tool-library fixture: the v1.5.7 readings (threshold, calendar, a helper one level
 *      down, a nullable read, a ternary price) and hard clean twins (transport validation, size, status, timing and
 *      paging mechanisms, a lookup callback, code mappings by switch and ternary).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadRules, runTree } from '../../../src/v15-instrument/index.js';
import type { Finding } from '../../../src/v15-instrument/index.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const RULE = 'R-ADAPTER-RULE';
const FX = path.join(REPO, 'tests', 'fixtures', 'v15-cn04');

describe('H06 R-ADAPTER-RULE v1.5.7', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-h06-'));
  afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const rules = loadRules().filter((r) => r.id === RULE);
  const violations = (xs: Finding[]): Finding[] => xs.filter((f) => f.status === 'violation' && f.rule === RULE);

  it('the rule header documents the v1.5.7 change', () => {
    expect(rules[0]!.text).toMatch(/^\/\/ v1\.5\.7 \(2026-11-02\):/m);
  });

  describe('HCAL-01..HCAL-04 H06 cases (development data)', () => {
    const SETS: [string, string][] = [
      ['hcal-01', 'subscriptions'], ['hcal-02', 'meters'], ['hcal-02', 'recruitment'],
      ['hcal-03', 'museum-loans'], ['hcal-03', 'solar-coop'], ['hcal-04', 'radio-station'], ['hcal-04', 'vet-clinic'],
    ];
    for (const [set, dom] of SETS) {
      it(`${set}/${dom}: positives in their labelled file, twins, legit and base clean`, async () => {
        const dd = path.join(REPO, 'experiments', set, dom);
        const labels = JSON.parse(fs.readFileSync(path.join(dd, 'labels.json'), 'utf8')) as Record<string, { rule: string; label: string; file: string | null }>;
        for (const c of ['base', ...Object.keys(labels).filter((k) => labels[k]!.rule === 'H06').sort()]) {
          const tree = path.join(scratch, set, dom, c);
          fs.cpSync(path.join(dd, 'base'), tree, { recursive: true });
          if (c !== 'base') fs.cpSync(path.join(dd, 'cases', c), tree, { recursive: true });
          const r = await runTree(tree, rules, { spec: path.join(tree, 'spec.yaml'), scratch: path.join(scratch, '_s'), withApg: false, ...(c !== 'base' ? { baseline: path.join(dd, 'base') } : {}) });
          const files = [...new Set(violations(r.findings).map((f) => f.file))];
          if (c !== 'base' && labels[c]!.label === 'violation') expect({ c, files }).toEqual({ c, files: [labels[c]!.file] });
          else expect({ c, files }).toEqual({ c, files: [] });
        }
      }, 240_000);
    }
  });

  describe('synthetic shapes on the CN-04 tool-library fixture', () => {
    const IMPORTS = [
      "import type { Tool } from '../../../domain/tool';",
      "import { ToolError } from '../../../domain/errors';",
    ].join('\n');
    /** One adapter file added to the fixture base; returns the rule's evidence lines. */
    const run = async (id: string, file: string, body: string): Promise<string[]> => {
      const tree = path.join(scratch, 'syn', id);
      fs.cpSync(path.join(FX, 'base'), tree, { recursive: true });
      fs.mkdirSync(path.dirname(path.join(tree, file)), { recursive: true });
      fs.writeFileSync(path.join(tree, file), `${IMPORTS}\n\n${body}\n`);
      const r = await runTree(tree, rules, { spec: path.join(FX, 'spec.yaml'), scratch: path.join(scratch, '_s'), withApg: false, baseline: path.join(FX, 'base') });
      return violations(r.findings).map((f) => `${f.file}:${String(f.line)} ${f.evidence}`);
    };
    const IN = 'src/adapters/in/http/extra.controller.ts';
    const OUT = 'src/adapters/out/pg/tool-row.mapper.ts';

    const POSITIVES: [string, string, string, RegExp][] = [
      ['threshold on request data', IN, `
export class LoanLengthController {
  post(body: { days: number }): { status: number; body: object } {
    if (body.days > 14) return { status: 422, body: { error: 'loans are at most two weeks' } };
    return { status: 204, body: {} };
  }
}`, /threshold body\.days > 14\) and returns \{ status: 422/],
      ['calendar rule', IN, `
export class WeekendController {
  post(at: string): { status: number; body: object } {
    const when = new Date(at);
    if (when.getDay() === 6) return { status: 422, body: { error: 'closed on Saturdays' } };
    return { status: 204, body: {} };
  }
}`, /calendar when\.getDay\(\) === 6\)/],
      ['helper predicate one level down, named constant', OUT, `
const MIN_DEPOSIT_CENTS = 1500;
function tooCheap(tool: Tool): boolean { return tool.depositCents < MIN_DEPOSIT_CENTS; }
export class DepositGateway {
  hold(tool: Tool): { accepted: boolean; reason: string } {
    if (tooCheap(tool)) return { accepted: false, reason: 'below-minimum' };
    return { accepted: true, reason: '' };
  }
}`, /decides on domain state \(tool\.depositCents\) and returns \{ accepted: false/],
      ['nullable domain read (optional chaining)', IN, `
export class ReturnController {
  constructor(private readonly find: (id: string) => Tool | null) {}
  post(id: string): void {
    const t = this.find(id);
    if (t?.condition === 'broken') throw new ToolError('a broken tool cannot be returned');
  }
}`, /decides on domain state \(t\?\.condition\) and raises new ToolError/],
      ['ternary price on a domain value', OUT, `
export class FeeMapper {
  fee(tool: Tool): number {
    const rate = tool.condition === 'worn' ? 0.5 : 0;
    return rate;
  }
}`, /decides on domain state \(tool\.condition\) and chooses 0\.5/],
      ['local const holding a threshold', OUT, `
export class LateFeeRepository {
  rows: number[] = [];
  save(tool: Tool, lentAt: Date): void {
    const late = Date.now() - lentAt.getTime() > 21 * 86_400_000;
    this.rows.push(late ? Math.round(tool.depositCents * 0.1) : 0);
  }
}`, /threshold Date\.now\(\) - lentAt\.getTime\(\) > 21 \* 86_400_000\) and computes Math\.round/],
    ];
    for (const [name, file, body, re] of POSITIVES) {
      it(`positive: ${name}`, async () => {
        const h = await run(name.replace(/\W+/g, '-'), file, body);
        expect(h).toHaveLength(1);
        expect(h[0]).toMatch(re);
      }, 120_000);
    }

    const CLEAN: [string, string, string][] = [
      ['transport validation (typeof, isInteger, sign)', IN, `
export class DaysController {
  post(body: { days?: unknown }): { status: number; body: object } {
    if (typeof body.days !== 'number' || !Number.isInteger(body.days) || body.days <= 0) return { status: 400, body: { error: 'days must be a positive integer' } };
    return { status: 204, body: {} };
  }
}`],
      ['size check on a string', IN, `
export class MemberController {
  post(member: string): { status: number; body: object } {
    if (member.length > 64) return { status: 400, body: { error: 'member is too long' } };
    return { status: 204, body: {} };
  }
}`],
      ['paging limit', IN, `
export class ListController {
  get(q: { pageSize: number }): { status: number; body: object } {
    if (q.pageSize > 100) return { status: 400, body: { error: 'pageSize is at most 100' } };
    return { status: 200, body: {} };
  }
}`],
      ['vendor status and timeout mechanisms', OUT, `
const TIMEOUT_MS = 5000;
export class VendorClient {
  read(res: { status: number }, startedAt: number): { status: number; body: object } {
    if (res.status >= 500) return { status: 502, body: { error: 'vendor unavailable' } };
    if (Date.now() - startedAt > TIMEOUT_MS) return { status: 504, body: { error: 'vendor timed out' } };
    return { status: 200, body: {} };
  }
}`],
      ['lookup callback, then a presence test', OUT, `
export class ShelfRepository {
  constructor(private readonly tools: Tool[]) {}
  priciest(): Tool {
    const t = this.tools.find((x) => x.depositCents > 1000);
    if (t === undefined) throw new ToolError('no such tool');
    return t;
  }
}`],
      ['outbound enum to column mapping by switch', OUT, `
export function toRowCondition(tool: Tool): string {
  switch (tool.condition) {
    case 'good': return 'G';
    case 'worn': return 'W';
    case 'broken': return 'B';
  }
  return 'G';
}`],
      ['ternary code mapping on an equality', OUT, `
export function toRowFlag(tool: Tool): string {
  return tool.condition === 'broken' ? 'OUT_OF_SERVICE' : 'IN_SERVICE';
}`],
    ];
    for (const [name, file, body] of CLEAN) {
      it(`clean: ${name}`, async () => {
        expect(await run(name.replace(/\W+/g, '-'), file, body)).toEqual([]);
      }, 120_000);
    }
  });
});
