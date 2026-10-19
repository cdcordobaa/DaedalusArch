/** T-TREE (design DR-14 to DR-16): the pin check, the two-call export, the fingerprint. Git is mocked. */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunner, ProcessRunOptions } from '../../../../../src/shared/interfaces/process-runner.js';
import { checkPin, exportTree, treeFingerprint } from '../../../../../scripts/v1.3/lib/eff01/trees.js';
import { FIXTURE_TREE, tmpDir } from './helpers.js';

const PIN = '3aa0b8d3ad3b58c111c57974fb321ddb230bde73';
const ENV = { PATH: '/usr/bin:/bin' };

/** Records calls; `git archive -o` writes a file, `tar -xf` copies the fixture; stdout is never data. */
class MockGit implements ProcessRunner {
  readonly calls: { command: string; args: readonly string[] }[] = [];
  constructor(private readonly head: string) {}
  run(command: string, args: readonly string[], _o: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    this.calls.push({ command, args });
    const res = (stdout: string): Promise<DomainResult<ProcessResult>> => Promise.resolve(DomainResult.ok({ exitCode: 0, stdout, stderr: '', timedOut: false, durationMs: 1 }));
    if (command === 'git' && args[2] === 'rev-parse') return res(`${this.head}\n`);
    if (command === 'git' && args[2] === 'archive') {
      fs.writeFileSync(args[5] ?? '', 'tar bytes');
      return res('NOT-DATA');
    }
    if (command === 'tar') {
      fs.cpSync(FIXTURE_TREE, args[3] ?? '', { recursive: true });
      return res('NOT-DATA');
    }
    return Promise.resolve(DomainResult.fail([{ code: 'X', message: 'unexpected' }]));
  }
}

describe('EFF-01 trees (T-TREE)', () => {
  it('accepts the pinned HEAD and refuses another', async () => {
    expect((await checkPin(new MockGit(PIN), '/c/ddd-forum', PIN, ENV)).success).toBe(true);
    const wrong = await checkPin(new MockGit('0'.repeat(40)), '/c/ddd-forum', PIN, ENV);
    expect(wrong.success).toBe(false);
    if (!wrong.success) expect(wrong.errors[0]?.code).toBe('EFF01_PIN');
  });

  it('exports through exactly two runner calls (archive -o, then tar -xf) and deletes the tar', async () => {
    const h = tmpDir('tree');
    const dest = path.join(h, 'trees', 'ddd-forum');
    const runner = new MockGit(PIN);
    const r = await exportTree(runner, '/c/ddd-forum', PIN, dest, ENV);
    expect(r.success).toBe(true);
    expect(runner.calls).toEqual([
      { command: 'git', args: ['-C', '/c/ddd-forum', 'archive', '--format=tar', '-o', `${dest}.tar`, PIN] },
      { command: 'tar', args: ['-xf', `${dest}.tar`, '-C', dest] },
    ]);
    expect(fs.existsSync(`${dest}.tar`)).toBe(false);
    expect(treeFingerprint(dest)).toBe(treeFingerprint(FIXTURE_TREE));
  });

  it('refuses a non-empty destination', async () => {
    const h = tmpDir('tree');
    fs.writeFileSync(path.join(h, 'x'), 'x');
    const runner = new MockGit(PIN);
    expect((await exportTree(runner, '/c/x', PIN, h, ENV)).success).toBe(false);
    expect(runner.calls).toHaveLength(0);
  });

  it('fingerprints stably and changes on a one-byte edit and on an added dotfile', () => {
    const d = tmpDir('fp');
    fs.cpSync(FIXTURE_TREE, d, { recursive: true });
    const a = treeFingerprint(d);
    expect(treeFingerprint(d)).toBe(a);
    const f = path.join(d, 'src/domain/Book.ts');
    const text = fs.readFileSync(f, 'utf8');
    fs.writeFileSync(f, text.replace('id', 'iD'));
    expect(treeFingerprint(d)).not.toBe(a);
    fs.writeFileSync(f, text);
    expect(treeFingerprint(d)).toBe(a);
    fs.writeFileSync(path.join(d, '.env.example'), 'X=1\n');
    expect(treeFingerprint(d)).not.toBe(a);
  });
});
