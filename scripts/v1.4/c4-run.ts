/**
 * C4 interpretation runner (v1.4 U9; `ops/notes/c4-01-interpretation-design.md` §5, §6, §9). DEVELOPMENT SET ONLY.
 *
 * Per project: C3 on the in-process interpreter (`cypher-interp`, no Neo4j), plus the Sem rules over A1 + A2 when the
 * project has A2 facts; then every **blocking** finding gets one C4 call per run, schema-validated, grounded and
 * cassetted; then the A5 files and, for the seeded set, the scores against the manifests and the keyword baseline.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/c4-run.ts --cases --provider claude-cli --estimate        # count calls and tokens, call nothing
 *   npx tsx scripts/v1.4/c4-run.ts --cases --pilot --provider mock                 # scripted stand-in, 0 model calls
 *   npx tsx scripts/v1.4/c4-run.ts --cases --provider claude-cli --replay          # replay the cassettes, call nothing
 *   npx tsx scripts/v1.4/c4-run.ts --cases --pilot --provider gemini-agy --model <id> --exploratory --budget 24
 *   npx tsx scripts/v1.4/c4-run.ts --cases --pilot --provider claude-cli --exploratory --budget 24
 *   npx tsx scripts/v1.4/c4-run.ts --project <dir> --spec <yaml> [--facts <facts.json> --layers <layers.json>] --estimate
 *
 * Options:
 *   --cases | --project <dir>   the seeded set (tests/fixtures/v1.4-c4/set.json), or one project
 *   --pilot                     the pilot pairs only (set.json `pilotPairs`, C4-01 §7)
 *   --only <id,id>              these set projects only
 *   --spec <yaml>               --project: the spec C3 runs with (absent: no symbolic findings)
 *   --facts <facts.json>        --project: an A2 file; its Sem verdicts are C4 findings too (needs --layers)
 *   --layers <layers.json>      --project: the layer model of the A2 file
 *   --provider claude-cli|gemini-agy|gemini-api|mock   default mock. Live routes open only in record mode, and only
 *                               after --estimate has been read; the cap below stops the run
 *   --model <id>                required for the Gemini routes
 *   --exploratory               claude-cli or gemini-agy: accept the route's exploratory CLI versions besides the frozen
 *                               pin (CLAUDE_EXPLORATORY_VERSIONS 2.1.303, D1 2026-10-19; AGY_EXPLORATORY_VERSIONS);
 *                               recorded in A5
 *   --estimate                  print the calls (expected, upper bound), cached answers and prompt tokens; call nothing
 *   --replay                    answer from the cassettes only (a miss is an invalid run, never a call)
 *   --runs <n>                  runs per finding (default 2, C4-01 §4.2 rule 6)
 *   --budget <n>                provider calls allowed for the whole run (default 80, the six-case cap per vendor)
 *   --cassettes <dir>           default tests/fixtures/v1.4-c4/cassettes-<provider> (one subdir per project); the mock
 *                               records nothing unless this is given
 *   --out <dir>                 default results/v1.4-c4/<provider>[-replay]
 *
 * The scoring path never reads what this writes (C4-01 §4.4): see tests/unit/apg-enrich/ontology/c4-invariance.test.ts.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DEFAULT_ROUTE_DEPS, MockOntologyProvider, NoCallProvider, a5File, aggregateC4, blockingFindings, buildFacts,
  buildInterpretationContext, c4MockResponder, checkRoute, createScriptedResponder, describeRoute, diskReader,
  estimateInterpretation, interpretFindings, isOntologyRoute, keywordBaseline, loadFacts, openRoute, prepareOntologyInput,
  proposedExceptions, runOntology, runSemRules, scoreC4Case, unitsOf,
} from '../../src/apg-enrich/ontology/index.js';
import type {
  BaselineAnswer, C4CaseManifest, C4CaseScore, C4Finding, C4Item, FactsFile, OntologyInput, OntologyProvider,
  OntologyRouteSpec, OpenedRoute, RouteDeps, ScriptedAnswers, SemVerdict,
} from '../../src/apg-enrich/ontology/index.js';
import { MemoryGraphRepository } from '../../src/cypher-interp/index.js';
import { createInterpEvaluator } from '../../src/mcp-server/interp-evaluator.js';
import type { InterpEvaluator } from '../../src/mcp-server/interp-evaluator.js';
import { parseSpec } from '../../src/spec-parser/index.js';
import type { EvaluationReport } from '../../src/shared/types/evaluation.js';
import type { LayerModel } from '../../src/shared/types/spec.js';

export const C4_FIXTURES = 'tests/fixtures/v1.4-c4';
export const C4_SET = path.join(C4_FIXTURES, 'set.json');
export const C4_RUN_BUDGET = 80;

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function out(line = ''): void {
  process.stdout.write(`${line}\n`);
}

interface SetEntry { readonly id: string; readonly manifest: string; readonly manifestSha256: string }
export interface C4Set { readonly pilotPairs: readonly string[]; readonly pairs: readonly { readonly pair: string; readonly case: SetEntry; readonly twin: SetEntry }[] }

export interface C4Target {
  readonly id: string;
  readonly dir: string;
  readonly spec: string | null;
  readonly manifest: C4CaseManifest | null;
  /** An A2 file on disk, or a scripted mock C1d run (no model call) that produces one. */
  readonly a2: { readonly kind: 'file'; readonly facts: string; readonly layers: string } | { readonly kind: 'mock-scripted'; readonly answers: string; readonly layers: string } | null;
}

