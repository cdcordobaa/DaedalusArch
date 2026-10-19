/**
 * Ontology v0 runner (`Docs/v1.3/ontology-v0-design.md`; v1.4 U3 §13). DEVELOPMENT SET ONLY.
 *
 * Runs the grounded semantic layer over one project, over the planted ground-truth cases
 * (`tests/fixtures/v1.3-ontology/`) or over the NS-02 set (`tests/fixtures/v1.3-ontology/ns02/set.json`, 12 projects),
 * and scores the cases against their `expected-semantic.json`, with the cheap proxies' (and, when given, the judge's)
 * outcome on the same items. Every run also writes the A2 facts (`facts.json`), loads A1 + A2 into the in-process
 * graph and runs the Sem rules (`verdicts.json`); with an `ns02` block it scores both (`fact-scores.json`,
 * `verdict-scores.json`).
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/ontology-run.ts --fixtures --estimate
 *   npx tsx scripts/v1.3/ontology-run.ts --fixtures --budget 120            # live: the judge's isolated Claude CLI route
 *   npx tsx scripts/v1.3/ontology-run.ts --fixtures --replay                 # replay the live cassettes, no call
 *   npx tsx scripts/v1.3/ontology-run.ts --fixtures --provider mock          # scripted mock answers, record
 *   npx tsx scripts/v1.3/ontology-run.ts --fixtures --provider mock --replay # replay the mock fixture cassettes
 *   npx tsx scripts/v1.3/ontology-run.ts --ns02 --estimate                   # the NS-02 set, each with its own layers.json
 *   npx tsx scripts/v1.3/ontology-run.ts --project <dir> --layers <dir>/layers.json --provider gemini-agy --model <id> --estimate
 *   npx tsx scripts/v1.3/ontology-run.ts --project <dir> --spec <yaml> --estimate
 *
 * Options:
 *   --provider claude-cli|gemini-api|gemini-agy|mock
 *                                default claude-cli (the judge's route: pinned CLI, `--judge-config-dir`, isolation
 *                                pre-flight; credentials are never read). gemini-api reads GEMINI_API_KEY from the
 *                                environment, only when a live record opens; gemini-agy uses LABELLER_AGY_HOME and the
 *                                agy isolation pre-flight. Estimate and replay never open a route.
 *   --model <id>                 required for the Gemini routes (no default); claude-cli default is the judge's model
 *   --temperature <t>            gemini-api only (default: the P4 labeller's temperature, LABELLER_TEMPERATURE)
 *   --fact-policy agreed-only|any default agreed-only: model facts used only when both runs agree. `any` is a run-level
 *                                setting (it changes the pass (b) prompts and the pass (d) pairs), so it needs its own
 *                                calls. --runs 1 needs `any` (record and replay; --estimate --runs 1 still prints)
 *   --replay                     answer from the cassettes only (a miss makes the item invalid; nothing is called)
 *   --cassettes <dir>            default tests/fixtures/v1.3-ontology/cassettes-<provider> (one subdir per project)
 *   --mock-answers <dir>         default tests/fixtures/v1.3-ontology/mock-answers
 *   --budget <n>                 provider calls allowed per project (default 200; cache hits are free)
 *   --runs <n>                   runs per item (default 2)
 *   --estimate                   count the calls and prompt tokens, call nothing
 *   --judge-config-dir <dir>     default ~/.firewall/judge-claude-config
 *   --claude-bin <path>          default `claude`
 *   --judge-outcomes <json>      optional {"<case>": {"source": "...", "failedFiles": [...]}} to score the judge
 *   --out <dir>                  default results/v1.3-ontology/<provider>[-replay] (one subdir per project)
 * A usage limit or auth stop ends the run; what was recorded stays in the cassettes, so the same command resumes.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DEFAULT_ONTOLOGY_OPTIONS, DEFAULT_ROUTE_DEPS, FACT_POLICIES, MockOntologyProvider, NoCallProvider, aggregate, buildFacts, checkRoute,
  createScriptedResponder, describeRoute, diskReader, estimateOntology, isOntologyRoute, loadFacts, openRoute, prepareOntologyInput,
  runOntology, runSemRules, scoreCase, scoreFacts, scoreVerdicts,
} from '../../src/apg-enrich/ontology/index.js';
import type {
  CaseScore, ExpectedSemanticManifest, FactPolicy, JudgeCaseOutcome, Ns02Block, OntologyInput, OntologyProvider, OntologyRouteSpec,
  OpenedRoute, RouteDeps, ScriptedAnswers,
} from '../../src/apg-enrich/ontology/index.js';
import { MemoryGraphRepository } from '../../src/cypher-interp/index.js';
import { JUDGE_CONFIG_DIR_DEFAULT } from '../../src/llm-critic/frozen.js';
import { parseSpec } from '../../src/spec-parser/index.js';
import type { LayerModel } from '../../src/shared/types/spec.js';
import { LABELLER_API_MAX_TOKENS, LABELLER_TEMPERATURE } from '../llm-label.js';

export const FIXTURES = 'tests/fixtures/v1.3-ontology';
export const NS02_SET = path.join(FIXTURES, 'ns02', 'set.json');

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function out(line = ''): void {
  process.stdout.write(`${line}\n`);
}

export function fixtureCases(root = FIXTURES): string[] {
  return fs.readdirSync(root).filter((d) => d.startsWith('case-') && fs.existsSync(path.join(root, d, 'expected-semantic.json'))).sort();
}

interface SetProject { readonly id: string; readonly dir: string; readonly layers: string; readonly ns02: string; readonly manifestSha256?: string }
interface NsSet { readonly pairs: readonly { readonly pair: number; readonly defect: SetProject; readonly twin: SetProject }[]; readonly retired: readonly unknown[] }

export interface RunTarget {
  readonly id: string;
  readonly dir: string;
  /** Repo-relative layers.json of this target (the NS-02 set), else the run-wide layer model is used. */
  readonly layers?: string;
  /** Where the target's ns02 block lives (its manifest, or a parent-block sidecar file). */
  readonly ns02File?: string;
}

