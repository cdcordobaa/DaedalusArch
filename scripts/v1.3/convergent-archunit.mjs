/**
 * ArchUnitTS child process of `convergent-run.ts` (one project per process, so ArchUnitTS's graph cache is fresh).
 * Usage: node scripts/v1.3/convergent-archunit.mjs <archunit-package-dir> <checks.json> <tsconfig>   (cwd = project)
 * Prints one JSON object: { findings: [[id, file, target]], cycles: [[id, [edges]]], errors: [...] }.
 * The pinned package lives in experiments/validity-convergent/archunit (npm ci there; never committed).
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';

const [pkgDir, checksFile, tsconfig] = process.argv.slice(2);
const require = createRequire(path.join(path.resolve(pkgDir), 'package.json'));
const au = require('archunit');
const checks = JSON.parse(fs.readFileSync(checksFile, 'utf8'));
const opts = { allowEmptyTests: true, ignoreReferencedConfigErrors: true };
const findings = [];
const errors = [];

for (const c of checks) {
  try {
    const from = new RegExp(c.from);
    if (c.op === 'not-depend') {
      const v = await au.projectFiles(tsconfig).inPath(from).shouldNot().dependOnFiles().inPath(new RegExp(c.to)).check(opts);
      for (const x of v) for (const e of x.dependency?.cumulatedEdges ?? []) findings.push([c.id, e.source, e.target]);
    } else if (c.op === 'no-cycles') {
      const v = await au.projectFiles(tsconfig).inPath(from).should().haveNoCycles().check(opts);
      for (const x of v) for (const e of x.cycle ?? []) for (const ce of e.cumulatedEdges ?? []) findings.push([c.id, ce.source, ce.target]);
    } else if (c.op === 'be-in') {
      const v = await au.projectFiles(tsconfig).inPath(from).should().beInPath(new RegExp(c.allowed)).check(opts);
      for (const x of v) {
        const f = x.projectedNode?.label ?? x.fileInfo?.path ?? x.filePath;
        if (typeof f === 'string') findings.push([c.id, f, '']);
        else if (x.message === undefined || !String(x.message).startsWith('No files found')) errors.push({ id: c.id, unparsed: JSON.stringify(x).slice(0, 300) });
      }
    }
  } catch (e) {
    errors.push({ id: c.id, op: c.op, error: String(e?.message ?? e).slice(0, 500) });
  }
}
process.stdout.write(JSON.stringify({ findings, errors }) + '\n');
