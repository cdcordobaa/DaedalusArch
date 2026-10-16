/** scripts/v1.3/ontology-run.ts: estimate and replay of the recorded-fixture cassettes (no model call). */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fixtureCases, main } from '../../../scripts/v1.3/ontology-run.js';

describe('ontology-run script', () => {
  let out: string[];
  let spy: jest.SpyInstance;
  beforeEach(() => {
    out = [];
    spy = jest.spyOn(process.stdout, 'write').mockImplementation((s: string | Uint8Array) => { out.push(String(s)); return true; });
  });
  afterEach(() => { spy.mockRestore(); });

  it('lists the six planted cases', () => {
    expect(fixtureCases()).toHaveLength(6);
  });

  it('--estimate counts calls per case and calls nothing', async () => {
    expect(await main(['--fixtures', '--provider', 'mock', '--estimate'])).toBe(0);
    expect(out.filter((l) => l.startsWith('case-'))).toHaveLength(6);
    expect(out.join('')).toContain('budget 200 ok');
  }, 120_000);

  it('--replay of the mock cassettes scores every case against its manifest', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ontology-run-'));
    try {
      expect(await main(['--fixtures', '--provider', 'mock', '--replay', '--out', dir])).toBe(0);
      const scores = JSON.parse(fs.readFileSync(path.join(dir, 'scores.json'), 'utf8')) as { aggregate: { expected: number; found: number; forbiddenHits: number } };
      expect(scores.aggregate).toMatchObject({ expected: 3, found: 3, forbiddenHits: 0 });
      expect(out.join('')).toContain('| case-01-rule-dup-shapes | ruleDuplications: free-shipping-at-50 | expected | found | missed | not-recorded |');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);

  it('rejects a call without a target or with an unknown provider', async () => {
    expect(await main([])).toBe(2);
    expect(await main(['--fixtures', '--provider', 'gpt'])).toBe(2);
  });
});
