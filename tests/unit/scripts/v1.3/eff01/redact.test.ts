/** T-REDACT (design DR-27a, SC-8): longest prefix first, deep over objects and JSONL, boundary-safe; SC-8 cuts. */
import { redactJsonl, redactPaths, redactRoots, redactString } from '../../../../../scripts/v1.3/lib/eff01/redact.js';
import { normPath } from '../../../../../scripts/v1.3/lib/eff01/score.js';

const roots = redactRoots({
  home: '/Users/alice',
  harnessRoot: '/Users/alice/scratch/h',
  repoRoot: '/Volumes/Disk/alice/DaedalusArch',
  clonesDir: '/Users/alice/clones',
  configDir: '/Users/alice/.firewall/eff01-config',
  nodeBinary: '/opt/node/bin/node',
});

describe('EFF-01 redaction (T-REDACT)', () => {
  it('replaces each root, longest prefix first (a harness inside HOME becomes <H>)', () => {
    expect(redactString('/Users/alice/scratch/h/trees/ddd-forum/src/a.ts', roots)).toBe('<H>/trees/ddd-forum/src/a.ts');
    expect(redactString('/Users/alice/notes.md', roots)).toBe('<HOME>/notes.md');
    expect(redactString('read /Volumes/Disk/alice/DaedalusArch/experiments/eff-01/answers.json', roots)).toBe('read <REPO>/experiments/eff-01/answers.json');
    expect(redactString('/Users/alice/clones/ddd-forum', roots)).toBe('<CLONES>/ddd-forum');
    expect(redactString('/Users/alice/.firewall/eff01-config', roots)).toBe('<CONFIG>');
    expect(redactString('/opt/node/bin/node', roots)).toBe('<NODE>/node');
  });

  it('only replaces at a path boundary', () => {
    expect(redactString('/Users/alicesmith/x', roots)).toBe('/Users/alicesmith/x');
    expect(redactString('"/Users/alice"', roots)).toBe('"<HOME>"');
  });

  it('covers nested objects, keys and JSONL lines', () => {
    const v = { argv: ['--mcp-config', '/Users/alice/scratch/h/mcp/x.json'], deep: { list: [{ p: '/Users/alice/a' }] }, ['/Users/alice/k']: 1 };
    expect(redactPaths(v, roots)).toEqual({ argv: ['--mcp-config', '<H>/mcp/x.json'], deep: { list: [{ p: '<HOME>/a' }] }, ['<HOME>/k']: 1 });
    const jsonl = `${JSON.stringify({ input: { file_path: '/Users/alice/scratch/h/trees/x/README.md' } })}\nnot json /Users/alice/y\n`;
    expect(redactJsonl(jsonl, roots)).toBe(`${JSON.stringify({ input: { file_path: '<H>/trees/x/README.md' } })}\nnot json <HOME>/y\n`);
  });

  it('a path under a directory named src above the tree is not mis-cut by SC-8', () => {
    const r = redactRoots({ harnessRoot: '/work/src/h' });
    const stored = redactString('/work/src/h/trees/ddd-forum/src/shared/core/Result.ts', r);
    expect(stored).toBe('<H>/trees/ddd-forum/src/shared/core/Result.ts');
    expect(normPath(stored, { repoId: 'ddd-forum' })).toEqual({ value: 'src/shared/core/Result.ts', stripped: true });
    // Unredacted: cut after the last /ddd-forum/ segment, not at the first /src/.
    expect(normPath('/work/src/h/trees/ddd-forum/src/shared/core/Result.ts', { repoId: 'ddd-forum' })).toEqual({ value: 'src/shared/core/Result.ts', stripped: true });
  });
});
