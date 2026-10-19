/**
 * Brownfield zero-call baseline (Docs/DiagnosticRuns/v1.3-brownfield-mined-baseline-2026-10-18.md): run the
 * deterministic rule miner (src/rule-mining, unchanged) on the 15 external repositories that have hand-written specs
 * (results/v1.3-external/selection.json). Same snapshot procedure as scripts/v1.3/rule-mining-wild.ts: the clone's
 * analysis-root `src/` plus its tsconfig flattened by scripts/v1.3/lib/wild.ts, copied to a temp dir; the clone is
 * only read (no install, no scripts, no build). No LLM, no Neo4j.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/brownfield-mine.ts --selection results/v1.3-external/selection.json \
 *     --repos <dir with one clone per id> --out results/v1.3-brownfield [--id a,b]
 * Writes <out>/mined/<id>.mined.yaml (the emitted spec), <out>/mined/<id>.json (summary; all exceptions) and
 * appends one row per repository to <out>/mined/mine-runs.json.
 * With --oracle-specs <dir> (the declared specs, <id>.yaml) it also mines over the DECLARED layer map, as the oracle
 * arm of scripts/v1.3/rule-mining-eval.ts does (same graph and components; the declared spec's layers, kinds, style
 * and exclusions), and writes <out>/oracle/<id>.json: the rules with every exception and the mined allowed layer graph
 * (observed / strict / full) against the declared allowed graph restricted to the layers that hold a file.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import ts from 'typescript';
import picomatch from 'picomatch';
import YAML from 'yaml';
import { annotate } from '../../src/ise/layer-mapper.js';
import { allowedGraph, analyseSnapshot, mineRules, proposeFromAnalysis, summariseProposal } from '../../src/rule-mining/index.js';
import type { MinedRuleKind, MiningStyle } from '../../src/rule-mining/index.js';
import { parseSpec } from '../../src/spec-parser/spec-parser.js';
import { readSpecExcludePaths } from '../../src/spec-parser/exclude-paths.js';
import { flattenTsconfig } from './lib/wild.js';

interface Entry { id: string; sha: string; root: string; tsconfig?: string; include?: string[]; style: string }

const argv = process.argv.slice(2);
const arg = (n: string): string | undefined => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const need = (n: string): string => { const v = arg(n); if (v === undefined) throw new Error(`${n} is required`); return v; };

async function main(): Promise<void> {
  const selection = JSON.parse(fs.readFileSync(need('--selection'), 'utf8')) as { entries: Entry[] };
  const repos = path.resolve(need('--repos'));
  const out = path.resolve(need('--out'));
  const only = arg('--id')?.split(',');
  fs.mkdirSync(path.join(out, 'mined'), { recursive: true });
  const runsFile = path.join(out, 'mined', 'mine-runs.json');
  const runs = fs.existsSync(runsFile) ? (JSON.parse(fs.readFileSync(runsFile, 'utf8')) as Record<string, unknown>[]) : [];
  for (const e of selection.entries.filter((x) => only === undefined || only.includes(x.id))) {
    const clone = path.join(repos, e.id);
    const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: clone, encoding: 'utf8' }).stdout.trim();
    const root = path.join(clone, e.root);
    const reader = {
      read: (p: string): Record<string, unknown> | undefined => {
        if (!fs.existsSync(p)) return undefined;
        const r = ts.readConfigFile(p, (f) => fs.readFileSync(f, 'utf8'));
        return r.error !== undefined ? undefined : (r.config as Record<string, unknown>);
      },
      resolvePackage: (): string | undefined => undefined,
    };
    const flat = flattenTsconfig(path.join(root, e.tsconfig ?? 'tsconfig.json'), root, reader, e.include);
    const holder = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-mine-'));
    const dir = path.join(holder, 'project');
    fs.mkdirSync(dir);
    fs.cpSync(path.join(root, 'src'), path.join(dir, 'src'), { recursive: true, filter: (p) => !p.includes(`${path.sep}node_modules`) });
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify(flat.tsconfig, null, 2) + '\n');
    const t0 = Date.now();
    try {
      const analysis = await analyseSnapshot(fs.realpathSync(dir), { presetsDir: path.resolve('presets') });
      const p = await proposeFromAnalysis(analysis, { presetsDir: path.resolve('presets') });
      const s = summariseProposal(p, { maxExceptions: 100000 });
      fs.writeFileSync(path.join(out, 'mined', `${e.id}.mined.yaml`), p.specYaml);
      fs.writeFileSync(path.join(out, 'mined', `${e.id}.json`), JSON.stringify({ id: e.id, sha: e.sha, head, declaredStyle: e.style, tsconfigNotes: flat.notes, ...s }, null, 1) + '\n');
      const row = { id: e.id, head, shaOk: head === e.sha, ms: Date.now() - t0, files: analysis.graph.files.length, style: p.style, styleConfidence: p.styleConfidence, rules: s.counts.rules, exceptions: s.counts.exceptions, specValid: s.spec.valid };
      runs.splice(0, runs.length, ...runs.filter((r) => r['id'] !== e.id), row);
      process.stderr.write(`${JSON.stringify(row)}\n`);
      const oracleDir = arg('--oracle-specs');
      if (oracleDir !== undefined) await oracle(e, path.join(oracleDir, `${e.id}.yaml`), analysis, out);
    } catch (err: unknown) {
      const row = { id: e.id, head, shaOk: head === e.sha, ms: Date.now() - t0, error: err instanceof Error ? err.message : String(err) };
      runs.splice(0, runs.length, ...runs.filter((r) => r['id'] !== e.id), row);
      process.stderr.write(`${JSON.stringify(row)}\n`);
    } finally {
      fs.rmSync(holder, { recursive: true, force: true });
    }
    fs.writeFileSync(runsFile, JSON.stringify(runs, null, 1) + '\n');
  }
}

const SETS = { observed: [] as MinedRuleKind[], strict: ['layer-direction', 'layer-unobserved'] as MinedRuleKind[], full: ['layer-direction', 'layer-unobserved', 'layer-rare-edge'] as MinedRuleKind[] };

async function oracle(e: Entry, specFile: string, analysis: Awaited<ReturnType<typeof analyseSnapshot>>, out: string): Promise<void> {
  const raw = YAML.parse(fs.readFileSync(specFile, 'utf8')) as { architecture: { style: string; layers: { name: string; directories?: string[]; file_patterns?: string[] }[]; allowed_dependencies?: { from: string; to: string[] }[] } };
  const a = raw.architecture;
  const names = a.layers.map((l) => l.name);
  const declaredAllowed: string[] = [];
  if (a.allowed_dependencies !== undefined) declaredAllowed.push(...a.allowed_dependencies.flatMap((d) => d.to.map((t) => `${d.from}>${t}`)));
  else for (let i = 0; i < names.length; i++) for (let j = 0; j < i; j++) if (a.style !== 'layered' || j === i - 1) declaredAllowed.push(`${String(names[i])}>${String(names[j])}`);
  const parsed = await parseSpec({ specFilePath: specFile });
  if (!parsed.success) throw new Error(`${e.id}: declared spec does not parse`);
  const kinds = new Map(parsed.data.layerModel.layers.map((l) => [l.name, l.kind]));
  const excluded = picomatch(readSpecExcludePaths(specFile), { dot: true });
  const assign = annotate(analysis.graph.files, a.layers.map((l) => ({ name: l.name, directories: l.directories ?? [], filePatterns: l.file_patterns ?? [] })) as never);
  const layerOf = new Map([...assign].map(([f, x]) => [f, excluded(f) ? null : x.layer]));
  const m = mineRules({ ...analysis.input, layerOf, layers: names, layerKinds: kinds }, a.style as MiningStyle);
  const present = new Set([...layerOf.values()].filter((l): l is string => l !== null));
  const truth = declaredAllowed.filter((x) => { const [p, q] = x.split('>'); return present.has(p ?? '') && present.has(q ?? ''); }).sort();
  const graphs = Object.fromEntries(Object.entries(SETS).map(([k, kinds2]) => {
    const mined = allowedGraph(m.pairs, m.rules, kinds2);
    const tp = mined.filter((x) => truth.includes(x)).length;
    return [k, { mined, tp, fp: mined.length - tp, fn: truth.length - tp }];
  }));
  const forbidding = m.rules.filter((r) => ['layer-direction', 'layer-unobserved', 'layer-rare-edge'].includes(r.kind))
    .map((r) => ({ id: r.id, kind: r.kind, level: r.level, pair: `${r.subject}>${String(r.object)}`, declaredForbids: !truth.includes(`${r.subject}>${String(r.object)}`) && present.has(r.subject) && present.has(String(r.object)) }));
  fs.mkdirSync(path.join(out, 'oracle'), { recursive: true });
  fs.writeFileSync(path.join(out, 'oracle', `${e.id}.json`), JSON.stringify({
    id: e.id, style: a.style, layersPresent: [...present].sort(), filesMapped: [...layerOf.values()].filter((l) => l !== null).length, files: layerOf.size,
    declaredAllowed: truth, graphs, forbidding,
    rules: m.rules.map((r) => ({ id: r.id, kind: r.kind, level: r.level, confidence: r.confidence, subject: r.subject, object: r.object, statement: r.statement, exceptions: r.exceptions })),
  }, null, 1) + '\n');
}

main().catch((e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`); process.exit(1); });
