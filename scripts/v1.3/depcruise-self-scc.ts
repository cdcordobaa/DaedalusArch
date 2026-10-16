/**
 * B3 (Docs/DiagnosticRuns/v1.3-jury-fixes-2026-10-16.md): does dependency-cruiser, the pinned 18.4.0
 * (experiments/tool-comparison/depcruise, the Study 1 / #166 pin), reproduce the 8-module SCC that the dogfood run
 * (#155, Docs/v1.3/dogfood.md D1) found on this repository's own src/? No LLM, no Neo4j. Entry file: no exports.
 *
 * Usage (repository root; depcruise installed with `npm ci --ignore-scripts` in experiments/tool-comparison/depcruise):
 *   node --import tsx scripts/v1.3/depcruise-self-scc.ts --tree <checkout> --label <name> [--tree <c2> --label <n2> ...]
 *     [--depcruise <bin>] [--out <file.json>]
 * Each <checkout> is a work tree of this repository (e.g. `git worktree add <dir> b08ec387`) with node_modules.
 *
 * Per tree, one cruise of src/ with two rules: `no-circular-folder` (scope: folder, dependency-cruiser's own folder
 * cycle detection) and `no-circular-module`. Resolution options are graph-fidelity's (`depcruiseConfig`). Then the
 * cruised module graph is collapsed to top-level src/ folders and an unbounded SCC is run on it, once with every
 * dependency and once without type-only imports (`type-only`, `type-import`), and compared with the D1 set.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { stronglyConnectedComponents } from '../../src/evaluation-engine/scc-cycles.js';

const D1 = ['apg-enrich', 'construct-switches', 'evaluation-engine', 'fitness-compiler', 'llm-critic', 'report', 'scoring-engine', 'spec-parser'];
const argv = process.argv.slice(2);
const all = (n: string): string[] => argv.flatMap((a, i) => (a === `--${n}` && argv[i + 1] !== undefined ? [argv[i + 1] as string] : []));
const one = (n: string): string | undefined => all(n)[0];
const trees = all('tree');
const labels = all('label');
if (trees.length === 0 || trees.length !== labels.length) throw new Error('give --tree <dir> --label <name> pairs');
const depcruise = path.resolve(one('depcruise') ?? 'experiments/tool-comparison/depcruise/node_modules/.bin/depcruise');
const out = one('out');

const CONFIG = `module.exports = {
  forbidden: [
    { name: 'no-circular-folder', severity: 'error', scope: 'folder', from: { path: '^src/' }, to: { circular: true } },
    { name: 'no-circular-module', severity: 'warn', from: { path: '^src/' }, to: { circular: true } },
  ],
  options: {
    tsPreCompilationDeps: true,
    doNotFollow: { path: '(^|/)node_modules/' },
    exclude: { path: ['(^|/)node_modules/', '^\\\\.git/'] },
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { extensions: ['.ts', '.tsx', '.d.ts', '.js', '.jsx', '.json'] },
  },
};
`;

interface Dep { readonly resolved: string; readonly couldNotResolve?: boolean; readonly coreModule?: boolean; readonly dependencyTypes?: readonly string[] }
interface Cruise {
  readonly modules: readonly { readonly source: string; readonly dependencies: readonly Dep[] }[];
  readonly summary: { readonly totalCruised: number; readonly violations: readonly { readonly from: string; readonly rule: { readonly name: string }; readonly cycle?: readonly { readonly name: string }[] }[] };
}

const top = (p: string): string | undefined => { const s = p.split('/'); return s[0] === 'src' && s.length > 2 ? s[1] : undefined; };
const TYPE_ONLY = new Set(['type-only', 'type-import']);

function topLevelSccs(c: Cruise, withTypeOnly: boolean): string[][] {
  const g = new Map<string, Set<string>>();
  for (const m of c.modules) {
    const a = top(m.source);
    if (a === undefined) continue;
    if (!g.has(a)) g.set(a, new Set());
    for (const d of m.dependencies) {
      if (d.couldNotResolve === true || d.coreModule === true) continue;
      if (!withTypeOnly && (d.dependencyTypes ?? []).some((t) => TYPE_ONLY.has(t))) continue;
      const b = top(d.resolved);
      if (b === undefined || b === a) continue;
      g.get(a)?.add(b);
      if (!g.has(b)) g.set(b, new Set());
    }
  }
  const sorted = new Map([...g.keys()].sort().map((k): [string, readonly string[]] => [k, [...(g.get(k) ?? [])].sort()]));
  return stronglyConnectedComponents(sorted).filter((s) => s.length >= 2).map((s) => [...s].sort());
}
const vsD1 = (sccs: readonly string[][]) => sccs.map((s) => ({
  size: s.length, members: s, equalsD1: s.length === D1.length && D1.every((m) => s.includes(m)),
  extra: s.filter((m) => !D1.includes(m)), missingFromD1: D1.filter((m) => !s.includes(m)),
}));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'depcruise-self-'));
const cfg = path.join(tmp, 'folder-circular.cjs');
fs.writeFileSync(cfg, CONFIG);
const version = spawnSync(depcruise, ['--version'], { encoding: 'utf8' }).stdout.trim();
const results: Record<string, unknown> = {};
try {
  trees.forEach((tree, i) => {
    const label = labels[i] as string;
    const t0 = performance.now();
    const r = spawnSync(depcruise, ['src', '--config', cfg, '--output-type', 'json', '--no-progress'], { cwd: path.resolve(tree), encoding: 'utf8', maxBuffer: 1 << 30 });
    const ms = Math.round(performance.now() - t0);
    if (r.stdout === '') throw new Error(`${label}: depcruise produced no output: ${r.stderr}`);
    const c = JSON.parse(r.stdout) as Cruise;
    const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: path.resolve(tree), encoding: 'utf8' }).stdout.trim();
    const folder = c.summary.violations.filter((v) => v.rule.name === 'no-circular-folder');
    results[label] = {
      sha, elapsedMs: ms, modulesCruised: c.summary.totalCruised,
      moduleScopeCycles: c.summary.violations.filter((v) => v.rule.name === 'no-circular-module').length,
      folderScope: {
        violations: folder.length,
        longestCycleFolders: folder.reduce((m, v) => Math.max(m, v.cycle?.length ?? 0), 0),
        topLevelFoldersInvolved: [...new Set(folder.flatMap((v) => [v.from, ...(v.cycle ?? []).map((x) => x.name)]).map((f) => top(`${f}/x`)).filter((x): x is string => x !== undefined))].sort(),
        cycles: folder.map((v) => ({ from: v.from, cycle: (v.cycle ?? []).map((x) => x.name) })),
      },
      topLevelScc: { allDependencies: vsD1(topLevelSccs(c, true)), withoutTypeOnly: vsD1(topLevelSccs(c, false)) },
    };
    process.stderr.write(`${label} (${sha.slice(0, 8)}): ${String(c.summary.totalCruised)} modules, ${String(ms)} ms\n`);
  });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
const text = JSON.stringify({ depcruise: version, d1: D1, trees: results }, null, 1) + '\n';
if (out !== undefined) fs.writeFileSync(out, text);
process.stdout.write(text);
