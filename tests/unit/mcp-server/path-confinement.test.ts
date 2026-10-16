/**
 * R05 and R06 (Docs/v1.3/post-merge-review-2026-10-16.md): the MCP tools must not remap a path outside the project
 * root (or an absolute path with no project) to a no-layer path that then passes, and the project view must not read
 * through a symlink that leaves the project root.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createSpecLoader, checkFileTool, checkImportTool, explainFindingTool, toProjectRelative, whichLayerTool } from '../../../src/mcp-server/tools.js';
import type { ServerContext } from '../../../src/mcp-server/tools.js';
import { ProjectView } from '../../../src/mcp-server/project-files.js';
import { CLEAN_ARCH_SPEC } from './helpers.js';

const ORM_ENTITY = "import { Entity } from 'typeorm';\n@Entity()\nexport class Order {}\n";

function scratch(): { real: string; link: string; cleanup: () => void } {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-paths-')));
  const real = path.join(base, 'private', 'work');
  fs.mkdirSync(path.join(real, 'src', 'domain'), { recursive: true });
  const link = path.join(base, 'tmp-link');
  fs.symlinkSync(real, link);
  return { real, link, cleanup: () => fs.rmSync(base, { recursive: true, force: true }) };
}

function ctxFor(project: string | undefined): ServerContext {
  return {
    defaultSpecPath: CLEAN_ARCH_SPEC,
    defaultProjectPath: project,
    env: {},
    loadSpec: createSpecLoader(),
    evaluateDeps: { makeGraph: () => { throw new Error('unused'); }, makePipeline: () => { throw new Error('unused'); } },
  };
}

describe('R05: tool paths are confined to the project root', () => {
  it('a project given through a symlink still layers the realpath form of a file (macOS /tmp -> /private/tmp)', async () => {
    const s = scratch();
    try {
      const ctx = ctxFor(s.link);
      const abs = path.join(s.real, 'src', 'domain', 'Order.ts');
      const rel = toProjectRelative(ctx, abs);
      expect(rel).toEqual({ ok: true, data: 'src/domain/Order.ts' });
      const r = await checkFileTool(ctx, { path: abs, content: ORM_ENTITY });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.data.blockingVerdict).toBe('block');
      const layer = await whichLayerTool(ctx, { path: abs });
      expect(layer.ok && layer.data.layer).toBe('domain');
    } finally {
      s.cleanup();
    }
  });

  it('an absolute path with no --project is refused, not unrooted into a no-layer PASS', async () => {
    const ctx = ctxFor(undefined);
    const r = await checkFileTool(ctx, { path: '/Users/x/proj/src/domain/Order.ts', content: ORM_ENTITY });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/absolute path/i);
    expect((await whichLayerTool(ctx, { path: '/Users/x/proj/src/domain/Order.ts' })).ok).toBe(false);
    // A relative path still works without a project.
    expect(toProjectRelative(ctx, 'src/domain/Order.ts')).toEqual({ ok: true, data: 'src/domain/Order.ts' });
  });

  it('a path outside the project root is refused (absolute, or relative with leading ..)', async () => {
    const s = scratch();
    try {
      const ctx = ctxFor(s.real);
      const outside = path.join(path.dirname(path.dirname(s.real)), 'elsewhere', 'src', 'domain', 'Order.ts');
      const r = await checkFileTool(ctx, { path: outside, content: ORM_ENTITY });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toMatch(/outside the project/i);
      expect((await checkFileTool(ctx, { path: '../../src/domain/Order.ts', content: ORM_ENTITY })).ok).toBe(false);
      expect((await checkImportTool(ctx, { from: outside, module: 'typeorm' })).ok).toBe(false);
    } finally {
      s.cleanup();
    }
  });
});

describe('R06: the project view does not follow symlinks out of the root', () => {
  it('read() refuses a symlink whose target is outside the root; explain_finding returns no line text from it', async () => {
    const s = scratch();
    const secretDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-secret-'));
    try {
      const secret = path.join(secretDir, 'protected.txt');
      fs.writeFileSync(secret, 'TOP-SECRET-LINE-1\nTOP-SECRET-LINE-2\n');
      fs.symlinkSync(secret, path.join(s.real, 'src', 'x.ts'));
      fs.writeFileSync(path.join(s.real, 'src', 'domain', 'inside.ts'), 'export const a = 1;\n');
      fs.symlinkSync(path.join(s.real, 'src', 'domain', 'inside.ts'), path.join(s.real, 'src', 'alias.ts'));
      const view = new ProjectView({ root: s.real });
      expect(view.read('src/x.ts')).toBeUndefined();
      // A symlink that stays inside the root is still read.
      expect(view.read('src/alias.ts')).toBe('export const a = 1;\n');
      const viaLinkRoot = new ProjectView({ root: s.link });
      expect(viaLinkRoot.read('src/domain/inside.ts')).toBe('export const a = 1;\n');
      expect(viaLinkRoot.read('src/x.ts')).toBeUndefined();
      const r = await explainFindingTool(ctxFor(s.real), { rule: 'FF-S01', file: 'src/x.ts', line: 1 });
      expect(JSON.stringify(r)).not.toContain('TOP-SECRET');
    } finally {
      s.cleanup();
      fs.rmSync(secretDir, { recursive: true, force: true });
    }
  });
});
