/**
 * `--confine` (src/mcp-server/confine.ts; Docs/v1.4/claude-s4-mcp-probe-spec.md probe d): the `spec` and `project`
 * tool arguments may not leave the configured spec and project. Off by default.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CONFINED_PREFIX, confineArgs } from '../../../src/mcp-server/confine.js';
import { parseArgs } from '../../../src/mcp-server/context.js';
import { createServer } from '../../../src/mcp-server/server.js';
import { createSpecLoader } from '../../../src/mcp-server/tools.js';
import type { ServerContext } from '../../../src/mcp-server/tools.js';
import { CLEAN_ARCH_SPEC, REPO } from './helpers.js';

interface Scratch {
  readonly base: string;
  readonly cell: string;
  readonly outsideSpec: string;
  readonly outsideProject: string;
  cleanup(): void;
}

function scratch(): Scratch {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-confine-')));
  const cell = path.join(base, 'cell');
  fs.mkdirSync(path.join(cell, 'src', 'domain'), { recursive: true });
  fs.writeFileSync(path.join(cell, 'tsconfig.json'), '{}\n');
  fs.writeFileSync(path.join(cell, 'src', 'domain', 'a.ts'), 'export const a = 1;\n');
  const outsideSpec = path.join(base, 'outside-spec.yaml');
  fs.copyFileSync(CLEAN_ARCH_SPEC, outsideSpec);
  const outsideProject = path.join(base, 'outside-proj');
  fs.mkdirSync(path.join(outsideProject, 'src', 'CANARYDIR'), { recursive: true });
  fs.writeFileSync(path.join(outsideProject, 'tsconfig.json'), '{}\n');
  fs.writeFileSync(path.join(outsideProject, 'src', 'CANARYDIR', 'b.ts'), 'export const b = 2;\n');
  return { base, cell, outsideSpec, outsideProject, cleanup: () => fs.rmSync(base, { recursive: true, force: true }) };
}

describe('confineArgs', () => {
  let s: Scratch;
  beforeEach(() => {
    s = scratch();
  });
  afterEach(() => s.cleanup());

  const scope = (cwd?: string) => ({ specPath: CLEAN_ARCH_SPEC, projectPath: s.cell, cwd: cwd ?? s.cell });

  it('accepts no spec/project argument, the configured spec, a spec inside the project and a project inside it', () => {
    fs.writeFileSync(path.join(s.cell, 'my-spec.yaml'), 'x');
    expect(confineArgs(scope(), {})).toBeNull();
    expect(confineArgs(scope(), { path: 'src/domain/a.ts' })).toBeNull();
    expect(confineArgs(scope(), { spec: CLEAN_ARCH_SPEC })).toBeNull();
    expect(confineArgs(scope(), { spec: 'my-spec.yaml' })).toBeNull();
    expect(confineArgs(scope(), { project: s.cell })).toBeNull();
    expect(confineArgs(scope(), { project: '.' })).toBeNull();
    expect(confineArgs(scope(), { project: 'src' })).toBeNull();
  });

  it.each([
    ['an absolute spec outside', (x: Scratch) => ({ spec: x.outsideSpec })],
    ['a relative spec that climbs out', () => ({ spec: '../outside-spec.yaml' })],
    ['the project directory itself as the spec', (x: Scratch) => ({ spec: x.cell })],
    ['an absolute project outside', (x: Scratch) => ({ project: x.outsideProject })],
    ['a relative project that climbs out', () => ({ project: '../outside-proj' })],
    ['a project that climbs out and back in', () => ({ project: 'src/../../outside-proj' })],
    ['the filesystem root as project', () => ({ project: '/' })],
  ])('refuses %s', (_name, args) => {
    expect(confineArgs(scope(), args(s))).toMatch(new RegExp(`^${CONFINED_PREFIX}`));
  });

  it('refuses a relative project that stays inside from one base but leaves from the other', () => {
    // From the repository cwd, "cell" does not exist and resolves outside the project.
    expect(confineArgs(scope(REPO), { project: 'src' })).toMatch(/^confined:/);
  });

  it('refuses a symlink inside the project that points outside', () => {
    fs.symlinkSync(s.outsideProject, path.join(s.cell, 'link'));
    expect(confineArgs(scope(), { project: 'link' })).toMatch(/^confined:/);
    fs.symlinkSync(s.outsideSpec, path.join(s.cell, 'spec-link.yaml'));
    expect(confineArgs(scope(), { spec: 'spec-link.yaml' })).toMatch(/^confined:/);
  });

  it('refuses any spec or project argument when nothing is configured', () => {
    expect(confineArgs({ cwd: s.cell }, { spec: CLEAN_ARCH_SPEC })).toMatch(/^confined:/);
    expect(confineArgs({ cwd: s.cell }, { project: s.cell })).toMatch(/^confined:/);
  });
});

describe('--confine on the server', () => {
  let s: Scratch;
  beforeEach(() => {
    s = scratch();
  });
  afterEach(() => s.cleanup());

  function ctx(confine: boolean): ServerContext {
    return {
      defaultSpecPath: CLEAN_ARCH_SPEC,
      defaultProjectPath: s.cell,
      env: {},
      loadSpec: createSpecLoader(),
      presetsDir: path.join(REPO, 'presets'),
      evaluateDeps: { makeGraph: () => { throw new Error('unused'); }, makePipeline: () => { throw new Error('unused'); } },
      ...(confine ? { confine: true } : {}),
    };
  }

  async function call(confine: boolean, name: string, args: Record<string, unknown>): Promise<{ isError: boolean; text: string }> {
    const server = createServer(ctx(confine));
    const client = new Client({ name: 't', version: '0' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(b), client.connect(a)]);
    try {
      const r = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { type: string; text?: string }[] };
      return { isError: r.isError === true, text: r.content.map((c) => c.text ?? '').join('') };
    } finally {
      await client.close();
    }
  }

  it('parseArgs reads --confine', () => {
    expect(parseArgs(['--spec', 's', '--confine']).confine).toBe(true);
    expect(parseArgs(['--spec', 's']).confine).toBeUndefined();
  });

  it('unconfined (the default) a tool reads a spec outside the project; confined it is refused before the tool runs', async () => {
    const open = await call(false, 'get_architecture_spec', { spec: s.outsideSpec });
    expect(open.isError).toBe(false);
    expect(open.text).toContain(s.outsideSpec);
    const shut = await call(true, 'get_architecture_spec', { spec: s.outsideSpec });
    expect(shut.isError).toBe(true);
    expect(shut.text).toMatch(/^confined:/);
    expect(shut.text).not.toContain('CANARY');
  });

  it('confined infer_spec refuses a sibling project; the configured spec still answers', async () => {
    const shut = await call(true, 'infer_spec', { project: s.outsideProject });
    expect(shut).toMatchObject({ isError: true });
    expect(shut.text).not.toContain('CANARYDIR');
    const ok = await call(true, 'get_architecture_spec', {});
    expect(ok.isError).toBe(false);
  });
});
