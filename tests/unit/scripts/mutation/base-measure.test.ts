/**
 * `scripts/u5a-base-measure.ts` main (Build and Test Steps 18–19; BR-U5a-36 b, c; BR-U5a-37): usage refusals and
 * both gates on correct-reference written to a scratch directory.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import { main } from '../../../../scripts/lib/base-measure-main.js';
import type { BaseMeasureDeps } from '../../../../scripts/lib/base-measure-main.js';
import { BASE_TYPECHECK_STEM, SITE_FEASIBILITY_STEM } from '../../../../scripts/lib/mutation/freeze-gates.js';
import { CLEAN_SPEC, REPO, fixtureBase } from './operator-harness.js';

jest.setTimeout(600_000);

let scratch: string;
beforeAll(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-measure-'));
});
afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

function deps(): BaseMeasureDeps & { text: () => string } {
  let s = '';
  return {
    runner: new NodeProcessRunner(),
    now: () => new Date('2026-10-08T00:00:00Z'),
    out: (t) => { s += t; },
    err: (t) => { s += t; },
    text: () => s,
  };
}

describe('u5a-base-measure main', () => {
  it('refuses an unknown gate, missing arguments, a bad split and an unreadable list (exit 2)', async () => {
    expect(await main(['other'], REPO, deps())).toBe(2);
    expect(await main(['typecheck', '--bases', 'x.json'], REPO, deps())).toBe(2);
    expect(await main(['typecheck', '--bases', 'x.json', '--out', scratch, '--split', 'dev'], REPO, deps())).toBe(2);
    expect(await main(['feasibility', '--bases', 'x.json', '--out', scratch, '--split', 'probe'], REPO, deps())).toBe(2);
    const d = deps();
    expect(await main(['typecheck', '--bases', path.join(scratch, 'missing.json'), '--out', scratch], REPO, d)).toBe(2);
    expect(d.text()).toContain('not a readable JSON file');
  });

  it('runs both gates on correct-reference: 0 type errors (exit 0); feasibility CAT_SHORTFALL on one fixture (exit 1)', async () => {
    const list = path.join(scratch, 'bases.json');
    fs.writeFileSync(list, JSON.stringify([fixtureBase(CLEAN_SPEC)]));
    const out = path.join(scratch, 'diag');
    const t = deps();
    expect(await main(['typecheck', '--bases', list, '--out', out, '--scratch', scratch], REPO, t)).toBe(0);
    expect(t.text()).toContain('correct-reference: tsc 5.9.3, 0 errors');
    const f = deps();
    expect(await main(['feasibility', '--bases', list, '--out', out, '--scratch', scratch], REPO, f)).toBe(1);
    expect(f.text()).toContain('CAT_SHORTFALL');
    expect(fs.readdirSync(out).sort()).toEqual([`${BASE_TYPECHECK_STEM}.json`, `${BASE_TYPECHECK_STEM}.md`, `${SITE_FEASIBILITY_STEM}.json`, `${SITE_FEASIBILITY_STEM}.md`]);
    expect(fs.readdirSync(scratch).filter((d) => d.startsWith('u5a-freeze-'))).toEqual([]);
  });
});
