/**
 * The readable form of the SDD demo transcript (`transcript.md`), rendered from the JSONL alone, so it can be rebuilt
 * and compared byte for byte by the replay. Pure.
 */
import type { FullEvalEvent, ToolCallEvent, TranscriptEvent } from './transcript.js';

interface Finding {
  readonly ruleId?: string;
  readonly tier?: string;
  readonly location?: string;
  readonly reason?: string;
  readonly fix?: string;
}

interface CheckResult {
  readonly blockingVerdict?: string;
  readonly blockingSummary?: string;
  readonly findings?: readonly Finding[];
  readonly hints?: readonly Finding[];
  readonly files?: readonly CheckResult[];
  readonly path?: string;
  readonly basis?: string;
}

const esc = (t: string): string => t.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function findingLines(r: CheckResult): string[] {
  const files = r.files ?? [r];
  const out: string[] = [];
  for (const f of files) {
    for (const x of f.findings ?? []) out.push(`  - **${x.ruleId ?? '?'}** (${x.tier ?? '?'}) \`${x.location ?? ''}\`: ${x.reason ?? ''} Fix: ${x.fix ?? ''}`);
    for (const x of f.hints ?? []) out.push(`  - hint **${x.ruleId ?? '?'}** (advisory) \`${x.location ?? ''}\`: ${x.reason ?? ''}`);
  }
  return out;
}

function diffFiles(diff: string): string[] {
  return [...diff.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((m) => m[1] ?? '');
}

function toolLine(e: ToolCallEvent): string[] {
  const head = `**#${String(e.seq)} \`${e.tool}\`** over stdio, ${String(e.latencyMs)} ms`;
  const out = [`- ${head}${e.note !== '' ? `: ${e.note}` : ''}`];
  const a = e.args;
  if (e.tool === 'check_diff') out.push(`  - diff of ${String(diffFiles(String(a.diff)).length)} file(s): ${diffFiles(String(a.diff)).map((f) => `\`${f}\``).join(', ')}`);
  if (e.tool === 'check_file') out.push(`  - proposed \`${String(a.path)}\` (not yet written)`);
  if (e.tool === 'suggest_placement' || e.tool === 'explain_finding') out.push(`  - args: \`${JSON.stringify({ ...a, spec: undefined })}\``);
  if (e.isError) {
    out.push(`  - error: ${String(e.result)}`);
    return out;
  }
  const r = e.result as CheckResult & Record<string, unknown>;
  if (r.blockingVerdict !== undefined) {
    out.push(`  - answer: **${r.blockingVerdict}**. ${r.blockingSummary ?? ''}`);
    out.push(...findingLines(r));
  } else if (e.tool === 'suggest_placement') {
    out.push(`  - answer: ${String(r.summary)}`);
  } else if (e.tool === 'explain_finding') {
    const ex = r.example as { violating?: string; compliant?: string } | undefined;
    out.push(`  - construct: ${String(r.construct)}; tier ${String(r.tier)}; fix: ${String(r.fix)}`);
    if (ex?.compliant !== undefined) out.push(`  - compliant example: \`${esc(ex.compliant)}\``);
  } else if (e.tool === 'get_architecture_spec') {
    const layers = (r.layers as { name: string; globs: string[] }[] | undefined) ?? [];
    out.push(`  - style ${String(r.style)}; layers ${layers.map((l) => `${l.name} (${l.globs.join(', ')})`).join('; ')}`);
  }
  if (e.tool === 'check_file' && r.blockingVerdict === 'block') {
    out.push('', '  <details><summary>The proposed content that was blocked</summary>', '', '  ```ts');
    out.push(...String(a.content).trimEnd().split('\n').map((l) => `  ${l}`));
    out.push('  ```', '', '  </details>', '');
  }
  return out;
}

function evalLine(e: FullEvalEvent): string {
  const blocking = e.blocking.length === 0 ? 'no blocking finding' : e.blocking.map((b) => `${b.ruleId} \`${b.file}\``).join(', ');
  const adv = e.advisory !== undefined && e.advisory.length > 0 ? `; advisory: ${e.advisory.map((a) => `${a.ruleId} \`${a.file}\``).join(', ')}` : '';
  return `- **#${String(e.seq)} full evaluation** (in-process \`cypher-interp\`, symbolic, v1.3 tiers), ${String(e.durationMs)} ms: **${e.verdict}**, ${blocking}; ${String(e.advisoryCount)} advisory row(s) in ${e.advisoryRules.join(', ')}${adv}`;
}

export function renderTranscript(events: readonly TranscriptEvent[]): string {
  const out: string[] = [
    '# SDD demo transcript: library-loans',
    '',
    'Rendered from `transcript.jsonl` by `scripts/sdd/lib/render.ts`; do not edit. One line per event, in order. The',
    'coding agent wrote the OpenSpec artifacts and the code; every DaedalusArch tool call went over a real stdio MCP',
    'connection (`scripts/sdd/agent.ts`). Latencies are the tool call alone, without server start-up.',
    'Rebuild and re-check everything with `npm run demo:sdd`. Context: `Docs/v1.3/sdd-demo.md`.',
  ];
  let change = '';
  for (const e of events) {
    if (e.change !== change) {
      change = e.change;
      out.push('', `## ${change}`, '');
    }
    switch (e.kind) {
      case 'files':
        out.push(`- **#${String(e.seq)} ${e.phase}**: ${e.note}`);
        out.push(`  - ${e.files.map((f) => `${f.op === 'delete' ? '−' : '+'}\`${f.path}\``).join(' ')}`);
        break;
      case 'derive-spec':
        out.push(`- **#${String(e.seq)} derive spec** (\`${e.generator}\`) -> \`${e.out}\` (sha256 ${e.sha256.slice(0, 12)}) from ${e.inputs.map((i) => `\`${i.rel}\``).join(', ')}`);
        break;
      case 'tool-call':
        out.push(...toolLine(e));
        break;
      case 'full-eval':
        out.push(evalLine(e));
        break;
      case 'note':
        out.push(`- **#${String(e.seq)} agent note**: ${e.text}`);
        break;
    }
  }
  return `${out.join('\n')}\n`;
}
