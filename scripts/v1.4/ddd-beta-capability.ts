/**
 * DDD beta capability study (v1.4 DDD-BETA, author decision 2026-10-19 in `ops/decisions.md`). Entry file: no exports.
 * Report: `Docs/DiagnosticRuns/v1.4-ddd-beta-capability-2026-10-19.md`. Helpers: `scripts/v1.4/lib/ddd-beta.ts`.
 * DEVELOPMENT DATA ONLY: no pre-registration, not a registered SO4 estimate. Zero model calls; engine `cypher-interp`.
 *
 * Bases: every `style: ddd` entry of `results/v1.3-external*\/selection.json` with its frozen spec, the three DDD
 * bases of the v1.3 hex/DDD operator run (`experiments/v1.3-operators-hexddd/projects.json`, `*-ddd.yaml`), the DDD
 * reference project (`tests/fixtures/v1.3-reference/ddd/clean`, `presets/ddd.yaml`) and the final step of the two kept
 * DDD loop-pilot runs (relief-volunteers none / gate, the TIER-A3 `dc` spec). External repositories are cloned at their
 * pinned SHAs into `--clones` beforehand (scratch, never committed); nothing is installed.
 *
 * Modes (repository root):
 *   npx tsx scripts/v1.4/ddd-beta-capability.ts census   --clones <dir> --work <dir> --out results/v1.4-ddd-beta
 *   npx tsx scripts/v1.4/ddd-beta-capability.ts fixtures --work <dir> --out results/v1.4-ddd-beta
 *   npx tsx scripts/v1.4/ddd-beta-capability.ts recall   --clones <dir> --work <dir> --out <dir> --bases a,b [--k 3] [--k-twin 2]
 *   npx tsx scripts/v1.4/ddd-beta-capability.ts merge    --out results/v1.4-ddd-beta <recall dir>,<recall dir>,...
 *   npx tsx scripts/v1.4/ddd-beta-capability.ts report   --out results/v1.4-ddd-beta   (summary.json, reach.md)
 *
 * - census: per base, the CLI `evaluate --symbolic-only --scoring v1.3 --engine cypher-interp --format json` with
 *   `--post-seal off` and `on`; a ts-morph census of the tree (classes, their bases, resolved named imports); the
 *   concept map, the grain census, the shadow class-grain FF-DT01 count and the rule preconditions. `census.json`.
 * - fixtures: every DDD reference variant materialised (`clean/` copied, `delete` applied, overlay on top) and
 *   evaluated with both post-seal settings; the blocking DDD findings compared with `expected-findings.json` on rule,
 *   file and target. `fixtures.json`.
 * - recall: the existing operators on each base (as U10 `seeded-recall-agent.ts`: the U5a catalogue in-coverage
 *   operators and the hex/DDD operators of style `ddd`; MO-H07 is added on `ddd` because the post-seal overlay puts
 *   FF-S02 `no-cyclic-deps` into the DDD rule set). Seeded sample of at most `--k` positive and `--k-twin` twin sites
 *   per operator and base. Type-check gate: the repository's TypeScript on the base's own tsconfig, missing packages
 *   stubbed alike in the unmutated copy and every mutant (BR-U5a-10); a mutant with more errors than its unmutated
 *   copy is not evaluated. Evaluation in process, post-seal on. `recall/run.json`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { Project } from 'ts-morph';
import picomatch from 'picomatch';
import { parse as parseYaml } from 'yaml';
import { DEFAULT_EXCLUDE_PATTERNS } from '../../src/apg-extractor/types.js';
import { createPipeline } from '../../src/pipeline/pipeline-factory.js';
import { parseInstrumentVersion } from '../../src/fitness-compiler/role-exemptions.js';
import { parseNeuralAggregation } from '../../src/scoring-engine/neural-aggregation.js';
import { parseScoringMode } from '../../src/scoring-engine/tiered-scoring.js';
import { ruleTier } from '../../src/scoring-engine/rule-tiers.js';
import { buildChildEnv } from '../../src/shared/process/node-process-runner.js';
import { harnessTsconfigText } from '../lib/generators/harness-tsconfig.js';
import { CYCLE_ROW_CAP, MAX_CYCLE_LENGTH } from '../lib/mutation/cycles.js';
import { compiledParams, compiledThresholds, loadCompiledSpec } from '../lib/mutation/expected.js';
import type { CompiledSpec } from '../lib/mutation/expected.js';
import { buildImportGraph, openImportGraphProject } from '../lib/mutation/import-graph.js';
import { makePreparedBase } from '../lib/mutation/prepare.js';
import { mulberry32 } from '../lib/mutation/rng.js';
import { baseCycleCount, evaluatePreconditions, sortSites } from '../lib/mutation/sites.js';
import { collectImportUses, provisionStubs } from '../lib/mutation/stubs.js';
import type { ImportUse } from '../lib/mutation/stubs.js';
import type { MutationOperator, MutationSite, PreconditionContext, ProjectHandle } from '../lib/mutation/types.js';
import { HEXDDD_OPERATORS } from '../lib/mutation/hexddd/index.js';
import { expectedKeys, newViolations, matchesKey, seedOf } from '../v1.3/lib/operators-hexddd.js';
import type { ExpectedKey, TemplateIds, Violation } from '../v1.3/lib/operators-hexddd.js';
import { operatorsFor, positiveOf } from './lib/seeded-recall-agent.js';
import {
  DDD_BLOCKING_RULES, betaReady, conceptMap, grainCensus, rulePreconditions, shadowClassGrainDt01, summariseByRule, twinTally,
} from './lib/ddd-beta.js';
import type { FileFact, KeyRow, LayerDecl, SpecDecl } from './lib/ddd-beta.js';

const REPO = process.cwd();
const SEED = 20261019;
const TSC = path.join(REPO, 'node_modules/typescript/lib/tsc.js');
const PILOT_RUNS = 'experiments/loop-pilot/run-2026-10-16/outputs/runs/claude-code-cli/claude-sonnet-5-5/relief-volunteers';

type BaseKind = 'real' | 'fixture' | 'agent';

interface BaseDef {
  readonly id: string;
  readonly kind: BaseKind;
  readonly source: string;
  readonly specPath: string;
  /** How to obtain the tree: a clone sub-directory, a repository directory, or a pilot snapshot. */
  readonly clone?: { readonly id: string; readonly root: string; readonly sha: string; readonly repo: string };
  readonly dir?: string;
  readonly snapshot?: { readonly arm: string; readonly step: number };
}

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function bases(): BaseDef[] {
  const out: BaseDef[] = [];
  for (const sel of ['v1.3-external', 'v1.3-external-2', 'v1.3-external-3']) {
    const doc = JSON.parse(fs.readFileSync(path.join(REPO, 'results', sel, 'selection.json'), 'utf8')) as { entries: { id: string; repo: string; sha: string; style: string; root: string }[] };
    for (const e of doc.entries) {
      if (e.style !== 'ddd') continue;
      out.push({ id: e.id, kind: 'real', source: `results/${sel}/selection.json`, specPath: `results/${sel}/specs/${e.id}.yaml`, clone: { id: e.id, root: e.root, sha: e.sha, repo: e.repo } });
    }
  }
  const hd = JSON.parse(fs.readFileSync(path.join(REPO, 'experiments/v1.3-operators-hexddd/projects.json'), 'utf8')) as { projects: { id: string; repo: string; sha: string; root: string }[] };
  for (const p of hd.projects) {
    out.push({ id: `${p.id}-ddd`, kind: 'real', source: 'experiments/v1.3-operators-hexddd/projects.json', specPath: `experiments/v1.3-operators-hexddd/specs/${p.id}-ddd.yaml`, clone: { id: p.id, root: p.root, sha: p.sha, repo: p.repo } });
  }
  out.push({ id: 'ref-ddd', kind: 'fixture', source: 'tests/fixtures/v1.3-reference/ddd', specPath: 'presets/ddd.yaml', dir: 'tests/fixtures/v1.3-reference/ddd/clean' });
  for (const arm of ['none', 'gate']) {
    out.push({ id: `relief-volunteers-${arm}`, kind: 'agent', source: `${PILOT_RUNS}/${arm}/run-0`, specPath: `results/v1.4-ddd-b2-v9/specs/relief-volunteers/${arm}/dc.yaml`, snapshot: { arm, step: 4 } });
  }
  return out;
}

