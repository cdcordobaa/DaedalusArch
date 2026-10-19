/**
 * MEAN-01 meaning analysis (C3m): κ and meaningful precision with intervals
 * (design `aidlc-docs/construction/v1.4/U7/functional-design/design.md`; codebook `ops/notes/mean-01-codebook-and-sample.md` §4, §9).
 *
 *   analyse  --sample <csv> [--rater <csv>] [--author <csv>] --primary A_practitioner|B_style_fidelity
 *            [--seed 20261018] [--resamples 10000] [--expect-sample-sha256 <hex>] [--out <dir>]
 *   simulate --sample <csv> --table-a a,b,c,d [--table-b a,b,c,d] [--unsure-rater k] [--blank k] --seed s --out <dir>
 *
 * Exit codes: 0 written; 2 input error (every problem listed) or a refused --out; 1 any other failure.
 * No model, API, network or Neo4j call. Run from the repo root.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyse } from './lib/meaning/analyse.js';
import { MEANING_LIB_DIR, MeaningInputError, hashFiles, loadSample, loadSheet, scriptHashPaths } from './lib/meaning/load.js';
import { displayPath, renderJson, renderMarkdown } from './lib/meaning/report.js';
import { SimulateError, parseTable, simulateSheets } from './lib/meaning/simulate.js';
import type { Field, Sheet } from './lib/meaning/types.js';
import { FIELDS, PROTOCOL } from './lib/meaning/types.js';

export interface Io {
  readonly stdout: (s: string) => void;
  readonly stderr: (s: string) => void;
}

class UsageError extends Error {}

function argOf(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) throw new UsageError(`--${name} needs a value`);
  return v;
}
function need(argv: readonly string[], name: string): string {
  const v = argOf(argv, name);
  if (v === undefined) throw new UsageError(`--${name} is required`);
  return v;
}
function intArg(argv: readonly string[], name: string, dflt: number | undefined): number {
  const v = argOf(argv, name);
  if (v === undefined) {
    if (dflt === undefined) throw new UsageError(`--${name} is required`);
    return dflt;
  }
  if (!/^\d+$/.test(v)) throw new UsageError(`--${name} must be a non-negative integer, got "${v}"`);
  return Number(v);
}

export function repoRoot(cwd: string): string {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf-8' }).trim();
}

/** BR-54, BR-60: true when `dir` is `results/` or under it. */
export function isUnderResults(dir: string, root: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(dir)).split(path.sep).join('/');
  return rel === 'results' || rel.startsWith('results/');
}

function readSheet(file: string | undefined, role: 'rater' | 'author', cwd: string, root: string, sample: ReturnType<typeof loadSample>): Sheet | null {
  if (file === undefined) return null;
  const abs = path.resolve(cwd, file);
  return loadSheet(fs.readFileSync(abs, 'utf-8'), role, displayPath(abs, root), sample);
}

function runAnalyse(argv: readonly string[], cwd: string, io: Io): number {
  const root = repoRoot(cwd);
  const primaryRaw = need(argv, 'primary');
  if (!(FIELDS as readonly string[]).includes(primaryRaw)) throw new UsageError(`--primary must be A_practitioner or B_style_fidelity, got "${primaryRaw}"`);
  const primary = primaryRaw as Field;
  const seed = intArg(argv, 'seed', PROTOCOL.seed);
  const resamples = intArg(argv, 'resamples', PROTOCOL.resamples);
  if (resamples === 0) throw new UsageError('--resamples must be positive');
  const sampleAbs = path.resolve(cwd, need(argv, 'sample'));
  const expectSha256 = argOf(argv, 'expect-sample-sha256');
  const sample = loadSample(fs.readFileSync(sampleAbs, 'utf-8'), displayPath(sampleAbs, root), expectSha256 === undefined ? {} : { expectSha256 });
  const rater = readSheet(argOf(argv, 'rater'), 'rater', cwd, root, sample);
  const author = readSheet(argOf(argv, 'author'), 'author', cwd, root, sample);
  const out = argOf(argv, 'out');
  const synthetic = [rater, author].some((s) => s?.simulated === true);
  if (out !== undefined && synthetic && isUnderResults(path.resolve(cwd, out), root)) {
    io.stderr('refused: a SYNTHETIC run (simulated sheets) cannot write under results/ (BR-54)\n');
    return 2;
  }
  const libFiles = fs.readdirSync(path.join(root, MEANING_LIB_DIR)).sort();
  const scriptHashes = hashFiles(scriptHashPaths(libFiles).map((p) => ({ path: p, content: fs.readFileSync(path.join(root, p), 'utf-8') })));
  const analysis = analyse({
    sample, samplePath: displayPath(sampleAbs, root), rater, author,
    config: { primary, seed, resamples, frameN: PROTOCOL.frameN, minN: PROTOCOL.minN, gate: PROTOCOL.gate },
    scriptHashes,
  });
  const md = renderMarkdown(analysis);
  if (out === undefined) io.stdout(md);
  else {
    const dir = path.resolve(cwd, out);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'analysis.json'), renderJson(analysis));
    fs.writeFileSync(path.join(dir, 'analysis.md'), md);
    io.stdout(`wrote ${displayPath(path.join(dir, 'analysis.json'), root)} and ${displayPath(path.join(dir, 'analysis.md'), root)}\n`);
  }
  return 0;
}

function runSimulate(argv: readonly string[], cwd: string, io: Io): number {
  const root = repoRoot(cwd);
  const outDir = path.resolve(cwd, need(argv, 'out'));
  if (isUnderResults(outDir, root)) {
    io.stderr('refused: simulated sheets are never written under results/ (BR-60)\n');
    return 2;
  }
  const sampleAbs = path.resolve(cwd, need(argv, 'sample'));
  const sample = loadSample(fs.readFileSync(sampleAbs, 'utf-8'), displayPath(sampleAbs, root));
  const tableB = argOf(argv, 'table-b');
  const sheets = simulateSheets(sample, {
    tableA: parseTable(need(argv, 'table-a'), '--table-a'),
    ...(tableB === undefined ? {} : { tableB: parseTable(tableB, '--table-b') }),
    unsureRater: intArg(argv, 'unsure-rater', 0),
    blank: intArg(argv, 'blank', 0),
    seed: intArg(argv, 'seed', undefined),
  });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'answers-author.csv'), sheets.author);
  fs.writeFileSync(path.join(outDir, 'answers-rater.csv'), sheets.rater);
  io.stdout(`wrote simulated sheets to ${displayPath(outDir, root)}\n`);
  return 0;
}

export function main(argv: readonly string[], cwd: string, io: Io): number {
  try {
    const mode = argv[0];
    if (mode === 'analyse') return runAnalyse(argv.slice(1), cwd, io);
    if (mode === 'simulate') return runSimulate(argv.slice(1), cwd, io);
    throw new UsageError('mode: analyse | simulate');
  } catch (e: unknown) {
    if (e instanceof MeaningInputError) { io.stderr(`${e.message}\n`); return 2; }
    if (e instanceof UsageError || e instanceof SimulateError) { io.stderr(`${e.message}\n`); return 2; }
    io.stderr(`${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
}

if (process.argv[1]?.endsWith('meaning-analysis.ts') === true) {
  process.exitCode = main(process.argv.slice(2), process.cwd(), {
    stdout: (s) => process.stdout.write(s),
    stderr: (s) => process.stderr.write(s),
  });
}
