import type { NeuronalInstruction } from '../shared/types/evaluation.js';
import type { LayerDefinition } from '../shared/types/spec.js';
import type { ContextPacket, TokenBudget } from './types.js';
import { DEFAULT_TOKEN_BUDGET } from './types.js';
import { CHARS_PER_TOKEN, PROMPT_INSTRUCTIONS, TRUNCATION_MARKER } from './frozen.js';
import { RUBRIC_OUT_OF_SCOPE } from './rubric.js';
import type { JudgeUnit } from './judge-unit-selector.js';
import type { UnitSourceContext } from './source-context.js';
import { EMPTY_EXCERPT } from './source-context.js';

/**
 * Context packet and frozen prompt template (BR-U4-CTX-06, CTX-07, CTX-08).
 *
 * The layer model comes only from the evaluation spec's layers (CTX-07); the prompt holds
 * root-relative paths, sorted lists, no timestamps and no absolute root (CTX-08).
 */

export interface UnitPromptInput {
  readonly unit: Pick<JudgeUnit, 'id' | 'kind' | 'layer' | 'filePaths'>;
  readonly context: UnitSourceContext;
  readonly evaluatorSpecLayers: readonly LayerDefinition[];
}

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n${TRUNCATION_MARKER}`;
}

/** Layer model section (CTX-07): each layer's name, kind and globs, in spec order. */
export function renderLayerModel(layers: readonly LayerDefinition[]): string {
  if (layers.length === 0) return '(none)';
  return layers
    .map((l) => {
      const patterns = l.filePatterns ?? [];
      const files = patterns.length > 0 ? `; file patterns: ${patterns.join(', ')}` : '';
      return `- ${l.name} (kind: ${l.kind ?? 'unspecified'}): ${l.directories.join(', ')}${files}`;
    })
    .join('\n');
}

/** Builds the context packet of one unit (DE §3.3). */
export function assembleContext(
  instruction: NeuronalInstruction,
  unitContext: UnitPromptInput,
  adrProse?: string,
  budget: TokenBudget = DEFAULT_TOKEN_BUDGET,
): ContextPacket {
  const { unit, context } = unitContext;
  return {
    rule: instruction.semanticCriteria.rule,
    rubric: {
      pass: instruction.semanticCriteria.rubric.pass,
      fail: instruction.semanticCriteria.rubric.fail,
      evidenceRequired: instruction.semanticCriteria.rubric.evidenceRequired,
    },
    layerModel: renderLayerModel(unitContext.evaluatorSpecLayers),
    unitId: unit.id,
    unitKind: unit.kind,
    unitLayer: unit.layer,
    unitFiles: [...unit.filePaths].sort(),
    source: context.source,
    ...(context.signatures !== undefined ? { signatures: context.signatures } : {}),
    incoming: context.incoming,
    outgoing: context.outgoing,
    apgSubgraph: context.subgraphExcerpt === '' ? EMPTY_EXCERPT : context.subgraphExcerpt,
    ...(adrProse !== undefined && adrProse !== '' ? { adrProse: truncateToTokens(adrProse, budget.adrProse) } : {}),
  };
}

function list(items: readonly string[]): string {
  return items.length === 0 ? '(none)' : items.map((i) => `- ${i}`).join('\n');
}

/** Renders the frozen prompt template (CTX-06), sections in their fixed order. */
export function constructPrompt(context: ContextPacket): string {
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
  sections.push(`## Graph excerpt\n${context.apgSubgraph}`);
  if (context.adrProse !== undefined) sections.push(`## ADR context\n${context.adrProse}`);
  sections.push(`## Instructions\n${PROMPT_INSTRUCTIONS}`);
  return `${sections.join('\n\n')}\n`;
}
