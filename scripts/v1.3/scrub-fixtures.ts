/**
 * V11: writes a comment-free copy of a fixture tree (scripts/v1.3/lib/fixture-scrub.ts). Line numbers are kept;
 * reference variant patches are rewritten so they apply to the scrubbed project. The source is never written.
 * Off by default: nothing runs it; a blind writer, judge or rater harness opts in by reading the copy.
 *
 * Usage (repository root): npx tsx scripts/v1.3/scrub-fixtures.ts <src> <dst>
 *   e.g. npx tsx scripts/v1.3/scrub-fixtures.ts tests/fixtures/v1.3-reference /tmp/ref-scrubbed
 * Exit 0 ok, 1 a file could not be scrubbed (nothing half-written is left), 2 usage.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { scrubTree } from './lib/fixture-scrub.js';

const [src, dst] = process.argv.slice(2);
if (src === undefined || dst === undefined) {
  process.stderr.write('usage: scrub-fixtures.ts <src> <dst>\n');
  process.exit(2);
}
if (path.resolve(src).split(path.sep).includes('daedalus-sealed')) {
  process.stderr.write('refusing to read under daedalus-sealed/\n');
  process.exit(2);
}
try {
  const s = scrubTree(src, dst);
  process.stdout.write(`scrubbed ${String(s.sourceFiles)} source file(s) (${String(s.sourceFilesChanged)} had comments), ${String(s.patches)} patch(es) (${String(s.patchesChanged)} changed), copied ${String(s.copied)} other file(s) -> ${path.resolve(dst)}\n`);
} catch (e) {
  fs.rmSync(dst, { recursive: true, force: true });
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
}
