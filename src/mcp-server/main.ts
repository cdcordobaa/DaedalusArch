#!/usr/bin/env node
/**
 * Stdio entry of the DaedalusArch MCP prototype (`daedalus-arch-mcp`).
 *
 *   daedalus-arch-mcp --spec <spec.yaml> [--project <dir>] [--neural claude-cli|mock|ensemble ...]
 *
 * `--neural` turns on the neural-arm tools (review_unit, explain_and_fix); off by default. Flags:
 * `neural-context.ts`, Docs/v1.3/neural-arm-agent-tools.md.
 *
 * Environment: DAEDALUS_SPEC / DAEDALUS_PROJECT (defaults for the flags); NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
 * for `evaluate_project` only. stdout carries the protocol, so diagnostics go to stderr.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildContext, parseArgs } from './context.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const server = createServer(buildContext(parseArgs(process.argv.slice(2)), process.env));
  await server.connect(new StdioServerTransport());
  process.stderr.write('daedalus-arch MCP server ready on stdio\n');
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
});
