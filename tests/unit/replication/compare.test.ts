/**
 * replication/lib/compare.mjs: a KNOWN waiver holds only for the regenerated content it records (its sha256), not for
 * any change to the named file.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const COMPARE = path.resolve(__dirname, '../../../replication/lib/compare.mjs');
const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'compare-mjs-'));
  for (const side of ['expected', 'actual']) fs.mkdirSync(path.join(tmp, side));
  fs.writeFileSync(path.join(tmp, 'expected', 'same.json'), '{"a":1}\n');
  fs.writeFileSync(path.join(tmp, 'actual', 'same.json'), '{"a":1}\n');
  fs.writeFileSync(path.join(tmp, 'expected', 'waived.json'), '{"cp4":"pass"}\n');
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function compare(regenerated: string, known: unknown): { code: number | null; out: string } {
  fs.writeFileSync(path.join(tmp, 'actual', 'waived.json'), regenerated);
  const knownFile = path.join(tmp, 'known.json');
  fs.writeFileSync(knownFile, JSON.stringify(known));
  const r = spawnSync(process.execPath, [COMPARE, 'L', path.join(tmp, 'expected'), path.join(tmp, 'actual'), '--known', knownFile], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout };
}

describe('compare.mjs KNOWN entries', () => {
  const regenerated = '{"cp4":"fail"}\n';

  it('reports KNOWN when the regenerated file has the recorded sha256', () => {
    const r = compare(regenerated, { 'L/waived.json': { reason: 'finding C-1', regeneratedSha256: sha256(regenerated) } });
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/^IDENTICAL L\/same\.json/m);
    expect(r.out).toMatch(/^KNOWN {5}L\/waived\.json regenerated sha256:[0-9a-f]{12} \(finding C-1\)$/m);
  });

  it('reports DIFF when the file differs in any other way', () => {
    const r = compare('{"cp4":"fail","cp5":"fail"}\n', { 'L/waived.json': { reason: 'finding C-1', regeneratedSha256: sha256(regenerated) } });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/^DIFF {6}L\/waived\.json .*not the known divergence/m);
  });

  it('reports DIFF for an entry without a hash (a name-only waiver)', () => {
    const r = compare(regenerated, { 'L/waived.json': 'finding C-1' });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/^DIFF {6}L\/waived\.json .*no regeneratedSha256/m);
  });

  it('every entry of replication/known-divergences.json carries a reason and a full sha256', () => {
    const known = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../replication/known-divergences.json'), 'utf8')) as Record<string, { reason?: unknown; regeneratedSha256?: unknown }>;
    expect(Object.keys(known).length).toBeGreaterThan(0);
    for (const entry of Object.values(known)) {
      expect(typeof entry.reason).toBe('string');
      expect(entry.regeneratedSha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe('smoke.sh', () => {
  it('prints an explicit SKIPPED line when the 72fa9203 replay cannot run', () => {
    const smoke = fs.readFileSync(path.resolve(__dirname, '../../../replication/smoke.sh'), 'utf8');
    expect(smoke).toMatch(/echo "SKIPPED {3}apg2-ablation@72fa9203 \(commit 72fa9203 is not in this checkout's history/);
    expect(smoke).toMatch(/SKIPPED: \$skipped step\(s\) did not run/);
  });
});
