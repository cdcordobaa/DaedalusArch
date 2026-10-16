/**
 * Human-rules pilot, enforcement history (v1.3). Walks every commit of a pilot's history that touches its source
 * or its rule file, runs the pinned dependency-cruiser with the rule file AS OF THAT COMMIT, and records how many
 * imports broke the developers' own layer rules. Commits with violations are the positives that `run.ts --sha`
 * then compares our verdicts on.
 *
 * Usage: npx tsx scripts/v1.3/human-rules-pilot/history.ts --work <dir> --id <pilot>
 * Writes results/v1.3-human-rules-pilot/history/<id>.json. No LLM is called.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { selectLayerRules } from './lib.js';
import type { DcRule, DcViolation } from './lib.js';

const REPO = process.cwd(); // run from the repository root
const HERE = path.join(REPO, 'scripts/v1.3/human-rules-pilot');
const OUT = path.join(REPO, 'results/v1.3-human-rules-pilot/history');
const DC_BIN = path.join(REPO, 'experiments/tool-comparison/depcruise/node_modules/.bin/depcruise');

interface Pilot { id: string; repo: string; sha: string; root: string; ruleFile: string; targets: string[] }

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function git(dir: string, args: string[]): string {
  return spawnSync('git', args, { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 28 }).stdout;
}

function main(): void {
  const work = arg('work'); const id = arg('id');
  if (work === undefined || id === undefined) throw new Error('--work <dir> --id <pilot> are required');
  const p = (JSON.parse(fs.readFileSync(path.join(HERE, 'pilots.json'), 'utf8')) as Pilot[]).find((x) => x.id === id);
  if (p === undefined) throw new Error(`unknown pilot ${id}`);
  const dir = path.join(work, p.id);
  if (!fs.existsSync(path.join(dir, '.git'))) throw new Error(`${dir}: run run.ts first (it clones the pilot)`);
  const rel = (f: string): string => (p.root === '.' ? f : `${p.root}/${f}`);
  const commits = git(dir, ['rev-list', '--first-parent', '--reverse', p.sha, '--', ...p.targets.map(rel), rel(p.ruleFile)]).split('\n').filter(Boolean);
  const rows: Record<string, unknown>[] = [];
  for (const sha of commits) {
    git(dir, ['checkout', '-q', '--force', sha]);
    const root = path.join(dir, p.root);
    const date = git(dir, ['log', '-1', '--format=%cs', sha]).trim();
    if (!fs.existsSync(path.join(root, p.ruleFile)) || !p.targets.every((t) => fs.existsSync(path.join(root, t)))) {
      rows.push({ sha, date, status: 'no-rule-file-or-target' });
      continue;
    }
    const r = spawnSync(DC_BIN, [...p.targets, '--config', p.ruleFile, '--output-type', 'json'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 30 });
    type DcOut = { summary: { violations: DcViolation[]; ruleSetUsed: { forbidden?: DcRule[] } } };
    let data: DcOut | null = null;
    try { data = JSON.parse(r.stdout) as DcOut; } catch { /* recorded below */ }
    if (data === null) { rows.push({ sha, date, status: 'depcruise-error', stderr: r.stderr.slice(0, 300) }); continue; }
    const { layer } = selectLayerRules(data.summary.ruleSetUsed.forbidden ?? []);
    const names = new Set(layer.map((x) => x.name));
    const v = data.summary.violations.filter((x) => names.has(x.rule.name));
    rows.push({
      sha, date, status: 'ok', layerRules: [...names], layerViolations: v.length,
      byRule: Object.fromEntries([...names].map((n) => [n, v.filter((x) => x.rule.name === n).length])),
      violations: v.map((x) => `${x.rule.name}: ${x.from} -> ${x.to}`),
    });
  }
  git(dir, ['checkout', '-q', '--force', p.sha]);
  fs.mkdirSync(OUT, { recursive: true });
  const ok = rows.filter((x) => x.status === 'ok');
  const withV = ok.filter((x) => (x.layerViolations as number) > 0);
  fs.writeFileSync(path.join(OUT, `${p.id}.json`), JSON.stringify({
    id: p.id, repo: p.repo, head: p.sha, commitsScanned: commits.length, commitsWithRules: ok.length, commitsWithLayerViolations: withV.length, rows,
  }, null, 1) + '\n');
  process.stdout.write(`${p.id}: ${String(commits.length)} commits, ${String(ok.length)} with rules, ${String(withV.length)} with layer violations\n`);
}

main();
