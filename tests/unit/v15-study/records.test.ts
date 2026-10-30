/**
 * `run-study.ts --keep-trees` (`experiments/v15-study/lib/records.ts`): session trees are copied to the results
 * directory with their session.json, after the recorded tree hashes and the canaries are checked (zero calls).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { keepSessionTrees, treeSha } from '../../../experiments/v15-study/lib/records.js';

let tmp: string;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-records-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

const write = (f: string, body: string): void => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); };

/** One driver session: seed and two steps, with an `out/` port folder and a node_modules link-like folder. */
function session(out: string, id: string, extra: Record<string, string> = {}): void {
  const snap = path.join(out, 'sessions', id, 'snap');
  write(path.join(snap, 'step-00', 'src', 'domain', 'A.ts'), 'export const a = 1;\n');
  write(path.join(snap, 'step-01', 'src', 'domain', 'A.ts'), 'export const a = 2;\n');
  write(path.join(snap, 'step-01', 'src', 'application', 'ports', 'out', 'P.ts'), 'export interface P {}\n');
  write(path.join(snap, 'step-02', 'src', 'domain', 'A.ts'), 'export const a = 3;\n');
  for (const [f, b] of Object.entries(extra)) write(path.join(snap, 'step-02', f), b);
  write(path.join(snap, 'step-02', 'node_modules', 'x', 'index.js'), 'module.exports = 1;\n');
  const steps = ['step-01', 'step-02'].map((s) => ({ step: s, treeSha256: treeSha(path.join(snap, s)) }));
  write(path.join(out, 'sessions', id, 'session.json'), `${JSON.stringify({ id, steps })}\n`);
  write(path.join(out, 'sessions', id, 'turns', 'step-01', 'prompt.txt'), 'prompt text\n');
}

describe('keepSessionTrees', () => {
  it('copies every step tree and session.json, without prompts or node_modules, and the copies keep their hashes', () => {
    const out = path.join(tmp, 'out');
    const res = path.join(tmp, 'res');
    session(out, 'c001');
    session(out, 'c002');
    fs.mkdirSync(path.join(out, 'sessions', 'c003'), { recursive: true }); // no session.json: not a session
    const kept = keepSessionTrees(out, res, ['canary-0123']);
    expect(kept.map((k) => [k.id, k.steps])).toEqual([['c001', 3], ['c002', 3]]);
    const c1 = path.join(res, 'sessions', 'c001');
    expect(fs.readdirSync(path.join(c1, 'snap')).sort()).toEqual(['step-00', 'step-01', 'step-02']);
    expect(fs.existsSync(path.join(c1, 'snap', 'step-01', 'src', 'application', 'ports', 'out', 'P.ts'))).toBe(true);
    expect(fs.existsSync(path.join(c1, 'snap', 'step-02', 'node_modules'))).toBe(false);
    expect(fs.existsSync(path.join(c1, 'turns'))).toBe(false);
    const sess = JSON.parse(fs.readFileSync(path.join(c1, 'session.json'), 'utf8')) as { steps: { step: string; treeSha256: string }[] };
    for (const st of sess.steps) expect(treeSha(path.join(c1, 'snap', st.step))).toBe(st.treeSha256);
    expect(fs.existsSync(path.join(res, 'sessions', 'c003'))).toBe(false);
  });

  it('refuses, and writes nothing, when a snapshot does not match its recorded hash', () => {
    const out = path.join(tmp, 'out');
    session(out, 'c001');
    fs.writeFileSync(path.join(out, 'sessions', 'c001', 'snap', 'step-02', 'src', 'domain', 'A.ts'), 'changed\n');
    expect(() => keepSessionTrees(out, path.join(tmp, 'res'))).toThrow(/does not match the recorded tree sha256/);
    expect(fs.existsSync(path.join(tmp, 'res'))).toBe(false);
  });

  it('refuses, and writes nothing, when a snapshot holds a canary', () => {
    const out = path.join(tmp, 'out');
    session(out, 'c001', { 'src/leak.ts': '// canary-0123\n' });
    expect(() => keepSessionTrees(out, path.join(tmp, 'res'), ['canary-0123'])).toThrow(/canary/);
    expect(fs.existsSync(path.join(tmp, 'res'))).toBe(false);
  });
});
