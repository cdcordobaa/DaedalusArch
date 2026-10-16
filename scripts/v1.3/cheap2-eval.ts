/**
 * Batch-2 cheap proxies: diagnostic run. DEVELOPMENT SET, no LLM, no Neo4j.
 *
 * 1. Planted fixtures (`tests/fixtures/v1.3-cheap2/<enrichment>`): per enrichment, planted cases caught, near misses
 *    flagged, and any other flag the proxy raised.
 * 2. False flags: every batch-2 proxy on the five clean reference projects (`tests/fixtures/v1.3-reference`, clean
 *    variant materialised as `cheap-semantics-eval.ts` does) and on their near-miss variants. Every flag there is a
 *    false flag by construction, except `no-tests` (a true statement about a project without tests; counted apart).
 *    Co-change runs twice: on the project's own history (none: skipped) and on the enclosing repository's history
 *    restricted to the reference directory. The template mirrors (`cheap2-in-memory.ts`) are run on the same facts.
 *    The violation variants' new flags against their clean base are listed for context.
 * 3. Agent provenance on the loop harness `--dry-run` demo (three arms) and on the synthetic provenance history.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/cheap2-eval.ts --out results/v1.3-cheap2 [--work <dir>]
 * Writes `<out>/scores.json` and prints the markdown tables.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BATCH2_PROXY_IDS, analyseProvenance, extractAndEnrich, readGitHistory, readLoopRun } from '../../src/apg-enrich/cheap/index.js';
import type { CheapEnrichment, CheapFlag, CheapOptions, ContextProxyId, ProvenanceResult } from '../../src/apg-enrich/cheap/index.js';
import { CHEAP2_IN_MEMORY } from '../../src/fitness-compiler/cheap2-in-memory.js';
import { apg2Params, memGraph } from '../../src/fitness-compiler/apg2-in-memory.js';
import { parseSpec, specExcludePathsFromYaml } from '../../src/spec-parser/index.js';
import type { APGResult } from '../../src/shared/types/apg.js';
import type { LayerDefinition, LayerModel } from '../../src/shared/types/spec.js';
import { main as loopMain } from '../lib/loop/main.js';
import type { LoopMainDeps } from '../lib/loop/main.js';
import { runDirFor } from '../lib/loop/loop.js';
import { loadAllReferences } from './lib/reference-model.js';
import { materialiseVariant } from './lib/materialise.js';

const FIXTURES = 'tests/fixtures/v1.3-cheap2';

interface Case { id: string; kind?: string; file: string; className?: string; methodName?: string; note?: string }
interface Expected { proxy: ContextProxyId; planted: Case[]; nearMisses: Case[] }

const layer = (name: string, kind: LayerDefinition['kind'], directories: string[]): LayerDefinition => ({ name, directories, naming: [], role: '', filePatterns: [], ...(kind !== undefined ? { kind } : {}) });
/** The layer model of the fixtures (the unit tests' `LAYERS`). */
export const FIXTURE_LAYERS: LayerModel = {
  layers: [
    layer('domain', 'domain', ['src/**/domain/**']),
    layer('application', 'application', ['src/**/application/**']),
    layer('infrastructure', 'infrastructure', ['src/**/infrastructure/**']),
    layer('presentation', 'presentation', ['src/**/presentation/**']),
  ],
};

const TSCONFIG = JSON.stringify({
  compilerOptions: { target: 'ES2021', module: 'CommonJS', moduleResolution: 'node', strict: true, experimentalDecorators: true, skipLibCheck: true, types: [] },
  include: ['src/**/*.ts', 'types/**/*.d.ts'],
});

function materialiseFixture(repoRoot: string, name: string, work: string): string {
  const root = path.join(work, 'fixtures', name);
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  fs.cpSync(path.join(repoRoot, FIXTURES, name), root, { recursive: true, filter: (src) => !/(expected|history|steps)\.json$/.test(src) });
  fs.writeFileSync(path.join(root, 'tsconfig.json'), TSCONFIG);
  fs.mkdirSync(path.join(root, 'types'), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, FIXTURES, 'vendor.d.ts'), path.join(root, 'types', 'vendor.d.ts'));
  return fs.realpathSync(root);
}

