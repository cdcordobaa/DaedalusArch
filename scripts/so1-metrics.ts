/**
 * SO1 metrics producer (ADR-021 SO1-E, X-7; FR-20). Definitions in `scripts/lib/so1-metrics.ts`.
 *
 * Over the committed specs a plan may evaluate with or a corpus spec is copied from (`corpus/specs/*.yaml`, the
 * fixture specs, `presets/*.yaml`; the same patterns as the BR-U5b-51 registry):
 * - runs the `validate` check (parse, schema, business rules as non-strict `validate` reports them, template refs,
 *   compilation) on the first committed version and on the working-tree version of each spec;
 * - counts the lines of each spec;
 * - computes template coverage per built-in style library (`TEMPLATE_REGISTRY` × `CYPHER_TEMPLATES`).
 * The layer-directory existence check of `validate --project` is left out: it needs the project checkout, which is
 * not part of the repository, and it checks the project rather than the spec.
 *
 * Writes canonical JSON (no timestamp, no absolute path), so the same commit gives the same bytes.
 * Usage: npx tsx scripts/so1-metrics-cli.ts [--out <file>] | --self-test
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseSpec } from '../src/spec-parser/spec-parser.js';
import { validateSpecAgainstProject } from '../src/spec-parser/spec-validator.js';
import { TEMPLATE_REGISTRY } from '../src/spec-parser/template-registry.js';
import { compileFunctions } from '../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../src/fitness-compiler/compiler-input.js';
import { CYPHER_TEMPLATES } from '../src/fitness-compiler/cypher-templates.js';
import { canonicalize } from './lib/canonical-json.js';
import { CORPUS_SPEC_PATTERN, FIXTURE_SPECS, matchesPattern, PRESET_PATTERN, sha256File } from './lib/prereg.js';
import { countSpecLines, libraryCoverage, so1Metrics } from './lib/so1-metrics.js';
import type { DeclaredFunction, LibraryCoverage, So1Metrics, SpecGroup, SpecRecord, ValidationOutcome } from './lib/so1-metrics.js';

export const SO1_USAGE = 'usage: npx tsx scripts/so1-metrics-cli.ts [--out <file>] | --self-test';

/** The group of a repository-relative spec path, `null` when it is not an SO1 spec. */
export function specGroupOf(path: string): SpecGroup | null {
  if (matchesPattern(path, CORPUS_SPEC_PATTERN)) return 'corpus';
  if (FIXTURE_SPECS.includes(path)) return 'fixture';
  if (matchesPattern(path, PRESET_PATTERN)) return 'preset';
  return null;
}

/** Project-only `validate` error codes (they read the project checkout, not the spec). */
const PROJECT_ONLY_CODES: ReadonlySet<string> = new Set(['LAYER_DIR_NOT_FOUND']);

