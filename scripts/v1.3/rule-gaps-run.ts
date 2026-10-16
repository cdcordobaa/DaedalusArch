/**
 * Rule-gap catalogue (`src/fitness-compiler/rule-gap-templates.ts`, `Docs/v1.3/rule-gap-catalogue.md`): live Cypher
 * runs. DEVELOPMENT DATA ONLY: results are fire counts and sampled findings for later human labelling, nothing is
 * scored or tuned on them.
 *
 * Every mode extracts with the v1.3 defaults plus APG v2 and field state (`{ ...V13_APG2_OPTIONS, fieldState: true }`),
 * ingests into Neo4j with the spec's layer model, runs every rule-gap template live as the compiler instantiates it
 * (`instantiateTemplate`; once more with an exclude pattern that matches nothing) with `ruleGapParams`, and compares
 * the rows with the in-memory mirror on the same extraction.
 *
 * Modes:
 * - `fixtures`: `tests/fixtures/v1.3-rule-gaps` (cases.json): live rows must equal the mirror and every case must hold.
 * - `reference`: the 71 variants of the five v1.3 dev reference projects (`tests/fixtures/v1.3-reference`).
 * - `e1 --e1-runs <dir> --e1-root <outcomes> --spec <spec>`: the accepted E1 cells, with the pinned ADR-032 tsconfig.
 * `fixtures` writes `<out>/fixtures-<engine>.json`. `reference` and `e1` write `<out>/<mode>-rows.json` (every row), `<out>/<mode>-summary.json` (fire counts) and
 * `<out>/<mode>-sample.md` (with `-neo4j` after the mode on that engine) (up to 10 distinct findings per rule, with code excerpts).
 *
 * Engines (`--engine`): `cypher-interp` (default; the in-process interpreter, `Docs/v1.3/cypher-interpreter.md`, a fresh
 * graph per project) or `neo4j` (Neo4j 5.26 + APOC: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD from the environment; the
 * cross-process Neo4j lock is held).
 * Usage (repository root): npx tsx scripts/v1.3/rule-gaps-run.ts fixtures|reference|e1 [--engine cypher-interp|neo4j] [--out <dir>] [e1 flags]
 * Default out: results/v1.3-rule-gaps.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import neo4j from 'neo4j-driver';
import { extractAPG, V13_APG2_OPTIONS, componentsFromLayerModel } from '../../src/apg-extractor/index.js';
import type { APGResult } from '../../src/shared/types/apg.js';
import type { DddModel, LayerDefinition, LayerModel, ParsedSpec } from '../../src/shared/types/spec.js';
import type { LayerKind } from '../../src/shared/types/enums.js';
import { RULE_GAP_TEMPLATES, RULE_GAP_TEMPLATE_TIERS } from '../../src/fitness-compiler/rule-gap-templates.js';
import { RULE_GAP_IN_MEMORY, ruleGapParams } from '../../src/fitness-compiler/rule-gap-in-memory.js';
import type { RuleGapParams } from '../../src/fitness-compiler/rule-gap-in-memory.js';
import { memGraph } from '../../src/fitness-compiler/apg2-in-memory.js';
import type { Row } from '../../src/fitness-compiler/apg2-in-memory.js';
import { instantiateTemplate } from '../../src/fitness-compiler/index.js';
import { ingestAPG, Neo4jRepository } from '../../src/neo4j-ingestion/index.js';
import { MemoryGraphRepository } from '../../src/cypher-interp/repository.js';
import type { GraphRepository } from '../../src/shared/interfaces/graph-repository.js';
import { parseSpec, readSpecExcludePaths } from '../../src/spec-parser/index.js';
import { acquireNeo4jLock } from '../../src/shared/process/neo4j-lock.js';
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import type { SnapshotStore } from '../../src/shared/interfaces/snapshot-store.js';
import { harnessTsconfigText } from '../lib/generators/harness-tsconfig.js';
import { loadAllReferences } from './lib/reference-model.js';
import { makeTempRoot, materialiseVariant } from './lib/materialise.js';
import { must } from './lib/must.js';

const ROOT = process.cwd();
const SUITE = path.join(ROOT, 'tests/fixtures/v1.3-rule-gaps');
const OPTIONS = { ...V13_APG2_OPTIONS, fieldState: true };
const SAMPLE_SIZE = 10;
const EXCERPT_RADIUS = 3;

const nullStore = {} as SnapshotStore;

function plain(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (neo4j.isInt(v)) return (v as { toNumber(): number }).toNumber();
  if (Array.isArray(v)) return v.map(plain);
  return v;
}
const plainRow = (r: Row): Record<string, unknown> => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, plain(v)]));
const canon = (rows: readonly Row[]): string[] => rows.map((r) => JSON.stringify(plainRow(r))).sort();

const cypherParams = (p: RuleGapParams): Record<string, unknown> => JSON.parse(JSON.stringify(p)) as Record<string, unknown>;

async function ingest(repo: GraphRepository, apg: APGResult, layerModel: LayerModel): Promise<void> {
  const r = await ingestAPG({ apgResult: apg, layerModel, mode: 'stateless' }, repo, nullStore);
  if (!r.success) throw new Error(`ingest: ${r.errors.map((e) => e.message).join('; ')}`);
  for (const w of r.warnings ?? []) if (w.code === 'INGEST_002' || w.code === 'INGEST_003') throw new Error(`ingest: ${w.code} ${w.message}`);
}

async function extract(dir: string, opts: object, tsconfig?: string): Promise<APGResult> {
  const r = await extractAPG(dir, opts, tsconfig);
  if (!r.success) throw new Error(`extract ${dir}: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.data;
}

async function runLive(repo: GraphRepository, name: string, p: RuleGapParams, exclude: boolean): Promise<Record<string, unknown>[]> {
  const tpl = must(RULE_GAP_TEMPLATES.get(name), `template ${name}`);
  const params: Record<string, unknown> = { ...cypherParams(p), ...(exclude ? { excludePatterns: ['^__no_such_path__$'] } : {}) };
  const r = await repo.executeQuery(instantiateTemplate(tpl, params), params);
  if (!r.success) throw new Error(`${name}: ${r.errors.map((e) => `${e.code} ${e.message}`).join('; ')}`);
  return r.data.records.map(plainRow);
}

interface Comparison { readonly template: string; readonly live: number; readonly mirror: number; readonly equal: boolean; readonly orderEqual: boolean; readonly excludeEqual: boolean; readonly onlyLive: string[]; readonly onlyMirror: string[] }

/** Ingests, runs every template live and its mirror; returns the comparison and the live rows. */
/** The graph store of one project: the shared Neo4j repository, or a fresh in-process graph. */
type RepoSource = () => GraphRepository;

