/**
 * EFF-01 stream-json transcript reader, confinement check and cost stripping (design DR-20, DR-23, DR-27; A1 DR-A1-4).
 * Same parsing idiom as `analyseTranscript` (`scripts/v1.3/lib/mcp-smoke.ts`), with per-name counts, the init event,
 * the result event and partial usage.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TOOL_NAMES } from '../../../../src/mcp-server/server.js';
import { DAEDALUS_MCP_SERVER } from '../../../lib/generators/arms.js';
import { FILE_TOOL_NAMES } from './argv.js';
import type { ConfinementResult, Eff01Condition } from './types.js';

export interface ToolUse {
  readonly id: string;
  readonly name: string;
  readonly input: Readonly<Record<string, unknown>>;
}

export interface InitInfo {
  readonly tools?: readonly string[];
  readonly mcpServers?: readonly { readonly name: string; readonly status: string }[];
  readonly model?: string;
}

export interface PartialUsage {
  readonly input: number;
  readonly cacheCreation: number;
  readonly cacheRead: number;
  readonly output: number;
}

export interface Transcript {
  readonly init?: InitInfo;
  readonly toolUses: readonly ToolUse[];
  readonly resultEvent?: Readonly<Record<string, unknown>>;
  readonly lastAssistantText?: string;
  /** Models named by assistant messages, in first-seen order. */
  readonly assistantModels: readonly string[];
  readonly assistantEvents: number;
  /** Per-model usage summed over distinct assistant messages (the last usage per message id). */
  readonly partialUsageByModel: Readonly<Record<string, PartialUsage>>;
  readonly unparsedLines: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
}

export function readTranscript(stdout: string): Transcript {
  let init: InitInfo | undefined;
  const toolUses: ToolUse[] = [];
  let resultEvent: Record<string, unknown> | undefined;
  let lastAssistantText: string | undefined;
  const models: string[] = [];
  let assistantEvents = 0;
  let unparsed = 0;
  const usageByMessage = new Map<string, { model: string; usage: PartialUsage }>();
  let anon = 0;
  for (const line of stdout.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    let ev: unknown;
    try {
      ev = JSON.parse(line);
    } catch {
      unparsed++;
      continue;
    }
    if (!isRecord(ev)) {
      unparsed++;
      continue;
    }
    if (ev.type === 'system' && ev.subtype === 'init') {
      const servers = Array.isArray(ev.mcp_servers)
        ? (ev.mcp_servers as unknown[]).filter(isRecord).map((s) => ({ name: String(s.name), status: String(s.status) }))
        : undefined;
      init = {
        ...(Array.isArray(ev.tools) ? { tools: (ev.tools as unknown[]).map(String) } : {}),
        ...(servers !== undefined ? { mcpServers: servers } : {}),
        ...(typeof ev.model === 'string' ? { model: ev.model } : {}),
      };
      continue;
    }
    if (ev.type === 'result') {
      resultEvent = ev;
      continue;
    }
    if (ev.type === 'assistant' && isRecord(ev.message)) {
      assistantEvents++;
      const msg = ev.message;
      const model = typeof msg.model === 'string' ? msg.model : 'unknown';
      if (!models.includes(model)) models.push(model);
      if (isRecord(msg.usage)) {
        const id = typeof msg.id === 'string' ? msg.id : `anon-${String(anon++)}`;
        usageByMessage.set(id, {
          model,
          usage: {
            input: num(msg.usage.input_tokens),
            cacheCreation: num(msg.usage.cache_creation_input_tokens),
            cacheRead: num(msg.usage.cache_read_input_tokens),
            output: num(msg.usage.output_tokens),
          },
        });
      }
      const texts: string[] = [];
      for (const c of Array.isArray(msg.content) ? (msg.content as unknown[]) : []) {
        if (!isRecord(c)) continue;
        if (c.type === 'tool_use' && typeof c.name === 'string') {
          toolUses.push({ id: typeof c.id === 'string' ? c.id : '', name: c.name, input: isRecord(c.input) ? c.input : {} });
        }
        if (c.type === 'text' && typeof c.text === 'string') texts.push(c.text);
      }
      if (texts.length > 0) lastAssistantText = texts.join('');
    }
  }
  const partialUsageByModel: Record<string, PartialUsage> = {};
  for (const { model, usage } of usageByMessage.values()) {
    const prev = partialUsageByModel[model] ?? { input: 0, cacheCreation: 0, cacheRead: 0, output: 0 };
    partialUsageByModel[model] = {
      input: prev.input + usage.input,
      cacheCreation: prev.cacheCreation + usage.cacheCreation,
      cacheRead: prev.cacheRead + usage.cacheRead,
      output: prev.output + usage.output,
    };
  }
  return {
    ...(init !== undefined ? { init } : {}),
    toolUses,
    ...(resultEvent !== undefined ? { resultEvent } : {}),
    ...(lastAssistantText !== undefined ? { lastAssistantText } : {}),
    assistantModels: models,
    assistantEvents,
    partialUsageByModel,
    unparsedLines: unparsed,
  };
}

