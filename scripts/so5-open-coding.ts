/**
 * Prepares the input of the exploratory open coding of E1 failure patterns (ADR-021 SO5-07; Fable B4;
 * `Docs/analysis-plan.md` §6 "Exploratory open coding", registered by P-U6). No model is called here.
 *
 * `--labels <reconciled.json> --runs <e1 run dir> --out <dir>` writes
 * - `open-coding-input.json`: the blinded coding items (`scripts/lib/so5-open-coding.ts`), the panel's input;
 * - `open-coding-key.csv`: coding id → item, run, cell, rule, FPAT family and weight, the author's key.
 * `--self-test`: a known-bad input (a run directory that does not exist) and exit 1 (BR-U5b-73).
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { csvText } from './aggregate.js';
import { loadRunDir } from './lib/report-io.js';
import { loadSo5Codes } from './lib/so5-codes.js';
import { isCodingLabels, keyRows, OPEN_CODING_INPUT_INVALID, OPEN_CODING_KEY_COLUMNS, openCodingInput } from './lib/so5-open-coding.js';

export const OPEN_CODING_USAGE = [
  'Usage: npx tsx scripts/so5-open-coding-cli.ts --labels <reconciled.json> --runs <e1 run dir> --out <dir>',
  '       npx tsx scripts/so5-open-coding-cli.ts --self-test',
].join('\n');

export const OPEN_CODING_INPUT_FILE = 'open-coding-input.json';
export const OPEN_CODING_KEY_FILE = 'open-coding-key.csv';

export interface OpenCodingMainIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  readonly writeFile: (path: string, text: string) => void;
}

export function main(argv: readonly string[], repoRoot: string, io: OpenCodingMainIo): number {
  if (argv[0] === '--self-test') {
    // Known-bad input: a run directory that does not exist.
    const code = main(['--labels', join(repoRoot, 'does-not-exist.json'), '--runs', join(repoRoot, 'does-not-exist'), '--out', join(repoRoot, 'does-not-exist-out')], repoRoot, io);
    io.err(`self-test: exit ${String(code)}\n`);
    return 1;
  }
  const opts = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i] ?? '';
    const v = argv[i + 1];
    if (!k.startsWith('--') || v === undefined) {
      io.err(`${OPEN_CODING_USAGE}\n`);
      return 2;
    }
    opts.set(k.slice(2), v);
  }
  const labelsFile = opts.get('labels');
  const runs = opts.get('runs');
  const out = opts.get('out');
  if (labelsFile === undefined || runs === undefined || out === undefined || opts.size !== 3) {
    io.err(`${OPEN_CODING_USAGE}\n`);
    return 2;
  }
  try {
    const so5 = loadSo5Codes(repoRoot);
    if (!so5.ok) throw new Error(`${so5.code}: ${so5.detail}`);
    const { records, reports } = loadRunDir(resolve(repoRoot, runs), OPEN_CODING_INPUT_INVALID);
    const labels = JSON.parse(readFileSync(resolve(repoRoot, labelsFile), 'utf8')) as unknown;
    if (!isCodingLabels(labels)) throw new Error(`${OPEN_CODING_INPUT_INVALID}: --labels must be llm-label output (ReconciledLabel[] with runs)`);
    const r = openCodingInput(labels, records, reports, so5.codes);
    if (!r.ok) throw new Error(r.detail);
    const dir = resolve(repoRoot, out);
    io.writeFile(join(dir, OPEN_CODING_INPUT_FILE), `${JSON.stringify(r.input, null, 2)}\n`);
    io.writeFile(join(dir, OPEN_CODING_KEY_FILE), csvText(OPEN_CODING_KEY_COLUMNS, keyRows(r.key)));
    io.out(`${String(r.input.items.length)} coding items in ${dir}\n`);
    return 0;
  } catch (e) {
    io.err(`${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
}