async function runAll(source: RepoSource, apg: APGResult, lm: LayerModel, p: RuleGapParams): Promise<{ cmp: Comparison[]; live: Map<string, Record<string, unknown>[]> }> {
  const repo = source();
  await ingest(repo, apg, lm);
  const g = memGraph(apg, lm);
  const cmp: Comparison[] = [];
  const live = new Map<string, Record<string, unknown>[]>();
  for (const name of RULE_GAP_TEMPLATES.keys()) {
    const rows = await runLive(repo, name, p, false);
    const rowsEx = await runLive(repo, name, p, true);
    const mirror = must(RULE_GAP_IN_MEMORY.get(name), `mirror ${name}`)(g, p).map(plainRow);
    live.set(name, rows);
    const a = canon(rows);
    const b = canon(mirror);
    cmp.push({ template: name, live: rows.length, mirror: mirror.length, equal: JSON.stringify(a) === JSON.stringify(b),
      orderEqual: JSON.stringify(rows) === JSON.stringify(mirror), excludeEqual: JSON.stringify(canon(rowsEx)) === JSON.stringify(a),
      onlyLive: a.filter((x) => !b.includes(x)), onlyMirror: b.filter((x) => !a.includes(x)) });
  }
  return { cmp, live };
}

const cmpOk = (c: Comparison): boolean => c.equal && c.excludeEqual;

// ── fixtures ─────────────────────────────────────────────────────────────────
interface FixtureProject { layers: { name: string; directories: string[]; kind: LayerKind }[]; forbiddenImports: string[]; ddd?: DddModel }
interface FixtureCase { id: string; kind: string; project: string; template: string; match: Record<string, unknown> }

