/**
 * Pinned per-run tsconfig and the harness-owned tsc launcher (FR-v1.2E-28; SO5; BR-U5a-42).
 *
 * - `buildHarnessTsconfig(cwd)`: the BR-U5a-42 object with `<cwd>` substituted (absolute `typeRoots` and `include`,
 *   because the file lives under `<H>/runs/<runId>/`, outside `cwd`, and automatic `@types` lookup is relative to the
 *   tsconfig's own directory). This content decides the SO5 valid-yield figure; it is stated verbatim in
 *   `Docs/generator-protocol.md`.
 * - `writeHarnessTsconfig(harnessRoot, runId, cwd)`: writes it to `<H>/runs/<runId>/tsconfig.json`.
 * - `writeHarnessTscLauncher(harnessRoot, tscJs, nodeBinary)`: writes `<H>/bin/tsc`, a POSIX `sh` launcher that
 *   execs the given node binary on the pinned skeleton `typescript/lib/tsc.js`; mode `0555`. The type-check of
 *   record never runs a binary inside `cwd` (BR-U5a-48).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { harnessTscPath, harnessTsconfigPath } from './argv.js';
import type { HarnessTsconfig } from './types.js';

export function buildHarnessTsconfig(cwd: string): HarnessTsconfig {
  if (!path.isAbsolute(cwd)) throw new Error('buildHarnessTsconfig: cwd must be absolute');
  const root = cwd.replace(/\/+$/, '');
  return {
    compilerOptions: {
      strict: true,
      target: 'ES2022',
      lib: ['ES2022'],
      module: 'commonjs',
      moduleResolution: 'node',
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      noEmit: true,
      incremental: false,
      typeRoots: [`${root}/node_modules/@types`],
      types: ['node'],
    },
    include: [`${root}/src/**/*.ts`],
  };
}

/** The tsconfig text written by the harness (2-space JSON, trailing newline). */
export function harnessTsconfigText(cwd: string): string {
  return `${JSON.stringify(buildHarnessTsconfig(cwd), null, 2)}\n`;
}

export function writeHarnessTsconfig(harnessRoot: string, runId: string, cwd: string): string {
  const file = harnessTsconfigPath(harnessRoot, runId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.rmSync(file, { force: true });
  fs.writeFileSync(file, harnessTsconfigText(cwd), { mode: 0o444 });
  return file;
}

function shQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** Launcher text: `exec <node> <tsc.js> "$@"`. */
export function harnessTscLauncherText(tscJs: string, nodeBinary: string): string {
  return `#!/bin/sh\nexec ${shQuote(nodeBinary)} ${shQuote(tscJs)} "$@"\n`;
}

export function writeHarnessTscLauncher(harnessRoot: string, tscJs: string, nodeBinary: string): string {
  if (!path.isAbsolute(tscJs) || !path.isAbsolute(nodeBinary)) {
    throw new Error('writeHarnessTscLauncher: tscJs and nodeBinary must be absolute');
  }
  const file = harnessTscPath(harnessRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) fs.chmodSync(file, 0o755);
  fs.writeFileSync(file, harnessTscLauncherText(tscJs, nodeBinary));
  fs.chmodSync(file, 0o555);
  return file;
}
