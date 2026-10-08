/**
 * CLI entry of the corpus rubric step (D-U4-10): no exports, no direct-run guard.
 * Usage: npx tsx scripts/corpus-rubric-u4-cli.ts [--check] <file>...  |  --self-test
 * Exit codes: 0 = every file carries the U4 rubric (edits written when not `--check`); 2 = a target was left
 * untouched or a file still carries the old rubric afterwards; 1 = usage or I/O error, or `--self-test`
 * (the built-in spec with the old name must fail the assertion; exit 1 means it did).
 */
import * as fs from 'node:fs';
import { applyRubric, assertNoOldRubric, SELF_TEST_SPEC } from './corpus-rubric-u4.js';

function run(argv: readonly string[]): number {
  const out = (s: string): void => { process.stdout.write(s); };
  const err = (s: string): void => { process.stderr.write(s); };

  if (argv.includes('--self-test')) {
    try {
      assertNoOldRubric(SELF_TEST_SPEC);
      out('self-test: old rubric NOT detected\n');
      return 0;
    } catch (e) {
      out(`self-test: ${e instanceof Error ? e.message : String(e)}\n`);
      return 1;
    }
  }

  const check = argv.includes('--check');
  const files = argv.filter((a) => !a.startsWith('--'));
  if (files.length === 0 || argv.some((a) => a.startsWith('--') && a !== '--check')) {
    err('usage: npx tsx scripts/corpus-rubric-u4-cli.ts [--check] <file>... | --self-test\n');
    return 1;
  }

  let code = 0;
  for (const file of files) {
    try {
      const before = fs.readFileSync(file, 'utf-8');
      const r = applyRubric(before);
      const after = check ? before : r.text;
      if (!check && r.edited) fs.writeFileSync(file, r.text);
      for (const p of r.editedPaths) out(`${check ? 'would edit' : 'edited'} ${file}: ${p}\n`);
      for (const u of r.untouched) out(`untouched ${file}: ${u}\n`);
      if (!r.edited && r.untouched.length === 0) out(`no change ${file}\n`);
      if (r.untouched.length > 0 || (check && r.edited)) code = Math.max(code, 2);
      try { assertNoOldRubric(after); } catch (e) {
        err(`${file}: ${e instanceof Error ? e.message : String(e)}\n`);
        code = Math.max(code, 2);
      }
    } catch (e) {
      err(`${file}: ${e instanceof Error ? e.message : String(e)}\n`);
      return 1;
    }
  }
  return code;
}

process.exitCode = run(process.argv.slice(2));
