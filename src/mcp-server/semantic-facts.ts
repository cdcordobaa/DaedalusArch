/**
 * `semantic_facts` (v1.4 U9, opt-in, off by default): a read-only view of the A2 semantic facts and the Sem rule
 * findings (SEM-MISPLACED, SEM-DUP, SEM-FRAG) recorded for the project, for an exploratory in-loop semantic cell.
 * Not part of any study arm: the `daedalus-mcp` arm's tool list is unchanged (C4-01 §8, REV-05 §3 item 8).
 *
 * Confinement-friendly by construction:
 * - the A2 directory (`facts.json`, and `verdicts.json` when present) is fixed when the server starts
 *   (`--semantic-facts <dir>` or `DAEDALUS_SEMANTIC_FACTS`); no call argument names a path to open;
 * - it reads that directory and project files through `ProjectView` (lexical and realpath confinement to the root);
 * - it never writes, never spawns a process, never opens a socket, and calls no model: the facts were recorded
 *   earlier (mock, replay or a live run with its own cassettes).
 *
 * "For the current snapshot": every cited code location of every model fact is re-checked against the project as it
 * is now (the lines exist and still hold the quote). A fact whose citation no longer holds is `stale` and is left out
 * unless `includeStale` is set; a finding citing a stale fact is stale too. Facts, not verdicts: the findings are
 * reported as recorded and are advisory here; nothing in this tool sets or changes a verdict.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Fact, FactsFile, SemVerdict } from '../apg-enrich/ontology/index.js';
import { collapseWhitespace } from '../apg-enrich/ontology/grounding.js';
import { ProjectView } from './project-files.js';
import { normalisePath } from './layer-resolver.js';

export const SEMANTIC_FACTS_TOOL = 'semantic_facts';

/** Most facts listed in one answer (`counts` always holds the full numbers). */
export const MAX_LISTED_FACTS = 200;

export interface SemanticFactsConfig {
  /** Directory holding `facts.json` (and `verdicts.json`) of the project, as the ontology runner writes them. */
  readonly dir: string;
}

export interface SemanticFactsArgs {
  /** Only facts and findings that cite this project-relative file. */
  readonly file?: string | undefined;
  /** `agreed-only` (default): model facts agreed by both runs; `any`: also single-run facts. */
  readonly policy?: 'agreed-only' | 'any' | undefined;
  /** Also list facts and findings whose cited code no longer matches the project. */
  readonly includeStale?: boolean | undefined;
}

export interface FactView {
  readonly id: string;
  readonly subject: string;
  readonly predicate: string;
  readonly value: unknown;
  readonly source: 'parser' | 'model';
  readonly agreement: 'agreed' | 'single-run' | null;
  readonly confidence: number | null;
  readonly files: readonly string[];
  /** A cited code location no longer holds its quote (or no longer exists) in the current project. */
  readonly stale: boolean;
}

export interface FindingView {
  readonly rule: string;
  readonly sites: readonly string[];
  readonly context: string | null;
  readonly verified: boolean | null;
  readonly facts: readonly string[];
  readonly files: readonly string[];
  readonly stale: boolean;
  /** Always false: Sem findings are reported, never enforced, by this tool. */
  readonly blocking: false;
}

export type SemanticFactsResult =
  | { readonly status: 'not-configured'; readonly message: string }
  | { readonly status: 'unavailable'; readonly message: string }
  | {
    readonly status: 'ok';
    readonly source: {
      readonly project: string;
      readonly contentHash: string;
      readonly provider: string;
      readonly model: string;
      readonly promptVersion: string;
      readonly runs: number;
      readonly factPolicy: string;
      readonly findingsRecorded: boolean;
    };
    readonly snapshot: { readonly checkedFacts: number; readonly staleFacts: number; readonly current: boolean };
    readonly counts: { readonly facts: number; readonly listed: number; readonly findings: number };
    readonly facts: readonly FactView[];
    readonly findings: readonly FindingView[];
    readonly note: string;
  };

export const SEMANTIC_FACTS_ENABLE_HINT = 'Start the MCP server with --semantic-facts <dir> (a directory holding the facts.json and verdicts.json the ontology runner wrote for this project), or set DAEDALUS_SEMANTIC_FACTS.';

const NOTE = 'Facts, not verdicts (N1): a model supplied the meaning facts, deterministic rules produced the findings. Advisory here; nothing in this answer blocks or changes a verdict.';

