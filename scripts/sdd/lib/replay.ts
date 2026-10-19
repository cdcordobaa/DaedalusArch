/**
 * Deterministic replay of the SDD demo (Docs/v1.3/sdd-demo.md): rebuilds the project from the transcript into an
 * empty directory and re-checks every step, with no LLM, no database and no network.
 *
 * - files: written with their recorded content (sha256 checked);
 * - derive-spec: the converter is run again on the rebuilt OpenSpec artifacts and must give the recorded YAML;
 * - tool-call: the same tool, same arguments, against the rebuilt project, through an in-process MCP client
 *   (`createServer` over an in-memory transport); the result must equal the recorded one;
 * - full-eval: the full evaluation on the in-process engine (`cypher-interp`); verdict and findings must match;
 * - for every check_file that answered "block", the blocked content is also given to the full evaluation (in a
 *   scratch copy) to see whether the full engine blocks it for the same rules: the counterfactual;
 * - at the end the rebuilt tree must equal the committed one, and `transcript.md` must equal its rendering.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../../src/mcp-server/server.js';
import { createSpecLoader } from '../../../src/mcp-server/tools.js';
import type { ServerContext } from '../../../src/mcp-server/tools.js';
import { openSpecToAac } from '../openspec-to-aac.js';
import { fullEvaluate } from './full-eval.js';
import type { FullEvalSummary } from './full-eval.js';
import { renderTranscript } from './render.js';
import { canonical, listTree, readTranscript, sha256 } from './transcript.js';
import type { FullEvalEvent, ToolCallEvent, TranscriptEvent } from './transcript.js';

export interface StepResult {
  readonly seq: number;
  readonly change: string;
  readonly kind: TranscriptEvent['kind'];
  readonly what: string;
  readonly ok: boolean;
  readonly detail?: string;
  readonly recordedMs?: number;
  readonly replayMs?: number;
}

export interface Counterfactual {
  readonly seq: number;
  readonly path: string;
  readonly toolBlockingRules: readonly string[];
  readonly fullVerdict: 'pass' | 'fail' | 'incomplete';
  readonly fullBlockingRules: readonly string[];
  readonly agree: boolean;
}

export interface ReplayReport {
  readonly events: number;
  readonly steps: readonly StepResult[];
  readonly counterfactuals: readonly Counterfactual[];
  readonly treeMatches: boolean;
  readonly treeDiff: readonly string[];
  readonly markdownMatches: boolean;
  /** `tsc --noEmit` on the rebuilt project. */
  readonly typecheck: boolean;
  /** `scenarios.ts` (the OpenSpec scenarios, executable) on the rebuilt project: its last output line. */
  readonly scenarios: { readonly ok: boolean; readonly summary: string };
  readonly ok: boolean;
}

export interface ReplayOptions {
  readonly repoRoot: string;
  readonly demoDir: string;
  /** Run the full evaluations (and the counterfactuals); on by default. */
  readonly fullEval?: boolean;
  readonly log?: (line: string) => void;
}

