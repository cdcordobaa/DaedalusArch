/**
 * `main` of `scripts/u5a-parity-check.ts` (FR-v1.2E-24; BR-U5a-56; D-U5a-13 a, D-U5a-15).
 *
 * Usage (repository root):
 *   npx tsx scripts/u5a-parity-check.ts --bases <list.json> [--spec <path>]
 *
 * `<list.json>` is a JSON array of `PreparedBase` objects (validated by `makePreparedBase`). For each base,
 * `compareImportGraphs` builds the ts-morph import graph (with the layers of `--spec`, else of the base's own
 * `specPath`) and the extractor's graph over the base directory and compares Files, barrel flags and File→File
 * `IMPORTS`/`RE_EXPORTS` edges. One line per base (`OK` or `DIFF`), then the differing items. Build and Test runs it
 * on every prepared corpus base before seeding; any difference is fixed in the builder (BR-U5a-56). The base is only
 * read. Exit 0 every base equal; 1 a difference; 2 usage or input error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { compareImportGraphs } from './import-graph-parity.js';
import type { ParityResult } from './import-graph-parity.js';
import { MANIFEST_SCHEMA_PATH, knownSecrets } from './manifest.js';
import { loadCompiledSpec } from './mutation/expected.js';
import type { LayerDirs } from './mutation/import-graph.js';
import { makePreparedBase } from './mutation/prepare.js';
import type { PreparedBaseInput } from './mutation/prepare.js';

export const PARITY_USAGE = [
  'usage: npx tsx scripts/u5a-parity-check.ts --bases <list.json of PreparedBase> [--spec <path>]',
  '',
  'Compares the U5a import-graph builder with extractAPG on each prepared base (BR-U5a-56).',
  'Exit 0 all equal; 1 a difference; 2 usage or input error.',
  '',
].join('\n');

export type CompareGraphs = (projectDir: string, tsconfigPath: string, layers: readonly LayerDirs[]) => Promise<ParityResult>;

export interface ParityMainDeps {
  readonly compare: CompareGraphs;
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

export function defaultParityDeps(): ParityMainDeps {
  return { compare: compareImportGraphs, out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(t) };
}

/** Runs the check; returns the exit code. */
export async function main(argv: readonly string[], repoRoot: string, deps: ParityMainDeps = defaultParityDeps()): Promise<number> {
  if (!fs.existsSync(path.resolve(repoRoot, MANIFEST_SCHEMA_PATH))) {
    deps.err('run from the repository root\n');
    return 2;
  }
  let basesPath: string | undefined;
  let spec: string | undefined;
  for (let i = 0; i < argv.length; i += 2) {
    const a = argv[i];
    const v = argv[i + 1];
    if (a === '--bases' && v !== undefined) basesPath = v;
    else if (a === '--spec' && v !== undefined) spec = v;
    else {
      deps.err(`unexpected argument ${JSON.stringify(a)}\n${PARITY_USAGE}`);
      return 2;
    }
  }
  if (basesPath === undefined) {
    deps.err(`--bases is required\n${PARITY_USAGE}`);
    return 2;
  }
  const usageError = (message: string): number => {
    deps.err(`${scrubSecrets(message, knownSecrets())}\n`);
    return 2;
  };
  let list: unknown;
  try {
    list = JSON.parse(fs.readFileSync(path.resolve(repoRoot, basesPath), 'utf8'));
  } catch {
    return usageError('--bases is not a readable JSON file');
  }
  if (!Array.isArray(list)) return usageError('--bases must hold a JSON array of PreparedBase objects');
  const layersBySpec = new Map<string, readonly LayerDirs[]>();
  let differing = 0;
  for (const raw of list as PreparedBaseInput[]) {
    const base = makePreparedBase(raw);
    if (!base.success) return usageError(base.errors.map((e) => `${e.code}: ${e.message}`).join('; '));
    const specPath = spec ?? base.data.specPath;
    let layers = layersBySpec.get(specPath);
    if (layers === undefined) {
      const compiled = await loadCompiledSpec(repoRoot, specPath);
      if (!compiled.success) return usageError(compiled.errors.map((e) => `${e.code}: ${e.message}`).join('; '));
      layers = compiled.data.layers;
      layersBySpec.set(specPath, layers);
    }
    const r = await deps.compare(base.data.dir, base.data.tsconfigPath, layers);
    deps.out(`${r.equal ? 'OK' : 'DIFF'} ${base.data.projectId}\n`);
    if (!r.equal) {
      differing++;
      for (const item of r.onlyInBuilder) deps.out(`  only-builder ${item}\n`);
      for (const item of r.onlyInExtractor) deps.out(`  only-extractor ${item}\n`);
    }
  }
  return differing === 0 ? 0 : 1;
}