/** The seeded set's projects, in pair order (case, then twin). */
export function setTargets(setFile = C4_SET, filter: { readonly pilot?: boolean; readonly only?: readonly string[] } = {}): C4Target[] {
  const set = JSON.parse(fs.readFileSync(setFile, 'utf8')) as C4Set;
  const root = path.dirname(setFile);
  const pairs = filter.pilot === true ? set.pairs.filter((p) => set.pilotPairs.includes(p.pair)) : set.pairs;
  return pairs.flatMap((p) => [p.case, p.twin]).filter((e) => filter.only === undefined || filter.only.includes(e.id)).map((e) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, e.manifest), 'utf8')) as C4CaseManifest;
    return {
      id: e.id, dir: manifest.projectDir ?? path.join(root, e.id), spec: manifest.spec ?? null, manifest,
      a2: manifest.a2 === undefined ? null : { kind: 'mock-scripted', answers: manifest.a2.answers, layers: manifest.a2.layers },
    };
  });
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

/** A C4 item with the class names the keyword baseline and the mock need. */
export type PreparedItem = C4Item & { readonly classNames: readonly string[] };

export interface PreparedProject {
  readonly id: string;
  readonly report: EvaluationReport | null;
  readonly facts: FactsFile | null;
  readonly semVerdicts: readonly SemVerdict[];
  readonly findings: readonly C4Finding[];
  readonly items: readonly PreparedItem[];
}

async function layerModelOfSpec(spec: string): Promise<LayerModel> {
  const parsed = await parseSpec({ specFilePath: spec });
  if (!parsed.success) throw new Error(`spec ${spec}: ${parsed.errors.map((e) => e.message).join('; ')}`);
  return parsed.data.layerModel;
}

/** A2 for the target: read from disk, or produced by a scripted C1d mock run (cache off, NOT a model call). */
async function a2Of(t: C4Target, input: OntologyInput, layers: LayerModel): Promise<{ facts: FactsFile; sem: SemVerdict[] } | null> {
  if (t.a2 === null) return null;
  let facts: FactsFile;
  if (t.a2.kind === 'file') {
    facts = readJson(t.a2.facts) as FactsFile;
  } else {
    const script = readJson(t.a2.answers) as ScriptedAnswers;
    const detail = await runOntology(input, {
      provider: new MockOntologyProvider(createScriptedResponder(script, input.apg, diskReader(input.projectRoot)), 'mock-ontology'),
      runs: 2, cacheMode: 'off', cacheDir: null, now: () => '2026-10-15T00:00:00.000Z',
    });
    facts = buildFacts(detail, input, { projectId: t.id, layerModelPath: t.a2.layers });
  }
  const repo = new MemoryGraphRepository();
  const loaded = await loadFacts(input.apg, layers, facts, repo);
  if (!loaded.success) throw new Error(`A2 load: ${loaded.errors.map((e) => e.message).join('; ')}`);
  const sem = await runSemRules(repo, facts, facts.producer.factPolicy);
  if (!sem.success) throw new Error(`Sem rules: ${sem.errors.map((e) => e.message).join('; ')}`);
  return { facts, sem: sem.data };
}

