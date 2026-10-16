/**
 * MCP v2 consistency check (Docs/v1.3/mcp-v2.md §4): for every variant of the v1.3 reference projects, the variant's
 * diff against the clean variant is fed to the `check_diff` tool handler, and the tool's blocking answer is compared
 * with the full firewall evaluation's blocking findings for that variant, read from the saved live run
 * (`results/v1.3-reference/after-member-facts/`).
 *
 * The full-evaluation reference of a variant is its findings that are blocking under the v1.3 tiers
 * (`ruleTier(ruleId, style)`), minus the rows a partial rule reports N/A (FF-P06's FLOWS_TO rows, rule-tiers.md
 * finding 9; read from the evidence file's discriminator), minus the same blocking findings of the clean variant
 * (the diff only adds what the variant adds). The raw file and the evidence file must agree on (rule, file, target).
 *
 * Every disagreement must be explained: a documented limit of the fast path (`DOCUMENTED_LIMITS`), or it is reported
 * as unexplained (a defect to fix) and `--check` fails.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Violation } from '../../../src/shared/taxonomy/violation-types.js';
import { RULE_TIERS, ruleTier } from '../../../src/scoring-engine/rule-tiers.js';
import { relTypeOf } from '../../../src/scoring-engine/tiered-scoring.js';
import type { DiffCheckResult, FileViolation } from '../../../src/mcp-server/types.js';

export const RESULTS_DIR = 'results/v1.3-reference/after-member-facts';

/** How the tool is configured for one comparison. */
export type ConsistencyMode = 'after-write' | 'before-write' | 'spec-only';

export const CONSISTENCY_MODES: readonly ConsistencyMode[] = Object.freeze(['after-write', 'before-write', 'spec-only']);

export const MODE_DESCRIPTIONS: Readonly<Record<ConsistencyMode, string>> = Object.freeze({
  'after-write': 'project root = the variant (the agent has written the change, then calls check_diff on git diff)',
  'before-write': 'project root = the clean project (the agent checks a proposed diff before writing it)',
  'spec-only': 'no project root (spec-only: new files whole, modified files on their added lines)',
});

export interface FullFinding {
  readonly ruleId: string;
  readonly file: string;
  readonly target?: string;
  /** FF-P06 only: FLOWS_TO or CONSTRUCTOR_INJECTS. */
  readonly relType?: string;
}

interface RawFile {
  readonly findings: readonly { readonly ruleId: string; readonly file: string; readonly target?: string }[];
}
interface EvidenceFile {
  readonly violations: readonly Violation[];
}

const key = (f: { ruleId: string; file: string; target?: string | undefined }): string => `${f.ruleId}|${f.file}|${f.target ?? ''}`;

/** The full evaluation's findings of one variant (evidence rows, checked against the raw rows). */
export function readFullFindings(repoRoot: string, style: string, variant: string): { findings: FullFinding[]; problems: string[] } {
  const raw = JSON.parse(fs.readFileSync(path.join(repoRoot, RESULTS_DIR, 'raw', style, `${variant}.json`), 'utf8')) as RawFile;
  const ev = JSON.parse(fs.readFileSync(path.join(repoRoot, RESULTS_DIR, 'evidence', style, `${variant}.json`), 'utf8')) as EvidenceFile;
  const findings: FullFinding[] = ev.violations.map((v) => {
    const rel = String(v.functionId) === 'FF-P06' ? relTypeOf(v) : undefined;
    return { ruleId: String(v.functionId), file: v.filePath, ...(v.target !== undefined ? { target: v.target } : {}), ...(rel !== undefined ? { relType: rel } : {}) };
  });
  const a = new Set(raw.findings.map(key));
  const b = new Set(findings.map(key));
  const problems: string[] = [];
  for (const k of a) if (!b.has(k)) problems.push(`${style}/${variant}: raw row ${k} missing from evidence`);
  for (const k of b) if (!a.has(k)) problems.push(`${style}/${variant}: evidence row ${k} missing from raw`);
  return { findings, problems };
}

/** True when the row counts towards the v1.3 blocking verdict (blocking tier, not a partial rule's N/A part). */
export function countsAsBlocking(f: FullFinding, style: string): boolean {
  const t = ruleTier(f.ruleId, style);
  if (t.tier !== 'blocking') return false;
  const partial = RULE_TIERS.get(f.ruleId)?.partial;
  return !(partial !== undefined && f.relType === partial.naRelType);
}

