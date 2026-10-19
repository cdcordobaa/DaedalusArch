/**
 * v1.4 TIER-A3 (REV-04 P15): which of the 7 DDD blocking rules can fire on each kept loop-pilot DDD snapshot under the
 * declared-aggregate spec (`dc`), read from the tree's file list and the spec's globs only. Entry file: no exports.
 * Report: `Docs/DiagnosticRuns/v1.4-ddd-b2-and-v9-2026-10-19.md` §3.3.
 *
 * Usage (repository root), after `ddd-b2-t1-rescore.ts` has written the spec variants:
 *   npx tsx scripts/v1.4/ddd-b2-rule-reach.ts [--dest results/v1.4-ddd-b2-v9]
 *
 * Zero model calls, no evaluation. A rule "can fire" when the files its template needs exist (a precondition, not a
 * finding): FF-DT01 needs a file matching an inner-entity glob (the template reads `module` and `inner_entities`, never
 * `root`), FF-DT02 that plus a repository file, FF-DT03 a value-object file, FF-DT04 and FF-S01 a domain-layer file,
 * FF-DS02 files in two contexts, FF-DS01 any source file. Writes <dest>/rule-reach.json.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';
import { globToRegex } from '../../src/fitness-compiler/glob-to-regex.js';

const REPO = process.cwd();
const RUNS = 'experiments/loop-pilot/run-2026-10-16/outputs/runs/claude-code-cli/claude-sonnet-5-5/relief-volunteers';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? fallback : fallback;
}

interface Agg { name: string; module: string; root: string; inner_entities: string[] }
interface DddSpec { architecture: { layers: { kind: string; directories: string[] }[]; ddd: { contexts: { root: string }[]; aggregates: Agg[]; repositories: string[]; value_objects: string[] } } }

const re = (g: string): RegExp => new RegExp(globToRegex(g, { segmentGlobstar: true }));
const matching = (files: string[], globs: string[]): string[] => files.filter((f) => globs.some((g) => re(g).test(f)));

function main(): void {
  const dest = path.resolve(arg('dest', 'results/v1.4-ddd-b2-v9'));
  const rows: Record<string, unknown>[] = [];
  for (const arm of ['none', 'gate']) {
    const runDir = path.join(REPO, RUNS, arm, 'run-0');
    const spec = parse(fs.readFileSync(path.join(dest, 'specs', 'relief-volunteers', arm, 'dc.yaml'), 'utf8')) as DddSpec;
    const { ddd, layers } = spec.architecture;
    const domainGlobs = layers.filter((l) => l.kind === 'domain').flatMap((l) => l.directories);
    for (const f of fs.readdirSync(path.join(runDir, 'steps')).filter((x) => /^step-\d\d\.json$/.test(x)).sort()) {
      const rec = JSON.parse(fs.readFileSync(path.join(runDir, 'steps', f), 'utf8')) as { stepIndex: number; finalCommit: string };
      const files = execFileSync('git', ['--git-dir', path.join(runDir, 'snapshots.git'), 'ls-tree', '-r', '--name-only', rec.finalCommit])
        .toString('utf8').split('\n').filter((p) => p.startsWith('src/') && p.endsWith('.ts'));
      const aggregates = ddd.aggregates.map((a) => ({
        name: a.name,
        moduleFiles: matching(files, [a.module]).length,
        rootFiles: matching(files, [a.root]),
        innerEntityFiles: matching(files, a.inner_entities),
      }));
      const inner = aggregates.flatMap((a) => a.innerEntityFiles);
      const repos = matching(files, ddd.repositories);
      const vos = matching(files, ddd.value_objects);
      const domain = matching(files, domainGlobs);
      const contextsWithFiles = ddd.contexts.filter((c) => files.some((p) => p.startsWith(c.root))).length;
      rows.push({
        run: `relief-volunteers/${arm}`, step: rec.stepIndex + 1, files: files.length, domainFiles: domain, aggregates,
        repositoryFiles: repos, valueObjectFiles: vos, contextsWithFiles,
        canFire: {
          'FF-DS01': files.length > 0,
          'FF-DS02': contextsWithFiles >= 2,
          'FF-DT01': inner.length > 0,
          'FF-DT02': inner.length > 0 && repos.length > 0,
          'FF-DT03': vos.length > 0,
          'FF-DT04': domain.length > 0,
          'FF-S01': domain.length > 0,
        },
      });
    }
  }
  fs.writeFileSync(path.join(dest, 'rule-reach.json'), `${JSON.stringify(rows, null, 1)}\n`);
  for (const r of rows) process.stdout.write(`${JSON.stringify(r)}\n`);
}

main();