/** C3 (cypher-interp), A2 and the C4 contexts of one project. Zero model calls. */
export async function prepareC4Project(t: C4Target, evaluate: InterpEvaluator = createInterpEvaluator()): Promise<PreparedProject> {
  const dir = path.resolve(t.dir);
  let report: EvaluationReport | null = null;
  let layers: LayerModel | undefined;
  if (t.spec !== null) {
    const r = await evaluate({ projectPath: dir, specPath: path.resolve(t.spec), scoringMode: 'v1.3' });
    if (!r.success) throw new Error(`C3 on ${t.id}: ${r.errors.map((e) => e.message).join('; ')}`);
    report = r.data.report;
    layers = await layerModelOfSpec(t.spec);
  }
  const a2Layers = t.a2 !== null ? readJson(t.a2.layers) as LayerModel : layers;
  const input = await prepareOntologyInput(dir, a2Layers !== undefined ? { layerModel: a2Layers } : {});
  const a2 = a2Layers !== undefined ? await a2Of(t, input, a2Layers) : null;
  const findings = blockingFindings(report ?? { violations: [] }, input.apg, a2?.sem ?? []);
  const units = unitsOf(input);
  const read = diskReader(input.projectRoot);
  const docs = input.docs ?? [];
  const classNames = (f: C4Finding): string[] => [...new Set(input.apg.nodes.filter((n) => (n.type === 'Class' || n.type === 'Interface') && f.files.includes(n.filePath)).map((n) => n.name))];
  const items = findings.map((f) => ({ context: buildInterpretationContext(f, a2?.facts ?? null, units, read), docs, read, classNames: classNames(f) }));
  return { id: t.id, report, facts: a2?.facts ?? null, semVerdicts: a2?.sem ?? [], findings, items };
}

export function baselineOf(items: readonly PreparedItem[]): Map<string, BaselineAnswer> {
  return new Map(items.map((i) => [i.context.finding.id, keywordBaseline(i.context.finding, i.classNames, i.docs, i.read)]));
}