/** The base's tree in `<work>/<id>/tree` (a copy: the clone and the fixture are never written), with its tsconfig. */
function materialise(b: BaseDef, clones: string, work: string): { tree: string; tsconfig: string } {
  const tree = path.join(work, b.id, 'tree');
  fs.rmSync(tree, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(tree), { recursive: true });
  if (b.clone !== undefined) {
    const src = path.join(clones, b.clone.id, b.clone.root);
    const head = execFileSync('git', ['-C', path.join(clones, b.clone.id), 'rev-parse', 'HEAD']).toString().trim();
    if (head !== b.clone.sha) throw new Error(`${b.id}: clone at ${head}, pinned ${b.clone.sha}`);
    fs.cpSync(src, tree, { recursive: true, filter: (s) => !/[\\/](node_modules|\.git)$/.test(s) });
  } else if (b.dir !== undefined) {
    fs.cpSync(path.join(REPO, b.dir), tree, { recursive: true });
  } else if (b.snapshot !== undefined) {
    const runDir = path.join(REPO, b.source);
    const rec = JSON.parse(fs.readFileSync(path.join(runDir, 'steps', `step-${String(b.snapshot.step - 1).padStart(2, '0')}.json`), 'utf8')) as { finalCommit: string };
    fs.mkdirSync(tree, { recursive: true });
    const tar = execFileSync('git', ['--git-dir', path.join(runDir, 'snapshots.git'), 'archive', rec.finalCommit], { maxBuffer: 256 * 1024 * 1024 });
    execFileSync('tar', ['-x', '-C', tree], { input: tar });
    // Relative paths, so a copy of the tree (the recall's base and mutant copies) reads its own files.
    fs.writeFileSync(path.join(tree, 'tsconfig.json'), harnessTsconfigText(tree).split(tree).join('.'));
  }
  return { tree, tsconfig: 'tsconfig.json' };
}

// ── Spec and tree facts ─────────────────────────────────────────────────────

interface RawSpec {
  architecture: {
    layers: { name: string; kind?: string; directories?: string[]; roles?: string[] }[];
    allowed_dependencies?: { from: string; to: string[] }[];
    ddd: SpecDecl['ddd'];
  };
}

