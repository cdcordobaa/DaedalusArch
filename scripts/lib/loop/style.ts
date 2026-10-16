/**
 * Style slot of the loop prompts (v1.3 loop pilot; `Docs/v1.3/pilot-tasks.md` §3, `Docs/v1.3/loop-pilot-readiness.md`).
 *
 * A plan may give each task a target style (`clean | hexagonal | ddd`). The step frame then names that style with two
 * sentences instead of the fixed "Clean Architecture" wording:
 * - the style sentence of `pilot-tasks.md` §3, word for word (for DDD it names the plan's bounded contexts);
 * - a folder-layout sentence derived from the style's canonical preset (`presets/<style>.yaml`), the way the E1
 *   templates carry the Clean layout (`Docs/generator-protocol.md` §5): for Clean and Hexagonal, the preset's layer
 *   folders in preset order; for DDD, the per-context sub-folders of the preset's `src/*\/<folder>/**` globs and the
 *   composition-root file. Preset folders that are neither per-context nor the composition root (the DDD preset's
 *   `src/shared-kernel/**`) are not named: the pilot spec declares only the plan's contexts, and where the agent puts
 *   shared code is part of the step-4 pressure (`pilot-tasks.md` §3).
 *
 * A task with no style keeps the original frames byte for byte (`prompts.ts`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';

export type LoopStyle = 'clean' | 'hexagonal' | 'ddd';

export const LOOP_STYLES: readonly LoopStyle[] = Object.freeze(['clean', 'hexagonal', 'ddd']);

/** The canonical preset each style's layout sentence is derived from (repository-relative). */
export const STYLE_PRESETS: Readonly<Record<LoopStyle, string>> = Object.freeze({
  clean: 'presets/clean-architecture.yaml',
  hexagonal: 'presets/hexagonal.yaml',
  ddd: 'presets/ddd.yaml',
});

/** A bounded context of a DDD task: its root folder and the part of the system it holds (plain words). */
export interface LoopContextDecl {
  /** `src/<name>/`. */
  readonly root: string;
  /** E.g. "the volunteer registry". */
  readonly part: string;
}

/** What the step frames say about the style. */
export interface StyleFrame {
  readonly style: LoopStyle;
  /** First-step sentence (`pilot-tasks.md` §3). */
  readonly styleSentence: string;
  /** Later steps: "follow the architecture the project already uses (<styleName>)". */
  readonly styleName: string;
  /** Folder layout derived from the style's preset. */
  readonly layoutSentence: string;
}

export const CONTEXT_ROOT_RE = /^src\/[a-z0-9][a-z0-9-]*\/$/;

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** "a", "a and b", "a, b and c". */
export function joinAnd(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`;
}

function contextClause(contexts: readonly LoopContextDecl[]): string {
  return joinAnd(contexts.map((c) => `${c.root} for ${c.part}`));
}

export function styleSentence(style: LoopStyle, contexts: readonly LoopContextDecl[] = []): string {
  switch (style) {
    case 'clean':
      return 'Organise the code following Clean Architecture.';
    case 'hexagonal':
      return 'Organise the code following Hexagonal Architecture (ports and adapters).';
    case 'ddd':
      return `Organise the code following Domain-Driven Design, with one bounded context per part: ${contextClause(contexts)}.`;
  }
}

export function styleName(style: LoopStyle, contexts: readonly LoopContextDecl[] = []): string {
  switch (style) {
    case 'clean':
      return 'Clean Architecture';
    case 'hexagonal':
      return 'Hexagonal Architecture, ports and adapters';
    case 'ddd':
      return `Domain-Driven Design, one bounded context per part: ${contextClause(contexts)}`;
  }
}

interface PresetLayerDirs {
  readonly name: string;
  readonly directories: readonly string[];
}

const COMPOSITION = new Set(['config', 'composition']);

/** The `architecture.layers[*].directories` of a preset text, in preset order. */
export function presetLayerDirs(presetText: string): readonly PresetLayerDirs[] {
  const doc = parseYaml(presetText) as { architecture?: { layers?: { name?: unknown; directories?: unknown }[] } } | null;
  const layers = doc?.architecture?.layers;
  if (!Array.isArray(layers)) throw new Error('preset has no architecture.layers');
  return layers.map((l) => ({
    name: String(l.name),
    directories: Array.isArray(l.directories) ? l.directories.map(String) : [],
  }));
}

/**
 * The folder-layout sentence of a style, from its preset text. Clean reproduces the E1 sentence exactly:
 * "Organise the source code under src/ in exactly three folders: src/domain, src/application and src/infrastructure."
 */
export function layoutSentence(style: LoopStyle, presetText: string, contexts: readonly LoopContextDecl[] = []): string {
  const layers = presetLayerDirs(presetText);
  if (style !== 'ddd') {
    const folders: string[] = [];
    for (const l of layers) {
      for (const d of l.directories) {
        const m = /^(src\/[A-Za-z0-9/_-]+)\/\*\*$/.exec(d);
        if (m === null) throw new Error(`${style} preset: layer ${l.name} folder ${d} is not a plain src/<dir>/** glob`);
        folders.push(m[1] ?? '');
      }
    }
    const n = NUMBER_WORDS[folders.length] ?? String(folders.length);
    return `Organise the source code under src/ in exactly ${n} folders: ${joinAnd(folders)}.`;
  }
  const perContext: string[] = [];
  const rootFiles: string[] = [];
  for (const l of layers) {
    for (const d of l.directories) {
      const m = /^src\/\*\/([A-Za-z0-9_-]+)\/\*\*$/.exec(d);
      if (m !== null) perContext.push(m[1] ?? '');
      else if (COMPOSITION.has(l.name) && /^src\/[A-Za-z0-9_-]+\.ts$/.test(d)) rootFiles.push(d);
    }
  }
  const example = contexts[0] !== undefined && perContext[0] !== undefined ? ` (for example ${contexts[0].root}${perContext[0]})` : '';
  const composition = rootFiles.length > 0 ? `, and put the composition root in ${joinAnd(rootFiles)}` : '';
  return `Inside each bounded context folder, organise the source code in the folders ${joinAnd(perContext)}${example}${composition}.`;
}

/** The frame of a style, reading its preset from the repository. */
export function styleFrame(repoRoot: string, style: LoopStyle, contexts: readonly LoopContextDecl[] = []): StyleFrame {
  const presetText = fs.readFileSync(path.resolve(repoRoot, STYLE_PRESETS[style]), 'utf8');
  return {
    style,
    styleSentence: styleSentence(style, contexts),
    styleName: styleName(style, contexts),
    layoutSentence: layoutSentence(style, presetText, contexts),
  };
}