/** The variant's blocking findings that the clean variant does not have. */
export function blockingDelta(variant: readonly FullFinding[], clean: readonly FullFinding[], style: string): FullFinding[] {
  const before = new Set(clean.filter((f) => countsAsBlocking(f, style)).map(key));
  return variant.filter((f) => countsAsBlocking(f, style) && !before.has(key(f)));
}

/** `git diff --no-index` of two project directories, with paths made project-relative (`a/<path>`, `b/<path>`). */
export function projectDiff(cleanDir: string, variantDir: string): string {
  const parent = path.dirname(cleanDir) === path.dirname(variantDir) ? path.dirname(cleanDir) : '/';
  const rc = path.relative(parent, cleanDir);
  const rv = path.relative(parent, variantDir);
  let out = '';
  try {
    execFileSync('git', ['diff', '--no-index', '--no-renames', '--no-color', rc, rv], { cwd: parent, maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    const err = e as { status?: number; stdout?: Buffer | string };
    if (err.status !== 1) throw e;
    out = String(err.stdout ?? '');
  }
  return out.split(`a/${rc}/`).join('a/').split(`b/${rv}/`).join('b/');
}

/** A documented limit of the fast path that explains one kind of disagreement. */
export interface DocumentedLimit {
  readonly id: string;
  readonly modes: readonly ConsistencyMode[];
  readonly ruleIds: readonly string[];
  /** `full-only`: the full evaluation blocks and the tool does not; `tool-only`: the reverse. */
  readonly direction: 'full-only' | 'tool-only';
  readonly reason: string;
}

export const DOCUMENTED_LIMITS: readonly DocumentedLimit[] = Object.freeze([
  {
    id: 'L1-cycles-need-the-graph',
    modes: ['spec-only'],
    ruleIds: ['FF-S02'],
    direction: 'full-only',
    reason: 'A cycle is a property of the whole import graph. Without a project root the fast path sees only the changed files, so it cannot close a cycle (no-cyclic-deps is listed in notChecked).',
  },
  {
    id: 'L2-added-lines-only',
    modes: ['spec-only'],
    ruleIds: ['FF-DT03'],
    direction: 'full-only',
    reason: 'Without a project root a modified file is checked on its added lines only. A class-level fact (here a value object made mutable by an added setter or field) is a fact about the class declaration, and the added lines alone do not parse as one, so the member facts cannot be read.',
  },
] satisfies DocumentedLimit[]);

export interface ToolFinding {
  readonly ruleId: string;
  readonly tier: string;
  readonly file: string;
  readonly line: number;
  readonly target?: string;
}

export interface VariantComparison {
  readonly style: string;
  readonly variant: string;
  readonly kind: string;
  readonly plants: string | null;
  readonly mode: ConsistencyMode;
  readonly full: { readonly blocks: boolean; readonly rules: readonly string[]; readonly findings: readonly FullFinding[] };
  readonly tool: {
    readonly blocks: boolean;
    readonly blockingVerdict: string;
    readonly rules: readonly string[];
    readonly findings: readonly ToolFinding[];
    readonly advisoryRules: readonly string[];
    readonly hints: readonly string[];
    readonly basis: readonly string[];
    readonly ms: number;
  };
  /** The blocking answer (block / pass) is the same. */
  readonly answerAgrees: boolean;
  /** The set of blocking rule ids is the same. */
  readonly rulesAgree: boolean;
  readonly bothRules: readonly string[];
  readonly fullOnlyRules: readonly string[];
  readonly toolOnlyRules: readonly string[];
  /** Every full blocking finding has a tool finding of the same rule in the same file (a cycle: in one of its files). */
  readonly locationsAgree: boolean;
  readonly explainedBy: readonly string[];
  readonly unexplained: readonly string[];
}

function sameLocation(full: FullFinding, tool: ToolFinding): boolean {
  if (full.ruleId !== tool.ruleId) return false;
  if (full.ruleId === 'FF-S02') return full.file.split(',').includes(tool.file);
  return full.file === tool.file;
}

export function compareVariant(
  meta: { style: string; variant: string; kind: string; plants: string | null; mode: ConsistencyMode },
  full: readonly FullFinding[],
  result: DiffCheckResult,
  ms: number,
): VariantComparison {
  const toolFindings: ToolFinding[] = result.files.flatMap((f) =>
    f.findings.filter((v: FileViolation) => v.tier === 'blocking').map((v) => ({ ruleId: v.ruleId, tier: v.tier, file: f.path, line: v.line, ...(v.target !== undefined ? { target: v.target } : {}) })),
  );
  const fullRules = [...new Set(full.map((f) => f.ruleId))].sort();
  const toolRules = [...new Set(toolFindings.map((f) => f.ruleId))].sort();
  const both = fullRules.filter((r) => toolRules.includes(r));
  const fullOnly = fullRules.filter((r) => !toolRules.includes(r));
  const toolOnly = toolRules.filter((r) => !fullRules.includes(r));
  const explainedBy: string[] = [];
  const unexplained: string[] = [];
  const explain = (rule: string, direction: 'full-only' | 'tool-only'): void => {
    const lim = DOCUMENTED_LIMITS.find((l) => l.direction === direction && l.modes.includes(meta.mode) && l.ruleIds.includes(rule));
    if (lim !== undefined) {
      if (!explainedBy.includes(lim.id)) explainedBy.push(lim.id);
    } else unexplained.push(`${direction} ${rule}`);
  };
  for (const r of fullOnly) explain(r, 'full-only');
  for (const r of toolOnly) explain(r, 'tool-only');
  return {
    ...meta,
    full: { blocks: full.length > 0, rules: fullRules, findings: full },
    tool: {
      blocks: result.blockingVerdict === 'block',
      blockingVerdict: result.blockingVerdict,
      rules: toolRules,
      findings: toolFindings,
      advisoryRules: [...new Set(result.files.flatMap((f) => f.findings.filter((v) => v.tier !== 'blocking').map((v) => v.ruleId)))].sort(),
      hints: [...new Set(result.files.flatMap((f) => f.hints.map((h) => h.ruleId)))].sort(),
      basis: result.files.map((f) => f.basis),
      ms,
    },
    answerAgrees: (full.length > 0) === (result.blockingVerdict === 'block'),
    rulesAgree: fullOnly.length === 0 && toolOnly.length === 0,
    bothRules: both,
    fullOnlyRules: fullOnly,
    toolOnlyRules: toolOnly,
    locationsAgree: full.every((f) => toolFindings.some((t) => sameLocation(f, t))),
    explainedBy,
    unexplained,
  };
}

export interface AgreementRow {
  readonly style: string;
  readonly mode: ConsistencyMode;
  readonly variants: number;
  readonly answerAgree: number;
  readonly rulesAgree: number;
  readonly locationsAgree: number;
  readonly cleanAndNearMissSilent: string;
  readonly unexplained: number;
}

export interface RuleRow {
  readonly style: string;
  readonly mode: ConsistencyMode;
  readonly ruleId: string;
  /** Variants where both block on the rule. */
  readonly both: number;
  readonly fullOnly: number;
  readonly toolOnly: number;
}

export function summarise(rows: readonly VariantComparison[]): { byStyle: AgreementRow[]; byRule: RuleRow[] } {
  const byStyle: AgreementRow[] = [];
  const byRule: RuleRow[] = [];
  const groups = new Map<string, VariantComparison[]>();
  for (const r of rows) groups.set(`${r.mode}|${r.style}`, [...(groups.get(`${r.mode}|${r.style}`) ?? []), r]);
  for (const [k, g] of groups) {
    const [mode = '', style = ''] = k.split('|');
    const quiet = g.filter((r) => r.kind !== 'violation');
    byStyle.push({
      style,
      mode: mode as ConsistencyMode,
      variants: g.length,
      answerAgree: g.filter((r) => r.answerAgrees).length,
      rulesAgree: g.filter((r) => r.rulesAgree).length,
      locationsAgree: g.filter((r) => r.locationsAgree).length,
      cleanAndNearMissSilent: `${String(quiet.filter((r) => !r.tool.blocks).length)}/${String(quiet.length)}`,
      unexplained: g.reduce((n, r) => n + r.unexplained.length, 0),
    });
    const rules = [...new Set(g.flatMap((r) => [...r.full.rules, ...r.tool.rules]))].sort();
    for (const ruleId of rules) {
      byRule.push({
        style,
        mode: mode as ConsistencyMode,
        ruleId,
        both: g.filter((r) => r.bothRules.includes(ruleId)).length,
        fullOnly: g.filter((r) => r.fullOnlyRules.includes(ruleId)).length,
        toolOnly: g.filter((r) => r.toolOnlyRules.includes(ruleId)).length,
      });
    }
  }
  return { byStyle, byRule };
}

/** p-th percentile (nearest rank) of a list of numbers. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(sorted.length, rank) - 1] ?? Number.NaN;
}