function specDecl(specPath: string): SpecDecl {
  const raw = parseYaml(fs.readFileSync(path.join(REPO, specPath), 'utf8')) as RawSpec;
  const layers: LayerDecl[] = raw.architecture.layers.map((l) => ({ name: l.name, kind: l.kind ?? null, directories: l.directories ?? [], roles: l.roles ?? [] }));
  const allowed = new Map<string, string[]>();
  for (const a of raw.architecture.allowed_dependencies ?? []) allowed.set(a.from, [...(allowed.get(a.from) ?? []), ...a.to]);
  return { layers, allowed, ddd: raw.architecture.ddd };
}

const baseName = (t: string): string => t.replace(/<.*$/s, '').replace(/^.*\./, '').trim();

/** Classes, their direct bases and the resolved named imports of every analysed file (the extractor's exclusions). */
function treeFacts(tree: string, tsconfig: string): FileFact[] {
  const project = new Project({ tsConfigFilePath: path.join(tree, tsconfig), skipFileDependencyResolution: false });
  const excluded = picomatch([...DEFAULT_EXCLUDE_PATTERNS], { dot: true });
  const rel = (abs: string): string => path.relative(tree, abs).split(path.sep).join('/');
  const facts: FileFact[] = [];
  for (const sf of project.getSourceFiles()) {
    const file = rel(sf.getFilePath());
    if (file.startsWith('..') || excluded(file)) continue;
    const classes = sf.getClasses().filter((c) => c.getName() !== undefined).map((c) => ({
      name: c.getName() as string,
      extends: c.getExtends() !== undefined ? baseName(c.getExtends()?.getExpression().getText() ?? '') : null,
      implements: c.getImplements().map((i) => baseName(i.getExpression().getText())),
    }));
    const imports = sf.getImportDeclarations().flatMap((d) => {
      const t = d.getModuleSpecifierSourceFile();
      if (t === undefined) return [];
      const target = rel(t.getFilePath());
      if (target.startsWith('..') || target.includes('node_modules/')) return [];
      const names = [...d.getNamedImports().map((n) => n.getName()), ...(d.getDefaultImport() !== undefined ? ['default'] : [])];
      return [{ target, names }];
    });
    const types = [...sf.getInterfaces().map((i) => i.getName()), ...sf.getTypeAliases().map((t) => t.getName())];
    facts.push({ file, classes, imports, types });
  }
  return facts.sort((a, b) => (a.file < b.file ? -1 : 1));
}

// ── CLI evaluation (census, fixtures) ───────────────────────────────────────

interface CliReport {
  violations: { functionId: string; filePath: string; target?: string | null; message?: string }[];
  functionResults: { functionId: string; name: string; violationCount: number }[];
  disabledFunctions: { functionId: string; name: string; reason: string }[];
  layerAnnotation?: { mapped: number; unmapped: number; unmappedFiles: string[] };
  graphStats?: { nodeCountByType: Record<string, number> };
  tiers: { style: string; blocking: { rules: { functionId: string; violationCount: number }[] } };
  postSealAdded?: string[];
}