export async function main(argv: readonly string[], deps: RouteDeps = DEFAULT_ROUTE_DEPS): Promise<number> {
  const cases = argv.includes('--cases');
  const project = arg(argv, '--project');
  if (!cases && project === undefined) {
    out('give --cases or --project <dir>');
    return 2;
  }
  const providerName = arg(argv, '--provider') ?? 'mock';
  if (!isOntologyRoute(providerName)) {
    out(`unknown provider ${providerName}`);
    return 2;
  }
  const estimate = argv.includes('--estimate');
  const replay = argv.includes('--replay');
  const exploratory = argv.includes('--exploratory');
  const runs = Number(arg(argv, '--runs') ?? '2');
  const budget = Number(arg(argv, '--budget') ?? String(C4_RUN_BUDGET));
  const model = arg(argv, '--model');
  const spec: OntologyRouteSpec = { route: providerName, ...(model !== undefined ? { model } : {}), ...(exploratory ? { exploratory: true } : {}), ...(providerName === 'gemini-api' ? { temperature: 0 } : {}) };
  const ok = checkRoute(spec);
  if (!ok.success) {
    for (const e of ok.errors) out(e.message);
    return 2;
  }
  const description = describeRoute(spec);
  const cassettesArg = arg(argv, '--cassettes');
  const cassettes = cassettesArg ?? path.join(C4_FIXTURES, `cassettes-${providerName}`);
  const outDir = arg(argv, '--out') ?? path.join('results/v1.4-c4', `${providerName}${replay ? '-replay' : ''}`);
  const only = arg(argv, '--only')?.split(',');
  const targets: C4Target[] = cases ? setTargets(C4_SET, { pilot: argv.includes('--pilot'), ...(only !== undefined ? { only } : {}) }) : [{
    id: path.basename(path.resolve(project ?? '.')), dir: project ?? '.', spec: arg(argv, '--spec') ?? null, manifest: null,
    a2: arg(argv, '--facts') !== undefined ? { kind: 'file', facts: arg(argv, '--facts') ?? '', layers: arg(argv, '--layers') ?? '' } : null,
  }];
  if (targets.some((t) => t.a2?.kind === 'file' && t.a2.layers === '')) {
    out('--facts needs --layers <layers.json>');
    return 2;
  }

  const evaluate = createInterpEvaluator();
  let opened: OpenedRoute | null = null;
  let spent = 0;
  const scores: C4CaseScore[] = [];
  let exit = 0;
  try {
    for (const t of targets) {
      const p = await prepareC4Project(t, evaluate);
      const cacheDir = path.join(cassettes, t.id);
      const mockCache = cassettesArg !== undefined ? 'record' as const : 'off' as const;
      const cacheMode = replay ? 'replay' as const : providerName === 'mock' ? mockCache : 'record' as const;
      if (estimate) {
        const e = estimateInterpretation(p.items, { provider: new NoCallProvider(description), cacheMode: 'replay', cacheDir, runs, budget: budget - spent });
        out(`${t.id}: blocking findings ${String(e.findings)} (${p.findings.map((f) => f.rule).join(', ') || 'none'}); calls expected ${String(e.expectedCalls)}, upper bound ${String(e.upperBound)}; cached ${String(e.cached)}; prompt tokens ~${String(e.promptTokens)}`);
        spent += e.expectedCalls;
        continue;
      }
      let provider: OntologyProvider;
      if (replay) provider = new NoCallProvider(description);
      else if (providerName === 'mock') provider = new MockOntologyProvider(c4MockResponder(new Map(p.items.map((i) => [i.context.finding.id, i]))), 'mock-c4');
      else {
        if (opened === null) {
          const r = await openRoute(spec, deps, { mode: 'record' });
          if (!r.success) {
            out(`${providerName} route pre-flight failed: ${r.errors.map((e) => `${e.code}: ${e.message}`).join('; ')}`);
            return 3;
          }
          opened = r.data;
          if (r.data.ready !== null) out(r.data.ready);
        }
        provider = opened.provider;
      }
      const res = await interpretFindings(p.items, { provider, cacheMode, cacheDir: cacheMode === 'off' ? null : cacheDir, runs, budget: Math.max(0, budget - spent), runId: `c4-${t.id}` });
      spent += res.calls.providerCalls;
      const a5 = a5File(t.id, provider.describe(), runs, exploratory, res.entries);
      const dir = path.join(outDir, t.id);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'interpretations.json'), `${JSON.stringify(a5, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'proposed-exceptions.json'), `${JSON.stringify(proposedExceptions(a5), null, 2)}\n`);
      const baseline = baselineOf(p.items);
      fs.writeFileSync(path.join(dir, 'baseline.json'), `${JSON.stringify(Object.fromEntries(baseline), null, 2)}\n`);
      const c = res.calls;
      out(`${t.id}: ${String(p.findings.length)} blocking findings; calls ${String(c.providerCalls)}, cache hits ${String(c.cacheHits)}, invalid ${String(c.invalid)}, budget-skipped ${String(c.skippedForBudget)}, cassette misses ${String(c.cassetteMisses)}`);
      if (t.manifest !== null) {
        const s = scoreC4Case(t.manifest, res.entries, baseline);
        scores.push(s);
        fs.writeFileSync(path.join(dir, 'score.json'), `${JSON.stringify(s, null, 2)}\n`);
      }
      if (res.stopped !== null) {
        out(`STOPPED: ${res.stopped.code} ${res.stopped.message}. Recorded answers are kept; rerun the same command to resume.`);
        exit = 4;
        break;
      }
    }
  } finally {
    opened?.dispose();
  }
  if (estimate) {
    out(`total expected calls ${String(spent)} (x2 upper bound with one retry each); cap --budget ${String(budget)}${spent > budget ? ' EXCEEDED: lower the scope or raise the cap with the author\'s OK' : ''}`);
    return 0;
  }
  if (scores.length > 0) {
    const agg = aggregateC4(scores);
    fs.writeFileSync(path.join(outDir, 'scores.json'), `${JSON.stringify({ provider: providerName, replay, exploratory, runs, aggregate: agg, cases: scores }, null, 2)}\n`);
    out('');
    out('| Project | Role | Target | C4 correct | Clean | Baseline correct | Baseline clean |');
    out('|---|---|---|---|---|---|---|');
    for (const s of scores) out(`| ${s.case} | ${s.role} | ${s.targetFound ? 'found' : 'MISSING'} | ${String(s.correct)} | ${String(s.clean)} | ${String(s.baseline.correct)} | ${String(s.baseline.clean)} |`);
    out('');
    out(`cases correct ${String(agg.casesCorrect)}/${String(agg.cases)}; twins clean ${String(agg.twinsClean)}/${String(agg.twins)} (false exception claims ${String(agg.falseExceptionClaimsOnTwins)}); hallucinated exceptions ${String(agg.hallucinatedExceptions)}; inconsistent ${String(agg.inconsistent)}; baseline cases ${String(agg.baselineCasesCorrect)}/${String(agg.cases)}, twins clean ${String(agg.baselineTwinsClean)}/${String(agg.twins)}`);
  }
  return exit;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]).endsWith(path.join('scripts', 'v1.4', 'c4-run.ts'))) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
}
