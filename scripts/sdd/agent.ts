/**
 * The recorder the coding agent drives while it builds the SDD demo (Docs/v1.3/sdd-demo.md). Every subcommand appends
 * to the transcript; MCP tools are called through a real stdio MCP client against `src/mcp-server/main.ts`.
 *
 *   npx tsx scripts/sdd/agent.ts <command> --change <name> [--phase <phase>] [--note "<why>"] ...
 *
 *   snapshot                       record the files written since the last record (OpenSpec artifacts and code)
 *   derive [--active a,b]          regenerate .daedalus/architecture.yaml from the OpenSpec designs and record it
 *   check-diff                     check_diff over the src/ changes since the previous check_diff (after-write)
 *   check-file --path <p> --content-file <f>   check_file on a proposed file before writing it
 *   call <tool> --json '<args>'    any other tool (suggest_placement, explain_finding, get_architecture_spec, ...)
 *   full-eval                      the full evaluation on the in-process engine (cypher-interp), recorded
 *   note --text "<text>"           a short note of the agent's decision
 *
 * Options: --project (default examples/sdd-library-loans), --transcript (default <project>/transcript/transcript.jsonl).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { projectDiff } from '../v1.3/lib/mcp-consistency.js';
import { openSpecToAac } from './openspec-to-aac.js';
import { fullEvaluate } from './lib/full-eval.js';
import {
  appendEvent,
  canonical,
  changesBetween,
  listTree,
  readTranscript,
  sha256,
  stateAfter,
  writeTree,
} from './lib/transcript.js';
import type { Phase, TranscriptEvent } from './lib/transcript.js';

export const SPEC_REL = '.daedalus/architecture.yaml';

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function need(argv: readonly string[], name: string): string {
  const v = arg(argv, name);
  if (v === undefined) throw new Error(`missing ${name}`);
  return v;
}

/** Only source and build config are checked; OpenSpec Markdown and the derived spec are not code. */
export function isCode(rel: string): boolean {
  return rel.startsWith('src/') && /\.ts$/.test(rel);
}

/** The state at the last check_diff call (empty before the first). */
export function lastCheckedState(events: readonly TranscriptEvent[]): Map<string, string> {
  let idx = -1;
  events.forEach((e, i) => {
    if (e.kind === 'tool-call' && e.tool === 'check_diff') idx = i;
  });
  return stateAfter(events.slice(0, idx + 1));
}

/** Unified diff of the code files between two states (git diff --no-index, project-relative paths). */
export function codeDiff(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-diff-'));
  try {
    const pick = (m: ReadonlyMap<string, string>): Map<string, string> => new Map([...m].filter(([p]) => isCode(p)));
    const a = path.join(tmp, 'old');
    const b = path.join(tmp, 'new');
    fs.mkdirSync(a);
    fs.mkdirSync(b);
    writeTree(a, pick(before));
    writeTree(b, pick(after));
    return projectDiff(a, b);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export interface StdioCall {
  readonly isError: boolean;
  readonly result: unknown;
  readonly latencyMs: number;
  readonly serverStartMs: number;
}

/** One tool call over stdio: start the server (`--project <root>`), list tools, call, close. */
export async function callOverStdio(repo: string, projectRoot: string, tool: string, args: Record<string, unknown>): Promise<StdioCall> {
  const t0 = performance.now();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', path.join(repo, 'src/mcp-server/main.ts'), '--project', projectRoot],
    cwd: repo,
    stderr: 'ignore',
  });
  const client = new Client({ name: 'sdd-demo-agent', version: '1.0.0' });
  await client.connect(transport);
  try {
    await client.listTools();
    const serverStartMs = performance.now() - t0;
    const a = performance.now();
    const res = await client.callTool({ name: tool, arguments: args });
    const latencyMs = performance.now() - a;
    const isError = res.isError === true;
    const text = (res.content as { type: string; text?: string }[] | undefined)?.find((c) => c.type === 'text')?.text ?? '';
    return { isError, result: isError ? text : res.structuredContent ?? JSON.parse(text), latencyMs, serverStartMs };
  } finally {
    await client.close();
  }
}

/** Arguments as sent: the project-relative spec path becomes absolute for the server. */
export function withAbsoluteSpec(args: Record<string, unknown>, projectRoot: string): Record<string, unknown> {
  return typeof args.spec === 'string' ? { ...args, spec: path.join(projectRoot, args.spec) } : args;
}

const round = (ms: number): number => Math.round(ms * 10) / 10;

