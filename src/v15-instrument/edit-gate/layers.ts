/**
 * v1.5 instrument (Stage 0, 2026-10-26): promoted from `experiments/edit-gate/layers.ts`; the logic is unchanged and the
 * prototype stays in place as the record of the exploratory runs.
 *
 * Edit gate, layer checks (v1.5-exp, exploratory; added for PUZZLE-04). The frozen `check_diff` handler
 * (`src/mcp-server/tools.ts`, imported read-only, the fast path the pull arm's server also answers with) runs on a
 * unified diff of the changed source files against the cell's seed. `check_diff` rebuilds each modified file and reports
 * only what the new content has that the seed's did not, so a finding the seed already had (planted debt) is not shown.
 * The gate keeps the blocking findings of the three layer rules FF-S01 (dependency-direction), FF-S02 (no-cyclic-deps)
 * and FF-S03 (no-layer-skip), and turns each into the gate's finding shape (`gate.ts`), so that de-duplication, the
 * message and the Stop hook treat them like `check_consistency` findings.
 *
 * 2026-10-29 (instrument v1.5.1): `rules` takes any set of frozen rule ids (the delivery hub passes the style's frozen
 * rules from the one rule list, `../rule-set.ts`); the default stays FF-S01–S03. Messages come from
 * `../rule-messages.ts` (plain rule text, the file:line and subject with the frozen reason, the frozen fix); keys are
 * unchanged.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildContext, parseArgs } from '../../mcp-server/context.js';
import { SOURCE_FILE_RE } from '../../mcp-server/diff-check.js';
import { checkDiffTool, type ServerContext } from '../../mcp-server/tools.js';
import type { FileViolation } from '../../mcp-server/types.js';
import type { KeyedFinding } from './gate.js';
import { frozenMessage } from '../rule-messages.js';

export const LAYER_RULES: readonly string[] = ['FF-S01', 'FF-S02', 'FF-S03'];

/** The frozen rule names (the presets' `name` of each id). */
export const LAYER_RULE_NAMES: Readonly<Record<string, string>> = { 'FF-S01': 'dependency-direction', 'FF-S02': 'no-cyclic-deps', 'FF-S03': 'no-layer-skip' };

export interface LayerCheck {
  readonly findings: readonly KeyedFinding[];
  /** FF-S01–S03 findings the tier filter dropped (advisory for the spec's style), for the record. */
  readonly advisory: number;
  readonly ms: number;
}

const contexts = new Map<string, ServerContext>();

/** The frozen server context for one spec and tree: fast path, no environment read (no engine switch leaks in). */
function contextOf(spec: string, root: string): ServerContext {
  const k = `${spec}\n${root}`;
  let c = contexts.get(k);
  if (c === undefined) {
    c = buildContext(parseArgs(['--spec', spec, '--project', root, '--engine', 'cypher-interp']), {});
    contexts.set(k, c);
  }
  return c;
}

/** `diff -u` of one file, `a/` and `b/` labels, `/dev/null` for a side that does not exist. Empty when equal. */
function unified(seedDir: string, root: string, rel: string): string {
  const a = path.join(seedDir, rel);
  const b = path.join(root, rel);
  const hasA = fs.existsSync(a);
  const hasB = fs.existsSync(b);
  if (!hasB) return ''; // deleted: nothing new to check
  try {
    execFileSync('diff', ['-u', '--label', hasA ? `a/${rel}` : '/dev/null', '--label', `b/${rel}`, hasA ? a : '/dev/null', b], { encoding: 'utf8' });
    return '';
  } catch (e) {
    const out = (e as { status?: number; stdout?: string }).status === 1 ? (e as { stdout: string }).stdout : '';
    return out.endsWith('\n') ? out : `${out}\n`;
  }
}

export function toKeyed(v: FileViolation): KeyedFinding {
  return {
    file: v.file,
    line: v.line,
    rule: v.ruleId,
    ...frozenMessage(v),
    writes: [],
    command: v.subject,
    aggregates: [],
    key: [v.ruleId, v.file, v.subject, v.target ?? ''].join('|'),
  };
}

/**
 * The layer findings of the changed files against the seed. `changed` is tree-relative (the hub's `changedSince`);
 * only TypeScript/JavaScript sources are diffed.
 */
export async function checkLayers(o: { readonly root: string; readonly spec: string; readonly seedDir: string; readonly changed: readonly string[]; readonly rules?: readonly string[] | undefined }): Promise<LayerCheck> {
  const ids = o.rules ?? LAYER_RULES;
  const t0 = performance.now();
  if (ids.length === 0) return { findings: [], advisory: 0, ms: 0 };
  const diff = o.changed.filter((f) => SOURCE_FILE_RE.test(f)).map((f) => unified(o.seedDir, o.root, f)).filter((d) => d.trim() !== '').join('');
  if (diff === '') return { findings: [], advisory: 0, ms: Math.round(performance.now() - t0) };
  const r = await checkDiffTool(contextOf(o.spec, o.root), { diff });
  if (!r.ok) throw new Error(`check_diff: ${r.message}`);
  const layer = r.data.files.flatMap((f) => f.findings).filter((v) => ids.includes(v.ruleId));
  const blocking = layer.filter((v) => v.tier === 'blocking');
  const seen = new Set<string>();
  const findings = blocking.map(toKeyed).filter((f) => (seen.has(f.key) ? false : (seen.add(f.key), true)));
  return { findings, advisory: layer.length - blocking.length, ms: Math.round(performance.now() - t0) };
}