function cli(tree: string, specPath: string, tsconfig: string, postSeal: 'on' | 'off'): CliReport | { error: string } {
  const env = buildChildEnv(process.env, ['PATH', 'HOME']);
  const argv = ['tsx', path.join(REPO, 'bin/firewall.ts'), 'evaluate', '--post-seal', postSeal, '--project', tree, '--spec', path.join(REPO, specPath), '--symbolic-only',
    '--scoring', 'v1.3', '--tsconfig', path.join(tree, tsconfig), '--format', 'json', '--engine', 'cypher-interp'];
  try {
    return JSON.parse(execFileSync('npx', argv, { cwd: REPO, env, maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8')) as CliReport;
  } catch (e) {
    const stdout = (e as { stdout?: Buffer }).stdout?.toString('utf8') ?? '';
    if (stdout.trim().startsWith('{')) return JSON.parse(stdout) as CliReport;
    const stderr = (e as { stderr?: Buffer }).stderr?.toString('utf8') ?? String(e);
    return { error: stderr.split('\n').filter((l) => l.trim() !== '').slice(-1).join(' ').split(tree).join('<project>') };
  }
}

const relPath = (p: string, tree: string): string => p.split(',').map((x) => (x.startsWith(`${tree}/`) ? x.slice(tree.length + 1) : x)).join(',');

/** Per DDD blocking rule: compiled and run, disabled (with reason), absent; blocking violations with file and target. */
function ruleRows(r: CliReport, tree: string): Record<string, { status: string; violations: number; findings: { file: string; target: string | null }[] }> {
  const out: Record<string, { status: string; violations: number; findings: { file: string; target: string | null }[] }> = {};
  const blocking = new Set(r.tiers.blocking.rules.map((x) => String(x.functionId)));
  for (const rule of DDD_BLOCKING_RULES) {
    const ran = r.functionResults.find((f) => String(f.functionId) === rule);
    const dis = r.disabledFunctions.find((f) => String(f.functionId) === rule);
    const findings = r.violations.filter((v) => v.functionId === rule).map((v) => ({ file: relPath(v.filePath, tree), target: typeof v.target === 'string' ? relPath(v.target, tree) : null }));
    out[rule] = {
      status: ran !== undefined ? (blocking.has(rule) ? 'ran (blocking)' : 'ran (advisory)') : dis !== undefined ? `disabled: ${dis.reason.split(tree).join('<project>')}` : 'absent',
      violations: findings.length,
      findings,
    };
  }
  return out;
}

async function census(clones: string, work: string, out: string): Promise<void> {
  const rows: Record<string, unknown>[] = [];
  for (const b of bases()) {
    process.stderr.write(`census ${b.id}\n`);
    const { tree, tsconfig } = materialise(b, clones, work);
    const spec = specDecl(b.specPath);
    const facts = treeFacts(tree, tsconfig);
    const grain = grainCensus(spec, facts);
    const evals: Record<string, unknown> = {};
    let unmapped: { files: number; unmapped: number; share: number; unmappedFiles: string[] } | null = null;
    let graphNodes: Record<string, number> | null = null;
    for (const ps of ['off', 'on'] as const) {
      const r = cli(tree, b.specPath, tsconfig, ps);
      if ('error' in r) {
        evals[ps] = { error: r.error };
        continue;
      }
      evals[ps] = { rules: ruleRows(r, tree), postSealAdded: r.postSealAdded ?? [] };
      if (r.layerAnnotation !== undefined) {
        const n = r.layerAnnotation.mapped + r.layerAnnotation.unmapped;
        unmapped = { files: n, unmapped: r.layerAnnotation.unmapped, share: n > 0 ? r.layerAnnotation.unmapped / n : 0, unmappedFiles: r.layerAnnotation.unmappedFiles.map((f) => relPath(f, tree)) };
      }
      graphNodes = r.graphStats?.nodeCountByType ?? null;
    }
    const files = facts.map((f) => f.file);
    const inContext = files.filter((f) => spec.ddd.contexts.some((c) => f.startsWith(c.root))).length;
    const outside = files.filter((f) => (spec.ddd.outside_contexts ?? []).some((g) => picomatch(g, { dot: true })(f))).length;
    rows.push({
      id: b.id, kind: b.kind, source: b.source, spec: b.specPath, ...(b.clone !== undefined ? { repo: b.clone.repo, sha: b.clone.sha, root: b.clone.root } : {}),
      files: files.length, unmapped, graphNodes,
      contextShare: { inContext, outsideDeclared: outside, neither: files.length - inContext - outside },
      concepts: conceptMap(spec, facts),
      grain,
      shadowClassGrainDt01: shadowClassGrainDt01(spec, facts, grain),
      preconditions: rulePreconditions(spec, facts),
      evaluation: evals,
    });
  }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'census.json'), `${JSON.stringify({ schema: 'ddd-beta-census/v1', engine: 'cypher-interp (CLI, scoring v1.3, symbolic-only)', rows }, null, 1)}\n`);
}

// ── Fixtures ────────────────────────────────────────────────────────────────

async function fixtures(work: string, out: string): Promise<void> {
  const root = path.join(REPO, 'tests/fixtures/v1.3-reference/ddd');
  const variants = ['clean', ...fs.readdirSync(path.join(root, 'variants')).sort()];
  const rows: Record<string, unknown>[] = [];
  for (const v of variants) {
    const tree = path.join(work, 'fixtures', v);
    fs.rmSync(tree, { recursive: true, force: true });
    fs.cpSync(path.join(root, 'clean'), tree, { recursive: true });
    let expected = JSON.parse(fs.readFileSync(path.join(root, 'clean/expected-findings.json'), 'utf8')) as { findings: { rule: string; file: string; target?: string }[] };
    let planted: string | null = null;
    if (v !== 'clean') {
      const vd = path.join(root, 'variants', v);
      const meta = JSON.parse(fs.readFileSync(path.join(vd, 'variant.json'), 'utf8')) as { rule: string; delete: string[] };
      planted = meta.rule;
      for (const d of meta.delete) fs.rmSync(path.join(tree, d), { force: true });
      fs.cpSync(path.join(vd, 'overlay'), tree, { recursive: true });
      expected = JSON.parse(fs.readFileSync(path.join(vd, 'expected-findings.json'), 'utf8')) as typeof expected;
    }
    const res: Record<string, unknown> = {};
    for (const ps of ['off', 'on'] as const) {
      const r = cli(tree, 'presets/ddd.yaml', 'tsconfig.json', ps);
      if ('error' in r) {
        res[ps] = { error: r.error };
        continue;
      }
      const rr = ruleRows(r, tree);
      const blockingFound = Object.entries(rr).flatMap(([rule, x]) => (x.status === 'ran (blocking)' ? x.findings.map((f) => ({ rule, ...f })) : []));
      const exp = expected.findings.filter((f) => DDD_BLOCKING_RULES.includes(f.rule) && ruleTier(f.rule, 'ddd').tier === 'blocking');
      const key = (f: { rule: string; file: string; target?: string | null }): string => `${f.rule}|${f.file}|${f.target ?? ''}`;
      const foundKeys = new Set(blockingFound.map(key));
      const expKeys = new Set(exp.map(key));
      res[ps] = {
        rules: Object.fromEntries(Object.entries(rr).map(([k, x]) => [k, { status: x.status, violations: x.violations }])),
        expectedBlocking: exp.map(key), matched: exp.filter((f) => foundKeys.has(key(f))).map(key),
        missed: exp.filter((f) => !foundKeys.has(key(f))).map(key), unexpected: blockingFound.filter((f) => !expKeys.has(key(f))).map(key),
      };
    }
    rows.push({ variant: v, plantedRule: planted, ...res });
    process.stderr.write(`fixture ${v} done\n`);
  }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'fixtures.json'), `${JSON.stringify({ schema: 'ddd-beta-fixtures/v1', spec: 'presets/ddd.yaml', rows }, null, 1)}\n`);
}

