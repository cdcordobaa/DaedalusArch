/**
 * `npm run demo:sdd`: rebuild the SDD demo from its transcript and re-check every step in process
 * (Docs/v1.3/sdd-demo.md). No LLM, no database, no network.
 *
 *   npx tsx scripts/sdd/replay-demo.ts [--demo examples/sdd-library-loans] [--no-full-eval] [--json <file>]
 *       [--render]   (re-render transcript.md from transcript.jsonl and exit)
 *
 * Exit codes: 0 every step reproduced, the tree and transcript.md match; 1 a mismatch; 2 an error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { latencyTable, replay } from './lib/replay.js';
import { renderTranscript } from './lib/render.js';
import { readTranscript } from './lib/transcript.js';

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main(argv: readonly string[]): Promise<number> {
  const repo = process.cwd();
  const demoDir = path.resolve(repo, arg(argv, '--demo') ?? 'examples/sdd-library-loans');
  const out = (t: string): void => {
    process.stdout.write(t);
  };
  if (argv.includes('--render')) {
    const events = readTranscript(path.join(demoDir, 'transcript', 'transcript.jsonl'));
    fs.writeFileSync(path.join(demoDir, 'transcript', 'transcript.md'), renderTranscript(events));
    out(`rendered transcript.md from ${String(events.length)} events\n`);
    return 0;
  }
  const report = await replay({ repoRoot: repo, demoDir, fullEval: !argv.includes('--no-full-eval'), log: (l) => out(`${l}\n`) });
  out(`\n${latencyTable(report.steps)}\n\n`);
  for (const c of report.counterfactuals) {
    out(`counterfactual #${String(c.seq)} ${c.path}: check_file blocked on ${c.toolBlockingRules.join(', ')}; full evaluation ${c.fullVerdict} on ${c.fullBlockingRules.join(', ') || '-'}: ${c.agree ? 'agree' : 'DISAGREE'}\n`);
  }
  out(`rebuilt tree equals ${path.relative(repo, demoDir)}: ${report.treeMatches ? 'yes' : `NO (${report.treeDiff.join(', ')})`}\n`);
  out(`transcript.md equals its rendering: ${report.markdownMatches ? 'yes' : 'NO (run with --render)'}\n`);
  const failed = report.steps.filter((s) => !s.ok).length;
  out(`${String(report.events)} events, ${String(report.steps.length - failed)}/${String(report.steps.length)} steps reproduced: ${report.ok ? 'OK' : 'MISMATCH'}\n`);
  const json = arg(argv, '--json');
  if (json !== undefined) {
    fs.mkdirSync(path.dirname(path.resolve(repo, json)), { recursive: true });
    fs.writeFileSync(path.resolve(repo, json), `${JSON.stringify(report, null, 2)}\n`);
  }
  return report.ok ? 0 : 1;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    process.stderr.write(`error: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exitCode = 2;
  },
);
