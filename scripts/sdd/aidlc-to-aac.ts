/**
 * AWS AI-DLC application design -> DaedalusArch architecture-as-code (Docs/v1.3/sdd-demo.md).
 *
 *   npx tsx scripts/sdd/aidlc-to-aac.ts --project <dir> [--presets presets] [--out <file>] [--check]
 *
 * Reads the "## Architecture" sections of `aidlc-docs/inception/application-design/` (application-design.md,
 * components.md, component-dependency.md) and of each unit's `construction/<unit>/functional-design/*.md`.
 * Exit codes as openspec-to-aac.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { aidlcDesignFiles, convert } from './lib/sdd-sources.js';

const GENERATOR = 'scripts/sdd/aidlc-to-aac.ts';

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export function aidlcToAac(projectRoot: string, presetsDir: string): ReturnType<typeof convert> {
  const files = aidlcDesignFiles(projectRoot);
  return files.ok ? convert(files.value, presetsDir, GENERATOR) : files;
}

export function main(argv: readonly string[], cwd: string, out: (t: string) => void, err: (t: string) => void): number {
  const project = arg(argv, '--project');
  if (project === undefined) {
    err('usage: aidlc-to-aac --project <dir> [--presets <dir>] [--out <file>] [--check]\n');
    return 2;
  }
  const res = aidlcToAac(path.resolve(cwd, project), path.resolve(cwd, arg(argv, '--presets') ?? 'presets'));
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

if (process.argv[1]?.endsWith('aidlc-to-aac.ts') === true) {
  process.exitCode = main(process.argv.slice(2), process.cwd(), (t) => process.stdout.write(t), (t) => process.stderr.write(t));
}
