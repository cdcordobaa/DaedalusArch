/**
 * v1.5 spec pre-flight: the frozen schema, the frozen DDD binder and the v1.5 reader each fail loudly. Zero model calls.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { preflightSpec } from '../../../src/v15-instrument/preflight.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const SPEC = path.join(REPO, 'experiments', 'puzzle-01', 'puzzles', 'p1-transfers', 'spec.yaml');

let tmp: string;
beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-preflight-')); });
afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

const variant = (name: string, edit: (s: string) => string): string => {
  const text = fs.readFileSync(SPEC, 'utf8');
  const out = edit(text);
  expect(out).not.toBe(text);
  const p = path.join(tmp, name);
  fs.writeFileSync(p, out);
  return p;
};

describe('preflightSpec', () => {
  it('passes the PUZZLE-01 p1-transfers spec', async () => {
    const r = await preflightSpec(SPEC);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('fails an inner entity given as a bare class name, with the frozen binder message', async () => {
    const p = variant('bad-inner.yaml', (s) => s.replace('inner_entities: []', 'inner_entities: [Transfer]'));
    const r = await preflightSpec(p);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.startsWith('frozen DDD binder:') && e.includes('"Transfer" lies outside context root "src/ledger/"'))).toBe(true);
  });

  it('fails a spec missing scoring, with the frozen schema message', async () => {
    const p = variant('no-scoring.yaml', (s) => s.slice(0, s.indexOf('\nscoring:')) + '\n' + s.slice(s.indexOf('confidence_thresholds:')));
    const r = await preflightSpec(p);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.startsWith('frozen schema: Spec is invalid') && /scoring/i.test(e))).toBe(true);
  });

  it('fails a missing file', async () => {
    const r = await preflightSpec(path.join(tmp, 'absent.yaml'));
    expect(r.ok).toBe(false);
  });
});