/** The 12 projects of the NS-02 set index, in pair order (defect, then twin); the retired pair is not listed. */
export function ns02Targets(setFile = NS02_SET): RunTarget[] {
  const set = JSON.parse(fs.readFileSync(setFile, 'utf8')) as NsSet;
  const root = path.dirname(path.dirname(setFile));
  const t = (p: SetProject): RunTarget => ({ id: p.id, dir: path.join(root, p.dir), layers: path.join(root, p.layers), ns02File: path.join(root, p.ns02) });
  return set.pairs.flatMap((p) => [t(p.defect), t(p.twin)]);
}

function readLayers(file: string): LayerModel {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as LayerModel;
}

async function layerModelOf(argv: readonly string[], fixtures: boolean): Promise<{ model: LayerModel | undefined; path: string | null }> {
  const spec = arg(argv, '--spec');
  if (spec !== undefined) {
    const parsed = await parseSpec({ specFilePath: spec });
    if (!parsed.success) throw new Error(`spec ${spec}: ${parsed.errors.map((e) => e.message).join('; ')}`);
    return { model: parsed.data.layerModel, path: spec };
  }
  const layers = arg(argv, '--layers') ?? (fixtures ? path.join(FIXTURES, 'layers.json') : undefined);
  return layers === undefined ? { model: undefined, path: null } : { model: readLayers(layers), path: layers };
}

/** The target's ns02 block: its set entry, else a parent-case sidecar block (`ns02/parent-blocks/<id>.json`), else its manifest's. */
function ns02BlockOf(t: RunTarget, manifest: ExpectedSemanticManifest | null): Ns02Block | null {
  const file = t.ns02File ?? path.join(FIXTURES, 'ns02', 'parent-blocks', `${t.id}.json`);
  if (fs.existsSync(file)) {
    const j = JSON.parse(fs.readFileSync(file, 'utf8')) as { readonly ns02?: Ns02Block };
    if (j.ns02 !== undefined) return j.ns02;
  }
  return manifest?.ns02 ?? null;
}

const RUNS1_TRAP = '--runs 1 with --fact-policy agreed-only: every assertion is single-run, so agreed-only keeps no model fact and every finding and verdict is empty whatever the model answers (the NS-02 §4 runs = 1 trap). Use --runs 2, or --fact-policy any to read the single-run facts.';

