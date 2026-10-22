/**
 * PUZZLE-01 behaviour-test runner (zero calls). Loads a puzzle's `tests/behaviour.ts` and the tree's entry module
 * (`puzzle.json` → `entry`, which exports `createApp`), and runs every case against a fresh app.
 *
 * Usage (repository root):
 *   npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle <puzzle dir> --tree <tree dir>
 * Prints one JSON object { passed, failed, cases: [{ name, kind, ok, error? }] }; exit 0 iff every case passed.
 * Case kinds: `regression` (behaviour the seed already has) and `feature` (behaviour the tasks ask for).
 * `puzzle.json` → `vendorModules` ({ name: dir }) names runtime stand-ins for vendor packages whose typings the seed
 * carries (for example a fake SDK): the tree is then copied to a scratch directory and each stand-in is placed at
 * `node_modules/<name>` next to it, so the tree's own imports resolve to it.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

export interface TestCase {
  readonly name: string;
  readonly kind: 'regression' | 'feature';
  readonly step?: string;
  readonly run: (createApp: (options?: Record<string, unknown>) => unknown) => void | Promise<void>;
}

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

async function main(): Promise<number> {
  const puzzleArg = arg('puzzle');
  const treeArg = arg('tree');
  if (puzzleArg === undefined || treeArg === undefined) {
    process.stderr.write('usage: run-tests.ts --puzzle <dir> --tree <dir>\n');
    return 2;
  }
  const puzzle = path.resolve(puzzleArg);
  const meta = JSON.parse(fs.readFileSync(path.join(puzzle, 'puzzle.json'), 'utf8')) as { entry: string; vendorModules?: Record<string, string> };
  let tree = path.resolve(treeArg);
  if (meta.vendorModules !== undefined) {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'puzzle-01-tests-'));
    fs.cpSync(tree, path.join(scratch, 'tree'), { recursive: true });
    tree = path.join(scratch, 'tree');
    for (const [name, dir] of Object.entries(meta.vendorModules)) fs.cpSync(path.join(puzzle, dir), path.join(tree, 'node_modules', name), { recursive: true });
    process.on('exit', () => fs.rmSync(scratch, { recursive: true, force: true }));
  }
  const tests = (await import(pathToFileURL(path.join(puzzle, 'tests', 'behaviour.ts')).href)) as { cases: TestCase[] };
  const entry = (await import(pathToFileURL(path.join(tree, meta.entry)).href)) as { createApp?: TestCase['run'] extends (c: infer C) => unknown ? C : never };
  const results: { name: string; kind: string; step: string | null; ok: boolean; error?: string }[] = [];
  for (const c of tests.cases) {
    try {
      if (typeof entry.createApp !== 'function') throw new Error(`${meta.entry} exports no createApp`);
      await c.run(entry.createApp);
      results.push({ name: c.name, kind: c.kind, step: c.step ?? null, ok: true });
    } catch (e) {
      results.push({ name: c.name, kind: c.kind, step: c.step ?? null, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  const failed = results.filter((r) => !r.ok).length;
  process.stdout.write(`${JSON.stringify({ passed: results.length - failed, failed, cases: results })}\n`);
  return failed === 0 ? 0 : 1;
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
});
