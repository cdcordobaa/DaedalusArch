/**
 * v1.3 options effects on the external human-written set (Docs/DiagnosticRuns/v1.3-options-effects-2026-10-16.md).
 * Entry file: no exports. Runs `firewall evaluate --engine cypher-interp --symbolic-only --format json` on each of the
 * 15 projects of `results/v1.3-external/selection.json` once per option set, with `--advisory-filter <set>`, and
 * keeps only counts: blocking (defining) and advisory (warning) rows per rule, rows the filter suppressed or rolled up
 * per option, the verdict and the IMPORTS edge count. No source and no finding text is written.
 *
 * A row's tier is the one its own report gives (`tiers.blocking.rules` / `tiers.advisory.rules`), as
 * `scripts/v1.3/external-sheet.ts` reads it. No construct switch is applied (src/construct-switches is not used).
 *
 * Usage (repository root; clones at the pinned SHAs under <clones>/<id>, never committed):
 *   node --import tsx scripts/v1.3/options-effects-external.ts --clones <dir> --out results/v1.3-options-effects/external.json
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { OPTION_SETS } from './lib/options-effects.js';

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const clones = path.resolve(arg('--clones') ?? '');
const out = path.resolve(arg('--out') ?? 'results/v1.3-options-effects/external.json');
const repo = process.cwd();
const selection = JSON.parse(fs.readFileSync(path.join(repo, 'results/v1.3-external/selection.json'), 'utf8')) as {
  entries: { id: string; sha: string; root: string }[];
};

interface TierRule { readonly functionId: string; readonly tier: string }
interface Report {
  verdict?: string;
  violations: { functionId: string }[];
  tiers?: { verdict?: string; blocking: { rules: TierRule[] }; advisory: { rules: TierRule[] } };
  graphStats?: { edgeCountByType?: Record<string, number> };
  advisoryFilter?: { options?: string[]; suppressed?: { option?: string; violation?: { functionId?: string } }[] };
}

const childEnv: Record<string, string> = {};
for (const k of ['PATH', 'HOME']) { const v = process.env[k]; if (v !== undefined) childEnv[k] = v; }

function evaluate(projectDir: string, spec: string, filter: string): Report {
  const r = spawnSync(path.join(repo, 'node_modules/.bin/tsx'), [
    'bin/firewall.ts', 'evaluate', '--engine', 'cypher-interp', '--project', projectDir, '--spec', spec,
    '--symbolic-only', '--format', 'json', '--advisory-filter', filter,
  ], { cwd: repo, env: childEnv, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, timeout: 900_000 });
  const start = r.stdout.indexOf('{');
  if (start < 0) throw new Error(`no JSON from evaluate ${projectDir} (${filter}): exit ${String(r.status)} ${r.stderr.slice(0, 400)}`);
  return JSON.parse(r.stdout.slice(start)) as Report;
}

const inc = (m: Record<string, number>, k: string): void => { m[k] = (m[k] ?? 0) + 1; };

const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) as Record<string, unknown> : {};
const projects = (prev.projects ?? {}) as Record<string, Record<string, unknown>>;
for (const e of selection.entries) {
  const head = spawnSync('git', ['-C', path.join(clones, e.id), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  if (head !== e.sha) throw new Error(`${e.id}: clone HEAD ${head} is not the pinned ${e.sha}`);
  const projectDir = path.join(clones, e.id, e.root);
  const spec = path.join(repo, 'results/v1.3-external/specs', `${e.id}.yaml`);
  const per: Record<string, unknown> = projects[e.id] ?? {};
  for (const set of OPTION_SETS) {
    if (per[set.name] !== undefined) continue;
    const t0 = Date.now();
    const rep = evaluate(projectDir, spec, set.filter);
    const tierOf = new Map<string, string>();
    for (const t of [...(rep.tiers?.blocking.rules ?? []), ...(rep.tiers?.advisory.rules ?? [])]) tierOf.set(t.functionId, t.tier);
    const blockingByRule: Record<string, number> = {};
    const advisoryByRule: Record<string, number> = {};
    let untiered = 0;
    for (const v of rep.violations) {
      const t = tierOf.get(v.functionId);
      if (t === 'blocking') inc(blockingByRule, v.functionId); else if (t === 'advisory') inc(advisoryByRule, v.functionId); else untiered += 1;
    }
    const suppressedByOption: Record<string, number> = {};
    const suppressedByRule: Record<string, number> = {};
    let rolledUp = 0;
    for (const s of rep.advisoryFilter?.suppressed ?? []) {
      inc(suppressedByOption, s.option ?? '?');
      inc(suppressedByRule, s.violation?.functionId ?? '?');
      if (s.option === 'cv05-rollup') rolledUp += 1;
    }
    const sum = (m: Record<string, number>): number => Object.values(m).reduce((a, b) => a + b, 0);
    per[set.name] = {
      verdict: rep.tiers?.verdict ?? rep.verdict, blocking: sum(blockingByRule), advisory: sum(advisoryByRule), untiered,
      suppressed: sum(suppressedByOption), rolledUp, blockingByRule, advisoryByRule, suppressedByOption, suppressedByRule,
      imports: rep.graphStats?.edgeCountByType?.IMPORTS ?? null, wallMs: Date.now() - t0,
    };
    projects[e.id] = per;
    process.stderr.write(`${e.id} ${set.name}: blocking ${String(sum(blockingByRule))}, advisory ${String(sum(advisoryByRule))}\n`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ engine: 'cypher-interp', projects }, null, 1) + '\n');
  }
}
fs.writeFileSync(out, JSON.stringify({ engine: 'cypher-interp', projects }, null, 1) + '\n');
