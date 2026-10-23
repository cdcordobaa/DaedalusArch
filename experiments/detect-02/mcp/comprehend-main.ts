#!/usr/bin/env node
/**
 * Stdio entry of the COMPREHEND-01 graph-tool server (`comprehend-server.ts`): the four comprehension tools, or with
 * `--with-frozen` also the frozen tools and `check_consistency`; with `--with-callers` (GRAPH-SCALE) also `callers`.
 *   npx tsx experiments/detect-02/mcp/comprehend-main.ts --project <dir> --spec <spec.yaml> [--tsconfig <tsconfig>] --confine [--call-log <abs path>] [--with-frozen] [--with-callers]
 * stdout carries the protocol; diagnostics go to stderr.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { checkCallLogPath } from '../../../src/mcp-server/call-log.js';
import { callLogPath, parseArgs } from '../../../src/mcp-server/context.js';
import { createComprehendServer } from './comprehend-server.js';
import { contextFrom } from './server.js';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const withFrozen = argv.includes('--with-frozen');
  const withCallers = argv.includes('--with-callers');
  const rest = argv.filter((a) => a !== '--with-frozen' && a !== '--with-callers');
  const args = parseArgs(rest);
  const logPath = callLogPath(args, process.env);
  if (logPath !== undefined) {
    const bad = checkCallLogPath(logPath, args.project ?? process.env.DAEDALUS_PROJECT);
    if (bad !== null) { process.stderr.write(`Error: ${bad}\n`); process.exit(2); }
  }
  const server = createComprehendServer(contextFrom(withFrozen ? rest : [...rest, '--engine', 'cypher-interp']), { withFrozen, withCallers });
  await server.connect(new StdioServerTransport());
  process.stderr.write(`daedalus-graph MCP server (COMPREHEND-01 experimental${withFrozen ? ', with the frozen tools' : ''}) ready on stdio\n`);
}
main().catch((e: unknown) => { process.stderr.write(`Fatal: ${e instanceof Error ? e.message : String(e)}\n`); process.exit(2); });
