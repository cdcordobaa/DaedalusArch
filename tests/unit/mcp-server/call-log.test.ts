/**
 * MCP call log (Docs/v1.3/mcp-call-log.md): off by default with byte-identical answers; with a logger, one line per
 * call holding hashes and paths only.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { argsSha256, checkCallLogPath, fileCallLogger, filesTouched } from '../../../src/mcp-server/call-log.js';
import type { CallLogEntry, CallLogger } from '../../../src/mcp-server/call-log.js';
import { callLogPath, parseArgs } from '../../../src/mcp-server/context.js';
import { createServer } from '../../../src/mcp-server/server.js';
import { createSpecLoader } from '../../../src/mcp-server/tools.js';
import type { ServerContext } from '../../../src/mcp-server/tools.js';
import { CLEAN_ARCH_SPEC, FIXTURES } from './helpers.js';

const PROJECT = path.join(FIXTURES, 'variant-a-structural');
const SECRET_CONTENT = "import { Repository } from 'typeorm';\nexport class Task { /* call-log-canary */ }\n";

function context(over: Partial<ServerContext> = {}): ServerContext {
  return {
    defaultSpecPath: CLEAN_ARCH_SPEC,
    defaultProjectPath: PROJECT,
    env: {},
    loadSpec: createSpecLoader(),
    evaluateDeps: {
      makeGraph: () => ({ executeQuery: jest.fn(), clearGraph: jest.fn(), healthCheck: jest.fn().mockResolvedValue(false), close: jest.fn().mockResolvedValue(undefined) }),
      makePipeline: () => ({ executor: { execute: () => Promise.resolve(DomainResult.ok({})) } as never, cleanup: () => Promise.resolve() }),
      connectTimeoutMs: 50,
    },
    ...over,
  };
}

function memoryLogger(fingerprints: (string | null)[] = []): CallLogger & { readonly lines: CallLogEntry[] } {
  const lines: CallLogEntry[] = [];
  let t = Date.parse('2026-10-16T00:00:00Z');
  let i = 0;
  return {
    lines,
    record: (e) => lines.push(e),
    now: () => (t += 5),
    fingerprint: () => fingerprints[i++] ?? 'fp-start',
    startFingerprint: 'fp-start',
  };
}

async function connect(ctx: ServerContext): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createServer(ctx);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [c, s] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(s), client.connect(c)]);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

const DIFF = [
  '--- /dev/null',
  '+++ b/src/domain/entities/Order.ts',
  '@@ -0,0 +1,2 @@',
  "+import { Repository } from 'typeorm';",
  '+export class Order { /* call-log-canary */ }',
  '',
].join('\n');

const CALLS: readonly [string, Record<string, unknown>][] = [
  ['get_architecture_spec', {}],
  ['which_layer', { path: 'src/domain/entities/Task.ts' }],
  ['check_import', { from: 'src/domain/entities/Task.ts', module: '../../infrastructure/config/InfraConfig' }],
  ['check_file', { path: 'src/domain/entities/Task.ts', content: SECRET_CONTENT }],
  ['check_diff', { diff: DIFF }],
  ['explain_violation', { rule: 'FF-S01' }],
  ['which_layer', { path: 'x.ts', spec: '/nonexistent/spec.yaml' }],
];

async function runCalls(ctx: ServerContext): Promise<{ tools: unknown; results: unknown[] }> {
  const { client, close } = await connect(ctx);
  const { tools } = await client.listTools();
  const results: unknown[] = [];
  for (const [name, args] of CALLS) results.push(await client.callTool({ name, arguments: args }));
  await close();
  return { tools, results };
}