async function fixtures(repo: RepoSource, out: string, engine: string): Promise<number> {
  const suite = JSON.parse(fs.readFileSync(path.join(SUITE, 'cases.json'), 'utf8')) as { projects: Record<string, FixtureProject>; cases: FixtureCase[] };
  const results: Record<string, unknown>[] = [];
  const comparisons: Record<string, Comparison[]> = {};
  let bad = 0;
  for (const [name, spec] of Object.entries(suite.projects)) {
    const lm: LayerModel = {
      layers: spec.layers.map((l): LayerDefinition => ({ name: l.name, directories: l.directories, naming: [], role: '', kind: l.kind, kindSource: 'explicit' })),
      ...(spec.ddd !== undefined ? { ddd: spec.ddd } : {}),
    };
    const p = ruleGapParams(lm, { forbiddenImports: spec.forbiddenImports });
    const { cmp, live } = await runAll(repo, await extract(path.join(SUITE, name), OPTIONS), lm, p);
    comparisons[name] = cmp;
    bad += cmp.filter((c) => !cmpOk(c)).length;
    for (const c of suite.cases.filter((x) => x.project === name)) {
      const hits = (live.get(c.template) ?? []).filter((r) => Object.entries(c.match).every(([k, v]) => JSON.stringify(r[k]) === JSON.stringify(v)));
      const pass = c.kind === 'violating' ? hits.length > 0 : hits.length === 0;
      if (!pass) bad += 1;
      results.push({ id: c.id, kind: c.kind, template: c.template, liveRows: hits.length, pass });
    }
    process.stdout.write(`${name}: ${cmp.map((c) => `${c.template}=${String(c.live)}/${String(c.mirror)}${cmpOk(c) ? '' : ' DIFF'}`).join(', ')}\n`);
  }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, `fixtures-${engine}.json`), JSON.stringify({ comparisons, cases: results }, null, 2) + '\n');
  process.stdout.write(`cases: ${String(results.length)}, failing: ${results.filter((r) => r.pass !== true).map((r) => String(r.id)).join(', ') || 'none'}; problems: ${String(bad)}\n`);
  return bad === 0 ? 0 : 1;
}

// ── shared reporting for reference and e1 ─────────────────────────────────────
interface RunUnit { readonly group: string; readonly unit: string; readonly kind: string; readonly projectDir: string; readonly spec: ParsedSpec; readonly tsconfig?: string; readonly excludePatterns: readonly string[] }
interface FoundRow { readonly template: string; readonly group: string; readonly unit: string; readonly kind: string; readonly row: Record<string, unknown> }

function forbiddenOf(spec: ParsedSpec): string[] {
  const ff = spec.fitnessFunctions.find((f) => f.name === 'domain-purity');
  return [...(ff?.forbiddenImports ?? [])];
}

/** The identity of a finding across variants: its file plus the template's discriminator columns. */
function findingKey(template: string, row: Record<string, unknown>): string {
  const t = must(RULE_GAP_TEMPLATES.get(template), template);
  const cols = [t.resultMapping.filePathColumn, ...(t.resultMapping.targetColumn !== undefined ? [t.resultMapping.targetColumn] : []), ...t.resultMapping.discriminatorColumns];
  return JSON.stringify(cols.map((c) => row[c] ?? null));
}