// ── Seeded recall ───────────────────────────────────────────────────────────

/** The operators run on a `ddd` base: U10's set plus MO-H07 / MO-H07n (FF-S02 is in the DDD rule set post-seal). */
function dddOperators(): MutationOperator[] {
  const extra = HEXDDD_OPERATORS.filter((o) => o.id === 'MO-H07' || o.id === 'MO-H07n');
  return [...operatorsFor('ddd'), ...extra];
}

/** Template → function ids under the spec, plus the post-seal overlay's templates when the spec does not declare them. */
function templateIds(compiled: CompiledSpec): TemplateIds {
  const ids = new Map<string, readonly string[]>([...compiled.enabled.entries()].map(([t, f]) => [t, f.map((x) => x.functionId)]));
  if (!compiled.declared.has('no-cyclic-deps')) ids.set('no-cyclic-deps', ['FF-S02']);
  if (!compiled.declared.has('application-purity')) ids.set('application-purity', ['FF-P07']);
  return ids;
}

function tscErrors(dir: string, tsconfig: string): number {
  const r = spawnSync(process.execPath, [TSC, '--noEmit', '-p', path.join(dir, tsconfig)], { encoding: 'utf8', cwd: dir, timeout: 900_000, maxBuffer: 256 * 1024 * 1024 });
  if (r.status === 0) return 0;
  const n = `${r.stdout}${r.stderr}`.split('\n').filter((l) => /error TS\d+/.test(l)).length;
  return n > 0 ? n : 1;
}

async function evaluateInProcess(projectDir: string, specPath: string, tsconfig: string, apgStore: string): Promise<Violation[]> {
  const { executor, cleanup } = createPipeline({
    projectPath: projectDir, specFilePath: path.join(REPO, specPath), neo4jUri: '', neo4jUser: 'neo4j', neo4jPassword: '',
    evaluationMode: 'symbolic-only', pipelineMode: 'stateless', persist: false, diff: false, verbose: false,
    apgStorePath: apgStore, tsconfigPath: path.join(projectDir, tsconfig),
    instrumentVersion: parseInstrumentVersion('v2'), neuralAggregation: parseNeuralAggregation('registered'),
    scoringMode: parseScoringMode('v1.3'), graphEngine: 'cypher-interp', postSealRules: true,
  });
  try {
    const result = await executor.execute();
    if (!result.success) throw new Error(result.errors.map((e) => e.message).join('; '));
    return result.data.violations
      .filter((v) => typeof v.functionId === 'string' && typeof v.filePath === 'string')
      .map((v) => {
        const o = v as unknown as { functionId: string; filePath: string; target?: unknown; discriminator?: unknown };
        const disc = Array.isArray(o.discriminator) ? (o.discriminator as unknown[]).filter((d): d is string => typeof d === 'string') : [];
        return { functionId: o.functionId, filePath: relPath(o.filePath, projectDir), target: typeof o.target === 'string' ? relPath(o.target, projectDir) : '', discriminator: disc };
      });
  } finally {
    await cleanup();
  }
}

interface RecallRow extends KeyRow {
  readonly rowId: string;
  readonly site: MutationSite;
  readonly expected: readonly ExpectedKey[];
  readonly absentTemplates: readonly string[];
  readonly newBlocking: readonly Violation[];
  readonly typecheck: { readonly base: number; readonly mutant: number | null };
  readonly detail?: string;
  readonly diff: string;
}

interface Cell {
  readonly baseId: string;
  readonly operatorId: string;
  readonly candidates: number;
  readonly eligible: number;
  readonly sampled: number;
  readonly rejected: Readonly<Record<string, number>>;
}

function copyWithStubs(src: string, dest: string, tsconfig: string, uses: readonly ImportUse[]): void {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true, filter: (s) => !/[\\/](node_modules|\.git)$/.test(s) });
  provisionStubs(dest, tsconfig, uses);
}

function diffOf(before: string, after: string, label: string): string {
  return spawnSync('diff', ['-u', '--label', `a/${label}`, '--label', `b/${label}`, fs.existsSync(before) ? before : '/dev/null', after], { encoding: 'utf8' }).stdout;
}

