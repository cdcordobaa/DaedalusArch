#!/usr/bin/env node
// The Gemini generator's PreToolUse confinement hook (U12; Docs/v1.4/gemini-generator.md, "Confinement").
//
// agy 1.4.2 runs this for EVERY tool call (hooks.json matcher ".*") before the tool runs. It is plain Node with no
// dependency, committed here and copied into each generator home by the per-turn writer (`writeAgyTurnFiles`), which
// also writes the per-turn config this script reads (the work directory, the allowed command, the arm, the log path).
// Nothing it decides comes from the model-visible prompt.
//
//   node agy-confine-hook.mjs <turn-config.json>     (stdin: agy's camelCase PreToolUse payload)
//
// Allow-list per arm (everything else is denied with a reason):
// - file tools (view_file, list_dir, find_by_name, grep_search, write_to_file, replace_file_content,
//   multi_replace_file_content, sed_file, and the 1.4.2 stream names read_file / write_file) only when EVERY path
//   argument resolves (realpath of the deepest existing ancestor, so no symlink escape) inside the work directory;
// - run_command only when allowCommand is true and args.CommandLine equals the turn's type-check command exactly;
//   command_status only after that command was allowed in this turn;
// - finish;
// - daedalus-mcp arm: call_mcp_tool only for the daedalus-arch server's spec-only tools (never evaluate_project), and
//   read_file / view_file of exactly those tools' schema files in the home (agy 1.4.2 reads them before an MCP call).
//
// Output: stdout {"decision":"allow"|"deny","reason":...}, exit 0. Each decision is appended to the turn's hook log
// (JSON line: tool, decision, reason, stepIdx), which lies outside the work directory. Any internal error (bad config,
// malformed stdin, a log that cannot be written) exits non-zero, which agy treats as a block (fail-closed).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HOOK_CONFIG_SCHEMA = 'agy-confine-turn/v1';

/** File tools: allowed only with every path argument inside the work directory. */
export const FILE_TOOLS = Object.freeze([
  'view_file',
  'list_dir',
  'find_by_name',
  'grep_search',
  'write_to_file',
  'replace_file_content',
  'multi_replace_file_content',
  'sed_file',
  // agy 1.4.2 stream-json names (S4 run of 2026-10-19): the same file access under the permission action names.
  'read_file',
  'write_file',
]);
/** The read tools that may read an allowed MCP tool's schema file in the daedalus-mcp arm. */
export const SCHEMA_READ_TOOLS = Object.freeze(['view_file', 'read_file']);
export const ANSWER_TOOLS = Object.freeze(['finish']);
export const COMMAND_TOOL = 'run_command';
export const COMMAND_STATUS_TOOL = 'command_status';
export const MCP_TOOL = 'call_mcp_tool';

/** Argument keys that name a path. */
const PATH_KEY = /path|file|dir|uri/i;
/** Argument keys that carry file content or search text, never a path to open. */
const CONTENT_KEY = /content|instruction|description|chunk|query|pattern|include|exclude|replacement|target_?content|code/i;