/** Lines around the finding: the row's line, else the declaration of its class or member, else the file head. */
function excerpt(projectDir: string, template: string, row: Record<string, unknown>): { file: string; from: number; text: string } {
  const t = must(RULE_GAP_TEMPLATES.get(template), template);
  const file = String(row[t.resultMapping.filePathColumn]);
  const abs = path.join(projectDir, file);
  if (!fs.existsSync(abs)) return { file, from: 0, text: '(file not found)' };
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  let at = typeof row.line === 'number' ? row.line : -1;
  const symbol = [row.controller, row.class, row.consumer, row.provider, row.member].find((x) => typeof x === 'string') as string | undefined;
  if (at < 0 && symbol !== undefined) {
    const [cls, member] = symbol.split('.');
    const re = member !== undefined ? new RegExp(`\\b${member}\\s*\\(`) : new RegExp(`class\\s+${cls ?? ''}\\b`);
    const i = lines.findIndex((l) => re.test(l));
    if (i >= 0) at = i + 1;
  }
  // Point at the dependency or field when the row names one, inside the declaration.
  const firstField = Array.isArray(row.fields) ? row.fields[0] : undefined;
  const near = [row.field, row.parameter, firstField, row.dependency, row.heldType, row.target].find((x) => typeof x === 'string') as string | undefined;
  if (near !== undefined && at > 0) {
    const short = path.basename(near).replace(/\.ts$/, '');
    const j = lines.findIndex((l, k) => k >= at - 1 && k < at + 40 && l.includes(short));
    if (j >= 0) at = j + 1;
  }
  if (at < 1) at = 1;
  const from = Math.max(1, at - EXCERPT_RADIUS);
  const to = Math.min(lines.length, at + EXCERPT_RADIUS);
  return { file, from, text: lines.slice(from - 1, to).map((l, k) => `${String(from + k).padStart(4)}${from + k === at ? ' >' : '  '} ${l}`).join('\n') };
}

