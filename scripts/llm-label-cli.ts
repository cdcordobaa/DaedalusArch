/**
 * CLI entry of `scripts/llm-label.ts` (FR-27; BR-U5b-34, 44, 73). No exports; D-U5a-13 (a) form.
 * Usage: npx tsx scripts/llm-label-cli.ts --plan <label-plan.json> --estimate
 *        npx tsx scripts/llm-label-cli.ts --plan <file> --mode record|replay --cassette-dir <dir> --model <id> [--provider gemini|mock] --out <file>
 * Live Gemini calls happen only with `--mode record --provider gemini`, after an estimate within budget (BR-U5b-44).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { GeminiProvider } from '../src/llm-critic/gemini-provider.js';
import { MockLLMProvider } from '../src/llm-critic/mock-provider.js';
import { LABELLER_MAX_TOKENS, LABELLER_TEMPERATURE, main } from './llm-label.js';

void main(process.argv.slice(2), process.cwd(), {
  out: (t) => process.stdout.write(t),
  err: (t) => process.stderr.write(t),
  writeFile: (f, t) => {
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, t);
  },
}, {
  gemini: (model) => new GeminiProvider({
    apiKey: process.env.GEMINI_API_KEY ?? '', model, temperature: LABELLER_TEMPERATURE, maxTokens: LABELLER_MAX_TOKENS,
  }),
  mock: () => new MockLLMProvider(),
}).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
