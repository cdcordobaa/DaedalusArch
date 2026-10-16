import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { GraphRepository } from '../../../src/shared/interfaces/graph-repository.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { buildContext, parseArgs } from '../../../src/mcp-server/context.js';
import { SPEC_TOOL_NAMES, TOOL_NAMES, createServer } from '../../../src/mcp-server/server.js';
import { createSpecLoader, toProjectRelative } from '../../../src/mcp-server/tools.js';
import type { ServerContext } from '../../../src/mcp-server/tools.js';
import { CLEAN_ARCH_SPEC, FIXTURES } from './helpers.js';

const PROJECT = path.join(FIXTURES, 'variant-a-structural');

function context(overrides: Partial<ServerContext> = {}, reachable = true): ServerContext {
  const graph: GraphRepository = {
    executeQuery: jest.fn(),
    clearGraph: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(reachable),
    close: jest.fn().mockResolvedValue(undefined),
  };
  return {
    defaultSpecPath: CLEAN_ARCH_SPEC,
    defaultProjectPath: PROJECT,
    env: { NEO4J_PASSWORD: 'pw-for-tests' },
    loadSpec: createSpecLoader(),
    evaluateDeps: {
      makeGraph: () => graph,
      makePipeline: () => ({
        executor: {
          execute: () =>
            Promise.resolve(
              DomainResult.ok({
                ahsDeterministic: 0.9,
                verdict: 'pass',
                durationMs: 5,
                functionResults: [],
                violations: [],
              }),
            ),
        } as never,
        cleanup: () => Promise.resolve(),
      }),
      connectTimeoutMs: 50,
    },
    ...overrides,
  };
}

async function connect(
  ctx: ServerContext,
): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createServer(ctx);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as { type: string; text: string }[])[0]?.text ?? '';
  return {
    isError: result.isError === true,
    text,
    structured: result.structuredContent as Record<string, unknown> | undefined,
  };
}

