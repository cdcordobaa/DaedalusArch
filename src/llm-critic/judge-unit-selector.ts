import * as fs from 'node:fs';
import * as path from 'node:path';
import type { JudgeUnitKind } from '../shared/types/enums.js';
import type { BaselineSelection, ExclusionReason } from '../shared/types/evaluation.js';
import type { LayerDefinition } from '../shared/types/spec.js';
import type { FunctionId } from '../shared/types/value-objects.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { globToRegex } from '../fitness-compiler/glob-to-regex.js';
import { sha256Hex } from './canonical-json.js';
import { CHARS_PER_TOKEN, MIN_SIZE_TOKENS, SELECTION_SEED, UNIT_CAP } from './frozen.js';
import type { JudgeGraphView } from './judge-graph.js';
import { typeKey } from './judge-graph.js';

/**
 * Judge-unit selector (BR-U4-SEL-01..07; BLM §3, §4, §5; ADR-017 item 4).
 * Pure apart from reading the first lines and size of candidate files under `projectRoot`.
 */

// ── Entities (DE §2) ─────────────────────────────────────────────────────────────────────

export interface JudgeUnit {
  readonly id: string;                    // file: path; class: `${name}@${path}`; module: dir, or `${dir}#${layer}`
  readonly kind: JudgeUnitKind;
  readonly layer: string;
  readonly filePaths: readonly string[];  // sorted, root-relative POSIX
  readonly sizeTokens: number;            // ceil(total chars / 4); informational (minSizeTokens = 0)
  readonly singleFile: boolean;           // module: one-file module; file and class units: true
}

export interface CandidateSet {
  readonly kind: JudgeUnitKind;
  readonly units: readonly JudgeUnit[];                              // sorted by id
  readonly exclusions: Readonly<Record<ExclusionReason, number>>;    // every key present
  readonly uncoveredFiles: readonly string[];                        // the 'unlayered' files, sorted
}

export interface UnitSelectionRule {
  readonly cap: number;
  readonly seed: string;
  readonly minSizeTokens: number;
  readonly seededList: readonly string[];   // development only (BR-U4-SEL-06)
  readonly baseline?: BaselineSelection;    // variant run (BR-U4-SEL-07)
}

export const DEFAULT_SELECTION_RULE: UnitSelectionRule = Object.freeze({
  cap: UNIT_CAP,
  seed: SELECTION_SEED,
  minSizeTokens: MIN_SIZE_TOKENS,
  seededList: Object.freeze([]),
});

/** Exclusion reasons in the order they are tested (DE §2.2). */
export const EXCLUSION_REASONS: readonly ExclusionReason[] = Object.freeze([
  'unlayered', 'exclude-paths', 'barrel', 'test-path', 'e2e-spec', 'generated-path', 'generated-marker',
]);

const TEST_SEGMENTS = new Set(['__tests__', '__mocks__', 'test', 'tests', 'e2e']);
const GENERATED_MARKERS = ['@generated', 'DO NOT EDIT'];
const HEAD_LINES = 10;

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function emptyExclusions(): Record<ExclusionReason, number> {
  return {
    unlayered: 0, 'exclude-paths': 0, barrel: 0, 'test-path': 0, 'e2e-spec': 0, 'generated-path': 0, 'generated-marker': 0,
  };
}