function replayGit(root: string, commits: readonly { message: string; trailers?: Record<string, string>; files: Record<string, string | null> }[]): void {
  const env = { PATH: process.env.PATH ?? '', HOME: root, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', LC_ALL: 'C' };
  const run = (args: string[], extra: Record<string, string> = {}): void => {
    const r = spawnSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@localhost', '-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...args], { cwd: root, env: { ...env, ...extra }, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  };
  run(['init', '--quiet']);
  commits.forEach((c, i) => {
    for (const [rel, text] of Object.entries(c.files)) {
      const abs = path.join(root, rel);
      if (text === null) fs.rmSync(abs, { force: true });
      else {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, text);
      }
    }
    run(['add', '--all']);
    const trailers = Object.entries(c.trailers ?? {}).map(([k, v]) => `${k}: ${v}`).join('\n');
    const date = new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString();
    run(['commit', '--quiet', '--allow-empty', '-m', trailers === '' ? c.message : `${c.message}\n\n${trailers}`], { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
  });
}

const onUnit = (f: CheapFlag, c: Case): boolean => f.evidence.file === c.file && (c.className === undefined || f.className === c.className) && (c.methodName === undefined || f.methodName === c.methodName);

function score(flags: readonly CheapFlag[], exp: Expected): { planted: number; caught: number; missed: string[]; nearMisses: number; nearMissFlagged: string[]; otherFlags: string[] } {
  const missed = exp.planted.filter((p) => !flags.some((f) => f.kind === p.kind && onUnit(f, p))).map((p) => p.id);
  const nearMissFlagged = exp.nearMisses.filter((n) => flags.some((f) => onUnit(f, n))).map((n) => n.id);
  const otherFlags = flags.filter((f) => !exp.planted.some((p) => f.kind === p.kind && onUnit(f, p))).map((f) => `${f.kind}@${f.evidence.file}`);
  return { planted: exp.planted.length, caught: exp.planted.length - missed.length, missed, nearMisses: exp.nearMisses.length, nearMissFlagged, otherFlags };
}

function mirrorRows(apg: APGResult, enr: Pick<CheapEnrichment, 'edges' | 'nodeFacts' | 'virtualNodes'>, lm: LayerModel): Record<string, number> {
  const g = memGraph(apg, lm);
  const p = apg2Params(lm);
  return Object.fromEntries([...CHEAP2_IN_MEMORY.entries()].map(([name, f]) => [name, f(g, enr, p).length]));
}

const specCache = new Map<string, { model: LayerModel; excludes: string[] }>();
async function specOf(specPath: string): Promise<{ model: LayerModel; excludes: string[] }> {
  const hit = specCache.get(specPath);
  if (hit !== undefined) return hit;
  const parsed = await parseSpec({ specFilePath: specPath });
  if (!parsed.success) throw new Error(`${specPath}: spec does not parse`);
  const v = { model: parsed.data.layerModel, excludes: specExcludePathsFromYaml(fs.readFileSync(specPath, 'utf8')) };
  specCache.set(specPath, v);
  return v;
}

export async function main(argv: readonly string[], repoRoot: string): Promise<number> {
  const arg = (name: string): string | undefined => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const out = path.resolve(arg('--out') ?? 'results/v1.3-cheap2');
  const work = path.resolve(arg('--work') ?? fs.mkdtempSync(path.join(os.tmpdir(), 'v13-cheap2-')));
  fs.mkdirSync(out, { recursive: true });
  const p = (s: string): void => {
    process.stdout.write(`${s}\n`);
  };

  // ── 1. Planted fixtures ──
  const fixtures: Record<string, ReturnType<typeof score> & { ms: number }> = {};
  for (const name of ['error-flow', 'reachability', 'sdk-spread', 'test-topology', 'config-surface', 'co-change']) {
    const exp = JSON.parse(fs.readFileSync(path.join(repoRoot, FIXTURES, name, 'expected.json'), 'utf8')) as Expected;
    const root = materialiseFixture(repoRoot, name, work);
    const options: Partial<CheapOptions> = { proxies: [exp.proxy] };
    if (name === 'co-change') {
      replayGit(root, (JSON.parse(fs.readFileSync(path.join(repoRoot, FIXTURES, name, 'history.json'), 'utf8')) as { commits: [] }).commits);
      Object.assign(options, { coChangeMaxFilesPerCommit: 6 });
    }
    const t0 = performance.now();
    const r = await extractAndEnrich(root, { layerModel: FIXTURE_LAYERS, options });
    fixtures[name] = { ...score(r.enrichment.flags, exp), ms: Math.round(performance.now() - t0) };
  }
  const provExp = JSON.parse(fs.readFileSync(path.join(repoRoot, FIXTURES, 'provenance', 'expected.json'), 'utf8')) as Expected;
  const provRepo = path.join(work, 'fixtures', 'provenance-git');
  fs.rmSync(provRepo, { recursive: true, force: true });
  fs.mkdirSync(provRepo, { recursive: true });
  replayGit(provRepo, (JSON.parse(fs.readFileSync(path.join(repoRoot, FIXTURES, 'provenance', 'steps.json'), 'utf8')) as { steps: [] }).steps);
  let t0 = performance.now();
  const synth = await analyseProvenance(readGitHistory(provRepo), { layerModel: FIXTURE_LAYERS });
  fixtures.provenance = { ...score(synth.flags, provExp), ms: Math.round(performance.now() - t0) };

  p('## Planted fixtures');
  p('| Enrichment | Planted | Caught | Near misses | Near misses flagged | Other flags | ms |');
  p('|---|---|---|---|---|---|---|');
  for (const [n, s] of Object.entries(fixtures)) p(`| ${n} | ${String(s.planted)} | ${String(s.caught)}${s.missed.length > 0 ? ` (missed ${s.missed.join(', ')})` : ''} | ${String(s.nearMisses)} | ${String(s.nearMissFlagged.length)}${s.nearMissFlagged.length > 0 ? ` (${s.nearMissFlagged.join(', ')})` : ''} | ${String(s.otherFlags.length)} | ${String(s.ms)} |`);

  // ── 2. Reference projects ──
  const precision: { project: string; kind: string; files: number; flags: Record<string, number>; flagList: { proxy: string; kind: string; where: string; message: string }[]; templateRows: Record<string, number>; enclosingCoChange: Record<string, unknown>; timingsMs: Record<string, number>; summaries: unknown }[] = [];
  const violations: { variant: string; newFlags: string[] }[] = [];
  const mat = path.join(work, 'reference');
  const key = (f: CheapFlag): string => `${f.proxy}|${f.kind}|${f.evidence.file}|${f.className ?? ''}|${f.methodName ?? ''}`;
  for (const ref of loadAllReferences(repoRoot)) {
    const { model, excludes } = await specOf(ref.specPath);
    const runVariant = async (dir: string, options: Partial<CheapOptions>): Promise<{ apg: APGResult; enrichment: CheapEnrichment }> =>
      extractAndEnrich(fs.realpathSync(dir), { layerModel: model, extractorOptions: { excludePatterns: excludes }, options: { proxies: BATCH2_PROXY_IDS, ...options } });
    let cleanKeys = new Set<string>();
    for (const v of [...ref.variants].sort((a, b) => (a.manifest.kind === 'clean' ? -1 : b.manifest.kind === 'clean' ? 1 : 0))) {
      const id = `${ref.style}/${v.manifest.variant}`;
      const dir = materialiseVariant(ref, v, mat).projectDir;
      const r = await runVariant(dir, {});
      if (v.manifest.kind === 'violation') {
        violations.push({ variant: id, newFlags: [...new Set(r.enrichment.flags.filter((f) => !cleanKeys.has(key(f))).map((f) => `${f.proxy}:${f.kind}@${f.evidence.file}`))].sort() });
        continue;
      }
      if (v.manifest.kind === 'clean') cleanKeys = new Set(r.enrichment.flags.map(key));
      // Co-change over the enclosing repository's history of the fixture directory (the materialised copy has none).
      const srcDir = ref.format === 'overlay' ? ref.projectDir : v.manifest.kind === 'clean' ? ref.projectDir : null;
      let enclosingCoChange: Record<string, unknown> = { skipped: 'variant overlay: no history of its own' };
      if (srcDir !== null) {
        const e = await extractAndEnrich(fs.realpathSync(srcDir), { layerModel: model, extractorOptions: { excludePatterns: excludes }, options: { proxies: ['co-change'], coChangeHistory: 'enclosing' } });
        enclosingCoChange = { ...(e.enrichment.summaries['co-change'] ?? {}), flags: e.enrichment.flags.map((f) => f.message), matrix: undefined };
      }
      const counts: Record<string, number> = Object.fromEntries(BATCH2_PROXY_IDS.map((x) => [x, 0]));
      for (const f of r.enrichment.flags) counts[f.proxy] = (counts[f.proxy] ?? 0) + 1;
      precision.push({
        project: id, kind: v.manifest.kind, files: r.apg.nodes.filter((n) => n.type === 'File').length, flags: counts,
        flagList: r.enrichment.flags.map((f) => ({ proxy: f.proxy, kind: f.kind, where: `${f.evidence.file}:${String(f.evidence.startLine)}`, message: f.message })),
        templateRows: mirrorRows(r.apg, r.enrichment, model), enclosingCoChange,
        timingsMs: Object.fromEntries(Object.entries(r.enrichment.timingsMs).map(([k, x]) => [k, Math.round(x)])),
        summaries: r.enrichment.summaries,
      });
    }
  }
  p('');
  p('## Reference projects (clean and near-miss variants): flags per proxy');
  p(`| Project | Kind | Files | ${BATCH2_PROXY_IDS.join(' | ')} | no-tests | Template rows | Co-change (enclosing history) | Proxies ms |`);
  p(`|---|---|---|${BATCH2_PROXY_IDS.map(() => '---').join('|')}|---|---|---|---|`);
  for (const x of precision) {
    const noTests = x.flagList.filter((f) => f.kind === 'no-tests').length;
    const cc = x.enclosingCoChange as { commits?: number; commitsUsed?: number; filePairs?: number; flags?: string[]; skipped?: string };
    p(`| ${x.project} | ${x.kind} | ${String(x.files)} | ${BATCH2_PROXY_IDS.map((id) => String((x.flags[id] ?? 0) - (id === 'test-topology' ? noTests : 0))).join(' | ')} | ${String(noTests)} | ${String(Object.values(x.templateRows).reduce((s, n) => s + n, 0))} | ${cc.skipped ?? `${String(cc.commitsUsed)} of ${String(cc.commits)} commits, ${String(cc.filePairs)} pairs, ${String(cc.flags?.length ?? 0)} flags`} | ${String(Object.entries(x.timingsMs).filter(([k]) => k !== 'context').reduce((s, [, n]) => s + n, 0))} |`);
  }
  p('');
  p('### Flags on clean and near-miss variants');
  for (const x of precision) for (const f of x.flagList) if (f.kind !== 'no-tests') p(`- ${x.project}: ${f.proxy} ${f.kind} at ${f.where}: ${f.message}`);
  p('');
  p('### Violation variants: new batch-2 flags against the clean base');
  for (const v of violations) p(`- ${v.variant}: ${v.newFlags.join('; ') || '—'}`);

  // ── 3. Agent provenance on the loop --dry-run demo ──
  const outRoot = path.join(work, 'loop-demo');
  fs.rmSync(outRoot, { recursive: true, force: true });
  const deps: LoopMainDeps = {
    runner: { run: () => Promise.reject(new Error('the dry run spawns nothing')) },
    clock: { now: () => 0 }, sleep: () => Promise.resolve(), now: () => new Date(), parentEnv: {}, out: () => undefined, err: (t) => process.stderr.write(t),
  };
  const code = await loopMain(['--plan', 'experiments/loop-demo/plan.dry-run.json', '--dry-run', '--out-root', path.join(outRoot, 'out'), '--binary', '/bin/false', '--harness-root', path.join(outRoot, 'h')], repoRoot, deps);
  if (code !== 0) throw new Error(`loop dry run exited ${String(code)}`);
  const demoLayers: LayerModel = { layers: (['domain', 'application', 'infrastructure'] as const).map((n) => layer(n, n, [`src/${n}/**`])) };
  const demo: Record<string, ProvenanceResult['summary'] & { ms: number }> = {};
  for (const arm of ['none', 'daedalus-mcp', 'gate']) {
    t0 = performance.now();
    const r = await analyseProvenance(readLoopRun(runDirFor(path.join(outRoot, 'out'), `claude-code-cli/stub-model/todo-list/${arm}/run-0`)), { layerModel: demoLayers });
    demo[arm] = { ...r.summary, newFindings: r.erosion.flatMap((e) => e.newFindings.map((f) => `${e.turnId}: ${f.tier} ${f.rule} ${f.file}${f.target !== undefined ? ` -> ${f.target}` : ''} (attributed to ${f.attributedTurn} by ${f.via})`)), ms: Math.round(performance.now() - t0) };
  }
  p('');
  p('## Agent provenance');
  p('| History | Snapshots | Blocking per snapshot (new / resolved / total) | Advisory per snapshot (new / total) | REIMPLEMENTS (clone, vocabulary) | Locality per snapshot | ms |');
  p('|---|---|---|---|---|---|---|');
  const row = (name: string, s: Record<string, unknown>, ms: number): void => {
    const er = s.erosion as { turnId: string; newBlocking: number; resolvedBlocking: number; totalBlocking: number; newAdvisory: number; totalAdvisory: number }[];
    const loc = s.locality as { turnId: string; components: number; locality: number | null }[];
    const re = s.reimplements as { clone: number; vocabulary: number };
    p(`| ${name} | ${String(s.snapshots)} | ${er.map((e) => `${e.turnId} +${String(e.newBlocking)}/-${String(e.resolvedBlocking)}/${String(e.totalBlocking)}`).join('; ')} | ${er.map((e) => `+${String(e.newAdvisory)}/${String(e.totalAdvisory)}`).join('; ')} | ${String(re.clone)}, ${String(re.vocabulary)} | ${loc.map((l) => `${String(l.components)} comp, ${String(l.locality)}`).join('; ')} | ${String(ms)} |`);
  };
  for (const [arm, s] of Object.entries(demo)) row(`loop demo, arm ${arm}`, s, s.ms);
  row('synthetic history (fixture)', synth.summary, fixtures.provenance.ms);
  for (const [arm, s] of Object.entries(demo)) for (const l of s.newFindings as string[]) p(`- ${arm}: ${l}`);
  for (const f of synth.flags) p(`- synthetic: ${f.message}`);

  fs.writeFileSync(path.join(out, 'scores.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), fixtures, precision, violations, provenance: { demo, synthetic: { summary: synth.summary, flags: synth.flags, erosion: synth.erosion, locality: synth.locality } } }, null, 1)}\n`);
  return 0;
}

if (process.argv[1]?.endsWith('cheap2-eval.ts') === true) {
  void main(process.argv.slice(2), process.cwd()).then((c) => {
    process.exitCode = c;
  });
}
