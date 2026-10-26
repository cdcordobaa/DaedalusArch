#!/usr/bin/env node
/**
 * Stdio entry of the v1.5 MCP server (promoted from `experiments/detect-02/mcp/main.ts`): the frozen server's flags,
 * unchanged, plus `check_consistency`. The frozen v1.4 server stays `src/mcp-server/main.ts` (`npm run mcp`).
 *   npx tsx src/v15-instrument/mcp/main.ts --spec <spec.yaml> --project <dir> --engine cypher-interp --confine [--call-log <abs path>]
 * stdout carries the protocol; diagnostics go to stderr.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { checkCallLogPath } from '../../mcp-server/call-log.js';
import { callLogPath, parseArgs, serverEngine } from '../../mcp-server/context.js';
import { contextFrom, createDetectServer } from './server.js';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  if (serverEngine(args, process.env) === undefined) { process.stderr.write('Error: --engine must be neo4j or cypher-interp\n'); process.exit(2); }
  const logPath = callLogPath(args, process.env);
  if (logPath !== undefined) {
    const bad = checkCallLogPath(logPath, args.project ?? process.env.DAEDALUS_PROJECT);
    if (bad !== null) { process.stderr.write(`Error: ${bad}\n`); process.exit(2); }
  }
  const server = createDetectServer(contextFrom(argv));
  await server.connect(new StdioServerTransport());
  process.stderr.write('daedalus-arch MCP server (v1.5 instrument, + check_consistency) ready on stdio\n');
}
main().catch((e: unknown) => { process.stderr.write(`Fatal: ${e instanceof Error ? e.message : String(e)}\n`); process.exit(2); });