async function recallBase(b: BaseDef, clones: string, work: string, k: number, kTwin: number, rows: RecallRow[], cells: Cell[]): Promise<Record<string, unknown>> {
  const { tree: raw, tsconfig } = materialise(b, clones, work);
  const baseCopy = path.join(work, b.id, 'base');
  const usesR = collectImportUses(raw, tsconfig);
  const baseUses: readonly ImportUse[] = usesR.success ? usesR.data : [];
  copyWithStubs(raw, baseCopy, tsconfig, baseUses);
  const baseErrors = tscErrors(baseCopy, tsconfig);
  const compiled = await loadCompiledSpec(REPO, b.specPath);
  if (!compiled.success) return { id: b.id, excluded: `spec: ${compiled.errors.map((e) => e.message).join('; ')}` };
  const ids = templateIds(compiled.data);
  const apgStore = path.join(work, b.id, 'apg-store');
  const baseline = await evaluateInProcess(baseCopy, b.specPath, tsconfig, apgStore);
  const handle: ProjectHandle = openImportGraphProject(baseCopy, tsconfig);
  const prepared = makePreparedBase({
    projectId: b.id, baseKind: 'generated', dir: baseCopy, baseGenerationTreeSha: '0'.repeat(40),
    tsconfigPath: tsconfig, tscPath: TSC, tscVersion: 'repository tsc', overlays: [], specPath: b.specPath,
  });
  if (!prepared.success) throw new Error(prepared.errors.map((e) => e.message).join('; '));
  const g = buildImportGraph(handle, compiled.data.layers);
  const ctx: PreconditionContext = {
    base: prepared.data, baseGraph: g, baseCycleCount: baseCycleCount(g, MAX_CYCLE_LENGTH, CYCLE_ROW_CAP), maxCycleLength: MAX_CYCLE_LENGTH,
    cycleRowCap: CYCLE_ROW_CAP, thresholds: compiledThresholds(compiled.data), templateParams: compiledParams(compiled.data), enabledTemplates: [...compiled.data.enabled.keys(), 'no-cyclic-deps'],
  };
  let n = 0;
  for (const op of dddOperators()) {
    let candidates: MutationSite[];
    try {
      candidates = sortSites(op.findSites(handle, compiled.data.spec));
    } catch (e) {
      cells.push({ baseId: b.id, operatorId: op.id, candidates: 0, eligible: 0, sampled: 0, rejected: { [`findSites-error: ${e instanceof Error ? e.message : String(e)}`]: 1 } });
      continue;
    }
    const tally = evaluatePreconditions(op, handle, compiled.data.spec, candidates, ctx);
    const role = op.role === 'twin' ? 'twin' : 'positive';
    const want = role === 'twin' ? kTwin : k;
    const sample = mulberry32(seedOf(`${b.id}|${op.id}`, SEED)).pickDistinct(tally.eligible, Math.min(want, tally.eligible.length));
    cells.push({ baseId: b.id, operatorId: op.id, candidates: candidates.length, eligible: tally.eligible.length, sampled: sample.length, rejected: { ...tally.rejectedByReason } });
    for (const { site } of sample) {
      const rowId = `${b.id}__${op.id}__${String(n++)}`;
      const row = await applyRow(op, site, rowId, b, raw, baseCopy, path.join(work, b.id, 'mutant'), tsconfig, ids, baseUses, baseErrors, baseline, apgStore);
      rows.push(row);
      process.stderr.write(`${rowId}: ${row.status}\n`);
    }
  }
  return { id: b.id, kind: b.kind, files: g.files.size, tscErrors: baseErrors, baselineViolations: baseline.length, baselineBlocking: baseline.filter((v) => ruleTier(v.functionId, 'ddd').tier === 'blocking').length };
}

async function applyRow(
  op: MutationOperator, site: MutationSite, rowId: string, b: BaseDef, raw: string, baseCopy: string, dest: string, tsconfig: string,
  ids: TemplateIds, baseUses: readonly ImportUse[], baseErrors: number, baseline: readonly Violation[], apgStore: string,
): Promise<RecallRow> {
  const role = op.role === 'twin' ? 'twin' : 'positive';
  const common = { rowId, baseId: b.id, baseKind: b.kind, operatorId: op.id, positiveId: positiveOf(op), role, site } as const;
  const empty = { expected: [], absentTemplates: [], hits: [], newBlocking: [], diff: '' };
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(raw, dest, { recursive: true, filter: (s) => !/[\\/](node_modules|\.git)$/.test(s) });
  try {
    const handle = openImportGraphProject(dest, tsconfig);
    const r = op.apply(handle, site, mulberry32(SEED));
    if (!r.success) return { ...common, ...empty, status: 'apply-error', typecheck: { base: baseErrors, mutant: null }, detail: r.errors.map((e) => e.message).join('; ') };
    await handle.project.save();
    const edit = r.data;
    provisionStubs(dest, tsconfig, [...baseUses, ...(op.plannedImportUses?.(site) ?? [])]);
    const diff = [...edit.editedFiles, ...edit.createdFiles].map((f) => diffOf(path.join(baseCopy, f), path.join(dest, f), f)).join('');
    const { keys, absent } = role === 'positive' ? expectedKeys(op, site, edit, ids) : { keys: [], absent: [] };
    const files = { expected: keys, absentTemplates: absent, diff };
    // A positive with no expected key under this spec is a feasibility finding, never a miss: it is not evaluated.
    if (role === 'positive' && keys.length === 0) return { ...common, ...empty, ...files, status: 'no-expected-key', typecheck: { base: baseErrors, mutant: null } };
    const errors = tscErrors(dest, tsconfig);
    if (errors > baseErrors) return { ...common, ...empty, ...files, status: 'typecheck', typecheck: { base: baseErrors, mutant: errors } };
    let mutant: Violation[];
    try {
      mutant = await evaluateInProcess(dest, b.specPath, tsconfig, apgStore);
    } catch (e) {
      return { ...common, ...empty, ...files, status: 'evaluate-error', typecheck: { base: baseErrors, mutant: errors }, detail: e instanceof Error ? e.message : String(e) };
    }
    const fresh = newViolations(baseline, mutant);
    const newBlocking = fresh.filter((v) => ruleTier(v.functionId, 'ddd').tier === 'blocking');
    if (role === 'twin') return { ...common, ...files, status: newBlocking.length > 0 ? 'false-fire' : 'silent', hits: [], newBlocking, typecheck: { base: baseErrors, mutant: errors } };
    const hits = keys.map((key) => fresh.some((v) => matchesKey(v, key)));
    return { ...common, ...files, status: hits.every(Boolean) ? 'detected' : 'missed', hits, newBlocking, typecheck: { base: baseErrors, mutant: errors } };
  } finally {
    fs.rmSync(dest, { recursive: true, force: true });
  }
}

