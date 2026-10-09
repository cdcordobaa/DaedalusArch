/**
 * SP-* probe copies for the registered sensitivity plan (Build and Test Step 28; BR-U5a-30; DV-U5b-24; ADR-016 b).
 *
 * For each of the 25 frozen probes: open `fixtures/correct-reference`, take the probe's forced site
 * (`SP_FORCED_SITES`, the sites of the U5a Step 33 unit test) from its own `findSites`, and apply it with the
 * registered `mutate` entry (`--split probe`, `--cycle-strategy` as given) into one manifest. SP-FF-S03 uses the
 * layered fixture spec, every other probe `specs/clean-arch.yaml` (the probe's own `spec`).
 *
 * Usage (repository root):
 *   npx tsx scripts/sp-probe-copies-cli.ts --out ../daedalus-sp-probes [--cycle-strategy simple-cycles|scc]
 * Writes `<out>/manifest.json` and `<out>/copies/…`; `--out` must be repository-relative and must not exist yet.
 * Exit: 0 all 25 rows; 1 a probe was refused, rejected or has no forced site; 2 usage.
 */
import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { loadCompiledSpec } from './lib/mutation/expected.js';
import { openImportGraphProject } from './lib/mutation/import-graph.js';
import { defaultMutateDeps, main as mutateMain } from './lib/mutation/mutate-main.js';
import type { MutateMainDeps } from './lib/mutation/mutate-main.js';
import { forcedSiteOf } from './lib/mutation/operators/sp/forced-sites.js';
import { SP_PROBES } from './lib/mutation/operators/sp/index.js';

export const SP_COPIES_USAGE = 'usage: npx tsx scripts/sp-probe-copies-cli.ts --out <repository-relative dir> [--cycle-strategy simple-cycles|scc]';
const BASE = 'fixtures/correct-reference';

export async function main(argv: readonly string[], repoRoot: string, deps: MutateMainDeps = defaultMutateDeps()): Promise<number> {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const a = argv[i] ?? '';
    const v = argv[i + 1];
    if (!['--out', '--cycle-strategy'].includes(a) || v === undefined || v.startsWith('--')) {
      deps.err(`${SP_COPIES_USAGE}\n`);
      return 2;
    }
    args.set(a.slice(2), v);
  }
  const out = args.get('out');
  const strategy = args.get('cycle-strategy') ?? 'simple-cycles';
  if (out === undefined || isAbsolute(out) || !['simple-cycles', 'scc'].includes(strategy)) {
    deps.err(`${SP_COPIES_USAGE}\n(--out is required and repository-relative)\n`);
    return 2;
  }
  if (existsSync(resolve(repoRoot, out))) {
    deps.err(`${out} already exists: the probe copies are written once\n`);
    return 1;
  }
  const handle = openImportGraphProject(resolve(repoRoot, BASE), 'tsconfig.json');
  for (const p of SP_PROBES) {
    const spec = await loadCompiledSpec(repoRoot, p.spec);
    if (!spec.success) {
      deps.err(`${p.op.id}: ${spec.errors.map((e) => e.message).join('; ')}\n`);
      return 1;
    }
    const site = forcedSiteOf(p.op.id, p.op.findSites(handle, spec.data.spec));
    if (site === undefined) {
      deps.err(`${p.op.id}: no forced site\n`);
      return 1;
    }
    const code = await mutateMain([
      '--base', BASE, '--spec', p.spec, '--operator', p.op.id, '--split', 'probe', '--cycle-strategy', strategy,
      '--site', JSON.stringify({ filePath: site.filePath, detail: site.detail }),
      '--manifest', join(out, 'manifest.json'), '--out', join(out, 'copies'),
    ], repoRoot, deps);
    if (code !== 0) {
      deps.err(`${p.op.id}: mutate exit ${String(code)}\n`);
      return 1;
    }
    deps.out(`${p.op.id} ${p.spec} ${site.filePath}\n`);
  }
  return 0;
}