describe('MCP server over an in-memory transport', () => {
  it('exposes exactly the eleven tools (the eight v1 tools first, then the MCP v2 tools, then propose_spec), each with a description and an input schema', async () => {
    const { client, close } = await connect(context());
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual([...TOOL_NAMES]);
    expect([...TOOL_NAMES]).toEqual([
      'get_architecture_spec',
      'which_layer',
      'check_import',
      'evaluate_project',
      'explain_violation',
      'check_file',
      'check_diff',
      'suggest_placement',
      'infer_spec',
      'explain_finding',
      'propose_spec',
    ]);
    expect(SPEC_TOOL_NAMES).not.toContain('evaluate_project');
    expect(SPEC_TOOL_NAMES).not.toContain('propose_spec');
    expect(SPEC_TOOL_NAMES).toHaveLength(9);
    for (const tool of tools) {
      expect(tool.description?.length).toBeGreaterThan(40);
      expect(tool.inputSchema.type).toBe('object');
    }
    expect(tools.find((t) => t.name === 'check_import')?.inputSchema.required).toEqual([
      'from',
      'module',
    ]);
    expect(tools.find((t) => t.name === 'evaluate_project')?.annotations?.destructiveHint).toBe(
      true,
    );
    expect(tools.find((t) => t.name === 'which_layer')?.annotations?.readOnlyHint).toBe(true);
    await close();
  });

  it('get_architecture_spec returns the spec as structured data and as JSON text', async () => {
    const { client, close } = await connect(context());
    const r = await call(client, 'get_architecture_spec');
    expect(r.isError).toBe(false);
    expect(r.structured?.layerOrder).toEqual(['domain', 'application', 'infrastructure']);
    expect(JSON.parse(r.text)).toEqual(r.structured);
    await close();
  });

  it('which_layer accepts an absolute path inside the configured project', async () => {
    const { client, close } = await connect(context());
    const r = await call(client, 'which_layer', {
      path: path.join(PROJECT, 'src/domain/entities/Task.ts'),
    });
    expect(r.structured).toMatchObject({ path: 'src/domain/entities/Task.ts', layer: 'domain' });
    await close();
  });

  it('check_import reports a violation with rule id and reason', async () => {
    const { client, close } = await connect(context());
    const r = await call(client, 'check_import', {
      from: 'src/domain/entities/Task.ts',
      module: '../../infrastructure/config/InfraConfig',
    });
    expect(r.isError).toBe(false);
    expect(r.structured?.verdict).toBe('violation');
    const first = (r.structured?.violations as { ruleId: string; reason: string }[])[0];
    expect(first?.ruleId).toBe('FF-S01');
    expect(first?.reason).toContain('may not import infrastructure');
    await close();
  });

  it('explain_violation answers from the catalogue and errors on an unknown rule', async () => {
    const { client, close } = await connect(context());
    const ok = await call(client, 'explain_violation', { rule: 'FF-P01' });
    expect(ok.structured).toMatchObject({
      ruleName: 'domain-purity',
      violationType: 'DOMAIN_PURITY_VIOLATION',
    });
    const bad = await call(client, 'explain_violation', { rule: 'nonsense' });
    expect(bad.isError).toBe(true);
    expect(bad.text).toMatch(/Unknown rule "nonsense"/);
    await close();
  });

  it('evaluate_project returns the summary with a mocked pipeline', async () => {
    const { client, close } = await connect(context());
    const r = await call(client, 'evaluate_project');
    expect(r.isError).toBe(false);
    expect(r.structured).toMatchObject({
      ahs: 0.9,
      verdict: 'pass',
      violationCount: 0,
      evaluationMode: 'symbolic-only',
    });
    await close();
  });

  it('evaluate_project is an error result naming Neo4j when it is unreachable', async () => {
    const { client, close } = await connect(context({}, false));
    const r = await call(client, 'evaluate_project');
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(
      /^NEO4J_UNREACHABLE: Neo4j is not reachable at the configured NEO4J_URI/,
    );
    await close();
  });

  it('evaluate_project is an error result when NEO4J_PASSWORD is not set', async () => {
    const { client, close } = await connect(context({ env: {} }));
    const r = await call(client, 'evaluate_project');
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/CONFIG_MISSING_ENV: NEO4J_PASSWORD is not set/);
    await close();
  });

  it('rejects arguments that fail the schema', async () => {
    const { client, close } = await connect(context());
    const result = await client
      .callTool({ name: 'check_import', arguments: { from: 'a.ts' } })
      .catch((e: unknown) => e);
    const failed = result instanceof Error || (result as { isError?: boolean }).isError === true;
    expect(failed).toBe(true);
    await close();
  });

  it('explains a rule even when no spec is configured, and says so for the spec tools', async () => {
    const { client, close } = await connect(context({ defaultSpecPath: undefined }));
    expect((await call(client, 'explain_violation', { rule: 'FF-S01' })).isError).toBe(false);
    const r = await call(client, 'get_architecture_spec');
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/No spec configured/);
    await close();
  });

  it('reports a missing spec file and an invalid spec as errors', async () => {
    const { client, close } = await connect(context());
    const missing = await call(client, 'get_architecture_spec', { spec: '/nope/spec.yaml' });
    expect(missing.isError).toBe(true);
    expect(missing.text).toMatch(/Spec file not found/);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-spec-'));
    const bad = path.join(dir, 'bad.yaml');
    fs.writeFileSync(bad, 'spec_version: "1.0.0"\narchitecture: {}\n');
    const invalid = await call(client, 'get_architecture_spec', { spec: bad });
    expect(invalid.isError).toBe(true);
    expect(invalid.text).toMatch(/Spec is invalid/);
    fs.rmSync(dir, { recursive: true, force: true });
    await close();
  });
});

