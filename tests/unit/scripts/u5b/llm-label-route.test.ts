/**
 * ADR-035: `--derive-route` keeps the items, strata and seeds of the chosen populations of a registered plan and
 * routes them to another labeller route with the remaining label budget; the estimate must still fit.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deriveRoutePlan, main } from '../../../../scripts/llm-label.js';
import type { LabelPlanFile } from '../../../../scripts/llm-label.js';
import { LABEL_FIXTURE_DIR, fixturePlan } from './label-fixture.js';
import { ROOT } from './score-fixture.js';

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function run(argv: string[]): { code: Promise<number>; out: string[]; err: string[]; files: Map<string, string> } {
  const out: string[] = [];
  const err: string[] = [];
  const files = new Map<string, string>();
  const code = main(argv, ROOT, { out: (t) => out.push(t), err: (t) => err.push(t), writeFile: (f, t) => files.set(f, t) });
  return { code, out, err, files };
}

describe('ADR-035 --derive-route', () => {
  it('keeps only the chosen population, its strata and the seeds, and sets route and budget', () => {
    const plan = fixturePlan();
    const d = deriveRoutePlan(plan, { source: 'p.json', populations: ['P4'], provider: 'gemini', model: 'gemini-3.1-pro-preview', budgetCalls: 50, reason: 'r' });
    expect(d.items.length).toBeGreaterThan(0);
    expect(d.items.every((i) => i.population === 'P4')).toBe(true);
    expect(d.items).toEqual(plan.items.filter((i) => i.population === 'P4'));
    expect(d.strata.every((s) => s.population === 'P4')).toBe(true);
    expect(d).toMatchObject({ provider: 'gemini', model: 'gemini-3.1-pro-preview', budgetCalls: 50, permutationSeed: plan.permutationSeed, derivedFrom: { plan: 'p.json', populations: ['P4'], reason: 'r' } });
  });

  it('writes the derived plan through the CLI and refuses a missing flag, an unpinned model or a budget the estimate exceeds', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'u5b-route-'));
    dirs.push(dir);
    const src = join(LABEL_FIXTURE_DIR, 'plan.json');
    const base = ['--plan', src, '--derive-route', '--population', 'P4', '--provider', 'gemini', '--reason', 'route change'];
    const ok = run([...base, '--model', 'gemini-3.1-pro-preview', '--budget', '40', '--out', join(dir, 'd.json')]);
    expect(await ok.code).toBe(0);
    const written = [...ok.files.values()][0];
    expect(written).toBeDefined();
    const d = JSON.parse(written ?? '{}') as LabelPlanFile;
    expect(d.provider).toBe('gemini');
    expect(d.items.every((i) => i.population === 'P4')).toBe(true);
    expect(await run([...base, '--budget', '40', '--out', join(dir, 'x.json')]).code).toBe(2);
    expect(await run([...base, '--model', '', '--budget', '40', '--out', join(dir, 'x.json')]).code).toBe(1);
    // A registered-sizing plan (items x 2 runs + the re-ask reserve) refuses a budget it does not fit.
    const registered = join(dir, 'registered.json');
    writeFileSync(registered, JSON.stringify({ ...fixturePlan(), sizing: 'registered', reaskReserveCalls: 30 }));
    const fits = run(['--plan', registered, ...base.slice(2), '--model', 'gemini-3.1-pro-preview', '--budget', '100', '--out', join(dir, 'y.json')]);
    expect(await fits.code).toBe(0);
    const tight = run(['--plan', registered, ...base.slice(2), '--model', 'gemini-3.1-pro-preview', '--budget', '31', '--out', join(dir, 'x.json')]);
    expect(await tight.code).toBe(1);
    expect(tight.files.size).toBe(0);
    expect(readFileSync(join(ROOT, src), 'utf8')).toContain('"permutationSeed"');
  });
});
