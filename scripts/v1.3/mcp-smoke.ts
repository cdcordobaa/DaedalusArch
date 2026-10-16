/**
 * Live smoke test of the MCP v2 server with Claude Code (Docs/v1.3/mcp-smoke.md). Entry file; run on the local machine
 * (it needs the claude CLI, a login, and the network). The dry run needs none of them.
 *
 *   npm run build
 *   npx tsx scripts/v1.3/mcp-smoke.ts --claude "$(command -v claude)" --model <pinned model id> [--cli-version x.y.z]
 *       [--server-entry dist/mcp-server/main.js] [--timeout-ms 900000] [--keep] [--out <dir>]
 *   npx tsx scripts/v1.3/mcp-smoke.ts --dry-run [--behaviour fixes|ignores-block|never-checks]
 *
 * Exit codes: 0 the agent called check_diff or check_file (and the report was written); 1 it never did; 2 setup error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { runSmoke, StubClaudeRunner } from './lib/mcp-smoke.js';

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main(argv: readonly string[]): Promise<number> {
  const repo = process.cwd();
  const dryRun = argv.includes('--dry-run');
  const out = path.resolve(repo, arg(argv, '--out') ?? 'results/v1.3-reference/mcp-v2');
  const behaviour = (arg(argv, '--behaviour') ?? 'fixes') as 'fixes' | 'ignores-block' | 'never-checks';
  const binary = dryRun ? '/usr/bin/claude-stub' : arg(argv, '--claude') ?? process.env.CLAUDE_BIN;
  const modelId = dryRun ? 'stub-model' : arg(argv, '--model');
  if (binary === undefined || modelId === undefined) {
    process.stderr.write('usage: mcp-smoke --claude <abs path> --model <id> [--cli-version x.y.z] | --dry-run\n');
    return 2;
  }
  const serverEntry = path.resolve(repo, arg(argv, '--server-entry') ?? 'dist/mcp-server/main.js');
  const specForStub = path.join(repo, 'specs/clean-arch.yaml');
  const res = await runSmoke({
    repoRoot: repo,
    binary,
    modelId,
    nodeBinary: process.execPath,
    serverEntry,
    timeoutMs: Number(arg(argv, '--timeout-ms') ?? '900000'),
    cliVersion: arg(argv, '--cli-version'),
    runner: dryRun ? new StubClaudeRunner(specForStub, behaviour) : new NodeProcessRunner(),
    parentEnv: process.env,
    keep: argv.includes('--keep'),
    dryRun,
  });
  if (!res.success) {
    process.stderr.write(`${res.errors.map((e) => `${e.code}: ${e.message}`).join('\n')}\n`);
    return 2;
  }
  const r = res.data;
  fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, dryRun ? 'mcp-smoke-dry-run.json' : `mcp-smoke-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, `${JSON.stringify(r, null, 2)}\n`);
  process.stdout.write(
    [
      `${dryRun ? 'DRY RUN (stub agent)' : 'LIVE'}: claude ${r.cliVersion}, exit ${String(r.exitCode)}${r.timedOut ? ' (timed out)' : ''}, ${String(r.transcript.events)} events, ${String(r.transcript.calls.length)} tool calls`,
      `called check_diff/check_file: ${r.verdict.calledCheck ? `yes (${String(r.transcript.checkCalls)})` : 'NO'}`,
      `blocking answers: ${String(r.transcript.blockingAnswers)}; acted on them: ${r.verdict.actedOnBlocking}`,
      `final tree blocking findings: ${r.verdict.finalBlocking.map((f) => `${f.file} (${f.rules.join(', ')})`).join('; ') || 'none'}`,
      `report: ${path.relative(repo, file)}${r.layout.root !== '' && argv.includes('--keep') ? `; run kept in ${r.layout.root}` : ''}`,
      '',
    ].join('\n'),
  );
  return r.verdict.calledCheck ? 0 : 1;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
