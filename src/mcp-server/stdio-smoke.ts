#!/usr/bin/env node
/**
 * Stdio smoke of the MCP server with no database (v1.3 npx mode, `Docs/v1.3/npx-mode.md` §3). Starts the server as a
 * child process over stdio with an environment that holds no NEO4J variable, lists the tools and calls
 * get_architecture_spec, suggest_placement, check_file (fast and with `templates`), check_diff and evaluate_project.
 * Each call's wall time is reported; any failed expectation exits 1.
 *
 *   node dist/mcp-server/stdio-smoke.js --spec <spec.yaml> --project <dir> [--server <cmd> [args...]]
 *
 * Default server: `node <this package>/dist/mcp-server/main.js`. The project must have `src/domain/` and
 * `src/infrastructure/` layers (the probe writes nothing; it proposes a domain file importing infrastructure).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface SmokeOptions {
  readonly command: string;
  readonly args: readonly string[];
  readonly specPath: string;
  readonly projectPath: string;
  /** Environment of the server; NEO4J_* entries are removed whatever is passed. */
  readonly env?: NodeJS.ProcessEnv;
  /** Project-relative domain file and an infrastructure file it should not import (defaults: first .ts files found). */
  readonly domainFile?: string;
  readonly infraFile?: string;
}

export interface SmokeStep {
  readonly step: string;
  readonly ok: boolean;
  readonly ms: number;
  readonly detail: string;
}

export interface SmokeReport {
  readonly ok: boolean;
  readonly engineLine: string;
  readonly tools: readonly string[];
  readonly steps: readonly SmokeStep[];
}

function firstTs(dir: string): string | undefined {
  if (!fs.existsSync(dir)) return undefined;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, e.name);
    if (e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) return full;
    if (e.isDirectory()) {
      const f = firstTs(full);
      if (f !== undefined) return f;
    }
  }
  return undefined;
}

function noNeo4j(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (!k.startsWith('NEO4J_') && v !== undefined) out[k] = v;
  return out;
}

type Structured = Record<string, unknown>;