/** The `validate` check on a spec text (written to a temporary file, as `validate` reads a path). */
export async function validateSpecText(text: string): Promise<ValidationOutcome> {
  const dir = mkdtempSync(join(tmpdir(), 'so1-spec-'));
  try {
    const file = join(dir, 'spec.yaml');
    writeFileSync(file, text);
    const parsed = await parseSpec({ specFilePath: file });
    if (!parsed.success) {
      return { pass: false, errors: parsed.errors.map((e) => `[${e.code}] ${e.message}`), style: null, declared: null, compiled: null, disabled: null };
    }
    const spec = parsed.data;
    const style = spec.style ?? null;
    const declared = spec.fitnessFunctions.length;
    // An empty project path never exists, so only the project-only codes come from it; they are dropped.
    const report = validateSpecAgainstProject(spec, join(dir, 'no-project'));
    const errors = report.errors.filter((e) => !PROJECT_ONLY_CODES.has(e.code)).map((e) => `[${e.code}] ${e.message}`);
    const compiled = compileFunctions(compilerInputFromSpec(spec));
    if (!compiled.success) {
      return { pass: false, errors: [...errors, ...compiled.errors.map((e) => `[${e.code}] ${e.message}`)], style, declared, compiled: null, disabled: null };
    }
    return {
      pass: errors.length === 0, errors, style, declared,
      compiled: compiled.data.totalCompiled, disabled: compiled.data.disabledFunctions.length,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function git(repoRoot: string, args: readonly string[]): string {
  return execFileSync('git', [...args], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
}

function tryGit(repoRoot: string, args: readonly string[]): string | null {
  try {
    return git(repoRoot, args);
  } catch {
    return null;
  }
}

/** The committed SO1 spec paths, sorted. */
export function so1SpecPaths(repoRoot: string): string[] {
  return git(repoRoot, ['ls-files', '-z']).split('\0').filter((p) => p !== '' && specGroupOf(p) !== null).sort();
}

/** The library coverage of every built-in style template. */
export function builtInCoverage(): LibraryCoverage[] {
  const hasCypher = (name: string): boolean => CYPHER_TEMPLATES.has(name);
  return [...TEMPLATE_REGISTRY.values()].map((t) => libraryCoverage(t.style, t.functions.map((f): DeclaredFunction => ({
    id: String(f.id), name: f.name, route: f.route, hasRubric: f.semanticCriteria?.rubric !== undefined,
  })), hasCypher));
}

async function specRecord(repoRoot: string, path: string, group: SpecGroup): Promise<SpecRecord> {
  const currentText = readFileSync(join(repoRoot, path), 'utf8');
  const commits = (tryGit(repoRoot, ['log', '--format=%H', '--', path]) ?? '').split('\n').filter((l) => l !== '');
  const added = (tryGit(repoRoot, ['log', '--diff-filter=A', '--format=%H', '--', path]) ?? '').split('\n').filter((l) => l !== '');
  const firstCommit = added[added.length - 1] ?? null;
  const firstText = firstCommit === null ? currentText : (tryGit(repoRoot, ['show', `${firstCommit}:${path}`]) ?? currentText);
  const current = await validateSpecText(currentText);
  const first = firstText === currentText ? current : await validateSpecText(firstText);
  return {
    path, group, sha256: sha256File(join(repoRoot, path)), firstCommit, revisions: commits.length,
    lines: countSpecLines(currentText), first, current,
  };
}

/** The SO1 metrics of the checkout at `repoRoot`. */
export async function computeSo1Metrics(repoRoot: string): Promise<So1Metrics> {
  const records: SpecRecord[] = [];
  for (const path of so1SpecPaths(repoRoot)) {
    const group = specGroupOf(path);
    if (group !== null) records.push(await specRecord(repoRoot, path, group));
  }
  const commit = (tryGit(repoRoot, ['rev-parse', 'HEAD']) ?? '').trim();
  return so1Metrics(commit, records, builtInCoverage());
}

export interface So1MainIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  readonly writeFile: (file: string, text: string) => void;
}

/** Known-bad input of `--self-test`: a spec with an unknown style must fail the check. */
export const SELF_TEST_BAD_SPEC = 'spec_version: "1.0.0"\narchitecture:\n  style: no-such-style\n  layers: []\n';

/** CLI body. Exit 0 written; 1 `--self-test` saw the known-bad spec fail (as it must); 2 usage or IO error. */
export async function main(argv: readonly string[], repoRoot: string, io: So1MainIo): Promise<number> {
  let outFile: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' && argv[i + 1] !== undefined) outFile = argv[++i];
    else if (a === '--self-test') {
      const bad = await validateSpecText(SELF_TEST_BAD_SPEC);
      if (!bad.pass) {
        io.out(`self-test: the known-bad spec failed the check (expected exit 1): ${bad.errors.join('; ')}\n`);
        return 1;
      }
      io.err('self-test: the known-bad spec PASSED the check\n');
      return 0;
    } else {
      io.err(`${SO1_USAGE}\n`);
      return 2;
    }
  }
  let metrics: So1Metrics;
  try {
    metrics = await computeSo1Metrics(repoRoot);
  } catch (e) {
    io.err(`${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }
  const text = canonicalize(metrics);
  if (outFile === undefined) io.out(text);
  else io.writeFile(resolve(repoRoot, outFile), text);
  return 0;
}
