/**
 * v1.5 final study: the two arms' prompt and argv (design note §1.4, §6 item 8, §7 step 5). Pure.
 *
 * - `none`: the HEXDDD-01 baseline frame (`framePrompt`, the TRAPRATE-01 / PUZZLE-01 frame), the frozen argv
 *   (`buildGeneratorArgs`), byte for byte.
 * - `combined`: the same frame with the hint-audited combined sentence appended (`frame-combined.txt`, frozen by
 *   hash, appended the way the frozen `armPrompt` appends an arm sentence), and the frozen argv with exactly two
 *   changes: the `--settings` value turns the edit gate's hooks on (`withGateSettings`), and the pull channel's MCP
 *   server is added with the frozen `withMcpServer` (`--mcp-config <inline JSON>` after `--strict-mcp-config`, and
 *   `mcp__daedalus-arch__*` in `--allowedTools`). Both sockets are served by one delivery hub per session.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildGeneratorArgs } from '../../../scripts/lib/generators/argv.js';
import { withMcpServer } from '../../../scripts/lib/generators/arms.js';
import type { GeneratorCliConfig } from '../../../scripts/lib/generators/types.js';
import { gateSettingsJson, withGateSettings, type GateRelay } from '../../../src/v15-instrument/edit-gate/settings.js';
import { framePrompt } from '../../puzzle-01-baseline/run-baseline.js';
import type { Arm } from './plan.js';

/** `experiments/v15-delivery/hint-audit/frame-combined.txt` (hint audit VERDICT.md: 0 FAIL in 8 audits). */
export const FRAME_COMBINED_FILE = path.join('experiments', 'v15-delivery', 'hint-audit', 'frame-combined.txt');
/** sha256 of the file's bytes: the frozen text. */
export const FRAME_COMBINED_SHA256 = '76a684f6f929711f4456c761e29ec9e15ec5ac2c0cf415ab37cb6f1fdf772586';

export const MCP_SERVER_NAME = 'daedalus-arch';
export const MCP_ALLOW_RULE = 'mcp__daedalus-arch__*';

/** Reads the combined sentence and refuses it unless its bytes hash to the frozen value. */
export function loadCombinedSentence(repo: string): string {
  const bytes = fs.readFileSync(path.join(repo, FRAME_COMBINED_FILE));
  const got = createHash('sha256').update(bytes).digest('hex');
  if (got !== FRAME_COMBINED_SHA256) throw new Error(`frame-combined.txt: sha256 ${got}, frozen ${FRAME_COMBINED_SHA256}`);
  return bytes.toString('utf8').replace(/\s+$/, '');
}

export function promptFor(arm: Arm, request: string, tcCommand: string, combinedSentence: string): string {
  const base = framePrompt(request, tcCommand);
  return arm === 'none' ? base : `${base.replace(/\s+$/, '')}\n\n${combinedSentence}\n`;
}

export interface McpRelay { readonly nodeBinary: string; readonly relay: string; readonly socket: string }

/** The pull relay's MCP config, inline (nothing in it names a task). */
export function mcpConfigJson(m: McpRelay): string {
  return JSON.stringify({ mcpServers: { [MCP_SERVER_NAME]: { type: 'stdio', command: m.nodeBinary, args: [m.relay, m.socket], env: {} } } });
}

export interface ArmSockets { readonly gate: GateRelay; readonly mcp: McpRelay }

export function argvFor(arm: Arm, cfg: GeneratorCliConfig, runId: string, prompt: string, sockets: ArmSockets | null): readonly string[] {
  const frozen = buildGeneratorArgs(cfg, { runId }, prompt);
  if (arm === 'none') return frozen;
  if (sockets === null) throw new Error('arm combined needs the hub sockets');
  return withGateSettings(withMcpServer(frozen, mcpConfigJson(sockets.mcp), [MCP_ALLOW_RULE], []), sockets.gate);
}

export interface ArgvDiff {
  /** `none` equals the frozen argv, byte for byte. */
  readonly noneIdentical: boolean;
  /** `combined` with its two changes undone equals the frozen argv. */
  readonly combinedOnlyTwoChanges: boolean;
  /** The `--settings` value of `combined` is the gate's (hooks on). */
  readonly settingsIsGate: boolean;
  /** The `--mcp-config` value of `combined` is the relay config. */
  readonly mcpIsRelay: boolean;
  readonly changedPositions: readonly number[];
}

/** Argv diff (§6 item 8, §7 step 5), on one prompt so only the arm's flags can differ. */
export function argvDiff(cfg: GeneratorCliConfig, runId: string, prompt: string, sockets: ArmSockets): ArgvDiff {
  const frozen = buildGeneratorArgs(cfg, { runId }, prompt);
  return compareArgv(frozen, argvFor('none', cfg, runId, prompt, null), argvFor('combined', cfg, runId, prompt, sockets), sockets);
}

/** The comparison itself (pure): `none` must equal `frozen`; `combined` with its two changes undone must too. */
export function compareArgv(frozen: readonly string[], none: readonly string[], combinedIn: readonly string[], sockets: ArmSockets): ArgvDiff {
  const combined = [...combinedIn];
  const noneIdentical = JSON.stringify(none) === JSON.stringify(frozen);
  const si = combined.indexOf('--settings');
  const mi = combined.indexOf('--mcp-config');
  const settingsIsGate = si >= 0 && combined[si + 1] === gateSettingsJson(sockets.gate);
  const mcpIsRelay = mi >= 0 && combined[mi + 1] === mcpConfigJson(sockets.mcp);
  const undone = [...combined];
  const fsi = frozen.indexOf('--settings');
  if (si >= 0 && fsi >= 0) undone[si + 1] = frozen[fsi + 1] as string;
  if (mi >= 0) undone.splice(mi, 2);
  const ai = undone.indexOf(MCP_ALLOW_RULE);
  if (ai >= 0) undone.splice(ai, 1);
  const combinedOnlyTwoChanges = JSON.stringify(undone) === JSON.stringify(frozen);
  const changedPositions: number[] = [];
  for (let i = 0; i < Math.max(frozen.length, combined.length); i++) if (frozen[i] !== combined[i]) changedPositions.push(i);
  return { noneIdentical, combinedOnlyTwoChanges, settingsIsGate, mcpIsRelay, changedPositions };
}
