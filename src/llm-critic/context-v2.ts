/**
 * Judge v2 prompt (v1.3 development; see `judge-v2.ts`). v1's `constructPrompt` is untouched.
 *
 * The v2 prompt keeps v1's sections and order, swaps the rubric for the v2 text, replaces the JSON graph excerpt with
 * a rendered APG neighbourhood of the unit (`## Neighbourhood`) and adds `## Candidate flags` (the cheap proxies'
 * flags on the unit's files, labelled as unverified). Paths are root-relative, lists sorted, no timestamps (CTX-08).
 */
import type { CheapFlag } from '../apg-enrich/cheap/types.js';
import type { LayerDefinition } from '../shared/types/spec.js';
import { CHARS_PER_TOKEN, EXCERPT_EDGE_TYPES, TRUNCATION_MARKER } from './frozen.js';
import type { JudgeGraphView } from './judge-graph.js';
import { typeKey } from './judge-graph.js';
import { RUBRIC_OUT_OF_SCOPE } from './rubric.js';
import type { ContextPacket } from './types.js';
import {
  CANDIDATE_FLAGS_HEADER, JUDGE_V2_BUDGET, JUDGE_V2_FLAG_PROXIES, JUDGE_V2_MAX_FLAGS, PROMPT_INSTRUCTIONS_V2,
} from './judge-v2.js';

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function cutChars(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n${TRUNCATION_MARKER}`;
}

function list(items: readonly string[]): string {
  return items.length === 0 ? '(none)' : items.map((i) => `- ${i}`).join('\n');
}

/**
 * The unit's one-hop APG neighbourhood, per unit file: what it imports (files with their layer and layer kind,
 * packages by name), who imports it from outside the unit, and the injection, extension and implementation edges of
 * its classes. Same edge set as v1's excerpt (`EXCERPT_EDGE_TYPES`, literal view).
 */
export function renderNeighbourhood(
  unitFiles: readonly string[],
  view: JudgeGraphView,
  layers: readonly LayerDefinition[],
  maxChars: number = JUDGE_V2_BUDGET.neighbourhood * CHARS_PER_TOKEN,
): string {
  const kindOf = new Map(layers.map((l) => [l.name, l.kind ?? 'unspecified']));
  const fileLayer = new Map(view.files.map((f) => [f.path, f.layer]));
  const typeFile = new Map<string, string>();
  for (const t of [...view.classes, ...view.interfaces]) typeFile.set(typeKey(t), t.file);
  const describe = (key: string): string => {
    if (fileLayer.has(key)) {
      const layer = fileLayer.get(key) ?? null;
      return layer === null ? `${key} (unlayered)` : `${key} (layer ${layer}, kind ${kindOf.get(layer) ?? 'unspecified'})`;
    }
    const tf = typeFile.get(key);
    if (tf !== undefined) {
      const layer = fileLayer.get(tf) ?? null;
      const name = key.slice(0, key.indexOf('@'));
      return `${name} in ${tf}${layer === null ? ' (unlayered)' : ` (layer ${layer}, kind ${kindOf.get(layer) ?? 'unspecified'})`}`;
    }
    return `package ${key}`;
  };
  const members = new Set(unitFiles);
  const ownerOf = (key: string): string | undefined => (members.has(key) ? key : typeFile.get(key));
  const allowed = new Set<string>(EXCERPT_EDGE_TYPES);
  const blocks: string[] = [];
  for (const file of [...unitFiles].sort(compareStrings)) {
    const imports = new Set<string>();
    const importedBy = new Set<string>();
    const typed = new Set<string>();
    for (const e of view.edges) {
      if (!allowed.has(e.type)) continue;
      const fromOwner = ownerOf(e.from);
      const toOwner = ownerOf(e.to);
      if (e.type === 'IMPORTS' || e.type === 'RE_EXPORTS') {
        if (e.from === file && !members.has(e.to)) imports.add(`${e.type === 'RE_EXPORTS' ? 're-exports ' : ''}${describe(e.to)}`);
        if (e.to === file && !members.has(e.from)) importedBy.add(describe(e.from));
      } else if (fromOwner === file) {
        const verb = e.type === 'CONSTRUCTOR_INJECTS' ? 'injects' : e.type === 'FLOWS_TO' ? 'flows to' : e.type.toLowerCase();
        typed.add(`${e.from.slice(0, e.from.indexOf('@'))} ${verb} ${describe(e.to)}`);
      } else if (toOwner === file && fromOwner !== undefined && !members.has(fromOwner)) {
        const verb = e.type === 'CONSTRUCTOR_INJECTS' ? 'is injected into' : e.type === 'FLOWS_TO' ? 'receives flow from' : `is ${e.type.toLowerCase().replace(/s$/, '')}ed by`;
        typed.add(`${e.to.slice(0, e.to.indexOf('@'))} ${verb} ${describe(e.from)}`);
      }
    }
    const layer = fileLayer.get(file) ?? null;
    blocks.push([
      `${file}${layer === null ? ' (unlayered)' : ` (layer ${layer}, kind ${kindOf.get(layer) ?? 'unspecified'})`}`,
      `  imports: ${imports.size === 0 ? '(none)' : [...imports].sort(compareStrings).join('; ')}`,
      `  imported by: ${importedBy.size === 0 ? '(none)' : [...importedBy].sort(compareStrings).join('; ')}`,
      ...(typed.size === 0 ? [] : [`  types: ${[...typed].sort(compareStrings).join('; ')}`]),
    ].join('\n'));
  }
  return blocks.length === 0 ? '(none)' : cutChars(blocks.join('\n'), maxChars);
}

/** The cheap-proxy flags on the unit's files (either end of a two-ended flag), sorted and capped. */
export function candidateFlagsOf(unitFiles: readonly string[], flags: readonly CheapFlag[]): CheapFlag[] {
  const members = new Set(unitFiles);
  const proxies = new Set<string>(JUDGE_V2_FLAG_PROXIES);
  const key = (f: CheapFlag): string => `${f.evidence.file}\u0000${String(f.evidence.startLine).padStart(6, '0')}\u0000${f.proxy}\u0000${f.kind}\u0000${f.message}`;
  const seen = new Set<string>();
  return flags
    .filter((f) => proxies.has(f.proxy) && (members.has(f.evidence.file) || (f.related !== undefined && members.has(f.related.file))))
    .sort((a, b) => compareStrings(key(a), key(b)))
    .filter((f) => {
      const k = key(f);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

/**
 * Flag messages carry checker type text, which can hold absolute `import("/abs/.../node_modules/pkg/...")` paths. The
 * prompt keeps root-relative paths only (CTX-08): such an import becomes `import("pkg")`, any other absolute path `<abs>`.
 */
export function relativiseTypeText(text: string): string {
  return text
    .replace(/import\("[^"]*\/node_modules\/((?:@[^/"]+\/)?[^/"]+)[^"]*"\)/g, 'import("$1")')
    .replace(/import\("\/[^"]*"\)/g, 'import("<abs>")')
    .replace(/(^|[\s(])\/(?:Users|Volumes|private|home|tmp|var)\/\S*/g, '$1<abs>');
}

export function renderCandidateFlags(
  flags: readonly CheapFlag[],
  maxFlags: number = JUDGE_V2_MAX_FLAGS,
  maxChars: number = JUDGE_V2_BUDGET.candidateFlags * CHARS_PER_TOKEN,
): string {
  if (flags.length === 0) return `${CANDIDATE_FLAGS_HEADER}\n(none)`;
  const lines = flags.slice(0, maxFlags).map((f) => {
    const span = f.evidence.startLine === f.evidence.endLine ? String(f.evidence.startLine) : `${String(f.evidence.startLine)}-${String(f.evidence.endLine)}`;
    const related = f.related !== undefined ? ` [other end: ${f.related.file}:${String(f.related.startLine)}]` : '';
    return `- ${f.proxy}/${f.kind} at ${f.evidence.file}:${span}: ${relativiseTypeText(f.message)}${related}`;
  });
  if (flags.length > maxFlags) lines.push(`- (${String(flags.length - maxFlags)} more not shown)`);
  return `${CANDIDATE_FLAGS_HEADER}\n${cutChars(lines.join('\n'), maxChars)}`;
}

/** v2 extras of one unit. */
export interface V2PromptExtras {
  readonly neighbourhood: string;
  readonly candidateFlags: string;
}

/** Renders the v2 prompt: v1's sections with the v2 rubric (already in `context.rubric`) and the two v2 sections. */
export function constructPromptV2(context: ContextPacket, extras: V2PromptExtras): string {
  const sections: string[] = [
    `## Rule\n${context.rule}`,
    `## Rubric\nPass: ${context.rubric.pass}\nFail: ${context.rubric.fail}\nEvidence required: ${context.rubric.evidenceRequired}\n${RUBRIC_OUT_OF_SCOPE}`,
    `## Layer model\n${context.layerModel}`,
    `## Unit\nKind: ${context.unitKind}\nId: ${context.unitId}\nLayer: ${context.unitLayer}\nUnit files:\n${list(context.unitFiles)}`,
    `## Source\n${context.source}`,
  ];
  if (context.unitKind === 'module') {
    sections.push(
      `## Exported signatures\n${context.signatures ?? '(none)'}`,
      `## Incoming\n${list(context.incoming)}`,
      `## Outgoing\n${list(context.outgoing)}`,
    );
  }
  sections.push(`## Neighbourhood\n${extras.neighbourhood}`);
  sections.push(`## Candidate flags\n${extras.candidateFlags}`);
  if (context.adrProse !== undefined) sections.push(`## ADR context\n${context.adrProse}`);
  sections.push(`## Instructions\n${PROMPT_INSTRUCTIONS_V2}`);
  return `${sections.join('\n\n')}\n`;
}