/** The configured A2 directory from `--semantic-facts` or DAEDALUS_SEMANTIC_FACTS; undefined = off. */
export function semanticFactsConfigOf(flag: string | undefined, env: NodeJS.ProcessEnv): SemanticFactsConfig | undefined {
  const dir = flag ?? env.DAEDALUS_SEMANTIC_FACTS;
  return dir === undefined || dir === '' ? undefined : { dir: path.resolve(dir) };
}

function readJsonIn(dir: string, name: string): unknown {
  const text = new ProjectView({ root: dir }).read(name);
  return text === undefined ? undefined : JSON.parse(text) as unknown;
}

/** Re-checks a fact's code citations against the current project. Doc and graph citations are not code: skipped. */
function isStale(f: Fact, view: ProjectView): boolean {
  if (f.source !== 'model') return false;
  for (const e of f.evidence) {
    const text = view.read(e.file);
    if (text === undefined) return true;
    const lines = text.split('\n');
    if (e.startLine < 1 || e.endLine > lines.length || e.endLine < e.startLine) return true;
    if (!collapseWhitespace(lines.slice(e.startLine - 1, e.endLine).join('\n')).includes(collapseWhitespace(e.quote))) return true;
  }
  return false;
}

function filesOf(f: Fact): string[] {
  return [...new Set([...f.evidence.map((e) => e.file), ...f.citations.locations.filter((l) => l.kind === 'code').map((l) => l.file)])].sort();
}

export function semanticFactsTool(config: SemanticFactsConfig | undefined, projectRoot: string | undefined, args: SemanticFactsArgs): SemanticFactsResult {
  if (config === undefined) return { status: 'not-configured', message: SEMANTIC_FACTS_ENABLE_HINT };
  if (projectRoot === undefined) return { status: 'unavailable', message: 'No project root: start the server with --project so the facts can be checked against the current code.' };
  let a2: FactsFile | undefined;
  let verdicts: SemVerdict[] | undefined;
  try {
    a2 = fs.existsSync(config.dir) ? readJsonIn(config.dir, 'facts.json') as FactsFile | undefined : undefined;
    verdicts = a2 === undefined ? undefined : readJsonIn(config.dir, 'verdicts.json') as SemVerdict[] | undefined;
  } catch (err) {
    return { status: 'unavailable', message: `The recorded facts could not be parsed: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (a2?.artifact !== 'A2') return { status: 'unavailable', message: 'No A2 facts.json in the configured semantic-facts directory.' };

  const view = new ProjectView({ root: projectRoot });
  const policy = args.policy ?? 'agreed-only';
  const file = args.file !== undefined && args.file !== '' ? normalisePath(args.file) : undefined;
  const all = a2.facts.map((f): FactView => ({
    id: f.id, subject: f.subject, predicate: f.predicate, value: f.value, source: f.source, agreement: f.agreement, confidence: f.confidence,
    files: filesOf(f), stale: isStale(f, view),
  }));
  const byId = new Map(all.map((f) => [f.id, f]));
  const usable = (f: FactView): boolean => (f.source === 'parser' || policy === 'any' || f.agreement === 'agreed') && (args.includeStale === true || !f.stale);
  const facts = all.filter((f) => usable(f) && (file === undefined || f.files.includes(file)));
  const findings = (verdicts ?? []).map((v): FindingView => {
    const cited = v.facts.flatMap((id) => { const f = byId.get(id); return f === undefined ? [] : [f]; });
    return {
      rule: v.rule, sites: v.sites, context: v.context, verified: v.verified ?? null, facts: v.facts,
      files: [...new Set(cited.flatMap((f) => f.files))].sort(),
      stale: cited.length < v.facts.length || cited.some((f) => f.stale), blocking: false,
    };
  }).filter((v) => (args.includeStale === true || !v.stale) && (file === undefined || v.files.includes(file)));
  const model = all.filter((f) => f.source === 'model');
  const stale = model.filter((f) => f.stale).length;
  return {
    status: 'ok',
    source: {
      project: a2.project.id, contentHash: a2.project.contentHash, provider: a2.producer.provider, model: a2.producer.model,
      promptVersion: a2.producer.promptVersion, runs: a2.producer.runs, factPolicy: a2.producer.factPolicy, findingsRecorded: verdicts !== undefined,
    },
    snapshot: { checkedFacts: model.length, staleFacts: stale, current: stale === 0 },
    counts: { facts: facts.length, listed: Math.min(facts.length, MAX_LISTED_FACTS), findings: findings.length },
    facts: facts.slice(0, MAX_LISTED_FACTS),
    findings,
    note: NOTE,
  };
}
