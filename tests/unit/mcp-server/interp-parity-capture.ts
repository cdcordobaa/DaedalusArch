/**
 * The default-path capture behind `interp-parity-default.test.ts`: check_file, check_diff and check_import on the
 * hexagonal reference project (with and without a project root), with the server context built from no flag and no
 * environment. The golden file was written by this module on untouched `origin/v1.3` (Docs/v1.3/mcp-interp-parity.md
 * §4.2), so the test asserts the default tool outputs did not change. Imports only what `origin/v1.3` has.
 *
 *   npx tsx tests/unit/mcp-server/interp-parity-capture.ts <out.json>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildContext, parseArgs } from '../../../src/mcp-server/context.js';
import { checkDiffTool, checkFileTool, checkImportTool } from '../../../src/mcp-server/tools.js';
import type { ServerContext } from '../../../src/mcp-server/tools.js';

// Under jest (CommonJS) from this file's directory; under tsx (ESM, no __dirname) from the working directory.
export const REPO_ROOT = typeof __dirname === 'string' ? path.resolve(__dirname, '../../..') : process.cwd();
export const HEX = path.join(REPO_ROOT, 'tests/fixtures/v1.3-reference/hexagonal');
export const HEX_SPEC = path.join(HEX, 'spec.yaml');
export const HEX_PROJECT = path.join(HEX, 'project');

export const SERVICE = 'src/application/services/CancelBookingService.ts';
export const OUTBOUND = 'src/adapters/outbound/persistence/InMemoryBookingRepository.ts';

/** A diff that adds an application → adapters-outbound import to an existing service and adds one new file. */
export function captureDiff(): string {
  const old = fs.readFileSync(path.join(HEX_PROJECT, SERVICE), 'utf8').split('\n');
  if (old[old.length - 1] === '') old.pop();
  const added = "import { InMemoryBookingRepository } from '../../adapters/outbound/persistence/InMemoryBookingRepository';";
  const ctxLines = old.slice(0, 3);
  const hunk = [`@@ -1,${String(ctxLines.length)} +1,${String(ctxLines.length + 1)} @@`, `+${added}`, ...ctxLines.map((l) => ` ${l}`)];
  const newFile = ["import { Booking } from '../../domain/model/Booking';", '', 'export class ExportBookings {', '  run(b: Booking): string { return String(b); }', '}'];
  return [
    `diff --git a/${SERVICE} b/${SERVICE}`, `--- a/${SERVICE}`, `+++ b/${SERVICE}`, ...hunk,
    'diff --git a/src/application/services/ExportBookings.ts b/src/application/services/ExportBookings.ts',
    'new file mode 100644', '--- /dev/null', '+++ b/src/application/services/ExportBookings.ts',
    `@@ -0,0 +1,${String(newFile.length)} @@`, ...newFile.map((l) => `+${l}`), '',
  ].join('\n');
}

export const PROPOSED_SERVICE = `import { InMemoryBookingRepository } from '../../adapters/outbound/persistence/InMemoryBookingRepository';\n${fs.readFileSync(path.join(HEX_PROJECT, SERVICE), 'utf8')}`;

function context(argv: readonly string[], env: NodeJS.ProcessEnv): ServerContext {
  return buildContext(parseArgs(argv), env);
}

/** Absolute repository paths replaced by `<repo>` (the golden file is machine-independent). */
function portable(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value).split(REPO_ROOT).join('<repo>'));
}

export async function captureTools(argv: readonly string[], env: NodeJS.ProcessEnv): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [mode, root] of [['project', HEX_PROJECT], ['spec-only', undefined]] as const) {
    const ctx = context([...argv, '--spec', HEX_SPEC, ...(root !== undefined ? ['--project', root] : [])], env);
    out[`${mode}/check_file`] = await checkFileTool(ctx, { path: SERVICE, content: PROPOSED_SERVICE });
    out[`${mode}/check_diff`] = await checkDiffTool(ctx, { diff: captureDiff() });
    out[`${mode}/check_import`] = await checkImportTool(ctx, { from: SERVICE, module: '../../adapters/outbound/persistence/InMemoryBookingRepository' });
  }
  return portable(out) as Record<string, unknown>;
}

if (process.argv[1]?.endsWith('interp-parity-capture.ts') === true) {
  const target = process.argv[2];
  if (target === undefined) throw new Error('usage: interp-parity-capture.ts <out.json>');
  void captureTools([], {}).then((c) => {
    fs.writeFileSync(target, `${JSON.stringify(c, null, 2)}\n`);
  });
}
