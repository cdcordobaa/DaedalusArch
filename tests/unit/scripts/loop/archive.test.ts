/**
 * Gate S12 archive step (`scripts/lib/loop/archive.ts`) on a dry-run loop out-root: a deterministic, path-free
 * manifest and ustar; verification; the path-free scan.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { archiveOutRoot, buildManifest, scanPathFree, ustarSplit, verifyManifest } from '../../../../scripts/lib/loop/archive.js';
import { runLoop } from '../../../../scripts/lib/loop/loop.js';
import { context, spec, tmpRoot } from './helpers.js';

let tmp: string;
let out: string;
beforeEach(async () => {
  tmp = tmpRoot('loop-archive-');
  out = path.join(tmp, 'out');
  const r = await runLoop(context(out), spec('none'));
  if (!r.success) throw new Error('dry run failed');
  fs.writeFileSync(path.join(out, 'schedule.json'), '{"schema":"loop-schedule/v1"}\n');
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('S12 archive', () => {
  it('archives records and the snapshot store, not the work tree, with relative paths only', () => {
    fs.symlinkSync('/etc', path.join(out, 'runs', 'link'));
    const m = buildManifest(out);
    const paths = m.entries.map((e) => e.path);
    expect(paths).toContain('schedule.json');
    expect(paths.some((p) => p.endsWith('/run.json'))).toBe(true);
    expect(paths.some((p) => p.endsWith('/steps/step-01.json'))).toBe(true);
    expect(fs.readdirSync(path.join(out, 'runs'), { recursive: true }).some((p) => String(p).endsWith(`${path.sep}work`))).toBe(true);
    expect(paths.some((p) => p.includes('/work/'))).toBe(false);
    expect(paths.every((p) => !path.isAbsolute(p))).toBe(true);
    expect(m.skippedLinks).toBe(1);
    expect(JSON.stringify(m)).not.toContain(tmp);
  });

  it('the tarball is byte-identical across runs and readable by tar, and holds the manifest files', () => {
    const a = archiveOutRoot(out, path.join(tmp, 'a.tar'));
    const b = archiveOutRoot(out, path.join(tmp, 'b.tar'));
    expect(a.tarSha256).toBe(b.tarSha256);
    expect(a.manifestSha256).toBe(b.manifestSha256);
    const listed = spawnSync('tar', ['-tf', path.join(tmp, 'a.tar')], { encoding: 'utf8' });
    expect(listed.status).toBe(0);
    expect(listed.stdout.trim().split('\n')).toEqual(a.entries.map((e) => e.path));
    const x = path.join(tmp, 'x');
    fs.mkdirSync(x);
    expect(spawnSync('tar', ['-xf', path.join(tmp, 'a.tar'), '-C', x]).status).toBe(0);
    for (const e of a.entries) expect(fs.readFileSync(path.join(x, e.path)).equals(fs.readFileSync(path.join(out, e.path)))).toBe(true);
  });

  it('refuses a tarball inside the out-root', () => {
    expect(() => archiveOutRoot(out, path.join(out, 'a.tar'))).toThrow(/ARCHIVE_INSIDE_OUTROOT/);
  });

  it('verify: equal content passes; a changed, added or missing file is named', () => {
    const m = buildManifest(out);
    expect(verifyManifest(out, m)).toEqual([]);
    fs.appendFileSync(path.join(out, 'schedule.json'), ' ');
    fs.writeFileSync(path.join(out, 'runs', 'extra.txt'), 'x');
    expect(verifyManifest(out, m)).toEqual(['changed: schedule.json', 'added: runs/extra.txt']);
  });

  it('ustar split: ≤ 100 bytes as name; longer split at a slash; impossible → null', () => {
    expect(ustarSplit('a/b')).toEqual({ prefix: '', name: 'a/b' });
    const long = `${'d'.repeat(120)}/${'f'.repeat(90)}`;
    expect(ustarSplit(long)).toEqual({ prefix: 'd'.repeat(120), name: 'f'.repeat(90) });
    expect(ustarSplit('x'.repeat(300))).toBeNull();
  });

  it('path-free scan: home paths and secret shapes are found by file and line, never quoted', () => {
    const d = path.join(tmp, 'results');
    fs.mkdirSync(d);
    fs.writeFileSync(path.join(d, 'a.json'), '{\n "cwd": "/Users/someone/x"\n}\n');
    fs.writeFileSync(path.join(d, 'b.md'), 'ok\nkey sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123\n');
    fs.writeFileSync(path.join(d, 'c.md'), 'runs/claude-code-cli/x and /tmp/y are fine\n');
    expect(scanPathFree(d)).toEqual([
      { file: 'a.json', line: 2, kind: 'absolute-home-path' },
      { file: 'b.md', line: 2, kind: 'secret-shape' },
    ]);
  });
});