function isRecord(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isInsideOrEqual(root, p) {
  const rel = path.relative(root, p);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** `p` resolved against `base` with every symlink of its deepest existing ancestor followed; null when not a path. */
export function resolveReal(p, base, realpath = fs.realpathSync) {
  if (typeof p !== 'string' || p === '') return null;
  let s = p;
  if (s.startsWith('file://')) s = fileURLToPath(s);
  if (s.startsWith('~')) return null;
  const abs = path.resolve(base, s);
  const rest = [];
  for (let at = abs; ; at = path.dirname(at)) {
    try {
      return path.join(realpath(at), ...rest.reverse());
    } catch {
      if (path.dirname(at) === at) return null;
      rest.push(path.basename(at));
    }
  }
}

/** Every path a tool call names: string values under path keys, and absolute-looking strings under other keys. */
export function pathArgs(args) {
  const out = [];
  const visit = (key, v) => {
    if (typeof v === 'string') {
      if (PATH_KEY.test(key) && !CONTENT_KEY.test(key)) out.push(v);
      else if (!CONTENT_KEY.test(key) && (v.startsWith('/') || v.startsWith('~') || v.startsWith('file://') || v.split(/[\\/]/).includes('..'))) out.push(v);
    } else if (Array.isArray(v)) {
      for (const x of v) visit(key, x);
    } else if (isRecord(v) && !CONTENT_KEY.test(key)) {
      for (const [k, x] of Object.entries(v)) visit(k, x);
    }
  };
  for (const [k, v] of Object.entries(args)) visit(k, v);
  return out;
}

/** The validated per-turn config; throws on anything unexpected (the caller fails closed). */
export function parseConfig(value) {
  if (!isRecord(value) || value.schema !== HOOK_CONFIG_SCHEMA) throw new Error('hook config: wrong schema');
  if (value.arm !== 'none' && value.arm !== 'daedalus-mcp') throw new Error('hook config: arm');
  if (value.workDir !== null && (typeof value.workDir !== 'string' || !path.isAbsolute(value.workDir))) throw new Error('hook config: workDir');
  if (typeof value.allowCommand !== 'boolean') throw new Error('hook config: allowCommand');
  if (value.typecheckCommand !== null && typeof value.typecheckCommand !== 'string') throw new Error('hook config: typecheckCommand');
  if (value.allowCommand && value.workDir !== null && (typeof value.typecheckCommand !== 'string' || value.typecheckCommand === '')) throw new Error('hook config: typecheckCommand');
  if (value.logPath !== null && (typeof value.logPath !== 'string' || !path.isAbsolute(value.logPath))) throw new Error('hook config: logPath');
  if (value.arm === 'daedalus-mcp' && value.workDir !== null) {
    const m = value.mcp;
    if (!isRecord(m) || typeof m.server !== 'string' || !Array.isArray(m.allowedTools) || !Array.isArray(m.deniedTools) || typeof m.schemaDir !== 'string' || !path.isAbsolute(m.schemaDir)) {
      throw new Error('hook config: mcp');
    }
    if (!m.allowedTools.every((t) => typeof t === 'string') || !m.deniedTools.every((t) => typeof t === 'string')) throw new Error('hook config: mcp tools');
  }
  return value;
}

const allow = (reason) => ({ decision: 'allow', reason });
const deny = (reason) => ({ decision: 'deny', reason });

/** A tool name as an MCP call may give it: `tool`, `server/tool`, `server.tool`, `server:tool`, `mcp__server__tool`. */
function lastSegment(s) {
  const parts = s.split(/__|[/.:]/).filter((x) => x !== '');
  return parts[parts.length - 1] ?? s;
}

function decideMcp(args, mcp) {
  const values = Object.entries(args).filter(([, v]) => typeof v === 'string');
  for (const [k, v] of values) {
    if (/server/i.test(k) && v !== mcp.server) return deny(`${MCP_TOOL}: only the ${mcp.server} server is allowed`);
  }
  if (values.some(([, v]) => mcp.deniedTools.includes(v) || mcp.deniedTools.includes(lastSegment(v)))) return deny(`${MCP_TOOL}: ${mcp.deniedTools.join(', ')} is not allowed`);
  const named = values.filter(([k]) => /tool|name/i.test(k) && !/server/i.test(k)).map(([, v]) => v);
  if (named.length === 0) return deny(`${MCP_TOOL}: no tool name argument`);
  if (!named.every((v) => mcp.allowedTools.includes(v) || mcp.allowedTools.includes(lastSegment(v)))) return deny(`${MCP_TOOL}: only the spec-only ${mcp.server} tools are allowed`);
  return allow(`${MCP_TOOL}: an allowed ${mcp.server} tool`);
}

/**
 * The decision for one PreToolUse payload (pure apart from `realpath`). `priorCommandAllowed`: the turn's type-check
 * command was allowed earlier in this turn (for command_status). Throws on a malformed payload (fail-closed).
 */
export function decide(input, config, deps = {}) {
  const realpath = deps.realpath ?? fs.realpathSync;
  if (!isRecord(input) || !isRecord(input.toolCall) || typeof input.toolCall.name !== 'string' || input.toolCall.name === '') throw new Error('hook input: no toolCall.name');
  const name = input.toolCall.name;
  const rawArgs = input.toolCall.args ?? {};
  if (!isRecord(rawArgs)) throw new Error('hook input: toolCall.args is not an object');
  const args = rawArgs;
  if (config.workDir === null) return deny('no turn is configured for this generator home');
  const work = realpath(config.workDir);
  if (ANSWER_TOOLS.includes(name)) return allow('the answer tool');
  if (FILE_TOOLS.includes(name)) {
    const paths = pathArgs(args);
    if (paths.length === 0) return deny(`${name}: no path argument`);
    const schemaFiles =
      config.arm === 'daedalus-mcp' && config.mcp !== undefined && SCHEMA_READ_TOOLS.includes(name)
        ? config.mcp.allowedTools.map((t) => path.join(resolveReal(config.mcp.schemaDir, '/', realpath) ?? config.mcp.schemaDir, `${t}.json`))
        : [];
    for (const p of paths) {
      const r = resolveReal(p, work, realpath);
      if (r === null) return deny(`${name}: a path argument cannot be resolved`);
      if (schemaFiles.includes(r)) continue;
      if (!isInsideOrEqual(work, r)) return deny(`${name}: a path lies outside the work directory`);
    }
    return allow(`${name}: every path inside the work directory`);
  }
  if (name === COMMAND_TOOL) {
    if (!config.allowCommand) return deny(`${COMMAND_TOOL}: no command is allowed in this turn`);
    const line = typeof args.CommandLine === 'string' ? args.CommandLine.trim() : null;
    if (line === null) return deny(`${COMMAND_TOOL}: no CommandLine argument`);
    return line === config.typecheckCommand ? allow(`${COMMAND_TOOL}: the turn's type-check command`) : deny(`${COMMAND_TOOL}: only the turn's exact type-check command is allowed`);
  }
  if (name === COMMAND_STATUS_TOOL) {
    if (!config.allowCommand) return deny(`${COMMAND_STATUS_TOOL}: no command is allowed in this turn`);
    return deps.priorCommandAllowed === true ? allow(`${COMMAND_STATUS_TOOL}: the type-check command`) : deny(`${COMMAND_STATUS_TOOL}: no allowed command has run in this turn`);
  }
  if (name === MCP_TOOL) {
    if (config.arm !== 'daedalus-mcp' || config.mcp === undefined) return deny(`${MCP_TOOL}: no MCP tool in the none arm`);
    return decideMcp(args, config.mcp);
  }
  return deny(`${name}: not on the generator allow-list`);
}

/** Whether the log already holds an allowed run_command (this turn's type-check). */
export function priorCommandAllowed(logPath) {
  if (logPath === null || !fs.existsSync(logPath)) return false;
  return fs
    .readFileSync(logPath, 'utf8')
    .split('\n')
    .some((l) => {
      try {
        const v = JSON.parse(l);
        return isRecord(v) && v.tool === COMMAND_TOOL && v.decision === 'allow';
      } catch {
        return false;
      }
    });
}

function appendLog(logPath, line) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify(line)}\n`);
}

/** The hook process: 0 with a decision on stdout, 2 on any internal error (agy blocks the call). */
export function main(argv, stdinText) {
  let logPath = null;
  try {
    const configPath = argv[0];
    if (typeof configPath !== 'string' || !path.isAbsolute(configPath)) throw new Error('usage: agy-confine-hook.mjs <abs turn-config.json>');
    const config = parseConfig(JSON.parse(fs.readFileSync(configPath, 'utf8')));
    logPath = config.logPath;
    let input;
    try {
      input = JSON.parse(stdinText);
    } catch {
      throw new Error('hook input: stdin is not JSON');
    }
    const d = decide(input, config, { priorCommandAllowed: priorCommandAllowed(config.logPath) });
    if (config.logPath === null) throw new Error('no turn is configured for this generator home (no hook log)');
    appendLog(config.logPath, { tool: input.toolCall.name, decision: d.decision, reason: d.reason, stepIdx: typeof input.stepIdx === 'number' ? input.stepIdx : null });
    process.stdout.write(`${JSON.stringify(d)}\n`);
    return 0;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (logPath !== null) {
      try {
        appendLog(logPath, { tool: null, decision: 'error', reason: message, stepIdx: null });
      } catch {
        // the exit code already blocks the call
      }
    }
    process.stderr.write(`agy-confine-hook: ${message} (the call is blocked)\n`);
    return 2;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  let text = '';
  try {
    text = fs.readFileSync(0, 'utf8');
  } catch {
    text = '';
  }
  process.exitCode = main(process.argv.slice(2), text);
}