/** JSON with object keys sorted, for an order-independent comparison. */
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    return `{${Object.keys(v as Record<string, unknown>)
      .sort()
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

function context(root: string, repoRoot: string): ServerContext {
  const refuse = (): never => {
    throw new Error('evaluate_project is not part of the replay');
  };
  return { defaultProjectPath: root, env: {}, loadSpec: createSpecLoader({ postSeal: false }) /* v1.4 U2: the demo was recorded on the sealed v1.3 rule set (BR-U2-10) */, presetsDir: path.join(repoRoot, 'presets'), evaluateDeps: { makeGraph: refuse, makePipeline: refuse } };
}

async function callInProcess(root: string, repoRoot: string, e: ToolCallEvent): Promise<{ isError: boolean; result: unknown; ms: number }> {
  const server = createServer(context(root, repoRoot));
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'sdd-demo-replay', version: '1.0.0' });
  await server.connect(b);
  await client.connect(a);
  try {
    const args = typeof e.args.spec === 'string' ? { ...e.args, spec: path.join(root, e.args.spec) } : e.args;
    const t0 = performance.now();
    const res = await client.callTool({ name: e.tool, arguments: args });
    const ms = performance.now() - t0;
    const isError = res.isError === true;
    const text = (res.content as { type: string; text?: string }[] | undefined)?.find((c) => c.type === 'text')?.text ?? '';
    return { isError, result: canonical(isError ? text : res.structuredContent ?? JSON.parse(text), root), ms };
  } finally {
    await client.close();
    await server.close();
  }
}

function blockingRules(result: unknown): string[] {
  const r = result as { findings?: { ruleId?: string; tier?: string }[] };
  return [...new Set((r.findings ?? []).filter((f) => f.tier === 'blocking').map((f) => f.ruleId ?? ''))].sort();
}

function sameEval(e: FullEvalEvent, s: FullEvalSummary): string | undefined {
  const want = { verdict: e.verdict, blocking: e.blocking, advisoryRules: e.advisoryRules, advisoryCount: e.advisoryCount, ...(e.advisory !== undefined ? { advisory: e.advisory } : {}) };
  const got = { verdict: s.verdict, blocking: s.blocking, advisoryRules: s.advisoryRules, advisoryCount: s.advisoryCount, ...(e.advisory !== undefined ? { advisory: s.advisory } : {}) };
  return stableJson(want) === stableJson(got) ? undefined : `recorded ${stableJson(want)} replayed ${stableJson(got)}`;
}

function copyTree(from: string, to: string): void {
  fs.cpSync(from, to, { recursive: true });
}

export async function replay(opts: ReplayOptions): Promise<ReplayReport> {
  const log = opts.log ?? ((): void => undefined);
  const transcriptDir = path.join(opts.demoDir, 'transcript');
  const events = readTranscript(path.join(transcriptDir, 'transcript.jsonl'));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-demo-replay-'));
  const steps: StepResult[] = [];
  const counterfactuals: Counterfactual[] = [];
  const doFull = opts.fullEval !== false;
  const push = (s: StepResult): void => {
    steps.push(s);
    log(`${s.ok ? 'ok  ' : 'FAIL'} #${String(s.seq).padStart(2)} ${s.change.padEnd(22)} ${s.what}${s.ok ? '' : `  -- ${s.detail ?? ''}`}`);
  };
  try {
    for (const e of events) {
      if (e.kind === 'files') {
        let bad = '';
        for (const f of e.files) {
          const abs = path.join(root, f.path);
          if (f.op === 'delete') {
            fs.rmSync(abs, { force: true });
            continue;
          }
          if (f.sha256 !== sha256(f.content ?? '')) bad += `${f.path} sha256 mismatch; `;
          fs.mkdirSync(path.dirname(abs), { recursive: true });
          fs.writeFileSync(abs, f.content ?? '');
        }
        push({ seq: e.seq, change: e.change, kind: e.kind, what: `${e.phase}: ${String(e.files.length)} file(s)`, ok: bad === '', ...(bad !== '' ? { detail: bad } : {}) });
      } else if (e.kind === 'derive-spec') {
        const res = openSpecToAac(root, path.join(opts.repoRoot, 'presets'), e.activeChanges);
        const ok = res.ok && res.value.yaml === e.content;
        if (res.ok) {
          fs.mkdirSync(path.dirname(path.join(root, e.out)), { recursive: true });
          fs.writeFileSync(path.join(root, e.out), res.value.yaml);
        }
        push({ seq: e.seq, change: e.change, kind: e.kind, what: `derive ${e.out} from ${String(e.inputs.length)} design(s)`, ok, ...(ok ? {} : { detail: res.ok ? 'YAML differs from the recorded one' : res.errors.join('; ') }) });
      } else if (e.kind === 'tool-call') {
        const r = await callInProcess(root, opts.repoRoot, e);
        const ok = r.isError === e.isError && stableJson(r.result) === stableJson(e.result);
        const verdict = (e.result as { blockingVerdict?: string } | null)?.blockingVerdict;
        push({
          seq: e.seq, change: e.change, kind: e.kind, what: `${e.tool}${verdict !== undefined ? ` -> ${verdict}` : ''}`, ok,
          recordedMs: e.latencyMs, replayMs: Math.round(r.ms * 10) / 10, ...(ok ? {} : { detail: 'result differs from the recorded one' }),
        });
        if (doFull && e.tool === 'check_file' && verdict === 'block') {
          const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-demo-cf-'));
          try {
            copyTree(root, scratch);
            const rel = String(e.args.path);
            fs.mkdirSync(path.dirname(path.join(scratch, rel)), { recursive: true });
            fs.writeFileSync(path.join(scratch, rel), String(e.args.content));
            const s = await fullEvaluate(scratch, path.join(scratch, String(e.args.spec)));
            const tool = blockingRules(e.result);
            const full = [...new Set(s.blocking.map((b) => b.ruleId))].sort();
            const agree = stableJson(tool) === stableJson(full) && s.verdict === 'fail';
            counterfactuals.push({ seq: e.seq, path: rel, toolBlockingRules: tool, fullVerdict: s.verdict, fullBlockingRules: full, agree });
            log(`     counterfactual: the blocked ${rel} written as proposed -> full evaluation ${s.verdict} (${full.join(', ') || 'no blocking rule'}); check_file said ${tool.join(', ')}`);
          } finally {
            fs.rmSync(scratch, { recursive: true, force: true });
          }
        }
      } else if (e.kind === 'full-eval') {
        if (!doFull) {
          push({ seq: e.seq, change: e.change, kind: e.kind, what: 'full evaluation (skipped: --no-full-eval)', ok: true });
          continue;
        }
        const s = await fullEvaluate(root, path.join(root, '.daedalus/architecture.yaml'));
        const diff = sameEval(e, s);
        push({
          seq: e.seq, change: e.change, kind: e.kind, what: `full evaluation (cypher-interp) -> ${s.verdict}`, ok: diff === undefined,
          recordedMs: e.durationMs, replayMs: Math.round(s.durationMs * 10) / 10, ...(diff !== undefined ? { detail: diff } : {}),
        });
      } else {
        push({ seq: e.seq, change: e.change, kind: e.kind, what: 'note', ok: true });
      }
    }
    const rebuilt = listTree(root);
    const committed = listTree(opts.demoDir);
    const treeDiff = [...new Set([...rebuilt.keys(), ...committed.keys()])].sort().filter((p) => rebuilt.get(p) !== committed.get(p));
    const mdPath = path.join(transcriptDir, 'transcript.md');
    const markdownMatches = fs.existsSync(mdPath) && fs.readFileSync(mdPath, 'utf8') === renderTranscript(events);
    const bin = (rel: string): string => path.join(opts.repoRoot, 'node_modules', rel);
    const tsc = spawnSync(process.execPath, [bin('typescript/bin/tsc'), '-p', path.join(root, 'tsconfig.json'), '--typeRoots', bin('@types')], { encoding: 'utf8' });
    const typecheck = tsc.status === 0;
    log(`${typecheck ? 'ok  ' : 'FAIL'} tsc --noEmit on the rebuilt project${typecheck ? '' : `\n${tsc.stdout}`}`);
    const sc = spawnSync(process.execPath, [bin('tsx/dist/cli.mjs'), path.join(root, 'scenarios.ts')], { encoding: 'utf8', cwd: root });
    const scenarios = { ok: sc.status === 0, summary: sc.stdout.trim().split('\n').pop() ?? '' };
    log(`${scenarios.ok ? 'ok  ' : 'FAIL'} scenarios.ts on the rebuilt project: ${scenarios.summary}`);
    const ok = steps.every((s) => s.ok) && treeDiff.length === 0 && markdownMatches && typecheck && scenarios.ok;
    return { events: events.length, steps, counterfactuals, treeMatches: treeDiff.length === 0, treeDiff, markdownMatches, typecheck, scenarios, ok };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const pct = (xs: readonly number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? 0 : s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] ?? 0;
};

/** Per tool: calls, and p50 / max of the recorded stdio latency and the in-process replay latency. */
export function latencyTable(steps: readonly StepResult[]): string {
  const by = new Map<string, StepResult[]>();
  for (const s of steps) {
    if (s.recordedMs === undefined) continue;
    const key = s.kind === 'full-eval' ? 'full evaluation (cypher-interp)' : s.what.replace(/ -> .*$/, '');
    by.set(key, [...(by.get(key) ?? []), s]);
  }
  const rows = [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => {
    const rec = v.map((s) => s.recordedMs ?? 0);
    const rep = v.map((s) => s.replayMs ?? 0);
    return `| ${k} | ${String(v.length)} | ${pct(rec, 50).toFixed(0)} | ${Math.max(...rec).toFixed(0)} | ${pct(rep, 50).toFixed(0)} | ${Math.max(...rep).toFixed(0)} |`;
  });
  return ['| Check | Calls | Recorded p50 ms | Recorded max ms | Replay p50 ms | Replay max ms |', '|---|---|---|---|---|---|', ...rows].join('\n');
}
