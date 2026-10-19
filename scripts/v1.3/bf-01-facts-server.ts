/**
 * BF-01 read-only fact server (ops/notes/bf-01-brownfield-norm-derivation.md §5, arm G). Stdio MCP server
 * `daedalus-facts` over the spec-free parser graph A1 of one project (`lib/bf-01-facts.ts`, engine cypher-interp).
 *
 *   tsx scripts/v1.3/bf-01-facts-server.ts --project <abs analysis root> [--call-log <abs jsonl outside the project>]
 *
 * Five tools, all read-only: folder_dependency_matrix, fan_in, class_suffix_stats, implements_by_folder, query_graph.
 * It exposes no verdict, no spec, no inferred spec and no mined rule (unlike src/mcp-server: infer_spec, propose_spec
 * and propose_rules would hand G the M baseline). The call log keeps tool name, argument hash, duration and error.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  FACTS_SERVER, GRAPH_SCHEMA_NOTE, buildFactsGraph, classSuffixStats, fanIn, folderDependencyMatrix, implementsByFolder, readOnlyQuery,
} from './lib/bf-01-facts.js';
import type { FactsGraph } from './lib/bf-01-facts.js';

const argv = process.argv.slice(2);
const arg = (n: string): string | undefined => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };

type Register = (name: string, config: { title: string; description: string; inputSchema: z.ZodRawShape; annotations: Record<string, boolean> }, handler: (args: unknown) => Promise<CallToolResult>) => unknown;

async function main(): Promise<void> {
  const project = arg('--project');
  if (project === undefined || !path.isAbsolute(project)) {
    process.stderr.write('Error: --project <absolute path> is required\n');
    process.exit(2);
  }
  const logPath = arg('--call-log');
  if (logPath !== undefined && (!path.isAbsolute(logPath) || path.resolve(logPath).startsWith(path.resolve(project) + path.sep))) {
    process.stderr.write('Error: --call-log must be absolute and outside the project\n');
    process.exit(2);
  }
  const graph: Promise<FactsGraph> = buildFactsGraph(project);
  graph.catch(() => undefined);
  let seq = 0;
  const server = new McpServer({ name: FACTS_SERVER, version: '0.1.0' });
  const reg = server.registerTool.bind(server) as unknown as Register;
  const ro = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  const wrap = (name: string, fn: (g: FactsGraph, a: Record<string, unknown>) => Promise<unknown>) => async (args: unknown): Promise<CallToolResult> => {
    const t0 = Date.now();
    let error: string | null = null;
    let out: CallToolResult;
    try {
      const data = await fn(await graph, (args ?? {}) as Record<string, unknown>);
      out = { content: [{ type: 'text', text: JSON.stringify(data, null, 1) }] };
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      out = { content: [{ type: 'text', text: `Error: ${error}` }], isError: true };
    }
    if (logPath !== undefined) {
      const line = { schema: 'bf01-facts-call/v1', ts: new Date().toISOString(), seq: ++seq, tool: name, args: args ?? {}, argsSha256: createHash('sha256').update(JSON.stringify(args ?? {})).digest('hex'), durationMs: Date.now() - t0, error: error === null ? null : error.slice(0, 300) };
      fs.appendFileSync(logPath, `${JSON.stringify(line)}\n`);
    }
    return out;
  };
  const depth = z.number().int().min(1).max(6).optional().describe('Folder depth in path segments from the analysis root (default 2, e.g. "src/app").');
  const prefix = z.string().optional().describe('Only files under this folder (relative to the analysis root), e.g. "src/app".');

  reg('folder_dependency_matrix', {
    title: 'Folder dependency matrix',
    description: `Import edges between folders of the project's parser graph, at a folder depth: for each (from folder, to folder) the number of file-to-file import edges, how many are type-only, and how many distinct files import; plus the npm packages each folder imports. Read-only. ${GRAPH_SCHEMA_NOTE}`,
    inputSchema: { depth, prefix, include_packages: z.boolean().optional().describe('Also list package imports per folder (default true).') },
    annotations: ro,
  }, wrap('folder_dependency_matrix', (g, a) => folderDependencyMatrix(g, a)));

  reg('fan_in', {
    title: 'Fan-in per file',
    description: 'Files ranked by the number of distinct project files that import them. Read-only.',
    inputSchema: { top: z.number().int().min(1).max(200).optional().describe('How many files (default 20).'), prefix },
    annotations: ro,
  }, wrap('fan_in', (g, a) => fanIn(g, a)));

  reg('class_suffix_stats', {
    title: 'Class-name and file-name suffixes per folder',
    description: 'Per folder: counts of the last CamelCase word of declared class and interface names (e.g. Repository, Controller, UseCase), and counts of file-name suffixes (e.g. "service" in x.service.ts). Read-only.',
    inputSchema: { depth, prefix },
    annotations: ro,
  }, wrap('class_suffix_stats', (g, a) => classSuffixStats(g, a)));

  reg('implements_by_folder', {
    title: 'IMPLEMENTS and EXTENDS by folder',
    description: 'IMPLEMENTS and EXTENDS edges aggregated by (folder of the class, folder of the implemented or extended type). Shows where ports are declared and where adapters implement them. Read-only.',
    inputSchema: { depth, prefix },
    annotations: ro,
  }, wrap('implements_by_folder', (g, a) => implementsByFolder(g, a)));

  reg('query_graph', {
    title: 'Read-only Cypher on the parser graph',
    description: `Run one read-only Cypher query (MATCH ... RETURN) on the project's parser graph, in process. At most 200 rows; write clauses are refused. Use it for the counts you cite as stat evidence: a query that returns one row with columns numerator and denominator. ${GRAPH_SCHEMA_NOTE}`,
    inputSchema: { cypher: z.string().min(1).describe('A read-only Cypher query.') },
    annotations: ro,
  }, wrap('query_graph', async (g, a) => readOnlyQuery(g, String(a.cypher))));

  await server.connect(new StdioServerTransport());
  process.stderr.write(`${FACTS_SERVER} ready on stdio\n`);
}

main().catch((e: unknown) => {
  process.stderr.write(`Fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(2);
});
