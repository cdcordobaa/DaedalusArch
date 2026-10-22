/**
 * PUZZLE-04: copies one arm's records out of the root-only out root into `results/v1.4-puzzle-04/<arm>/` (zero calls).
 *   npx tsx experiments/puzzle-04/collect.ts --arm gate|pull
 * Kept: the ledgers, schedule, redraws, resumes, turn records, dry/smoke/probe results, every session's step snapshots,
 * `session.json` and step prompts, the hub logs (gate) or the MCP tap and frozen call logs (pull), and the private task
 * map. Never copied: CLI envelopes (they hold the agent's words), the hub scratch, server stderr. In the MCP tap the
 * `content` and `diff` arguments (the agent's code sent to check_file / check_diff) are replaced by their sha256 and
 * length. Absolute paths of the clone are replaced by `.`.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = process.cwd();
const arm = process.argv[process.argv.indexOf('--arm') + 1];
if (arm !== 'gate' && arm !== 'pull') throw new Error('--arm gate|pull');
const SRC = `/srv/o/${arm}/out`;
const DST = path.join(REPO, 'results', 'v1.4-puzzle-04', arm);
const scrub = (s: string): string => s.split(REPO).join('.');
const copyText = (from: string, to: string, f: (s: string) => string = scrub): void => {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, f(fs.readFileSync(from, 'utf8')));
};

fs.rmSync(DST, { recursive: true, force: true });
for (const f of ['calls.jsonl', 'turns.jsonl', 'schedule.json', 'redraws.jsonl', 'resumes.jsonl']) copyText(path.join(SRC, f), path.join(DST, 'run', f));
const results = arm === 'gate'
  ? [['dry/dry-result.json', 'dry-result.json'], ['smoke/smoke-result.json', 'smoke-result.json'], ['smoke/prompt.txt', 'smoke-prompt.txt'], ['probes/probe-result.json', 'probe-result.json'], ['probes/prompt.txt', 'probe-prompt.txt']]
  : [['dry/dry-result.json', 'dry-result.json'], ['smoke/smoke-result.json', 'smoke-result.json'], ['probe/probe-result.json', 'probe-result.json'], ['probe/prompt.txt', 'probe-prompt.txt']];
for (const [from, to] of results) copyText(path.join(SRC, from as string), path.join(DST, 'run', to as string));
copyText(`/srv/o/${arm}-input.json`, path.join(DST, 'run', 'input.json'));

const sessions = path.join(SRC, 'sessions');
for (const id of fs.existsSync(sessions) ? fs.readdirSync(sessions).sort() : []) {
  const from = path.join(sessions, id);
  const to = path.join(DST, 'sessions', id);
  if (fs.existsSync(path.join(from, 'snap'))) fs.cpSync(path.join(from, 'snap'), path.join(to, 'snap'), { recursive: true });
  copyText(path.join(from, 'session.json'), path.join(to, 'session.json'));
  const turns = path.join(from, 'turns');
  for (const t of fs.existsSync(turns) ? fs.readdirSync(turns) : []) copyText(path.join(turns, t, 'prompt.txt'), path.join(to, 'turns', t, 'prompt.txt'));
}

if (arm === 'gate') {
  const logs = path.join(SRC, 'gate');
  for (const f of fs.readdirSync(logs).filter((x) => x.endsWith('.gate.jsonl'))) copyText(path.join(logs, f), path.join(DST, 'gate', f));
} else {
  const logs = path.join(SRC, 'mcp');
  const sha = (s: string): string => createHash('sha256').update(s).digest('hex');
  const strip = (text: string): string => text.split('\n').filter(Boolean).map((l) => {
    const j = JSON.parse(l) as { arguments?: Record<string, unknown> };
    if (j.arguments !== undefined) {
      for (const k of ['content', 'diff']) {
        const v = j.arguments[k];
        if (typeof v === 'string') j.arguments[k] = { sha256: sha(v), length: v.length };
      }
    }
    return JSON.stringify(j);
  }).join('\n').concat('\n');
  for (const f of fs.readdirSync(logs).filter((x) => x.endsWith('.tap.jsonl'))) copyText(path.join(logs, f), path.join(DST, 'mcp', f), (s) => scrub(strip(s)));
  for (const f of fs.readdirSync(logs).filter((x) => x.endsWith('.calls.jsonl'))) copyText(path.join(logs, f), path.join(DST, 'mcp', f));
}

const map = JSON.parse(fs.readFileSync('/srv/o/task-map.json', 'utf8')) as Record<string, string>;
const input = JSON.parse(fs.readFileSync(`/srv/o/${arm}-input.json`, 'utf8')) as { tasks: { id: string }[] };
fs.writeFileSync(path.join(DST, 'private-task-map.json'), `${JSON.stringify({ note: 'private task map, committed after generation', ...Object.fromEntries(input.tasks.map((t) => [t.id, map[t.id]])) }, null, 1)}\n`);
process.stdout.write(`collected ${arm} into ${path.relative(REPO, DST)}\n`);
