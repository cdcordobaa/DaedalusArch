/**
 * Zero-call self-test of the research config dir rule (author decision 2026-10-19): the listing tolerance for
 * `skills/synced/**` and `plugins/synced/**`, and its run-time pair `initExtensionViolations`.
 *   npx tsx scripts/v1.3/bf-01-research-dir-selftest.ts
 */
import { initExtensionViolations, researchListingFailures } from './bf-01-run.js';

const r = 'matches no allow-list item';
const cases: [string, boolean][] = [];
const left = (fs: { entry: string; reason: string }[]): number => researchListingFailures(fs).length;
cases.push(['synced skills and plugins pass', left([{ entry: 'skills', reason: r }, { entry: 'skills/synced', reason: r }, { entry: 'skills/synced/a/SKILL.md', reason: r }, { entry: 'plugins/synced/b', reason: r }]) === 0]);
cases.push(['an unsynced skill fails', left([{ entry: 'skills', reason: r }, { entry: 'skills/mine/SKILL.md', reason: r }]) === 2]);
cases.push(['an MCP config inside synced fails', left([{ entry: 'plugins/synced/x/.mcp.json', reason: r }]) === 1]);
cases.push(['a projects transcript still fails', left([{ entry: 'projects/p/s.jsonl', reason: r }]) === 1]);
cases.push(['empty plugins and skills pass', left([{ entry: 'plugins', reason: r }, { entry: 'skills', reason: r }]) === 0]);
const init = (o: object): string => `${JSON.stringify({ type: 'system', subtype: 'init', ...o })}\n`;
const builtin = [{ name: 'cc-plugin-telemetry', path: 'builtin' }];
cases.push(['clean init passes', initExtensionViolations(init({ skills: [], slash_commands: [], plugins: builtin })).length === 0]);
cases.push(['a loaded skill fails', initExtensionViolations(init({ skills: ['x'], slash_commands: [], plugins: builtin })).length === 1]);
cases.push(['a slash command fails', initExtensionViolations(init({ skills: [], slash_commands: ['y'], plugins: builtin })).length === 1]);
cases.push(['a synced plugin fails', initExtensionViolations(init({ skills: [], slash_commands: [], plugins: [{ name: 'p', path: '/x/plugins/synced/p' }] })).length === 1]);
cases.push(['missing fields fail closed', initExtensionViolations(init({})).length === 3]);
cases.push(['no init event fails', initExtensionViolations('').length === 1]);
let ok = 0;
for (const [name, pass] of cases) { process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${name}\n`); if (pass) ok++; }
process.stdout.write(`${String(ok)}/${String(cases.length)}\n`);
process.exit(ok === cases.length ? 0 : 1);
