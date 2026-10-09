/**
 * SP-* probe copies CLI (Build and Test Step 28): usage refusals before any copy is made. The full 25-probe
 * application is exercised by `sp-probes.test.ts` with the same forced sites (`SP_FORCED_SITES`).
 */
import { SP_FORCED_SITES } from '../../../../scripts/lib/mutation/operators/sp/forced-sites.js';
import { SP_PROBES } from '../../../../scripts/lib/mutation/operators/sp/index.js';
import { defaultMutateDeps } from '../../../../scripts/lib/mutation/mutate-main.js';
import { main } from '../../../../scripts/sp-probe-copies.js';
import { REPO } from './operator-harness.js';

describe('sp-probe-copies', () => {
  const run = async (argv: string[]): Promise<[number, string]> => {
    const err: string[] = [];
    const code = await main(argv, REPO, { ...defaultMutateDeps(), out: () => undefined, err: (t) => err.push(t) });
    return [code, err.join('')];
  };

  it('every frozen probe has a forced site, and only those', () => {
    expect(Object.keys(SP_FORCED_SITES).sort()).toEqual(SP_PROBES.map((p) => p.op.id).sort());
  });

  it('refuses a missing or absolute --out, an unknown strategy and an existing --out', async () => {
    expect((await run([]))[0]).toBe(2);
    expect((await run(['--out', '/tmp/sp']))[0]).toBe(2);
    expect((await run(['--out', 'x', '--cycle-strategy', 'tarjan']))[0]).toBe(2);
    const [code, text] = await run(['--out', 'fixtures']);
    expect(code).toBe(1);
    expect(text).toContain('already exists');
  });
});
