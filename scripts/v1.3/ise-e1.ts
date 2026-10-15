/**
 * ISE on E1 (exploratory): intrinsic consistency vs extrinsic conformance on the accepted E1 cells. The definitions
 * are Docs/DiagnosticRuns/ise-e1-ics-2026-10-15.md §1 (committed before the first run).
 * Entry file: exports only the pure helpers `sitesOf` and `violatedSites` (unit-tested).
 *
 * Per accepted cell of `--e1-runs`:
 *   1. the cell is copied to a temporary directory (the outcomes are read-only);
 *   2. ISE Option 2 (`inferSpec`, preset-first) runs on a neutral snapshot: the cell's `src/`, the pinned tsconfig of
 *      the snapshot directory (ADR-032 `harnessTsconfigText`) and a `node_modules` symlink to the cell's skeleton
 *      install; nothing else of the cell is visible;
 *   3. `firewall evaluate --symbolic-only --format json` (v1.3 scoring) runs on the copy with the pinned tsconfig,
 *      once with the given spec (`--spec`, the E1 task spec) and once with the inferred spec;
 *   4. the site ratios (ICS under the inferred spec, ext_sites under the given spec) are computed from the ISE graph.
 * Writes <out>/cells/<id>.json, <out>/specs/<id>.inferred.yaml, <out>/raw/<id>.json (both finding sets, paths made
 * project-relative), and <out>/cells.json (all cells). `--only a,b` restricts the cells (ids with `/` as `_`).
 *
 * Usage (repository root, Neo4j env loaded):
 *   npx tsx scripts/v1.3/ise-e1.ts --e1-runs results/e1-grid/runs --e1-root <daedalus-e1-outcomes> \
 *     --spec specs/clean-arch.yaml --out results/v1.3-ise-e1
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import YAML from 'yaml';
import { annotate, inferSpec } from '../../src/ise/index.js';
import type { InferredLayer, IseGraph } from '../../src/ise/index.js';
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { acquireNeo4jLock } from '../../src/shared/process/neo4j-lock.js';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { CLI_ENTRY } from '../lib/freeze-gate-main.js';
import { harnessTsconfigText } from '../lib/generators/harness-tsconfig.js';
import { normaliseFindingPath } from './lib/compare.js';

export interface Finding {
  readonly functionId: string;
  readonly filePath: string;
  readonly target?: string;
  readonly discriminator?: readonly string[];
  readonly [k: string]: unknown;
}

/** §1.3 N: (layered src file -> imported src file or package) pairs. */
export function sitesOf(graph: IseGraph, layerOf: ReadonlyMap<string, { layer: string | null }>): Set<string> {
  const layered = (f: string): boolean => (layerOf.get(f)?.layer ?? null) !== null;
  const sites = new Set<string>();
  for (const e of graph.edges) if (layered(e.from)) sites.add(`${e.from}->${e.to}`);
  for (const p of graph.packageImports) if (layered(p.file)) sites.add(`${p.file}->pkg:${p.pkg}`);
  return sites;
}

/** §1.3 V: the distinct sites named by blocking findings. */
export function violatedSites(findings: readonly Finding[], blockingRules: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  for (const f of findings) {
    if (!blockingRules.has(f.functionId)) continue;
    if (f.functionId === 'FF-P06' && f.discriminator?.[2] === 'FLOWS_TO') continue; // N/A half (rule-tiers.md)
    if (f.functionId === 'FF-S02') {
      const cyc = f.filePath.split(',').map((x) => x.trim()).filter((x) => x !== '');
      for (let i = 0; i + 1 < cyc.length; i += 1) out.add(`${cyc[i] ?? ''}->${cyc[i + 1] ?? ''}`);
      if (cyc.length <= 1) out.add(`${f.filePath}->${f.target ?? ''}`);
      continue;
    }
    const t = f.target ?? '';
    out.add(t !== '' ? `${f.filePath}->${t}` : `${f.filePath}#${f.functionId}`);
  }
  return out;
}

