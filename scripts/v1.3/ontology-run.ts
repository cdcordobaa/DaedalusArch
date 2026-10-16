/**
 * Ontology v0 runner (`Docs/v1.3/ontology-v0-design.md`). DEVELOPMENT SET ONLY.
 *
 * Runs the grounded semantic layer over one project or over the planted ground-truth cases
 * (`tests/fixtures/v1.3-ontology/`), and scores the cases against their `expected-semantic.json`, with the cheap
 * proxies' (and, when given, the judge's) outcome on the same items.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/ontology-run.ts --fixtures --estimate
 *   npx tsx scripts/v1.3/ontology-run.ts --fixtures --budget 120            # live: the judge's isolated Claude CLI route
 *   npx tsx scripts/v1.3/ontology-run.ts --fixtures --replay                 # replay the live cassettes, no call
 *   npx tsx scripts/v1.3/ontology-run.ts --fixtures --provider mock          # scripted mock answers, record
 *   npx tsx scripts/v1.3/ontology-run.ts --fixtures --provider mock --replay # replay the mock fixture cassettes
 *   npx tsx scripts/v1.3/ontology-run.ts --project <dir> --spec <yaml> --estimate
 *
 * Options:
 *   --provider claude-cli|mock   default claude-cli (the judge's route: pinned CLI, `--judge-config-dir`, isolation
 *                                pre-flight; credentials are never read)
 *   --replay                     answer from the cassettes only (a miss makes the item invalid; nothing is called)
 *   --cassettes <dir>            default tests/fixtures/v1.3-ontology/cassettes-<provider> (one subdir per project)
 *   --mock-answers <dir>         default tests/fixtures/v1.3-ontology/mock-answers
 *   --budget <n>                 provider calls allowed per project (default 200; cache hits are free)
 *   --runs <n>                   runs per item (default 2)
 *   --estimate                   count the calls and prompt tokens, call nothing
 *   --judge-config-dir <dir>     default ~/.firewall/judge-claude-config
 *   --claude-bin <path>          default `claude`
 *   --judge-outcomes <json>      optional {"<case>": {"source": "...", "failedFiles": [...]}} to score the judge
 *   --out <dir>                  default results/v1.3-ontology/<provider>[-replay]
 * A usage limit or auth stop ends the run; what was recorded stays in the cassettes, so the same command resumes.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ClaudeCliOntologyProvider, DEFAULT_ONTOLOGY_OPTIONS, MockOntologyProvider, NoCallProvider, aggregate, createScriptedResponder,
  diskReader, estimateOntology, prepareOntologyInput, runOntology, scoreCase,
} from '../../src/apg-enrich/ontology/index.js';
import type {
  CaseScore, ExpectedSemanticManifest, JudgeCaseOutcome, OntologyInput, OntologyProvider, OntologyProviderDescription, ScriptedAnswers,
} from '../../src/apg-enrich/ontology/index.js';
import { ClaudeCliProvider } from '../../src/llm-critic/claude-cli-provider.js';
import { JUDGE_CONFIG_DIR_DEFAULT, JUDGE_EFFORT, JUDGE_MODEL } from '../../src/llm-critic/frozen.js';
import { expandHome } from '../../src/cli/llm-options.js';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { parseSpec } from '../../src/spec-parser/index.js';
import type { LayerModel } from '../../src/shared/types/spec.js';

export const FIXTURES = 'tests/fixtures/v1.3-ontology';

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

async function layerModelOf(argv: readonly string[], fixtures: boolean): Promise<LayerModel | undefined> {
  const spec = arg(argv, '--spec');
  if (spec !== undefined) {
    const parsed = await parseSpec({ specFilePath: spec });
    if (!parsed.success) throw new Error(`spec ${spec}: ${parsed.errors.map((e) => e.message).join('; ')}`);
    return parsed.data.layerModel;
  }
  const layers = arg(argv, '--layers') ?? (fixtures ? path.join(FIXTURES, 'layers.json') : undefined);
  return layers === undefined ? undefined : JSON.parse(fs.readFileSync(layers, 'utf8')) as LayerModel;
}

const CLI_DESCRIPTION: OntologyProviderDescription = { provider: 'claude-cli', model: JUDGE_MODEL, effort: JUDGE_EFFORT, temperature: null };
const MOCK_DESCRIPTION: OntologyProviderDescription = { provider: 'mock', model: 'mock-ontology', temperature: null };

export async function main(argv: readonly string[]): Promise<number> {
  const fixtures = argv.includes('--fixtures');
  const project = arg(argv, '--project');
  if (!fixtures && project === undefined) {
    out('give --fixtures or --project <dir>');
    return 2;
  }
  const providerName = arg(argv, '--provider') ?? 'claude-cli';
  if (providerName !== 'claude-cli' && providerName !== 'mock') {
    out(`unknown provider ${providerName}`);
    return 2;
  }
  const replay = argv.includes('--replay');
  const estimate = argv.includes('--estimate');
  const budget = Number(arg(argv, '--budget') ?? String(DEFAULT_ONTOLOGY_OPTIONS.budget));
  const runs = Number(arg(argv, '--runs') ?? String(DEFAULT_ONTOLOGY_OPTIONS.runs));
  const cassettes = arg(argv, '--cassettes') ?? path.join(FIXTURES, `cassettes-${providerName}`);
  const answersDir = arg(argv, '--mock-answers') ?? path.join(FIXTURES, 'mock-answers');
  const outDir = arg(argv, '--out') ?? path.join('results/v1.3-ontology', `${providerName}${replay ? '-replay' : ''}`);
  const judgeOutcomes = arg(argv, '--judge-outcomes');
  const judge = judgeOutcomes === undefined ? {} : JSON.parse(fs.readFileSync(judgeOutcomes, 'utf8')) as Record<string, JudgeCaseOutcome>;
  const layerModel = await layerModelOf(argv, fixtures);
  const targets = fixtures ? fixtureCases().map((c) => ({ id: c, dir: path.join(FIXTURES, c) })) : [{ id: path.basename(path.resolve(project ?? '.')), dir: project ?? '.' }];

  let cli: ClaudeCliProvider | null = null;
  const providerFor = async (input: OntologyInput, id: string): Promise<OntologyProvider | null> => {
    if (replay || estimate) return new NoCallProvider(providerName === 'mock' ? MOCK_DESCRIPTION : CLI_DESCRIPTION);
    if (providerName === 'mock') {
      const file = path.join(answersDir, `${id}.json`);
      const script: ScriptedAnswers = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as ScriptedAnswers : { case: id, responses: [] };
      return new MockOntologyProvider(createScriptedResponder(script, input.apg, diskReader(input.projectRoot)), MOCK_DESCRIPTION.model);
    }
    if (cli === null) {
      cli = new ClaudeCliProvider({
        binary: arg(argv, '--claude-bin') ?? 'claude',
        judgeConfigDir: expandHome(arg(argv, '--judge-config-dir') ?? JUDGE_CONFIG_DIR_DEFAULT),
        mode: 'record',
        projectRoot: path.resolve('.'),
      }, { runner: new NodeProcessRunner() });
      const prepared = await cli.prepare();
      if (!prepared.success) {
        out(`judge route pre-flight failed: ${prepared.errors.map((e) => `${e.code}: ${e.message}`).join('; ')}`);
        return null;
      }
      out(`judge route ready: CLI ${prepared.data.cliVersion}, probe ${prepared.data.isolationProbeSha256.slice(0, 12)}`);
    }
    return new ClaudeCliOntologyProvider(cli);
  };

  fs.mkdirSync(outDir, { recursive: true });
  const scores: CaseScore[] = [];
  let exit = 0;
  try {
    for (const t of targets) {
      const input = await prepareOntologyInput(t.dir, { ...(layerModel !== undefined ? { layerModel } : {}) });
      const provider = await providerFor(input, t.id);
      if (provider === null) return 3;
      const options = {
        provider, runs, budget,
        cacheMode: replay ? 'replay' as const : 'record' as const,
        cacheDir: path.join(cassettes, t.id),
        ...(providerName === 'mock' ? { now: (): string => '2026-10-15T00:00:00.000Z' } : {}),
      };
      if (estimate) {
        const e = estimateOntology(input, options);
        out(`${t.id}: classes ${String(e.classes)}, groups ${String(e.groups)}, rule-candidate classes ${String(e.ruleCandidateClasses)}; calls a=${String(e.calls.responsibility)} b<=${String(e.calls.capability)} c=${String(e.calls.rules)} d<=${String(e.calls.adjudicate)}; cached ${String(e.cachedKnown)}; upper bound ${String(e.totalUpperBound)}; prompt tokens ~${String(e.promptTokensKnown)}; budget ${String(e.budget)} ${e.withinBudget ? 'ok' : 'MAY BE EXCEEDED'}`);
        continue;
      }
      const { result } = await runOntology(input, options);
      fs.mkdirSync(path.join(outDir, t.id), { recursive: true });
      fs.writeFileSync(path.join(outDir, t.id, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
      const c = result.calls;
      out(`${t.id}: ${String(result.nodes.length)} Sem nodes, ${String(result.edges.length)} Sem edges, ${String(result.findings.length)} findings, ${String(result.hallucinations.length)} rejected (hallucinations); calls ${String(c.providerCalls)}, cache hits ${String(c.cacheHits)}, invalid ${String(c.invalid)}, budget-skipped ${String(c.skippedForBudget)}, cassette misses ${String(c.cassetteMisses)}`);
      if (result.stopped !== null) {
        out(`STOPPED in pass ${result.stopped.pass}: ${result.stopped.code} ${result.stopped.message}. Recorded answers are kept; rerun the same command to resume.`);
        exit = 4;
        break;
      }
      const manifestFile = path.join(t.dir, 'expected-semantic.json');
      if (fs.existsSync(manifestFile)) {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as ExpectedSemanticManifest;
        scores.push(scoreCase(manifest, result, { cheap: input.cheap, apg: input.apg, ...(judge[t.id] !== undefined ? { judge: judge[t.id] } : {}) }));
      }
    }
  } finally {
    (cli as ClaudeCliProvider | null)?.dispose();
  }
  if (scores.length > 0) {
    const agg = aggregate(scores);
    fs.writeFileSync(path.join(outDir, 'scores.json'), `${JSON.stringify({ provider: providerName, replay, aggregate: agg, cases: scores }, null, 2)}\n`);
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
