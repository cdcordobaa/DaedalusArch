#!/usr/bin/env node
/**
 * Stdio entry of the DaedalusArch MCP prototype (`daedalus-arch-mcp`).
 *
 *   daedalus-arch-mcp --spec <spec.yaml> [--project <dir>] [--engine neo4j|cypher-interp]
 *
 * Environment: DAEDALUS_SPEC / DAEDALUS_PROJECT (defaults for the flags). Engine (v1.3 npx mode): `--engine`, else
 * neo4j when NEO4J_URI is set (then NEO4J_USER, NEO4J_PASSWORD), else cypher-interp (in process, no database). Only
 * `evaluate_project` and the `templates` option of check_file/check_diff read a graph. stdout carries the protocol,
 * so diagnostics go to stderr.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildContext, parseArgs, serverEngine } from './context.js';
import { createServer } from './server.js';
import { engineLine } from '../cli/engine-default.js';
import { GRAPH_ENGINES } from '../cypher-interp/engine.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const engine = serverEngine(args, process.env);
  if (engine === undefined) {
    process.stderr.write(`Error: --engine must be one of ${GRAPH_ENGINES.join(' | ')}\n`);
    process.exit(2);
  }
  process.stderr.write(engineLine(engine));
  const server = createServer(buildContext(args, process.env));
  await server.connect(new StdioServerTransport());
  process.stderr.write('daedalus-arch MCP server ready on stdio\n');
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
});
