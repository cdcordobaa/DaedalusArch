/**
 * Blindness check for the score-free construct-decision answer sheet. Entry file: no exports.
 * Fails (exit 1) if the sheet contains a token that could reveal an option's effect on the
 * development set: fractions such as 13/13, recall, precision, TP/FP, decimal rates, arrows,
 * percentages, or result-steering and recommendation wording.
 * Usage (repository root):
 *   npx tsx scripts/v1.3/check-answer-sheet-blind.ts [Docs/v1.3/construct-decisions-answer-sheet.md]
 */
import { readFileSync } from 'node:fs';

const DEFAULT_PATH = 'Docs/v1.3/construct-decisions-answer-sheet.md';

/** Numbers that describe a rule itself (thresholds), not a result. */
const ALLOWED_DECIMALS = new Set(['0.85']);

interface Pattern {
  readonly name: string;
  readonly re: RegExp;
}

const PATTERNS: readonly Pattern[] = [
  { name: 'fraction (N/N)', re: /\d+\s*\/\s*\d+/g },
  // "(recalled)" marks source wording not yet checked in print; it is not a score.
  { name: 'recall', re: /\brecall(?!ed\b)\w*/gi },
  { name: 'precision', re: /\bprecision\w*/gi },
  { name: 'TP/FP', re: /\b[TF]Ps?\b/g },
  { name: 'true/false positive or negative', re: /\b(?:true|false)[ -](?:positive|negative)s?\b/gi },
  { name: 'rate bracket', re: /\[0\./g },
  { name: 'arrow', re: /→|⇒|->|=>/g },
  { name: 'percentage', re: /\d\s*%/g },
  { name: 'decimal rate', re: /(?<![\w.])[01]\.\d+\b/g },
  { name: 'delta', re: /\bdelta\b|[+-]\d+\s*(?:rows?|findings?)\b/gi },
  { name: 'CI range', re: /\bCI\b|confidence interval/gi },
  { name: 'score wording', re: /\b(?:yields?|scored)\b/gi },
  { name: 'steering wording', re: /\b(?:recovers?|fixes the|catches|misses|blind-only|tool-only|agreed row)\b/gi },
  { name: 'recommendation', re: /\brecommend\w*|\bsafe default/gi },
  { name: 'row counts', re: /\b\d+\s+(?:rows?|findings?|detections?|TPs?|FPs?|cases?)\b/gi },
  { name: 'sheet row reference', re: /\bsheet rows?\b/gi },
];

interface Hit {
  readonly line: number;
  readonly pattern: string;
  readonly token: string;
}

function scan(text: string): Hit[] {
  const hits: Hit[] = [];
  text.split('\n').forEach((lineText, i) => {
    for (const p of PATTERNS) {
      for (const m of lineText.matchAll(p.re)) {
        if (p.name === 'decimal rate' && ALLOWED_DECIMALS.has(m[0])) continue;
        hits.push({ line: i + 1, pattern: p.name, token: m[0] });
      }
    }
  });
  return hits;
}

const path = process.argv[2] ?? DEFAULT_PATH;
const text = readFileSync(path, 'utf8');
const hits = scan(text);
const lines = text.split('\n').length;

if (hits.length === 0) {
  process.stdout.write(`PASS ${path}: ${lines} lines, ${PATTERNS.length} patterns, 0 score-like tokens\n`);
  process.exitCode = 0;
} else {
  for (const h of hits) process.stdout.write(`${path}:${h.line}: [${h.pattern}] ${JSON.stringify(h.token)}\n`);
  process.stdout.write(`FAIL ${path}: ${hits.length} score-like token(s)\n`);
  process.exitCode = 1;
}
