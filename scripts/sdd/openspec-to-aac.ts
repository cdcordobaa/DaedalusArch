/**
 * OpenSpec -> DaedalusArch architecture-as-code (Docs/v1.3/sdd-demo.md).
 *
 *   npx tsx scripts/sdd/openspec-to-aac.ts --project <dir> [--changes a,b] [--presets presets] [--out <file>] [--check]
 *
 * Reads the "## Architecture" sections of `openspec/changes/archive/<change>/design.md` and of the active changes
 * (all, or those in --changes) and writes the spec YAML (stdout when --out is omitted). --check compares with --out
 * instead of writing it. Exit codes: 0 ok, 1 --check found a difference, 2 an artifact or argument error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { convert, openSpecDesignFiles } from './lib/sdd-sources.js';

const GENERATOR = 'scripts/sdd/openspec-to-aac.ts';

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export function openSpecToAac(projectRoot: string, presetsDir: string, changes?: readonly string[]): ReturnType<typeof convert> {
  const files = openSpecDesignFiles(projectRoot, changes);
  return files.ok ? convert(files.value, presetsDir, GENERATOR) : files;
}

export function main(argv: readonly string[], cwd: string, out: (t: string) => void, err: (t: string) => void): number {
  const project = arg(argv, '--project');
  if (project === undefined) {
    err('usage: openspec-to-aac --project <dir> [--changes a,b] [--presets <dir>] [--out <file>] [--check]\n');
    return 2;
  }
  const changes = arg(argv, '--changes')?.split(',').map((c) => c.trim()).filter((c) => c !== '');
  const res = openSpecToAac(path.resolve(cwd, project), path.resolve(cwd, arg(argv, '--presets') ?? 'presets'), changes);
  if (!res.ok) {
    err(`${res.errors.map((e) => `error: ${e}`).join('\n')}\n`);
    return 2;
  }
  const target = arg(argv, '--out');
  if (target === undefined) {
    out(res.value.yaml);
    return 0;
  }
  const abs = path.resolve(cwd, target);
  if (argv.includes('--check')) {
    const same = fs.existsSync(abs) && fs.readFileSync(abs, 'utf8') === res.value.yaml;
    err(same ? `${target}: up to date\n` : `${target}: differs from the design artifacts; regenerate it\n`);
    return same ? 0 : 1;
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, res.value.yaml);
  err(`wrote ${target} from ${String(res.value.inputs.length)} design artifact(s)\n`);
  return 0;
}

if (process.argv[1]?.endsWith('openspec-to-aac.ts') === true) {
  process.exitCode = main(process.argv.slice(2), process.cwd(), (t) => process.stdout.write(t), (t) => process.stderr.write(t));
}