async function main(argv: readonly string[]): Promise<number> {
  const repo = process.cwd();
  const cmd = argv[0] ?? '';
  const project = path.resolve(repo, arg(argv, '--project') ?? 'examples/sdd-library-loans');
  const transcript = path.resolve(repo, arg(argv, '--transcript') ?? path.join(project, 'transcript', 'transcript.jsonl'));
  const change = arg(argv, '--change') ?? '-';
  const phase = (arg(argv, '--phase') ?? 'implement') as Phase;
  const note = arg(argv, '--note') ?? '';
  const events = readTranscript(transcript);
  const out = (t: string): void => {
    process.stdout.write(t);
  };

  switch (cmd) {
    case 'snapshot': {
      const files = changesBetween(stateAfter(events), listTree(project));
      if (files.length === 0) throw new Error('nothing changed since the last record');
      const e = appendEvent(transcript, { kind: 'files', change, phase, note, files });
      out(`#${String(e.seq)} files: ${files.map((f) => `${f.op === 'delete' ? '-' : '+'}${f.path}`).join(' ')}\n`);
      return 0;
    }
    case 'derive': {
      const active = (arg(argv, '--active') ?? change).split(',').filter((c) => c !== '' && c !== '-');
      const res = openSpecToAac(project, path.join(repo, 'presets'), active);
      if (!res.ok) throw new Error(res.errors.join('\n'));
      fs.mkdirSync(path.join(project, path.dirname(SPEC_REL)), { recursive: true });
      fs.writeFileSync(path.join(project, SPEC_REL), res.value.yaml);
      const e = appendEvent(transcript, {
        kind: 'derive-spec', change, phase, generator: 'scripts/sdd/openspec-to-aac.ts', activeChanges: active,
        inputs: res.value.inputs, out: SPEC_REL, sha256: sha256(res.value.yaml), content: res.value.yaml,
      });
      out(`#${String(e.seq)} derived ${SPEC_REL} from ${res.value.inputs.map((i) => i.rel).join(', ')}\n`);
      return 0;
    }
    case 'check-diff':
    case 'check-file':
    case 'call': {
      let tool: string;
      let args: Record<string, unknown>;
      if (cmd === 'check-diff') {
        const unrecorded = changesBetween(stateAfter(events), listTree(project)).filter((f) => isCode(f.path));
        if (unrecorded.length > 0) throw new Error(`unrecorded code changes (snapshot first): ${unrecorded.map((f) => f.path).join(', ')}`);
        const diff = codeDiff(lastCheckedState(events), stateAfter(events));
        if (diff.trim() === '') throw new Error('no code change since the last check_diff (snapshot first)');
        tool = 'check_diff';
        args = { diff, spec: SPEC_REL };
      } else if (cmd === 'check-file') {
        tool = 'check_file';
        args = { path: need(argv, '--path'), content: fs.readFileSync(need(argv, '--content-file'), 'utf8'), spec: SPEC_REL };
      } else {
        tool = argv[1] ?? '';
        args = { spec: SPEC_REL, ...(JSON.parse(arg(argv, '--json') ?? '{}') as Record<string, unknown>) };
      }
      const r = await callOverStdio(repo, project, tool, withAbsoluteSpec(args, project));
      const e = appendEvent(transcript, {
        kind: 'tool-call', change, phase, note, transport: 'stdio', tool, args, isError: r.isError,
        result: canonical(r.result, project), latencyMs: round(r.latencyMs), serverStartMs: round(r.serverStartMs),
      });
      out(`#${String(e.seq)} ${tool} (${String(round(r.latencyMs))} ms)\n${JSON.stringify(canonical(r.result, project), null, 2)}\n`);
      return 0;
    }
    case 'full-eval': {
      const s = await fullEvaluate(project, path.join(project, SPEC_REL));
      const e = appendEvent(transcript, { kind: 'full-eval', change, phase, engine: 'cypher-interp', ...s, durationMs: round(s.durationMs) });
      out(`#${String(e.seq)} full evaluation (cypher-interp): ${s.verdict}; blocking ${JSON.stringify(s.blocking)}; advisory ${String(s.advisoryCount)} ${s.advisoryRules.join(',')}\n`);
      return 0;
    }
    case 'note': {
      const e = appendEvent(transcript, { kind: 'note', change, phase, text: need(argv, '--text') });
      out(`#${String(e.seq)} note\n`);
      return 0;
    }
    default:
      process.stderr.write('usage: agent.ts snapshot|derive|check-diff|check-file|call|full-eval|note --change <name> ...\n');
      return 2;
  }
}

if (process.argv[1] !== undefined && /sdd\/agent\.ts$/.test(process.argv[1])) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err: unknown) => {
      process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 2;
    },
  );
}