export async function main(argv: readonly string[], deps: RouteDeps = DEFAULT_ROUTE_DEPS): Promise<number> {
  const fixtures = argv.includes('--fixtures');
  const ns02 = argv.includes('--ns02');
  const project = arg(argv, '--project');
  if (!fixtures && !ns02 && project === undefined) {
    out('give --fixtures, --ns02 or --project <dir>');
    return 2;
  }
  const providerName = arg(argv, '--provider') ?? 'claude-cli';
  if (!isOntologyRoute(providerName)) {
    out(`unknown provider ${providerName}`);
    return 2;
  }
  const policyArg = arg(argv, '--fact-policy') ?? 'agreed-only';
  if (!(FACT_POLICIES as readonly string[]).includes(policyArg)) {
    out(`unknown fact policy ${policyArg} (agreed-only or any)`);
    return 2;
  }
  const factPolicy = policyArg as FactPolicy;
  const replay = argv.includes('--replay');
  const estimate = argv.includes('--estimate');
  const budget = Number(arg(argv, '--budget') ?? String(DEFAULT_ONTOLOGY_OPTIONS.budget));
  const runs = Number(arg(argv, '--runs') ?? String(DEFAULT_ONTOLOGY_OPTIONS.runs));
  if (runs === 1 && factPolicy === 'agreed-only' && !estimate) {
    out(RUNS1_TRAP);
    return 2;
  }
  const temperatureArg = arg(argv, '--temperature');
  const model = arg(argv, '--model');
  const spec: OntologyRouteSpec = {
    route: providerName,
    ...(model !== undefined ? { model } : {}),
    ...(temperatureArg !== undefined ? { temperature: Number(temperatureArg) } : providerName === 'gemini-api' ? { temperature: LABELLER_TEMPERATURE } : {}),
    ...(providerName === 'gemini-api' ? { maxTokens: LABELLER_API_MAX_TOKENS } : {}),
  };
  const routeOk = checkRoute(spec);
  if (!routeOk.success) {
    for (const e of routeOk.errors) out(e.message);
    return 2;
  }
  const description = describeRoute(spec);
  const cassettes = arg(argv, '--cassettes') ?? path.join(FIXTURES, `cassettes-${providerName}`);
  const answersDir = arg(argv, '--mock-answers') ?? path.join(FIXTURES, 'mock-answers');
  const outDir = arg(argv, '--out') ?? path.join('results/v1.3-ontology', `${providerName}${replay ? '-replay' : ''}`);
  const judgeOutcomes = arg(argv, '--judge-outcomes');
  const judge = judgeOutcomes === undefined ? {} : JSON.parse(fs.readFileSync(judgeOutcomes, 'utf8')) as Record<string, JudgeCaseOutcome>;
  const runLayers = await layerModelOf(argv, fixtures);
  const targets: RunTarget[] = ns02 ? ns02Targets()
    : fixtures ? fixtureCases().map((c) => ({ id: c, dir: path.join(FIXTURES, c) }))
      : [{ id: path.basename(path.resolve(project ?? '.')), dir: project ?? '.' }];

  let opened: OpenedRoute | null = null;
  const providerFor = async (input: OntologyInput, id: string): Promise<OntologyProvider | null> => {
    if (replay || estimate) return new NoCallProvider(description);
    if (providerName === 'mock') {
      const file = path.join(answersDir, `${id}.json`);
      const script: ScriptedAnswers = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as ScriptedAnswers : { case: id, responses: [] };
      return new MockOntologyProvider(createScriptedResponder(script, input.apg, diskReader(input.projectRoot)), description.model);
    }
    if (opened === null) {
      const r = await openRoute(spec, deps, { mode: 'record', claude: { binary: arg(argv, '--claude-bin') ?? 'claude', judgeConfigDir: arg(argv, '--judge-config-dir') ?? JUDGE_CONFIG_DIR_DEFAULT } });
      if (!r.success) {
        out(`${providerName} route pre-flight failed: ${r.errors.map((e) => `${e.code}: ${e.message}`).join('; ')}`);
        return null;
      }
      opened = r.data;
      if (r.data.ready !== null) out(r.data.ready);
    }
    return opened.provider;
  };

  fs.mkdirSync(outDir, { recursive: true });
  const scores: CaseScore[] = [];
  const notes: string[] = [];
  let exit = 0;
  try {
    for (const t of targets) {
      const layers = t.layers !== undefined ? { model: readLayers(t.layers), path: t.layers } : runLayers;
      const input = await prepareOntologyInput(t.dir, { ...(layers.model !== undefined ? { layerModel: layers.model } : {}) });
      const provider = await providerFor(input, t.id);
      if (provider === null) return 3;
      const options = {
        provider, runs, budget,
        requireAgreement: factPolicy === 'agreed-only',
        cacheMode: replay ? 'replay' as const : 'record' as const,
        cacheDir: path.join(cassettes, t.id),
        ...(providerName === 'mock' ? { now: (): string => '2026-10-15T00:00:00.000Z' } : {}),
      };
      if (estimate) {
        const e = estimateOntology(input, options);
        out(`${t.id}: classes ${String(e.classes)}, groups ${String(e.groups)}, rule-candidate classes ${String(e.ruleCandidateClasses)}; calls a=${String(e.calls.responsibility)} b<=${String(e.calls.capability)} c=${String(e.calls.rules)} d<=${String(e.calls.adjudicate)}; cached ${String(e.cachedKnown)}; upper bound ${String(e.totalUpperBound)}; prompt tokens ~${String(e.promptTokensKnown)}; budget ${String(e.budget)} ${e.withinBudget ? 'ok' : 'MAY BE EXCEEDED'}`);
        continue;
      }
      const detail = await runOntology(input, options);
      const { result } = detail;
      const dir = path.join(outDir, t.id);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
      const c = result.calls;
      out(`${t.id}: ${String(result.nodes.length)} Sem nodes, ${String(result.edges.length)} Sem edges, ${String(result.findings.length)} findings, ${String(result.hallucinations.length)} rejected (hallucinations); calls ${String(c.providerCalls)}, cache hits ${String(c.cacheHits)}, invalid ${String(c.invalid)}, budget-skipped ${String(c.skippedForBudget)}, cassette misses ${String(c.cassetteMisses)}`);
      if (result.stopped !== null) {
        out(`STOPPED in pass ${result.stopped.pass}: ${result.stopped.code} ${result.stopped.message}. Recorded answers are kept; rerun the same command to resume.`);
        exit = 4;
        break;
      }
      // A2 and the Sem rules (facts through the query layer; in-process graph, no Neo4j).
      const facts = buildFacts(detail, input, { projectId: t.id, layerModelPath: layers.path });
      fs.writeFileSync(path.join(dir, 'facts.json'), `${JSON.stringify(facts, null, 2)}\n`);
      const repo = new MemoryGraphRepository();
      const loaded = await loadFacts(input.apg, layers.model, facts, repo);
      if (!loaded.success) throw new Error(`A2 load: ${loaded.errors.map((e) => e.message).join('; ')}`);
      const verdicts = await runSemRules(repo, facts, factPolicy);
      if (!verdicts.success) throw new Error(`Sem rules: ${verdicts.errors.map((e) => e.message).join('; ')}`);
      fs.writeFileSync(path.join(dir, 'verdicts.json'), `${JSON.stringify(verdicts.data, null, 2)}\n`);

      const manifestFile = path.join(t.dir, 'expected-semantic.json');
      const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as ExpectedSemanticManifest : null;
      const block = ns02BlockOf(t, manifest);
      if (block !== null) {
        const fs1 = scoreFacts(block, facts, input.apg, factPolicy);
        const vs = scoreVerdicts(block, verdicts.data, input.apg);
        fs.writeFileSync(path.join(dir, 'fact-scores.json'), `${JSON.stringify(fs1, null, 2)}\n`);
        fs.writeFileSync(path.join(dir, 'verdict-scores.json'), `${JSON.stringify(vs, null, 2)}\n`);
        out(`  ns02 ${t.id}: required facts hit ${String(fs1.hit)}/${String(fs1.required)}, false facts ${String(fs1.falseFacts)}/${String(fs1.forbidden)}; verdicts ${vs.map((v) => `${v.rule} ${v.expected} ${v.outcome}`).join(', ')}`);
      }
      if (manifest !== null) {
        scores.push(scoreCase(manifest, result, { cheap: input.cheap, apg: input.apg, ...(judge[t.id] !== undefined ? { judge: judge[t.id] } : {}) }));
        // BR-U3-09: a fragmentation expected without any declared context is outside N4 scope; said on its own line.
        if (manifest.expect.conceptFragmentations.length > 0 && layers.model?.ddd === undefined) {
          const line = `  note: ${t.id} conceptFragmentations expected item is missed (N4: no declared context); fragmentation is a finding only inside one declared bounded context`;
          out(line);
          notes.push(line.trim());
        }
      }
    }
  } finally {
    (opened as OpenedRoute | null)?.dispose();
  }
  if (scores.length > 0) {
    const agg = aggregate(scores);
    fs.writeFileSync(path.join(outDir, 'scores.json'), `${JSON.stringify({ provider: providerName, replay, factPolicy, aggregate: agg, cases: scores, notes }, null, 2)}\n`);
    out('');
    out('| Case | Item | Polarity | Ontology | Cheap proxies | Judge |');
    out('|---|---|---|---|---|---|');
    for (const s of scores) for (const i of s.items) out(`| ${s.case} | ${i.kind}: ${i.id} | ${i.polarity} | ${i.ontology} | ${i.cheap} | ${i.judge} |`);
    out('');
    out(`expected ${String(agg.expected)}, found ${String(agg.found)}, forbidden hits ${String(agg.forbiddenHits)}/${String(agg.forbidden)}, unexpected ${String(agg.unexpected)}; cheap caught ${String(agg.cheapCaughtExpected)}/${String(agg.expected)} expected and flagged ${String(agg.cheapFlaggedForbidden)}/${String(agg.forbidden)} forbidden; hallucinations ${String(agg.hallucinations)} vs ${String(agg.acceptedAssertions)} accepted`);
  }
  return exit;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]).endsWith(path.join('scripts', 'v1.3', 'ontology-run.ts'))) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
}