async function recall(clones: string, work: string, out: string, ids: readonly string[], k: number, kTwin: number): Promise<void> {
  const rows: RecallRow[] = [];
  const cells: Cell[] = [];
  const infos: Record<string, unknown>[] = [];
  const t0 = Date.now();
  for (const b of bases().filter((x) => ids.includes(x.id))) {
    try {
      infos.push(await recallBase(b, clones, work, k, kTwin, rows, cells));
    } catch (e) {
      infos.push({ id: b.id, kind: b.kind, excluded: `error: ${(e instanceof Error ? e.message : String(e)).split(work).join('<work>')}` });
    }
    process.stderr.write(`${b.id} done\n`);
  }
  fs.mkdirSync(out, { recursive: true });
  const params = { k, kTwin, seed: SEED, elapsedMs: Date.now() - t0, engine: 'cypher-interp (in process; scoring v1.3, instrument v2, post-seal rules on)', typecheck: 'repository TypeScript on the base tsconfig, missing packages stubbed (BR-U5a-10)' };
  fs.writeFileSync(path.join(out, 'run.json'), `${JSON.stringify({ schema: 'ddd-beta-recall/v1', params, bases: infos, cells, rows: rows.map((r) => scrub(r, work)) }, null, 1)}\n`);
}

function scrub<T>(v: T, work: string): T {
  return JSON.parse(JSON.stringify(v).split(work).join('<work>')) as T;
}

/** Cells of a base that a later part ran again are taken from the later part. */
function dedupeCells(parts: readonly (readonly Cell[])[]): Cell[] {
  const last = new Map<string, number>();
  parts.forEach((cells, i) => {
    for (const c of cells) last.set(c.baseId, i);
  });
  return parts.flatMap((cells, i) => cells.filter((c) => last.get(c.baseId) === i));
}

function merge(out: string, dirs: readonly string[]): void {
  const parts = dirs.map((d) => JSON.parse(fs.readFileSync(path.join(d, 'run.json'), 'utf8')) as { params: { k: number; kTwin: number; seed: number; elapsedMs: number; engine: string; typecheck: string }; bases: unknown[]; cells: Cell[]; rows: RecallRow[] });
  const first = parts[0];
  if (first === undefined) return;
  const rows = parts.flatMap((p) => p.rows);
  // Per-part k (the reference project ran with a larger sample); a base run twice keeps its last run (a re-run after a fix).
  const params = { ...first.params, k: undefined, kTwin: undefined, parts: parts.map((p) => ({ k: p.params.k, kTwin: p.params.kTwin, bases: p.bases.map((b) => (b as { id: string }).id) })), elapsedMs: parts.reduce((a, p) => a + p.params.elapsedMs, 0) };
  const lastBase = new Map<string, unknown>();
  for (const b of parts.flatMap((p) => p.bases)) lastBase.set((b as { id: string }).id, b);
  const byRule = summariseByRule(rows);
  const twins = twinTally(rows);
  fs.mkdirSync(path.join(out, 'recall'), { recursive: true });
  fs.writeFileSync(path.join(out, 'recall', 'run.json'), `${JSON.stringify({ schema: 'ddd-beta-recall/v1', params, bases: [...lastBase.values()], cells: dedupeCells(parts.map((p) => p.cells)), rows }, null, 1)}\n`);
  fs.writeFileSync(path.join(out, 'recall', 'summary.json'), `${JSON.stringify({ byRule, twins }, null, 1)}\n`);
}

// ── Report ──────────────────────────────────────────────────────────────────

interface CensusRow {
  id: string;
  kind: BaseKind;
  preconditions: { rule: string; holds: boolean }[];
  evaluation: Record<string, { rules?: Record<string, { status: string; violations: number }> }>;
}

/**
 * Why a twin added a blocking row of `rule` (inspected by hand on every false fire of this run; the classes are checks,
 * not assumptions): a U5a catalogue twin (written for Clean, not DDD-aware) adding an FF-DS02 edge into another
 * context's unpublished file is a real context breach the twin should not have planted; an FF-S02 row whose every
 * cycle passes through a barrel (`index.ts`) is a literal file cycle the operator's precondition graph (per-name barrel
 * routing) cannot see. Anything else is `other`, an instrument false fire.
 */
function twinFireClass(r: RecallRow, rule: string): 'u5aTwinCrossesContext' | 'twinClosesBarrelCycle' | 'other' {
  const rows = r.newBlocking.filter((v) => v.functionId === rule);
  if (rule === 'FF-DS02' && !/^MO-[HD]\d/.test(r.operatorId)) return 'u5aTwinCrossesContext';
  if (rule === 'FF-S02' && rows.every((v) => v.filePath.split(',').some((f) => f.endsWith('index.ts')))) return 'twinClosesBarrelCycle';
  return 'other';
}

/**
 * Per rule and base: precondition, native blocking findings (post-seal on), seeded detection; per rule: real
 * repositories reached (fired natively or on a seed), pooled seeded recall, twin false fires adding the rule, and the
 * proposed beta bar. Writes `summary.json` and the reach matrix `reach.md`.
 */