function tokensOf(chars: number): number {
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

// ── Candidates (BR-U4-SEL-01, BLM §3) ────────────────────────────────────────────────────

export interface CandidateFile {
  readonly path: string;
  readonly layer: string;
  readonly sizeChars: number;
}

export interface CandidateFiles {
  readonly files: readonly CandidateFile[];                          // sorted by path
  readonly exclusions: Readonly<Record<ExclusionReason, number>>;
  readonly uncoveredFiles: readonly string[];
}

/** What the selector needs from a neuronal instruction (exclude globs come from the spec function). */
export interface CandidateInstruction {
  readonly excludePaths?: readonly string[];
}

/** Reads a file under `projectRoot` (real-path prefix check, CTX-02); `null` when unreadable or outside. */
function readUnderRoot(projectRoot: string, relPath: string): string | null {
  try {
    const rootReal = fs.realpathSync(projectRoot);
    const real = fs.realpathSync(path.join(rootReal, relPath));
    if (real !== rootReal && !real.startsWith(rootReal + path.sep)) return null;
    return fs.readFileSync(real, 'utf8');
  } catch {
    return null;
  }
}

function exclusionOf(
  file: { readonly path: string; readonly layer: string | null; readonly isBarrel: boolean },
  excludeRegexes: readonly RegExp[],
  head: string | null,
): ExclusionReason | null {
  if (file.layer === null) return 'unlayered';
  if (excludeRegexes.some((re) => re.test(file.path))) return 'exclude-paths';
  if (file.isBarrel) return 'barrel';
  const segments = file.path.split('/');
  const dirs = segments.slice(0, -1);
  if (dirs.some((s) => TEST_SEGMENTS.has(s))) return 'test-path';
  if ((segments[segments.length - 1] ?? '').endsWith('.e2e-spec.ts')) return 'e2e-spec';
  const prismaClient = dirs.some((s, i) => s === 'prisma' && dirs[i + 1] === 'client');
  if (dirs.includes('generated') || prismaClient) return 'generated-path';
  if (head !== null) {
    const lines = head.split(/\r?\n/, HEAD_LINES);
    if (lines.some((line) => GENERATED_MARKERS.some((m) => line.includes(m)))) return 'generated-marker';
  }
  return null;
}

/** BR-U4-SEL-01: filters the APG File nodes into candidates, counting each exclusion under its first reason. */
export function enumerateCandidates(
  view: JudgeGraphView,
  instruction: CandidateInstruction,
  projectRoot: string,
): CandidateFiles {
  const excludeRegexes = (instruction.excludePaths ?? []).map((g) => new RegExp(globToRegex(g)));
  const exclusions = emptyExclusions();
  const uncovered: string[] = [];
  const files: CandidateFile[] = [];
  for (const file of [...view.files].sort((a, b) => compareStrings(a.path, b.path))) {
    const needsHead = file.layer !== null;
    const content = needsHead ? readUnderRoot(projectRoot, file.path) : null;
    const reason = exclusionOf(file, excludeRegexes, content);
    if (reason !== null) {
      exclusions[reason]++;
      if (reason === 'unlayered') uncovered.push(file.path);
      continue;
    }
    files.push({ path: file.path, layer: file.layer ?? '', sizeChars: content?.length ?? 0 });
  }
  return { files, exclusions, uncoveredFiles: uncovered };
}

// ── File and class units (BR-U4-SEL-02) ──────────────────────────────────────────────────

export function buildFileUnits(candidates: CandidateFiles): readonly JudgeUnit[] {
  return candidates.files.map((f) => ({
    id: f.path, kind: 'file' as const, layer: f.layer, filePaths: [f.path], sizeTokens: tokensOf(f.sizeChars), singleFile: true,
  }));
}

/** Class units: Class nodes in candidate files, id `Class@file`; size is the file's (the class range is cut at Step 16). */
export function buildClassUnits(view: JudgeGraphView, candidates: CandidateFiles): readonly JudgeUnit[] {
  const byPath = new Map(candidates.files.map((f) => [f.path, f]));
  const units: JudgeUnit[] = [];
  for (const cls of view.classes) {
    const file = byPath.get(cls.file);
    if (file === undefined) continue;
    units.push({
      id: typeKey(cls), kind: 'class', layer: file.layer, filePaths: [file.path],
      sizeTokens: tokensOf(file.sizeChars), singleFile: true,
    });
  }
  return units.sort((a, b) => compareStrings(a.id, b.id));
}

// ── Mapped roots and module coalescing (BR-U4-SEL-03, BLM §4) ────────────────────────────

type GlobShape =
  | { readonly shape: 'P'; readonly root: string }
  | { readonly shape: 'S'; readonly prefix: readonly string[] }
  | { readonly shape: 'F' };

function isLiteral(segment: string): boolean {
  return !/[*?[{]/.test(segment);
}

/** BLM §4.1: P (literal directory prefix), S (wildcard then a literal directory segment), F (no literal directory segment). */
export function classifyGlob(glob: string): GlobShape {
  const trimmed = glob.replace(/^\.\//, '');
  const segments = trimmed.split('/').filter((s) => s !== '');
  let dirs: string[];
  if (trimmed.endsWith('/**')) dirs = segments.slice(0, -1);
  else if (trimmed.endsWith('/')) dirs = segments;
  else dirs = segments.slice(0, -1);
  const firstWildcard = dirs.findIndex((s) => !isLiteral(s));
  if (firstWildcard === -1) {
    return dirs.length > 0 ? { shape: 'P', root: dirs.join('/') } : { shape: 'F' };
  }
  const literalAfter = dirs.findIndex((s, i) => i > firstWildcard && isLiteral(s));
  if (literalAfter !== -1) return { shape: 'S', prefix: dirs.slice(0, literalAfter + 1) };
  return firstWildcard > 0 ? { shape: 'P', root: dirs.slice(0, firstWildcard).join('/') } : { shape: 'F' };
}

function segmentRegex(segment: string): RegExp {
  let out = '';
  for (const ch of segment) {
    if (ch === '*') out += '.*';
    else if (ch === '?') out += '.';
    else out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`);
}

/** Segment-wise glob match: `**` matches zero or more whole segments. */
function matchSegments(glob: readonly string[], target: readonly string[]): boolean {
  if (glob.length === 0) return target.length === 0;
  const [head, ...rest] = glob as [string, ...string[]];
  if (head === '**') {
    for (let i = 0; i <= target.length; i++) {
      if (matchSegments(rest, target.slice(i))) return true;
    }
    return false;
  }
  if (target.length === 0) return false;
  return segmentRegex(head).test(target[0] ?? '') && matchSegments(rest, target.slice(1));
}

function ancestorsOf(filePath: string): string[] {
  const dirs = filePath.split('/').slice(0, -1);
  const out: string[] = [];
  for (let i = 1; i <= dirs.length; i++) out.push(dirs.slice(0, i).join('/'));
  return out;
}

function dirnameOf(p: string): string {
  const i = p.lastIndexOf('/');
  return i === -1 ? '.' : p.slice(0, i);
}

function depthOf(dir: string): number {
  return dir === '.' ? 0 : dir.split('/').length;
}

/** Root of a file of a layer (BLM §4.1): the longest P/S ancestor root, else its own directory as a file root. */
function rootOf(filePath: string, shapes: readonly GlobShape[]): { readonly root: string; readonly fileRoot: boolean } {
  const ancestors = ancestorsOf(filePath);
  let best: string | null = null;
  for (const shape of shapes) {
    if (shape.shape === 'P') {
      if (filePath.startsWith(`${shape.root}/`) && (best === null || shape.root.length > best.length)) best = shape.root;
    } else if (shape.shape === 'S') {
      for (const dir of ancestors) {
        if (matchSegments(shape.prefix, dir.split('/')) && (best === null || dir.length > best.length)) best = dir;
      }
    }
  }
  return best === null ? { root: dirnameOf(filePath), fileRoot: true } : { root: best, fileRoot: false };
}

/** Coalesces the files of one root bottom-up (BLM §4.2); returns settled directory → files. */
function coalesce(root: string, files: readonly string[], fileRoot: boolean): Map<string, string[]> {
  const pending = new Map<string, string[]>();
  for (const file of files) {
    const dir = dirnameOf(file);
    const list = pending.get(dir) ?? [];
    list.push(file);
    pending.set(dir, list);
  }
  if (fileRoot) return pending;
  const done = new Set<string>();
  for (;;) {
    const next = [...pending.keys()]
      .filter((d) => !done.has(d))
      .sort((a, b) => depthOf(b) - depthOf(a) || compareStrings(a, b))[0];
    if (next === undefined) break;
    done.add(next);
    if (next === root) continue;
    const list = pending.get(next) ?? [];
    if (list.length < 2) {
      const parent = dirnameOf(next);
      pending.set(parent, [...(pending.get(parent) ?? []), ...list]);
      pending.delete(next);
    }
  }
  return pending;
}

/** Layer globs: directory globs, then file patterns (as the layer annotator reads them). */
function globsOf(layer: LayerDefinition): readonly string[] {
  return [...layer.directories, ...(layer.filePatterns ?? [])];
}

/**
 * BR-U4-SEL-03: module units of the candidates. Every candidate file is in exactly one module;
 * coalescing never crosses a layer or passes above a root; `#<layer>` ids when modules of
 * several layers settle in one directory.
 */
export function buildModuleUnits(candidates: CandidateFiles, layers: readonly LayerDefinition[]): readonly JudgeUnit[] {
  const shapesByLayer = new Map(layers.map((l) => [l.name, globsOf(l).map(classifyGlob)]));
  const sizeByPath = new Map(candidates.files.map((f) => [f.path, f.sizeChars]));
  // layer → root key → files
  const groups = new Map<string, Map<string, { root: string; fileRoot: boolean; files: string[] }>>();
  for (const file of candidates.files) {
    const { root, fileRoot } = rootOf(file.path, shapesByLayer.get(file.layer) ?? []);
    const byRoot = groups.get(file.layer) ?? new Map<string, { root: string; fileRoot: boolean; files: string[] }>();
    const key = `${fileRoot ? 'F' : 'R'}\u0000${root}`;
    const group = byRoot.get(key) ?? { root, fileRoot, files: [] };
    group.files.push(file.path);
    byRoot.set(key, group);
    groups.set(file.layer, byRoot);
  }
  // (dir, layer) → files
  const settled = new Map<string, { dir: string; layer: string; files: string[] }>();
  for (const [layer, byRoot] of groups) {
    for (const group of byRoot.values()) {
      for (const [dir, files] of coalesce(group.root, group.files, group.fileRoot)) {
        const key = `${dir}\u0000${layer}`;
        const entry = settled.get(key) ?? { dir, layer, files: [] };
        entry.files.push(...files);
        settled.set(key, entry);
      }
    }
  }
  const layersPerDir = new Map<string, Set<string>>();
  for (const { dir, layer } of settled.values()) {
    const set = layersPerDir.get(dir) ?? new Set<string>();
    set.add(layer);
    layersPerDir.set(dir, set);
  }
  const units: JudgeUnit[] = [];
  for (const { dir, layer, files } of settled.values()) {
    const filePaths = [...files].sort(compareStrings);
    const shared = (layersPerDir.get(dir)?.size ?? 0) > 1;
    units.push({
      id: shared ? `${dir}#${layer}` : dir,
      kind: 'module',
      layer,
      filePaths,
      sizeTokens: tokensOf(filePaths.reduce((sum, p) => sum + (sizeByPath.get(p) ?? 0), 0)),
      singleFile: filePaths.length === 1,
    });
  }
  return units.sort((a, b) => compareStrings(a.id, b.id));
}

/** Candidate set of one instruction (SEL-01..03): file, class or module units by `judgeUnit` (BR-U1-26). */
export function buildCandidateSet(
  view: JudgeGraphView,
  instruction: CandidateInstruction & { readonly judgeUnit: JudgeUnitKind },
  projectRoot: string,
  layers: readonly LayerDefinition[],
): CandidateSet {
  const candidates = enumerateCandidates(view, instruction, projectRoot);
  let units: readonly JudgeUnit[];
  if (instruction.judgeUnit === 'module') units = buildModuleUnits(candidates, layers);
  else if (instruction.judgeUnit === 'class') units = buildClassUnits(view, candidates);
  else units = buildFileUnits(candidates);
  return { kind: instruction.judgeUnit, units, exclusions: candidates.exclusions, uncoveredFiles: candidates.uncoveredFiles };
}

// ── Selection (BR-U4-SEL-04..07, BLM §5) ─────────────────────────────────────────────────

export interface SelectedUnit extends JudgeUnit {
  readonly origin?: 'addedByVariant';
}

export interface UnitSelection {
  readonly units: readonly SelectedUnit[];         // judged set, sorted by id
  readonly unitsCapped: number;
  readonly addedByVariant: readonly string[];      // sorted
  readonly removedByVariant: readonly string[];    // sorted
  readonly selection: BaselineSelection;           // persisted as neuralResults[].selection
}

/** `rank(u) = sha256_hex(seed ‖ "\0" ‖ unitId)` (SEL-04). */
export function rankOf(seed: string, unitId: string): string {
  return sha256Hex(`${seed}\u0000${unitId}`);
}

function roundRobin(units: readonly JudgeUnit[], seed: string, cap: number, picked: JudgeUnit[]): void {
  const taken = new Set(picked.map((u) => u.id));
  const layers = [...new Set(units.map((u) => u.layer))].sort(compareStrings);
  const queues = layers.map((layer) =>
    units
      .filter((u) => u.layer === layer && !taken.has(u.id))
      .map((u) => ({ unit: u, rank: rankOf(seed, u.id) }))
      .sort((a, b) => compareStrings(a.rank, b.rank) || compareStrings(a.unit.id, b.unit.id))
      .map((entry) => entry.unit),
  );
  while (picked.length < cap && queues.some((q) => q.length > 0)) {
    for (const queue of queues) {
      if (picked.length >= cap) break;
      const next = queue.shift();
      if (next !== undefined) picked.push(next);
    }
  }
}

/**
 * SEL-04 (seeded round-robin with cap), SEL-06 (seeded list, development only), SEL-07
 * (baseline reuse on a variant run). The judged set is returned in `unitId` order.
 */
export function selectUnits(units: readonly JudgeUnit[], rule: UnitSelectionRule, functionId: FunctionId): UnitSelection {
  const all = [...units].sort((a, b) => compareStrings(a.id, b.id));
  const candidateUnitIds = all.map((u) => u.id);
  const eligible = all.filter((u) => u.sizeTokens >= rule.minSizeTokens);

  if (rule.baseline !== undefined) {
    const selectedIds = new Set(rule.baseline.selectedUnitIds);
    const baselineCandidates = new Set(rule.baseline.candidateUnitIds);
    const chosen: SelectedUnit[] = [];
    for (const unit of eligible) {
      if (selectedIds.has(unit.id)) chosen.push(unit);
      else if (!baselineCandidates.has(unit.id)) chosen.push({ ...unit, origin: 'addedByVariant' });
    }
    const variantIds = new Set(candidateUnitIds);
    const removed = [...rule.baseline.selectedUnitIds].filter((id) => !variantIds.has(id)).sort(compareStrings);
    return {
      units: chosen,
      unitsCapped: all.length - chosen.length,
      addedByVariant: chosen.filter((u) => u.origin === 'addedByVariant').map((u) => u.id),
      removedByVariant: removed,
      selection: { functionId, candidateUnitIds, selectedUnitIds: chosen.map((u) => u.id), source: 'baseline' },
    };
  }

  const picked: JudgeUnit[] = [];
  if (rule.seededList.length > 0) {
    const byId = new Map(eligible.map((u) => [u.id, u]));
    for (const id of rule.seededList) {
      const unit = byId.get(id);
      if (unit !== undefined && picked.length < rule.cap && !picked.includes(unit)) picked.push(unit);
    }
  }
  roundRobin(eligible, rule.seed, rule.cap, picked);
  const chosen = [...picked].sort((a, b) => compareStrings(a.id, b.id));
  return {
    units: chosen,
    unitsCapped: all.length - chosen.length,
    addedByVariant: [],
    removedByVariant: [],
    selection: { functionId, candidateUnitIds, selectedUnitIds: chosen.map((u) => u.id), source: 'own' },
  };
}

/**
 * SEL-07: on a variant run (`baselines` given) every judged function needs its baseline row;
 * a missing row is a configuration error `LLM_BASELINE_SELECTION_MISSING`. Without baselines
 * the run selects on its own (`undefined`).
 */
export function resolveBaselineSelection(
  functionId: FunctionId,
  baselines: readonly BaselineSelection[] | undefined,
): DomainResult<BaselineSelection | undefined> {
  if (baselines === undefined) return DomainResult.ok(undefined);
  const row = baselines.find((b) => b.functionId === functionId);
  if (row === undefined) {
    return DomainResult.fail([{
      code: 'LLM_BASELINE_SELECTION_MISSING',
      message: `Baseline report has no selection row for ${String(functionId)}`,
      context: { functionId: String(functionId) },
    }]);
  }
  return DomainResult.ok(row);
}
