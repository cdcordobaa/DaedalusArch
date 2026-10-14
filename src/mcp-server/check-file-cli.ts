#!/usr/bin/env node
/**
 * Local try-out of `check_file` without an MCP client: the same handler, the same JSON.
 *
 *   npx tsx src/mcp-server/check-file-cli.ts --spec specs/clean-arch.yaml <path-in-project> [<file-with-content>]
 *
 * The content is read from `<file-with-content>`, or from stdin when it is omitted. `<path-in-project>` decides the
 * layer. Exit codes: 0 clean, 1 violations or unknown, 2 usage or spec error.
 */
import * as fs from 'node:fs';
import { buildContext, parseArgs } from './context.js';
import { checkFileTool } from './tools.js';
import type { ServerContext } from './tools.js';

export const CHECK_FILE_USAGE =
  'usage: check-file-cli --spec <spec.yaml> [--project <dir>] <path-in-project> [<file-with-content>]\n';

/** Positional arguments: everything that is not `--spec`/`--project` or their values. */
export function positionals(argv: readonly string[]): readonly string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '--spec' || a === '--project') i++;
    else if (!a.startsWith('--')) out.push(a);
  }
  return out;
}

export async function checkFileCli(
  argv: readonly string[],
  ctx: ServerContext,
  readContent: (file: string | undefined) => string,
  write: (s: string) => void,
): Promise<number> {
  const [target, contentFile] = positionals(argv);
  if (target === undefined) {
    write(CHECK_FILE_USAGE);
    return 2;
  }
  const res = await checkFileTool(ctx, { path: target, content: readContent(contentFile) });
  if (!res.ok) {
    write(`${res.message}\n`);
    return 2;
  }
  write(`${JSON.stringify(res.data, null, 2)}\n`);
  return res.data.verdict === 'clean' ? 0 : 1;
}

if (
  process.argv[1]?.endsWith('check-file-cli.ts') === true ||
  process.argv[1]?.endsWith('check-file-cli.js') === true
) {
  const argv = process.argv.slice(2);
  checkFileCli(
    argv,
    buildContext(parseArgs(argv), process.env),
    (file) => fs.readFileSync(file ?? 0, 'utf-8'),
    (s) => process.stdout.write(s),
  ).then(
    (code) => {
      process.exitCode = code;
    },
    (e: unknown) => {
      process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
      process.exitCode = 2;
    },
  );
}