function report(out: string): void {
  const census = (JSON.parse(fs.readFileSync(path.join(out, 'census.json'), 'utf8')) as { rows: CensusRow[] }).rows;
  const run = JSON.parse(fs.readFileSync(path.join(out, 'recall', 'run.json'), 'utf8')) as { rows: RecallRow[] };
  const byRule = summariseByRule(run.rows);
  const reach: Record<string, Record<string, { pre: boolean; native: number | null; seededKeys: number; seededHits: number }>> = {};
  for (const c of census) {
    const rules = c.evaluation.on?.rules ?? {};
    reach[c.id] = Object.fromEntries(DDD_BLOCKING_RULES.map((rule) => {
      let keys = 0;
      let hits = 0;
      for (const r of run.rows) {
        if (r.baseId !== c.id || r.role !== 'positive' || (r.status !== 'detected' && r.status !== 'missed')) continue;
        r.expected.forEach((k, i) => {
          if (k.functionId !== rule) return;
          keys++;
          if (r.hits[i] === true) hits++;
        });
      }
      const rr = rules[rule];
      return [rule, { pre: c.preconditions.find((p) => p.rule === rule)?.holds ?? false, native: rr?.status === 'ran (blocking)' ? rr.violations : null, seededKeys: keys, seededHits: hits }];
    }));
  }
  const twinsEvaluated = run.rows.filter((r) => r.role === 'twin' && (r.status === 'silent' || r.status === 'false-fire'));
  const verdicts = DDD_BLOCKING_RULES.map((rule) => {
    const real = census.filter((c) => c.kind === 'real');
    const reached = real.filter((c) => {
      const x = reach[c.id]?.[rule];
      return x !== undefined && ((x.native ?? 0) > 0 || x.seededHits > 0);
    }).map((c) => c.id);
    const pooled = byRule.find((b) => b.rule === rule && b.baseKind === '*');
    const fired = twinsEvaluated.filter((r) => r.newBlocking.some((v) => v.functionId === rule));
    const classes = { u5aTwinCrossesContext: 0, twinClosesBarrelCycle: 0, other: 0 };
    for (const r of fired) classes[twinFireClass(r, rule)]++;
    const bar = betaReady(reached.length, pooled?.rate ?? null, fired.length);
    const adjudicated = betaReady(reached.length, pooled?.rate ?? null, classes.other);
    return {
      rule, realReposPrecondition: real.filter((c) => reach[c.id]?.[rule]?.pre === true).length, realReposReached: reached, recall: pooled,
      twinsEvaluated: twinsEvaluated.length, twinFalseFires: fired.length, twinFalseFireClasses: classes,
      betaReady: bar.ready, reasons: bar.reasons, betaReadyAdjudicated: adjudicated.ready, reasonsAdjudicated: adjudicated.reasons,
    };
  });
  fs.writeFileSync(path.join(out, 'summary.json'), `${JSON.stringify({ schema: 'ddd-beta-summary/v1', bar: 'reach on >= 3 real repositories (fired natively or on a seed), pooled seeded recall >= 0.90, 0 twin false fires adding the rule (raw; adjudicated: 0 of class other)', verdicts, byRule, twins: twinTally(run.rows), reach }, null, 1)}\n`);
  const cell = (x: { pre: boolean; native: number | null; seededKeys: number; seededHits: number } | undefined): string =>
    x === undefined ? '' : `${x.pre ? 'P' : '–'} ${x.native === null ? 'n/r' : String(x.native)} ${x.seededKeys > 0 ? `${String(x.seededHits)}/${String(x.seededKeys)}` : '·'}`;
  const md = [
    '# DDD beta: reach matrix (post-seal on)',
    '',
    'Cell: precondition (P holds, – not) · native blocking findings on the unmutated tree (n/r: rule not run as blocking) · seeded keys detected/evaluated (· none).',
    '',
    `| Base | Kind | ${DDD_BLOCKING_RULES.join(' | ')} |`,
    `|---|---|${DDD_BLOCKING_RULES.map(() => '---').join('|')}|`,
    ...census.map((c) => `| ${c.id} | ${c.kind} | ${DDD_BLOCKING_RULES.map((r) => cell(reach[c.id]?.[r])).join(' | ')} |`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(out, 'reach.md'), md);
}

async function main(argv: readonly string[]): Promise<number> {
  const mode = argv[0];
  const out = path.resolve(arg(argv, '--out') ?? 'results/v1.4-ddd-beta');
  const work = path.resolve(arg(argv, '--work') ?? path.join(out, '..', 'ddd-beta-work'));
  const clones = path.resolve(arg(argv, '--clones') ?? path.join(work, 'clones'));
  if (mode === 'census') await census(clones, work, out);
  else if (mode === 'fixtures') await fixtures(work, out);
  else if (mode === 'recall') {
    const ids = (arg(argv, '--bases') ?? '').split(',').filter((x) => x.length > 0);
    await recall(clones, work, out, ids, Number(arg(argv, '--k') ?? '3'), Number(arg(argv, '--k-twin') ?? '2'));
  } else if (mode === 'merge') merge(out, (argv[argv.length - 1] ?? '').split(',').map((d) => path.resolve(d)));
  else if (mode === 'report') report(out);
  else if (mode === 'list') process.stdout.write(`${bases().map((b) => `${b.id}\t${b.kind}\t${b.specPath}`).join('\n')}\n`);
  else {
    process.stderr.write('usage: ddd-beta-capability.ts census|fixtures|recall|merge|list ...\n');
    return 2;
  }
  return 0;
}

main(process.argv.slice(2)).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
    process.exitCode = 2;
  },
);