describe('MCP call log', () => {
  it('leaves the tool list and every answer identical (golden: the server without the option)', async () => {
    const golden = await runCalls(context());
    const logged = await runCalls(context({ callLog: memoryLogger() }));
    expect(logged.tools).toEqual(golden.tools);
    expect(logged.results).toEqual(golden.results);
  });

  it('writes one line per call: hashes, paths, verdict and count, never the content or the diff', async () => {
    const logger = memoryLogger(['fp-start', 'fp-start', 'fp-changed']);
    await runCalls(context({ callLog: logger }));
    expect(logger.lines.map((l) => l.tool)).toEqual(CALLS.map(([n]) => n));
    expect(logger.lines.map((l) => l.seq)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const text = JSON.stringify(logger.lines);
    expect(text).not.toContain('call-log-canary');
    expect(text).not.toContain('typeorm');
    for (const [i, l] of logger.lines.entries()) {
      expect(l.schema).toBe('mcp-call/v1');
      expect(l.argsSha256).toBe(argsSha256(CALLS[i]?.[1]));
      expect(l.durationMs).toBe(5);
    }
    expect(logger.lines[1]?.filesTouched).toEqual(['src/domain/entities/Task.ts']);
    expect(logger.lines[2]?.verdict).toBe('block');
    expect(logger.lines[3]?.verdict).toBe('block');
    expect(logger.lines[3]?.blockingCount).toBeGreaterThan(0);
    expect(logger.lines[4]?.filesTouched).toEqual(['src/domain/entities/Order.ts']);
    expect(logger.lines[6]?.error).toMatch(/Spec file not found/);
    expect(logger.lines.map((l) => l.treeChangedSinceStart)).toEqual([false, false, true, false, false, false, false]);
  });

  it('hashes canonical JSON (key order does not matter) and extracts only paths', () => {
    expect(argsSha256({ a: 1, b: [{ y: 2, x: 1 }] })).toBe(argsSha256({ b: [{ x: 1, y: 2 }], a: 1 }));
    expect(filesTouched({ paths: ['b.ts', 'a.ts'], content: 'x', finding: { filePath: 'c.ts' } })).toEqual(['a.ts', 'b.ts', 'c.ts']);
    expect(filesTouched('nope')).toEqual([]);
  });

  it('refuses a relative path or one inside the project; reads --call-log and DAEDALUS_CALL_LOG', () => {
    expect(checkCallLogPath('calls.jsonl', '/p')).toMatch(/absolute/);
    expect(checkCallLogPath('/p/logs/calls.jsonl', '/p')).toMatch(/outside --project/);
    expect(checkCallLogPath('/p', '/p')).toMatch(/outside --project/);
    expect(checkCallLogPath('/h/calls.jsonl', '/p')).toBeNull();
    expect(callLogPath(parseArgs(['--spec', 's']), {})).toBeUndefined();
    expect(callLogPath(parseArgs(['--call-log', '/h/a.jsonl']), { DAEDALUS_CALL_LOG: '/h/b.jsonl' })).toBe('/h/a.jsonl');
    expect(callLogPath(parseArgs([]), { DAEDALUS_CALL_LOG: '/h/b.jsonl' })).toBe('/h/b.jsonl');
  });

  it('the file logger creates the log empty at start and fingerprints the project tree', async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'call-log-')));
    const project = path.join(root, 'work');
    fs.mkdirSync(path.join(project, 'src'), { recursive: true });
    fs.writeFileSync(path.join(project, 'src', 'a.ts'), 'export const a = 1;\n');
    const log = path.join(root, 'calls', 'step-01.jsonl');
    const logger = fileCallLogger(log, project);
    expect(fs.readFileSync(log, 'utf8')).toBe('');
    expect(logger.fingerprint()).toBe(logger.startFingerprint);
    fs.writeFileSync(path.join(project, 'src', 'b.ts'), 'export const b = 2;\n');
    expect(logger.fingerprint()).not.toBe(logger.startFingerprint);
    const { client, close } = await connect(context({ defaultProjectPath: project, callLog: logger }));
    await client.callTool({ name: 'get_architecture_spec', arguments: {} });
    await close();
    const lines = fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as CallLogEntry);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ tool: 'get_architecture_spec', treeChangedSinceStart: true, error: null });
    fs.rmSync(root, { recursive: true, force: true });
  });
});