describe('v1.3 loop tools over an in-memory transport', () => {
  it('check_file returns violations with rule, line, reason and fix', async () => {
    const { client, close } = await connect(context());
    const res = await call(client, 'check_file', {
      path: path.join(PROJECT, 'src/domain/entities/Order.ts'),
      content: "import { Entity } from 'typeorm';\nexport class Order {}",
    });
    expect(res.isError).toBe(false);
    expect(res.structured).toMatchObject({
      path: 'src/domain/entities/Order.ts',
      layer: 'domain',
      verdict: 'violations',
      violations: [{ rule: 'FF-P01', line: 1, subject: 'import "typeorm"' }],
    });
    expect(JSON.parse(res.text)).toEqual(res.structured);
    await close();
  });

  it('check_diff checks a diff and errors on text that is not a diff', async () => {
    const { client, close } = await connect(context());
    const ok = await call(client, 'check_diff', {
      diff: "--- /dev/null\n+++ b/src/domain/Order.ts\n@@ -0,0 +1 @@\n+import 'express';\n",
    });
    expect(ok.structured).toMatchObject({ verdict: 'violations', skipped: [] });
    const bad = await call(client, 'check_diff', { diff: 'hello' });
    expect(bad.isError).toBe(true);
    expect(bad.text).toMatch(/No file found in the diff/);
    await close();
  });

  it('suggest_placement returns placements and requires a purpose', async () => {
    const { client, close } = await connect(context());
    const res = await call(client, 'suggest_placement', { purpose: 'repository for orders' });
    expect(res.structured).toMatchObject({
      placements: [{ layer: 'domain' }, { layer: 'infrastructure' }],
    });
    const missing = await call(client, 'suggest_placement', {});
    expect(missing.isError).toBe(true);
    await close();
  });

  it('propose_spec returns the inferred proposal for the configured or given project, without a spec', async () => {
    const proposeSpec = jest.fn().mockResolvedValue({ label: 'inferred spec, not author-declared', style: 'layered', questions: [], yaml: '# y\n' });
    const { client, close } = await connect(context({ defaultSpecPath: undefined, proposeSpec }));
    const res = await call(client, 'propose_spec', {});
    expect(res.isError).toBe(false);
    expect(res.structured).toMatchObject({ label: 'inferred spec, not author-declared', style: 'layered' });
    expect(proposeSpec).toHaveBeenCalledWith(path.resolve(PROJECT));
    await call(client, 'propose_spec', { project: '/other' });
    expect(proposeSpec).toHaveBeenLastCalledWith(path.resolve('/other'));
    proposeSpec.mockRejectedValueOnce(new Error('no src/'));
    const bad = await call(client, 'propose_spec', {});
    expect(bad.isError).toBe(true);
    expect(bad.text).toMatch(/Cannot infer a spec .*no src\//);
    await close();
    const none = await connect(context({ defaultProjectPath: undefined, proposeSpec }));
    const missing = await call(none.client, 'propose_spec', {});
    expect(missing.text).toMatch(/No project configured/);
    await none.close();
  });

  it('propose_spec infers a real reference project end to end', async () => {
    const { client, close } = await connect(context({ defaultProjectPath: path.resolve('tests/fixtures/v1.3-reference/hexagonal/project') }));
    const res = await call(client, 'propose_spec', {});
    expect(res.structured).toMatchObject({ style: 'hexagonal', check: { valid: true, compiles: true } });
    expect(String(res.structured?.yaml)).toMatch(/^# INFERRED SPEC, NOT AUTHOR-DECLARED/);
    await close();
  }, 60_000);

  it('the loop tools report a missing spec like the others', async () => {
    const { client, close } = await connect(context({ defaultSpecPath: undefined }));
    for (const [name, args] of [
      ['check_file', { path: 'a.ts', content: '' }],
      ['check_diff', { diff: 'x' }],
      ['suggest_placement', { purpose: 'entity' }],
    ] as const) {
      const res = await call(client, name, args);
      expect(res.isError).toBe(true);
      expect(res.text).toMatch(/No spec configured/);
    }
    await close();
  });
});

describe('spec loader', () => {
  it('parses once per modification time and reparses after the file changes', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-spec-'));
    const specPath = path.join(dir, 'spec.yaml');
    fs.copyFileSync(CLEAN_ARCH_SPEC, specPath);
    const load = createSpecLoader();
    const first = await load(specPath);
    const again = await load(specPath);
    expect(first.ok && again.ok && first.data === again.data).toBe(true);
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(specPath, later, later);
    const third = await load(specPath);
    expect(third.ok && first.ok && third.data !== first.data).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('path and argument handling', () => {
  it('makes absolute paths project-relative and leaves relative ones alone', () => {
    const ctx = context();
    expect(toProjectRelative(ctx, path.join(PROJECT, 'src', 'a.ts'))).toEqual({ ok: true, data: 'src/a.ts' });
    expect(toProjectRelative(ctx, './src/a.ts')).toEqual({ ok: true, data: 'src/a.ts' });
    expect(toProjectRelative({ ...ctx, defaultProjectPath: undefined }, 'src/a.ts')).toEqual({ ok: true, data: 'src/a.ts' });
  });

  it('parses --spec and --project in both forms and ignores unknown flags', () => {
    expect(parseArgs(['--spec', 's.yaml', '--project=/p', '--verbose'])).toEqual({
      spec: 's.yaml',
      project: '/p',
    });
    expect(parseArgs([])).toEqual({});
    expect(parseArgs(['--spec'])).toEqual({});
  });

  it('lets flags override the environment defaults', () => {
    const env = { DAEDALUS_SPEC: 'env.yaml', DAEDALUS_PROJECT: '/env' };
    expect(buildContext({}, env)).toMatchObject({
      defaultSpecPath: 'env.yaml',
      defaultProjectPath: '/env',
    });
    expect(buildContext({ spec: 'flag.yaml' }, env)).toMatchObject({
      defaultSpecPath: 'flag.yaml',
      defaultProjectPath: '/env',
    });
  });
});