interface TierRule { functionId: string; violationCount: number; violated: boolean }
interface Tiers {
  style: string | null;
  verdict: string;
  blockingAhs: number | null;
  blocking: { rules: TierRule[]; violatedRules: number; violationCount: number };
  advisory: { rules: TierRule[]; violatedRules: number; violationCount: number };
}

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const req = (name: string): string => {
  const v = opt(name);
  if (v === undefined) throw new Error(`--${name} <value> is required`);
  return v;
};
const repoRoot = process.cwd();
const env = process.env;
const secrets = [env.NEO4J_PASSWORD ?? ''].filter((s) => s !== '');
const runner = new NodeProcessRunner();
const tsx = path.resolve(repoRoot, 'node_modules/.bin/tsx');
const childEnv: Record<string, string> = {};
for (const k of ['PATH', 'HOME', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']) {
  const v = env[k];
  if (v !== undefined) childEnv[k] = v;
}

function specLayers(specText: string): InferredLayer[] {
  const doc = YAML.parse(specText) as { architecture: { layers: { name: string; directories?: string[]; file_patterns?: string[] }[] } };
  return doc.architecture.layers.map((l) => ({ name: l.name, directories: l.directories ?? [], filePatterns: l.file_patterns ?? [] }));
}

async function evaluate(copy: string, spec: string, tsconfig: string, uri: string): Promise<{ findings: Finding[]; tiers: Tiers }> {
  const run = await runner.run(tsx, [CLI_ENTRY, 'evaluate', '--project', copy, '--spec', spec, '--format', 'json', '--symbolic-only', '--tsconfig', tsconfig, '--neo4j-uri', uri],
    { cwd: repoRoot, env: childEnv, timeoutMs: 600_000 });
  if (!run.success || run.data.timedOut) throw new Error('evaluate did not finish');
  const stdout = run.data.stdout;
  const start = stdout.indexOf('{');
  if (start < 0) throw new Error(`no JSON (${scrubSecrets(run.data.stderr.slice(0, 400), secrets)})`);
  const parsed = JSON.parse(stdout.slice(start)) as { violations?: Record<string, unknown>[]; tiers?: Tiers };
  if (!Array.isArray(parsed.violations) || parsed.tiers === undefined) throw new Error('no violations / tiers');
  const norm = (p: string): string => p.split(',').map((x) => normaliseFindingPath(x.trim(), copy)).join(',');
  const findings = parsed.violations.map((v) => {
    const o: Record<string, unknown> = { ...v };
    if (typeof o.filePath === 'string') o.filePath = norm(o.filePath);
    if (typeof o.target === 'string') o.target = norm(o.target);
    return o as unknown as Finding;
  });
  findings.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return { findings, tiers: parsed.tiers };
}

function scoreUnder(label: string, graph: IseGraph, layers: readonly InferredLayer[], ev: { findings: Finding[]; tiers: Tiers }) {
  const layerOf = annotate(graph.files, layers);
  const n = sitesOf(graph, layerOf);
  const blockingRules = new Set(ev.tiers.blocking.rules.map((r) => r.functionId));
  const advisoryRules = new Set(ev.tiers.advisory.rules.map((r) => r.functionId));
  const v = violatedSites(ev.findings, blockingRules);
  const blocking = ev.findings.filter((f) => blockingRules.has(f.functionId) && !(f.functionId === 'FF-P06' && f.discriminator?.[2] === 'FLOWS_TO'));
  const advisory = ev.findings.filter((f) => advisoryRules.has(f.functionId));
  const perFile = (xs: readonly Finding[]): Record<string, number> => {
    const m: Record<string, number> = {};
    for (const f of xs) m[f.filePath] = (m[f.filePath] ?? 0) + 1;
    return Object.fromEntries(Object.entries(m).sort());
  };
  return {
    label,
    style: ev.tiers.style,
    verdict: ev.tiers.verdict,
    blockingAhs: ev.tiers.blockingAhs,
    layeredFiles: [...layerOf.values()].filter((x) => x.layer !== null).length,
    checkedSites: n.size,
    violatedSites: [...v].sort(),
    violatedInChecked: [...v].filter((s) => n.has(s)).length,
    siteRatio: n.size === 0 ? null : 1 - Math.min(1, v.size / n.size),
    blockingFindings: blocking.length,
    advisoryFindings: advisory.length,
    blockingByRule: Object.fromEntries(ev.tiers.blocking.rules.filter((r) => r.violationCount > 0).map((r) => [r.functionId, r.violationCount])),
    advisoryByRule: Object.fromEntries(ev.tiers.advisory.rules.filter((r) => r.violationCount > 0).map((r) => [r.functionId, r.violationCount])),
    blockingPerFile: perFile(blocking),
    advisoryPerFile: perFile(advisory),
  };
}

async function main(): Promise<number> {
  const runsDir = path.resolve(req('e1-runs'));
  const e1Root = path.resolve(req('e1-root'));
  const givenSpec = path.resolve(req('spec'));
  const outDir = path.resolve(req('out'));
  const only = opt('only') !== undefined ? new Set((opt('only') ?? '').split(',')) : undefined;
  const uri = env.NEO4J_URI ?? '';
  if (uri === '' || (env.NEO4J_PASSWORD ?? '') === '') throw new Error('NEO4J_URI / NEO4J_PASSWORD are not set');
  for (const d of ['cells', 'specs', 'raw']) fs.mkdirSync(path.join(outDir, d), { recursive: true });
  const givenLayers = specLayers(fs.readFileSync(givenSpec, 'utf8'));
  const lock = await acquireNeo4jLock(uri, { label: 'ise-e1', env, onWait: (t) => process.stderr.write(`${t}\n`) });
  process.stderr.write(`Neo4j lock ${lock.mode}\n`);
  const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v13-ise-e1-')));
  const failures: string[] = [];
  const cells: unknown[] = [];
  try {
    for (const name of fs.readdirSync(runsDir).filter((n) => n.endsWith('.run.json')).sort()) {
      const rec = JSON.parse(fs.readFileSync(path.join(runsDir, name), 'utf8')) as { projectId?: string; status?: string };
      if (rec.status !== 'accepted' || rec.projectId === undefined) continue;
      const id = rec.projectId.replace(/\//g, '_');
      if (only !== undefined && !only.has(id)) continue;
      const [model = '', task = '', level = '', runTag = ''] = rec.projectId.split('/');
      const src = path.join(e1Root, rec.projectId);
      if (!fs.existsSync(src)) { failures.push(`${id}: source missing`); continue; }
      const started = Date.now();
      const copy = path.join(work, id);
      fs.cpSync(src, copy, { recursive: true, verbatimSymlinks: true });
      const tsconfig = path.join(work, `${id}.tsconfig.json`);
      fs.writeFileSync(tsconfig, harnessTsconfigText(copy), { mode: 0o444 });
      // ISE snapshot: src/ + pinned tsconfig + the skeleton node_modules symlink; neutral name.
      const holder = fs.mkdtempSync(path.join(work, 'ise-snap-'));
      const snap = path.join(holder, 'project');
      fs.mkdirSync(snap);
      fs.cpSync(path.join(copy, 'src'), path.join(snap, 'src'), { recursive: true });
      const nm = path.join(copy, 'node_modules');
      if (fs.existsSync(nm)) fs.symlinkSync(fs.realpathSync(nm), path.join(snap, 'node_modules'));
      fs.writeFileSync(path.join(snap, 'tsconfig.json'), harnessTsconfigText(snap));
      try {
        const inf = await inferSpec(snap, { presetsDir: path.join(repoRoot, 'presets') });
        const specFile = path.join(outDir, 'specs', `${id}.inferred.yaml`);
        fs.writeFileSync(specFile, inf.specYaml);
        const given = await evaluate(copy, givenSpec, tsconfig, uri);
        const own = await evaluate(copy, specFile, tsconfig, uri);
        fs.writeFileSync(path.join(outDir, 'raw', `${id}.json`), `${JSON.stringify({ given: given.findings, inferred: own.findings }, null, 1)}\n`);
        const top = inf.classification.ranked[0];
        const second = inf.classification.ranked[1];
        const totalPoints = inf.classification.ranked.reduce((s, r) => s + r.points, 0);
        const abstainReasons: string[] = [];
        if (totalPoints === 0) abstainReasons.push('no style evidence');
        if ((top?.confidence ?? 0) < 0.6) abstainReasons.push(`top confidence ${(top?.confidence ?? 0).toFixed(2)} < 0.60`);
        if (top !== undefined && second !== undefined && top.points > 0 && top.points === second.points) abstainReasons.push(`tie ${top.style} / ${second.style}`);
        const files = inf.graph.files.filter((f) => f.startsWith('src/'));
        const cell = {
          id, projectId: rec.projectId, model, task, level, run: runTag,
          files: files.length,
          ise: {
            style: inf.style,
            confidence: top?.confidence ?? 0,
            points: top?.points ?? 0,
            totalPoints,
            runnerUp: second !== undefined && second.points > 0 ? { style: second.style, confidence: second.confidence } : null,
            evidence: top?.evidence ?? [],
            ranked: inf.classification.ranked.map((r) => ({ style: r.style, points: r.points, confidence: r.confidence })),
            abstains: abstainReasons.length > 0,
            abstainReasons,
            styleMatch: inf.style === 'clean-architecture',
            units: inf.mapping.units.map((u) => ({ unit: u.unit, layer: u.layer, source: u.source, confidence: u.confidence })),
            structureOnlyUnits: inf.mapping.units.filter((u) => u.source === 'structure').length,
            unlayeredFiles: inf.mapping.files.filter((f) => f.layer === null).length,
            layers: inf.mapping.layers.filter((l) => l.directories.length + l.filePatterns.length > 0),
            specValid: inf.check.valid,
            specErrors: inf.check.errors,
            majorityVoteRules: inf.majorityVote.length,
          },
          extrinsic: scoreUnder('given', inf.graph, givenLayers, given),
          intrinsic: scoreUnder('inferred', inf.graph, specLayers(inf.specYaml), own),
        };
        fs.writeFileSync(path.join(outDir, 'cells', `${id}.json`), `${JSON.stringify(cell, null, 1)}\n`);
        cells.push(cell);
        process.stdout.write(`${id}: ${inf.style} ${(top?.confidence ?? 0).toFixed(2)} | ext ${String(cell.extrinsic.blockingAhs)} | ICS ${cell.intrinsic.siteRatio === null ? 'n/a' : cell.intrinsic.siteRatio.toFixed(3)} (${String(Date.now() - started)} ms)\n`);
      } catch (e) {
        failures.push(`${id}: ${scrubSecrets(e instanceof Error ? e.message : String(e), secrets)}`);
      } finally {
        fs.rmSync(holder, { recursive: true, force: true });
        fs.rmSync(copy, { recursive: true, force: true });
        fs.rmSync(tsconfig, { force: true });
      }
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
    lock.release();
  }
  if (only === undefined) fs.writeFileSync(path.join(outDir, 'cells.json'), `${JSON.stringify(cells, null, 1)}\n`);
  process.stdout.write(`done ${String(cells.length)} cells; ${String(failures.length)} failures\n`);
  for (const f of failures) process.stderr.write(`${f}\n`);
  return failures.length === 0 ? 0 : 1;
}

if (process.argv[1]?.endsWith('ise-e1.ts') === true) {
  void main().then((c) => { process.exitCode = c; }, (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), secrets)}\n`);
    process.exitCode = 2;
  });
}
