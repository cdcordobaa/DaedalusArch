/**
 * Creates (`--create`) and validates the two Gemini generator homes. Entry file: no exports. No sign-in, no model
 * call, no credential read; nothing is written into the repository. Library: `scripts/v1.4/lib/gemini-homes.ts`.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/gemini-homes.ts --create --home-none ~/.firewall/gemini-gen-none --home-mcp ~/.firewall/gemini-gen-mcp
 */
import { geminiHomesMain } from './lib/gemini-homes.js';

process.exitCode = geminiHomesMain(process.argv.slice(2), process.cwd(), (t) => process.stdout.write(t), (t) => process.stderr.write(t));