async function runUnits(repo: RepoSource, units: Iterable<RunUnit>, mode: string, out: string): Promise<number> {
  const rows: FoundRow[] = [];
  const unitsSeen: { group: string; unit: string; kind: string; mirrorEqual: boolean; diffs: Comparison[]; rows: Record<string, number> }[] = [];
  const excerpts = new Map<string, ReturnType<typeof excerpt>>();
  const errors: { group: string; unit: string; error: string }[] = [];
  for (const u of units) {
    try {
      const lm = u.spec.layerModel;
      const p = ruleGapParams(lm, { forbiddenImports: forbiddenOf(u.spec) });
      const apg = await extract(u.projectDir, { ...OPTIONS, excludePatterns: u.excludePatterns, components: componentsFromLayerModel(lm) }, u.tsconfig);
      const { cmp, live } = await runAll(repo, apg, lm, p);
      const counts: Record<string, number> = {};
      for (const [t, rs] of live) {
        counts[t] = rs.length;
        for (const r of rs) {
          rows.push({ template: t, group: u.group, unit: u.unit, kind: u.kind, row: r });
          const k = `${t}|${u.group}|${findingKey(t, r)}`;
          if (!excerpts.has(k)) excerpts.set(k, excerpt(u.projectDir, t, r));
        }
      }
      const mirrorEqual = cmp.every(cmpOk);
      unitsSeen.push({ group: u.group, unit: u.unit, kind: u.kind, mirrorEqual, diffs: cmp.filter((c) => !cmpOk(c)), rows: counts });
      process.stdout.write(`${u.group}/${u.unit}: ${Object.entries(counts).filter(([, n]) => n > 0).map(([t, n]) => `${t}=${String(n)}`).join(', ') || 'no rows'}${mirrorEqual ? '' : ' MIRROR-DIFF'}\n`);
    } catch (e) {
      errors.push({ group: u.group, unit: u.unit, error: e instanceof Error ? e.message : String(e) });
      process.stdout.write(`${u.group}/${u.unit}: ERROR ${errors[errors.length - 1]?.error ?? ''}\n`);
    }
  }

  // Fire counts: rows, units with a row, distinct findings (per group), by template and group.
  const groups = [...new Set(unitsSeen.map((u) => u.group))];
  const summary = [...RULE_GAP_TEMPLATES.keys()].map((t) => {
    const mine = rows.filter((r) => r.template === t);
    const byGroup = Object.fromEntries(groups.map((g) => {
      const gr = mine.filter((r) => r.group === g);
      return [g, { rows: gr.length, units: new Set(gr.map((r) => r.unit)).size, of: unitsSeen.filter((u) => u.group === g).length,
        distinct: new Set(gr.map((r) => findingKey(t, r.row))).size,
        byKind: Object.fromEntries([...new Set(unitsSeen.filter((u) => u.group === g).map((u) => u.kind))].map((k) => [k, gr.filter((r) => r.kind === k).length])) }];
    }));
    return { template: t, tier: RULE_GAP_TEMPLATE_TIERS.get(t)?.tier ?? 'advisory', applicableStyles: RULE_GAP_TEMPLATES.get(t)?.applicableStyles ?? [],
      rows: mine.length, units: new Set(mine.map((r) => `${r.group}/${r.unit}`)).size, distinct: new Set(mine.map((r) => `${r.group}|${findingKey(t, r.row)}`)).size, byGroup };
  });

  // Sample: up to SAMPLE_SIZE distinct findings per template, round-robin over groups, in sorted order (deterministic).
  const md: string[] = [`# Rule-gap ${mode} run: sampled findings for labelling`, '', `Development data. ${String(unitsSeen.length)} units, ${String(errors.length)} errors. Each finding: the group (style or E1 task), the units it occurs in, the row, and a code excerpt (\`>\` marks the line). Label column left empty for the human labeller.`, ''];
  for (const t of RULE_GAP_TEMPLATES.keys()) {
    const distinct = new Map<string, { group: string; units: string[]; row: Record<string, unknown> }>();
    for (const r of rows.filter((x) => x.template === t)) {
      const k = `${r.group}|${findingKey(t, r.row)}`;
      const d = distinct.get(k) ?? { group: r.group, units: [], row: r.row };
      d.units.push(r.unit);
      distinct.set(k, d);
    }
    const byGroup = new Map<string, [string, { group: string; units: string[]; row: Record<string, unknown> }][]>();
    for (const e of [...distinct.entries()].sort(([a], [b]) => a.localeCompare(b))) byGroup.set(e[1].group, [...(byGroup.get(e[1].group) ?? []), e]);
    const picked: [string, { group: string; units: string[]; row: Record<string, unknown> }][] = [];
    for (let i = 0; picked.length < SAMPLE_SIZE && [...byGroup.values()].some((l) => l.length > i); i++) {
      for (const l of byGroup.values()) if (l[i] !== undefined && picked.length < SAMPLE_SIZE) picked.push(l[i] as never);
    }
    md.push(`## ${t}`, '', `${String(distinct.size)} distinct findings; ${String(picked.length)} sampled.`, '');
    picked.forEach(([k, d], i) => {
      const ex = excerpts.get(`${t}|${k}`);
      const units = d.units.length > 4 ? `${d.units.slice(0, 4).join(', ')} … (${String(d.units.length)} units)` : d.units.join(', ');
      md.push(`### ${t} #${String(i + 1)} (${d.group})`, '', `- units: ${units}`, `- row: \`${JSON.stringify(d.row)}\``, '- label: ', '',
        '```ts', `// ${ex?.file ?? ''}`, ex?.text ?? '', '```', '');
    });
  }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, `${mode}-rows.json`), JSON.stringify({ units: unitsSeen, errors, rows }, null, 2) + '\n');
  fs.writeFileSync(path.join(out, `${mode}-summary.json`), JSON.stringify({ units: unitsSeen.length, errors, mirrorDiffs: unitsSeen.filter((u) => !u.mirrorEqual).map((u) => `${u.group}/${u.unit}`), summary }, null, 2) + '\n');
  fs.writeFileSync(path.join(out, `${mode}-sample.md`), md.join('\n'));
  const diffs = unitsSeen.filter((u) => !u.mirrorEqual).length;
  process.stdout.write(`units: ${String(unitsSeen.length)}, mirror diffs: ${String(diffs)}, errors: ${String(errors.length)}\n`);
  return diffs === 0 && errors.length === 0 ? 0 : 1;
}

async function* referenceUnits(work: string): AsyncGenerator<RunUnit> {
  for (const ref of loadAllReferences(ROOT)) {
    const parsed = await parseSpec({ specFilePath: ref.specPath });
    if (!parsed.success) throw new Error(`spec ${ref.specPath}: ${parsed.errors.map((e) => e.message).join('; ')}`);
    const excludePatterns = readSpecExcludePaths(ref.specPath);
    for (const v of ref.variants) {
      const m = materialiseVariant(ref, v, work);
      yield { group: ref.style, unit: v.manifest.variant, kind: v.manifest.kind, projectDir: m.projectDir, spec: parsed.data, excludePatterns };
    }
  }
}