export async function runStdioSmoke(o: SmokeOptions): Promise<SmokeReport> {
  const root = path.resolve(o.projectPath);
  const rel = (f: string): string => path.relative(root, f).split(path.sep).join('/');
  const domainFile = o.domainFile ?? rel(firstTs(path.join(root, 'src', 'domain')) ?? '');
  const infraFile = o.infraFile ?? rel(firstTs(path.join(root, 'src', 'infrastructure')) ?? '');
  const transport = new StdioClientTransport({
    command: o.command,
    args: [...o.args, '--spec', path.resolve(o.specPath), '--project', root],
    env: noNeo4j(o.env ?? process.env),
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', (d: Buffer) => {
    stderr += d.toString();
  });
  const client = new Client({ name: 'daedalus-stdio-smoke', version: '1.0.0' });
  const steps: SmokeStep[] = [];
  const step = async (name: string, f: () => Promise<{ ok: boolean; detail: string }>): Promise<void> => {
    const t0 = performance.now();
    try {
      const r = await f();
      steps.push({ step: name, ok: r.ok, ms: Math.round(performance.now() - t0), detail: r.detail });
    } catch (e) {
      steps.push({ step: name, ok: false, ms: Math.round(performance.now() - t0), detail: e instanceof Error ? e.message : String(e) });
    }
  };
  const call = async (name: string, args: Record<string, unknown>): Promise<{ isError: boolean; data: Structured }> => {
    const r = await client.callTool({ name, arguments: args });
    return { isError: r.isError === true, data: (r.structuredContent ?? {}) as Structured };
  };

  let tools: string[] = [];
  await step('connect', async () => {
    await client.connect(transport);
    return { ok: true, detail: 'initialized' };
  });
  await step('list_tools', async () => {
    tools = (await client.listTools()).tools.map((t) => t.name);
    return { ok: tools.includes('check_file') && tools.includes('evaluate_project'), detail: `${String(tools.length)} tools` };
  });
  await step('get_architecture_spec', async () => {
    const r = await call('get_architecture_spec', {});
    return { ok: !r.isError && Array.isArray(r.data.layers), detail: `${String((r.data.layers as unknown[] | undefined)?.length ?? 0)} layers` };
  });
  await step('suggest_placement', async () => {
    const r = await call('suggest_placement', { purpose: 'repository for orders' });
    return { ok: !r.isError, detail: r.isError ? 'error' : 'placement returned' };
  });
  await step('evaluate_project', async () => {
    const r = await call('evaluate_project', {});
    return {
      ok: !r.isError && r.data.engine === 'cypher-interp',
      detail: r.isError ? 'error' : `engine=${String(r.data.engine)} verdict=${String(r.data.verdict)} violations=${String(r.data.violationCount)} cache=${String(r.data.cache)}`,
    };
  });
  await step('evaluate_project (cached)', async () => {
    const r = await call('evaluate_project', {});
    return { ok: !r.isError && r.data.cache === 'hit', detail: `cache=${String(r.data.cache)}` };
  });
  const leakSpecifier = path.posix.relative(path.posix.dirname(domainFile), infraFile).replace(/\.ts$/, '');
  const leak = `import * as infra from '${leakSpecifier.startsWith('.') ? leakSpecifier : `./${leakSpecifier}`}';\n\nexport const leaked = infra;\n`;
  await step('check_file (fast)', async () => {
    const r = await call('check_file', { path: domainFile, content: leak });
    return { ok: !r.isError && r.data.blockingVerdict === 'block', detail: `blockingVerdict=${String(r.data.blockingVerdict)}` };
  });
  await step('check_file (templates)', async () => {
    const r = await call('check_file', { path: domainFile, content: leak, templates: true });
    const t = (r.data.templates ?? {}) as Structured;
    return {
      ok: !r.isError && t.status === 'checked' && t.blockingVerdict === 'block',
      detail: `templates.status=${String(t.status)} blockingVerdict=${String(t.blockingVerdict)} introduced=${String((t.introduced as unknown[] | undefined)?.length ?? 0)} latency=${JSON.stringify(t.latencyMs)}`,
    };
  });
  await step('check_diff (templates)', async () => {
    const lines = leak.trimEnd().split('\n');
    const diff = [`--- /dev/null`, `+++ b/${path.posix.join(path.posix.dirname(domainFile), 'SmokeLeak.ts')}`, `@@ -0,0 +1,${String(lines.length)} @@`, ...lines.map((l) => `+${l}`), ''].join('\n');
    const r = await call('check_diff', { diff, templates: true });
    const t = (r.data.templates ?? {}) as Structured;
    return { ok: !r.isError && t.status === 'checked' && t.blockingVerdict === 'block', detail: `blockingVerdict=${String(r.data.blockingVerdict)} templates.blockingVerdict=${String(t.blockingVerdict)}` };
  });
  await client.close().catch(() => undefined);
  const engineLine = stderr.split('\n').find((l) => l.startsWith('daedalus: graph engine')) ?? '';
  steps.push({ step: 'engine line', ok: engineLine.includes('cypher-interp'), ms: 0, detail: engineLine });
  return { ok: steps.every((s) => s.ok), engineLine, tools, steps };
}

function argValue(argv: readonly string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('stdio-smoke.js') || entry.endsWith('stdio-smoke.ts')) {
  const self = fs.realpathSync(entry);
  const argv = process.argv.slice(2);
  const spec = argValue(argv, '--spec');
  const project = argValue(argv, '--project');
  if (spec === undefined || project === undefined) {
    process.stderr.write('usage: stdio-smoke --spec <spec.yaml> --project <dir> [--server <cmd> [args...]]\n');
    process.exit(2);
  }
  const s = argv.indexOf('--server');
  const server = s >= 0 ? argv.slice(s + 1) : [process.execPath, path.join(path.dirname(self), self.endsWith('.ts') ? 'main.ts' : 'main.js')];
  runStdioSmoke({ command: server[0] ?? process.execPath, args: server.slice(1), specPath: spec, projectPath: project }).then(
    (r) => {
      process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
      process.exitCode = r.ok ? 0 : 1;
    },
    (e: unknown) => {
      process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
      process.exitCode = 2;
    },
  );
}
