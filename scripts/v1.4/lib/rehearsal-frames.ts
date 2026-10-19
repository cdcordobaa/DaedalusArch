/**
 * Rehearsal frames and hashes (BUILD-L, REV-04 P16/P18; `fixtures/v1.3-rehearsal-tasks/README.md`).
 *
 * Writes, from the harness's own code (`scripts/lib/loop/style.ts`, `prompts.ts`, `rungs.ts`), the frame text each
 * rehearsal task's agent would read, so the hint audit runs on what the harness sends rather than on a copied frame:
 * - `hint-audit/frame-<task>.txt`: the L2 frame (style sentence and layout sentence), the format of the 2026-10-16 files;
 * - `hint-audit/frame-<task>.L3.txt`: the L3 frame (the same two sentences, then the L3 rule block of the task's static
 *   evaluator spec).
 * For `vineyard-harvest` (DDD) it also writes the static rehearsal spec `specs/vineyard-harvest.ddd.yaml`: the DDD
 * preset constrained to the task's two declared contexts with the loop's own constraint (`constrainDddSpec`, the
 * preset standing in for the ISE output, so no layer is inferred from any tree). It is a rehearsal spec, written by an
 * agent, for the author to approve (README "Before any run" item 4); it is not D15.
 * Last, `hashes.json`: the sha256 of `tasks.json`, of each task's compact `JSON.stringify(task)` (as
 * `Docs/v1.3/pilot-tasks.md` §5), of each frame file and of the DDD spec.
 *
 * Entry: `scripts/v1.4/rehearsal-frames.ts`. Pure apart from reading the repository; no model call, no Neo4j.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { frameExtrasLines } from '../../lib/loop/prompts.js';
import { taskFrameExtras } from '../../lib/loop/rungs.js';
import { constrainDddSpec } from '../../lib/loop/specs.js';
import { styleFrame } from '../../lib/loop/style.js';
import type { LoopContextDecl, LoopStyle } from '../../lib/loop/style.js';

export const REHEARSAL_DIR = 'fixtures/v1.3-rehearsal-tasks';
export const DDD_SPEC = `${REHEARSAL_DIR}/specs/vineyard-harvest.ddd.yaml`;

interface StyleEntry {
  readonly style: LoopStyle;
  readonly evaluatorSpec: string;
  readonly contexts?: readonly LoopContextDecl[];
}

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

/** The static DDD rehearsal spec text (module header). */
export function dddRehearsalSpec(repoRoot: string, contexts: readonly LoopContextDecl[]): string {
  const preset = fs.readFileSync(path.join(repoRoot, 'presets/ddd.yaml'), 'utf8');
  const { specYaml } = constrainDddSpec(preset, preset, contexts);
  const header = [
    '# Rehearsal spec for fixtures/v1.3-rehearsal-tasks vineyard-harvest (DDD; BUILD-L, 2026-10-19). Written by',
    '# scripts/v1.4/rehearsal-frames.ts: presets/ddd.yaml constrained to the declared contexts src/picking/ and',
    '# src/cellar/ (scripts/lib/loop/specs.ts constrainDddSpec, the preset standing in for the ISE output). Static: no',
    '# aggregate is declared. For the author to approve before any run; not the D15 decision.',
  ];
  // The constraint's own comment says "frozen after step 1"; this spec is static, so that line is replaced.
  const body = specYaml.split('\n').filter((l) => !l.includes('frozen after step 1')).join('\n');
  return `${header.join('\n')}\n${body}`;
}

export interface RehearsalFiles {
  /** Repository-relative path → content. */
  readonly files: ReadonlyMap<string, string>;
  readonly hashes: Record<string, string>;
}

/** Every file the script writes, and the hashes it prints. */
export function rehearsalFiles(repoRoot: string): RehearsalFiles {
  const tasksText = fs.readFileSync(path.join(repoRoot, REHEARSAL_DIR, 'tasks.json'), 'utf8');
  const tasks = (JSON.parse(tasksText) as { tasks: { id: string }[] }).tasks;
  const styles = (JSON.parse(fs.readFileSync(path.join(repoRoot, REHEARSAL_DIR, 'styles.json'), 'utf8')) as { tasks: Record<string, StyleEntry> }).tasks;
  const files = new Map<string, string>();
  const hashes: Record<string, string> = { 'tasks.json': sha256(tasksText) };
  for (const t of tasks) hashes[`task/${t.id}`] = sha256(JSON.stringify(t));
  for (const t of tasks) {
    const s = styles[t.id];
    if (s === undefined) throw new Error(`styles.json has no entry for ${t.id}`);
    const contexts = s.contexts ?? [];
    let specPath = s.evaluatorSpec;
    if (s.style === 'ddd') {
      const spec = dddRehearsalSpec(repoRoot, contexts);
      files.set(DDD_SPEC, spec);
      specPath = DDD_SPEC;
    }
    const frame = styleFrame(repoRoot, s.style, contexts);
    const l2 = `${frame.styleSentence}\n${frame.layoutSentence}\n`;
    const specText = files.get(specPath) ?? fs.readFileSync(path.join(repoRoot, specPath), 'utf8');
    const l3Lines = frameExtrasLines(taskFrameExtras('L3', false, { source: specPath, text: specText }).extras);
    files.set(`${REHEARSAL_DIR}/hint-audit/frame-${t.id}.txt`, l2);
    files.set(`${REHEARSAL_DIR}/hint-audit/frame-${t.id}.L3.txt`, `${l2}${l3Lines.join('\n')}\n`);
  }
  for (const [p, text] of [...files.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) hashes[p.slice(REHEARSAL_DIR.length + 1)] = sha256(text);
  return { files, hashes };
}