async function* e1Units(argv: readonly string[], work: string): AsyncGenerator<RunUnit> {
  const flag = (n: string): string => {
    const i = argv.indexOf(`--${n}`);
    const v = i >= 0 ? argv[i + 1] : undefined;
    if (v === undefined) throw new Error(`e1 needs --${n}`);
    return path.resolve(ROOT, v);
  };
  const runs = flag('e1-runs');
  const e1Root = flag('e1-root');
  const specPath = flag('spec');
  if (!fs.existsSync(e1Root)) throw new Error(`E1 outcomes not found at ${e1Root} (not distributed with the repository)`);
  const parsed = await parseSpec({ specFilePath: specPath });
  if (!parsed.success) throw new Error(`spec ${specPath}: ${parsed.errors.map((e) => e.message).join('; ')}`);
  for (const name of fs.readdirSync(runs).filter((n) => n.endsWith('.run.json')).sort()) {
    const rec = JSON.parse(fs.readFileSync(path.join(runs, name), 'utf8')) as { projectId?: string; status?: string };
    if (rec.status !== 'accepted' || rec.projectId === undefined) continue;
    const dir = path.join(e1Root, rec.projectId);
    const tsconfig = path.join(work, `${rec.projectId.replace(/\//g, '_')}.tsconfig.json`);
    fs.writeFileSync(tsconfig, harnessTsconfigText(dir));
    const [, task = 'e1'] = rec.projectId.split('/');
    yield { group: task, unit: rec.projectId, kind: 'e1', projectDir: dir, spec: parsed.data, tsconfig, excludePatterns: readSpecExcludePaths(specPath) };
  }
}

async function main(argv: readonly string[]): Promise<number> {
  const mode = argv[0];
  const outIdx = argv.indexOf('--out');
  const out = path.resolve(ROOT, outIdx >= 0 ? argv[outIdx + 1] ?? '' : 'results/v1.3-rule-gaps');
  if (mode !== 'fixtures' && mode !== 'reference' && mode !== 'e1') {
    process.stderr.write('usage: rule-gaps-run.ts fixtures|reference|e1 [--engine cypher-interp|neo4j] [--out <dir>] [--e1-runs <dir> --e1-root <dir> --spec <file>]\n');
    return 2;
  }
  const engineIdx = argv.indexOf('--engine');
  const engine = engineIdx >= 0 ? argv[engineIdx + 1] ?? '' : 'cypher-interp';
  if (engine !== 'cypher-interp' && engine !== 'neo4j') {
    process.stderr.write('--engine is cypher-interp or neo4j\n');
    return 2;
  }
  const work = makeTempRoot('rule-gaps-');
  const run = async (source: RepoSource): Promise<number> => {
    if (mode === 'fixtures') return fixtures(source, out, engine);
    const units: RunUnit[] = [];
    for await (const u of mode === 'reference' ? referenceUnits(work) : e1Units(argv, work)) units.push(u);
    return runUnits(source, units, `${mode}${engine === 'neo4j' ? '-neo4j' : ''}`, out);
  };
  try {
    if (engine === 'cypher-interp') return await run(() => new MemoryGraphRepository());
    const uri = process.env.NEO4J_URI ?? '';
    const password = process.env.NEO4J_PASSWORD ?? '';
    if (uri === '' || password === '') {
      process.stderr.write('--engine neo4j needs NEO4J_URI and NEO4J_PASSWORD\n');
      return 2;
    }
    const lock = await acquireNeo4jLock(uri, { label: `rule-gaps ${mode}`, onWait: (t) => process.stderr.write(`${t}\n`) });
    const repo = new Neo4jRepository({ neo4jUri: uri, neo4jUser: process.env.NEO4J_USER ?? 'neo4j', neo4jPassword: password });
    try {
      return await run(() => repo);
    } finally {
      await repo.close();
      lock.release();
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

void main(process.argv.slice(2)).then(
  (c) => { process.exitCode = c; },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [process.env.NEO4J_PASSWORD ?? ''].filter((s) => s !== ''))}\n`);
    process.exitCode = 2;
  },
);
