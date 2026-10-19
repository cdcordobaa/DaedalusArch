/**
 * Human-rules pilot runner (v1.3). For each pilot in pilots.json:
 *  1. fetch the repository at its pinned SHA into <work>/<id> (verified);
 *  2. run the pinned dependency-cruiser (experiments/tool-comparison/depcruise, 18.4.0) with the project's OWN
 *     rule file, unchanged, and keep its violations of the human-written layer rules;
 *  3. translate those rules into a DaedalusArch spec (lib.ts, "resolved atoms") and, when the pilot lists one,
 *     also take the hand-written "idiomatic" spec (specs/<id>.idiomatic.yaml);
 *  4. run `firewall evaluate --format json --symbolic-only --engine cypher-interp` with each spec;
 *  5. compare edge keys (from|to) on the files both tools analyse, and write results/v1.3-human-rules-pilot/<id>.json.
 *
 * Usage: npx tsx scripts/v1.3/human-rules-pilot/run.ts --work <dir> [--id <pilot>] [--sha <commit>] [--tag <name>] [--seed <n>]
 * `--seed n` appends, per human layer rule, up to n imports the rule forbids plus as many controls no rule forbids
 * (deterministic choice, lib.chooseSeeds), so both tools are scored on known positives; the tree is restored after.
 * `--sha` re-runs one pilot at another commit of its history (the rule file as of that commit is used).
 * No LLM is called.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import picomatch from 'picomatch';
import { DEFAULT_EXCLUDE_PATTERNS } from '../../../src/apg-extractor/types.js';
import { resolveTemplate } from '../../../src/spec-parser/template-registry.js';
import {
  chooseSeeds, completeSpec, confusion, edgeKey, importSpecifier, inexpressibleEdges, ourKeys, selectLayerRules, theirKeys, toSpecYaml, translate,
} from './lib.js';
import type { DcRule, DcViolation, OursViolation, Seed } from './lib.js';

const REPO = process.cwd(); // run from the repository root
const HERE = path.join(REPO, 'scripts/v1.3/human-rules-pilot');
const RESULTS = path.join(REPO, 'results/v1.3-human-rules-pilot');
const DC_BIN = path.join(REPO, 'experiments/tool-comparison/depcruise/node_modules/.bin/depcruise');

interface Pilot {
  id: string; repo: string; sha: string; root: string; ruleFile: string; targets: string[]; licence: string;
  tsconfig?: string; idiomatic?: string;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function sh(cmd: string, args: string[], cwd: string): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 1 << 30 });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function checkout(p: Pilot, sha: string, work: string): string {
  const dir = path.join(work, p.id);
  if (!fs.existsSync(path.join(dir, '.git'))) {
    const c = sh('git', ['clone', '-q', `https://github.com/${p.repo}.git`, dir], work);
    if (c.status !== 0) throw new Error(`clone ${p.repo}: ${c.stderr}`);
  }
  sh('git', ['checkout', '-q', '--force', sha], dir);
  const head = sh('git', ['rev-parse', 'HEAD'], dir).stdout.trim();
  if (head !== sha) throw new Error(`${p.id}: HEAD ${head} is not the pinned ${sha}`);
  return dir;
}

interface DcModule { source: string; coreModule?: boolean; dependencies: { resolved: string; coreModule?: boolean; couldNotResolve?: boolean; dependencyTypes?: string[] }[] }
interface DcOut { modules: DcModule[]; summary: { violations: DcViolation[]; ruleSetUsed: { forbidden?: DcRule[] }; optionsUsed: Record<string, unknown> } }

function runDepcruise(p: Pilot, root: string): { out: DcOut; wallMs: number; version: string } {
  const t = Date.now();
  const r = sh(DC_BIN, [...p.targets, '--config', p.ruleFile, '--output-type', 'json'], root);
  const wallMs = Date.now() - t;
  if (r.stdout.trim() === '') throw new Error(`${p.id}: dependency-cruiser gave no output (exit ${String(r.status)}): ${r.stderr.slice(0, 500)}`);
  const version = sh(DC_BIN, ['--version'], root).stdout.trim();
  return { out: JSON.parse(r.stdout) as DcOut, wallMs, version };
}

function runOurs(root: string, spec: string, tsconfig: string | undefined): { violations: OursViolation[]; wallMs: number; errors: unknown; files: number } {
  const args = ['tsx', path.join(REPO, 'bin/firewall.ts'), 'evaluate', '--post-seal', 'off', '--project', root, '--spec', spec, '--format', 'json', '--symbolic-only', '--engine', 'cypher-interp'];
  if (tsconfig !== undefined) args.push('--tsconfig', path.join(root, tsconfig));
  const t = Date.now();
  const r = sh('npx', args, REPO);
  const wallMs = Date.now() - t;
  const start = r.stdout.indexOf('{');
  if (start < 0) throw new Error(`firewall gave no JSON (exit ${String(r.status)}): ${r.stderr.slice(0, 800)}`);
  const d = JSON.parse(r.stdout.slice(start)) as { violations: OursViolation[]; functionExecution?: { failed?: unknown[] }; graphStats?: { nodeCountByType?: { File?: number } } };
  return { violations: d.violations, wallMs, errors: d.functionExecution?.failed ?? [], files: d.graphStats?.nodeCountByType?.File ?? -1 };
}

function compareRun(label: string, ours: ReturnType<typeof runOurs>, scope: Set<string>, universe: Set<string>, theirs: Set<string>, dropTypeOnly: boolean): Record<string, unknown> {
  const oursAll = ourKeys(ours.violations, scope);
  const oursCmp = ourKeys(ours.violations, scope, { dropTypeOnly });
  const c = confusion(universe, oursCmp, theirs);
  return {
    label,
    ourFindingsS01S03: ours.violations.filter((v) => v.functionId === 'FF-S01' || v.functionId === 'FF-S03').length,
    ourKeysInScope: oursAll.size,
    ourKeysCompared: oursCmp.size,
    typeOnlyDropped: dropTypeOnly ? oursAll.size - oursCmp.size : 0,
    confusion: c,
    flagged: [...oursCmp].sort(),
    oursOnly: [...oursCmp].filter((k) => !theirs.has(k)).sort(),
    theirsOnly: [...theirs].filter((k) => !oursCmp.has(k)).sort(),
    ourFailedFunctions: ours.errors,
    ourFileNodes: ours.files,
    ourWallMs: ours.wallMs,
  };
}

function main(): void {
  const work = arg('work');
  if (work === undefined) throw new Error('--work <dir> is required');
  fs.mkdirSync(work, { recursive: true });
  fs.mkdirSync(path.join(RESULTS, 'specs'), { recursive: true });
  const pilots = JSON.parse(fs.readFileSync(path.join(HERE, 'pilots.json'), 'utf8')) as Pilot[];
  const only = arg('id');
  const shaArg = arg('sha');
  const tag = arg('tag');
  const seedArg = arg('seed');
  const perRule = seedArg === undefined ? undefined : Number(seedArg);
  for (const p of pilots) {
    if (only !== undefined && p.id !== only) continue;
    const sha = shaArg ?? p.sha;
    const dir = checkout(p, sha, work);
    const root = path.join(dir, p.root);
    let seeds: Seed[] = [];
    if (perRule !== undefined) {
      // Seeded run: pick imports from the unseeded graph, append them, and analyse the seeded tree.
      const base = runDepcruise(p, root);
      const { layer: baseLayer } = selectLayerRules(base.out.summary.ruleSetUsed.forbidden ?? []);
      const isEx = picomatch(DEFAULT_EXCLUDE_PATTERNS, { dot: true });
      const files = base.out.modules.map((m) => m.source).filter((f) => /\.tsx?$/.test(f) && !isEx(f) && !/(^|\/)node_modules\//.test(f) && fs.existsSync(path.join(root, f)));
      const existing = new Set(base.out.modules.flatMap((m) => m.dependencies.map((d) => edgeKey(m.source, d.resolved))));
      seeds = chooseSeeds(baseLayer, files, existing, perRule);
      for (const sd of seeds) fs.appendFileSync(path.join(root, sd.from), `\nimport '${importSpecifier(sd.from, sd.to)}'; // human-rules pilot seed\n`);
    }
    const dc = runDepcruise(p, root);
    const { layer, excluded } = selectLayerRules(dc.out.summary.ruleSetUsed.forbidden ?? []);
    const layerNames = new Set(layer.map((r) => r.name));
    const isExcluded = picomatch(DEFAULT_EXCLUDE_PATTERNS, { dot: true });
    const local = dc.out.modules.filter((m) => m.coreModule !== true && !/(^|\/)node_modules\//.test(m.source) && fs.existsSync(path.join(root, m.source)));
    // Scope: TypeScript files both tools analyse (our extractor's default excludes drop specs, tests and .d.ts).
    const scope = new Set(local.map((m) => m.source).filter((f) => /\.tsx?$/.test(f) && !isExcluded(f)));
    const universe = new Set<string>();
    for (const m of local) {
      if (!scope.has(m.source)) continue;
      for (const d of m.dependencies) if (scope.has(d.resolved)) universe.add(edgeKey(m.source, d.resolved));
    }
    const theirs = theirKeys(dc.out.summary.violations, layerNames, scope);
    const theirsAll = dc.out.summary.violations.filter((v) => layerNames.has(v.rule.name));
    const t = translate(layer, [...scope]);
    const suffix = tag === undefined ? '' : `@${tag}`;
    const specFile = path.join(RESULTS, 'specs', `${p.id}${suffix}.resolved.yaml`);
    fs.writeFileSync(specFile, toSpecYaml(t, [
      `Human-rules pilot: ${p.repo}@${sha} (${p.licence}), rules from ${p.root === '.' ? '' : `${p.root}/`}${p.ruleFile}.`,
      'Generated by scripts/v1.3/human-rules-pilot (resolved-atoms translation of the human-written layer rules).',
      `Layer rules translated: ${layer.map((r) => r.name).join(', ')}.`,
      'Each atom is a set of files with the same position on every rule; its comment names the rule sides it is on.',
    ], resolveTemplate('hexagonal')?.functions ?? []));
    const preDeps = dc.out.summary.optionsUsed.tsPreCompilationDeps;
    // dependency-cruiser without tsPreCompilationDeps does not see type-only imports; we drop ours to compare like with like.
    const dropTypeOnly = preDeps !== true;
    const resolved = compareRun('resolved-atoms', runOurs(root, specFile, p.tsconfig), scope, universe, theirs, dropTypeOnly);
    let idiomatic: Record<string, unknown> | null = null;
    if (p.idiomatic !== undefined && fs.existsSync(path.join(HERE, p.idiomatic))) {
      const idiomFile = path.join(RESULTS, 'specs', `${p.id}${suffix}.idiomatic.yaml`);
      fs.writeFileSync(idiomFile, completeSpec(fs.readFileSync(path.join(HERE, p.idiomatic), 'utf8'), resolveTemplate('hexagonal')?.functions ?? []));
      idiomatic = compareRun('idiomatic', runOurs(root, idiomFile, p.tsconfig), scope, universe, theirs, dropTypeOnly);
    }
    const result: Record<string, unknown> = {
      id: p.id, repo: p.repo, sha, licence: p.licence, ruleFile: p.ruleFile, root: p.root,
      depcruise: {
        version: dc.version, wallMs: dc.wallMs, tsPreCompilationDeps: preDeps ?? false,
        layerRules: layer.map((r) => ({ name: r.name, severity: r.severity ?? null, comment: r.comment ?? null, from: r.from, to: r.to })),
        excludedRules: excluded,
        layerViolationsAll: theirsAll.length,
        layerViolationsInScope: theirs.size,
        otherViolations: dc.out.summary.violations.length - theirsAll.length,
      },
      scope: { files: scope.size, localEdges: universe.size },
      translation: {
        atoms: t.atoms.map((a) => ({ name: a.name, label: a.label, files: a.files.length })),
        forbiddenPairs: t.forbidden.length, allowedPairs: t.allowed.length,
        selfForbidden: t.selfForbidden,
        unconstrainedFiles: t.unconstrained.length,
        inexpressibleEdges: inexpressibleEdges(layer, t, universe),
      },
      theirs: [...theirs].sort(),
      resolved,
      idiomatic,
    };
    if (seeds.length > 0) {
      const flagged = (r: Record<string, unknown> | null, k: string): boolean | null => (r === null ? null : (r.flagged as string[]).includes(k));
      result.seeds = seeds.map((sd) => {
        const k = edgeKey(sd.from, sd.to);
        return { ...sd, theirs: theirs.has(k), oursResolved: flagged(resolved, k), oursIdiomatic: flagged(idiomatic, k) };
      });
      sh('git', ['checkout', '-q', '--force', sha], dir);
    }
    const outFile = path.join(RESULTS, `${p.id}${suffix}.json`);
    fs.writeFileSync(outFile, JSON.stringify(result, null, 1) + '\n');
    const c = resolved.confusion as { both: number; oursOnly: number; theirsOnly: number; kappa: number | null };
    process.stdout.write(`${p.id}${suffix}: their layer violations ${theirs.size}; resolved both/ours/theirs ${c.both}/${c.oursOnly}/${c.theirsOnly} kappa ${String(c.kappa)}`
      + (idiomatic === null ? '' : `; idiomatic ${JSON.stringify((idiomatic.confusion as object))}`) + '\n');
  }
}

main();