export function toolCallCounts(t: Transcript): { total: number; byName: Record<string, number> } {
  const byName: Record<string, number> = {};
  for (const u of t.toolUses) byName[u.name] = (byName[u.name] ?? 0) + 1;
  return { total: t.toolUses.length, byName: Object.fromEntries(Object.keys(byName).sort().map((k) => [k, byName[k] ?? 0])) };
}

function canonical(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

function inside(root: string, p: string): boolean {
  const rel = path.relative(root, p);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** The path-like inputs of a file tool (Read `file_path`, Grep/Glob `path`, an absolute Glob `pattern`). */
function pathInputs(u: ToolUse): string[] {
  const out: string[] = [];
  for (const k of ['file_path', 'path', 'notebook_path']) {
    const v = u.input[k];
    if (typeof v === 'string' && v !== '') out.push(v);
  }
  const pattern = u.input.pattern;
  if (u.name === 'Glob' && typeof pattern === 'string' && path.isAbsolute(pattern)) out.push(pattern.replace(/[*?[{].*$/, ''));
  return out;
}

/** True when `p` (relative to the tree as cwd) resolves outside the tree. */
export function isOutsideTree(p: string, treeDir: string): boolean {
  const abs = path.isAbsolute(p) ? path.resolve(p) : path.resolve(treeDir, p);
  const roots = [path.resolve(treeDir), canonical(treeDir)];
  if (roots.some((r) => inside(r, abs))) return false;
  return !roots.some((r) => inside(r, canonical(abs)));
}

const MCP_PREFIX = 'mcp__';
const OWN_PREFIX = `mcp__${DAEDALUS_MCP_SERVER}__`;

/** DR-23 (R, N) and DR-A1-4 (G). */
export function checkConfinement(condition: Eff01Condition, t: Transcript, treeDir: string | null): ConfinementResult {
  const reasons: string[] = [];
  for (const u of t.toolUses) {
    if (condition === 'N') {
      reasons.push(`tool-use:${u.name}`);
      continue;
    }
    if (u.name.startsWith(MCP_PREFIX)) {
      if (condition === 'R') reasons.push(`mcp-tool:${u.name}`);
      else if (!u.name.startsWith(OWN_PREFIX)) reasons.push(`foreign-mcp-tool:${u.name}`);
      continue;
    }
    if (!FILE_TOOL_NAMES.includes(u.name)) {
      reasons.push(`builtin-not-allowed:${u.name}`);
      continue;
    }
    if (treeDir !== null) for (const p of pathInputs(u)) if (isOutsideTree(p, treeDir)) reasons.push(`read-outside-tree:${p}`);
  }
  if (condition === 'G') {
    const servers = t.init?.mcpServers ?? [];
    if (!servers.some((s) => s.name === DAEDALUS_MCP_SERVER && s.status === 'connected')) reasons.push('mcp-not-connected');
  }
  const tools = t.init?.tools;
  if (tools !== undefined) {
    const builtins = tools.filter((x) => !x.startsWith(MCP_PREFIX)).sort();
    const mcp = tools.filter((x) => x.startsWith(MCP_PREFIX));
    const expectBuiltins = condition === 'N' ? [] : [...FILE_TOOL_NAMES].sort();
    if (builtins.join(',') !== expectBuiltins.join(',')) reasons.push(`init-tools-mismatch:${builtins.join(',')}`);
    if (condition === 'G') {
      const expected = TOOL_NAMES.map((n) => `${OWN_PREFIX}${n}`);
      if (!expected.every((e) => mcp.includes(e)) || mcp.some((m) => !expected.includes(m))) reasons.push('init-mcp-tools-mismatch');
    } else if (mcp.length > 0) reasons.push('init-mcp-tools-present');
  }
  return { ok: reasons.length === 0, reasons };
}

/** DR-27: deletes `total_cost_usd` and every `costUSD` (also inside `modelUsage[*]`), deeply. */
export function stripCost<T>(value: T): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (isRecord(v)) {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) {
        if (k === 'total_cost_usd' || k === 'costUSD' || k === 'cost_usd') continue;
        out[k] = walk(x);
      }
      return out;
    }
    return v;
  };
  return walk(value) as T;
}

/** The daedalus-arch tool uses of a transcript (A1 graph evidence). */
export function graphToolCalls(t: Transcript): number {
  return t.toolUses.filter((u) => u.name.startsWith(OWN_PREFIX)).length;
}
