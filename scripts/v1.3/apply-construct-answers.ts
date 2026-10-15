/**
 * Applies the author's construct answers. Entry file: no exports.
 *
 * Usage (repository root):
 *   node --import tsx scripts/v1.3/apply-construct-answers.ts <answers.json> [--switch-file <path>] [--dry-run]
 * <answers.json> is either a plain map ({"Q3": "C", "Q5": {"choice": "D", "note": "..."}}) or the decision board's
 * database export (documents with fields {choice, note}; the document id is the question, e.g. "Q3").
 * Rewrites the generated block of src/shared/construct-switches.ts (every question; an unanswered one stays at A),
 * then prints the ADRs the author must sign, the ADR-V13-03 entries, the action items and the next commands.
 * It never runs the development-set re-run.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseAnswersDocument, signOffLines, SWITCH_FILE, writeSwitchFile } from './lib/construct-answers.js';

function main(): number {
  const argv = process.argv.slice(2);
  const file = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--switch-file');
  if (file === undefined) {
    process.stderr.write('usage: apply-construct-answers.ts <answers.json> [--switch-file <path>] [--dry-run]\n');
    return 2;
  }
  const i = argv.indexOf('--switch-file');
  const switchFile = path.resolve(i >= 0 ? argv[i + 1] ?? SWITCH_FILE : SWITCH_FILE);
  const parsed = parseAnswersDocument(JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')) as unknown);
  for (const w of parsed.warnings) process.stderr.write(`warning: ${w}\n`);
  if (!argv.includes('--dry-run')) {
    writeSwitchFile(switchFile, parsed.answers, parsed.notes);
    process.stdout.write(`wrote ${path.relative(process.cwd(), switchFile)} (${String(parsed.answered.size)} of 25 questions answered)\n`);
  }
  process.stdout.write(signOffLines(parsed).join('\n') + '\n');
  return 0;
}

try {
  process.exitCode = main();
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
}
