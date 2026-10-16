/**
 * Spec rungs of the loop frames (`Docs/v1.3/floor-escape-design-2026-10-16.md` §3.3), off by default.
 *
 * - L3: the frame states each blocking rule of the task's evaluator spec in one plain sentence (`prompts.ts`
 *   `ruleStatement`). The blocking rules are the spec's enabled symbolic fitness functions whose v1.3 tier
 *   (`src/scoring-engine/rule-tiers.ts`, at the spec's `architecture.style`) is blocking, in spec order, one sentence
 *   per rule name. This module reads tiers; it does not change them.
 * - L4: L3 plus the evaluator spec file itself, copied byte for byte into the cwd as `L4_SPEC_FILE` before the base
 *   commit (so it is part of the skeleton snapshot and never shows in a step diff; it does count in `treeFileCount`),
 *   and a file-read log: after every turn, whether the agent opened the file during the turn.
 *
 * File-read log method: the file's access time. Before each turn the harness sets the access time one minute before
 * the modification time (which also moves the change time to now), so under `relatime` (and `strictatime`) the first
 * read in the turn updates it. The snapshot git of an L4 run compares no change time (`core.trustctime=false`), so the
 * harness's own `git status` between attempts does not read the file. A self-test at run creation checks that the
 * file system updates access times; when it does not (`noatime`), `read` is recorded as null, never as false. A
 * "read" is any opening of the file's content during the turn (the agent's Read tool, a grep over the directory, …).
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ruleTier } from '../../../src/scoring-engine/rule-tiers.js';
import { L4_SPEC_FILE, ruleStatement } from './prompts.js';
import type { FrameExtras, SpecRung } from './prompts.js';

/** A blocking rule of a spec. */
export interface SpecBlockingRule {
  readonly id: string;
  readonly name: string;
}

interface SpecFunction {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly route?: unknown;
  readonly enabled?: unknown;
}

/** The blocking rules of a spec text (module header), in spec order, one per rule name. */
export function specBlockingRules(specText: string): readonly SpecBlockingRule[] {
  const doc = parseYaml(specText) as { architecture?: { style?: unknown }; fitness_functions?: unknown } | null;
  const style = typeof doc?.architecture?.style === 'string' ? doc.architecture.style : undefined;
  const fns = Array.isArray(doc?.fitness_functions) ? (doc.fitness_functions as SpecFunction[]) : [];
  const out: SpecBlockingRule[] = [];
  const names = new Set<string>();
  for (const f of fns) {
    if (typeof f.id !== 'string' || typeof f.name !== 'string') continue;
    if (f.enabled === false || (f.route !== undefined && f.route !== 'symbolic')) continue;
    if (ruleTier(f.id, style).tier !== 'blocking' || names.has(f.name)) continue;
    names.add(f.name);
    out.push({ id: f.id, name: f.name });
  }
  return out;
}

/** The L3 sentences of a spec text; throws when a blocking rule has no plain meaning (`RULE_PLAIN`). */
export function ruleSentences(specText: string): readonly string[] {
  const rules = specBlockingRules(specText);
  if (rules.length === 0) throw new Error('the spec has no blocking rule');
  return rules.map((r) => {
    const s = ruleStatement(r.name);
    if (s === undefined) throw new Error(`blocking rule ${r.id} ${r.name} has no plain meaning in RULE_PLAIN`);
    return s;
  });
}

/** The spec file an L4 run places in its cwd. */
export interface PlacedSpec {
  /** The spec as the plan names it (repository-relative or absolute). */
  readonly source: string;
  readonly text: string;
  readonly sha256: string;
}

/** A task's frame extras and, at L4, the spec placed in its cwd. */
export interface TaskFrameExtras {
  readonly extras: FrameExtras;
  readonly placedSpec?: PlacedSpec;
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** The frame extras of one task from its evaluator spec text (L2 needs no spec). */
export function taskFrameExtras(rung: SpecRung, attention: boolean, spec?: { readonly source: string; readonly text: string }): TaskFrameExtras {
  if (rung === 'L2') return { extras: { rung, ruleSentences: [], attention } };
  if (spec === undefined) throw new Error(`an ${rung} frame needs the task's evaluator spec`);
  const extras: FrameExtras = { rung, ruleSentences: ruleSentences(spec.text), attention };
  return rung === 'L4' ? { extras, placedSpec: { source: spec.source, text: spec.text, sha256: sha256(spec.text) } } : { extras };
}

/** Copies the spec into the cwd (before the base commit). */
export function placeSpec(cwd: string, spec: PlacedSpec): void {
  fs.writeFileSync(path.join(cwd, L4_SPEC_FILE), spec.text);
}

/** How the file-read log is taken: `atime` (module header), or `unavailable` when the file system does not update access times. */
export type ReadLogMethod = 'atime' | 'unavailable';

const PRIME_OFFSET_MS = 60_000;

/** Sets the file's access time before its modification time, so the next read updates it (module header). */
export function primeReadProbe(file: string): number {
  const st = fs.statSync(file);
  const atimeMs = Math.floor(st.mtimeMs - PRIME_OFFSET_MS);
  fs.utimesSync(file, new Date(atimeMs), st.mtime);
  return fs.statSync(file).atimeMs;
}

/** True when the file's access time moved past the primed value. */
export function wasRead(file: string, primedAtimeMs: number): boolean {
  return fs.statSync(file).atimeMs > primedAtimeMs;
}

/** Whether access times are updated on read in `dir` (a probe file is written, primed, read and removed). */
export function readLogMethod(dir: string): ReadLogMethod {
  const probe = path.join(dir, `.atime-probe-${String(process.pid)}`);
  try {
    fs.writeFileSync(probe, 'probe\n');
    const primed = primeReadProbe(probe);
    fs.readFileSync(probe);
    return wasRead(probe, primed) ? 'atime' : 'unavailable';
  } catch {
    return 'unavailable';
  } finally {
    fs.rmSync(probe, { force: true });
  }
}

/** One line of the file-read log (`spec-reads.jsonl`) and of the turn record. */
export interface SpecReadLog {
  readonly file: string;
  readonly method: ReadLogMethod;
  /** Opened during the turn; null when the method is unavailable or the file was gone. */
  readonly read: boolean | null;
  readonly present: boolean;
  /** Same bytes as the placed spec after the turn. */
  readonly intact: boolean;
}

/** Primes the probe before a turn; returns the check to run after it (before the snapshot commit). */
export function watchSpecRead(cwd: string, spec: PlacedSpec, method: ReadLogMethod): () => SpecReadLog {
  const file = path.join(cwd, L4_SPEC_FILE);
  let primed: number | null = null;
  try {
    if (method === 'atime') primed = primeReadProbe(file);
  } catch {
    primed = null;
  }
  return () => {
    const present = fs.existsSync(file);
    const read = method === 'atime' && primed !== null && present ? wasRead(file, primed) : null;
    // Hashing reads the file: done after the access-time check.
    const intact = present && sha256(fs.readFileSync(file, 'utf8')) === spec.sha256;
    return { file: L4_SPEC_FILE, method, read, present, intact };
  };
}
