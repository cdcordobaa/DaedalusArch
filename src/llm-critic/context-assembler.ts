import type { NeuronalInstruction } from '../shared/types/evaluation.js';
import type { ContextPacket, TokenBudget } from './types.js';
import { DEFAULT_TOKEN_BUDGET } from './types.js';

/**
 * Assemble a context packet for LLM evaluation.
 * Truncates each section to its token budget (approximation: 1 token ≈ 4 chars).
 */
export function assembleContext(
  instruction: NeuronalInstruction,
  codeSnippet: string,
  apgSubgraph?: string,
  adrProse?: string,
  budget: TokenBudget = DEFAULT_TOKEN_BUDGET,
): ContextPacket {
  return {
    rule: instruction.semanticCriteria.rule,
    rubric: {
      pass: instruction.semanticCriteria.rubric.pass,
      fail: instruction.semanticCriteria.rubric.fail,
      evidenceRequired: instruction.semanticCriteria.rubric.evidenceRequired,
    },
    codeSnippet: truncateToTokens(codeSnippet, budget.codeSnippet),
    ...(apgSubgraph ? { apgSubgraph: truncateToTokens(apgSubgraph, budget.apgSubgraph) } : {}),
    ...(adrProse ? { adrProse: truncateToTokens(adrProse, budget.adrProse) } : {}),
  };
}

/**
 * Construct the evaluation prompt from a context packet.
 */
export function constructPrompt(context: ContextPacket): string {
  let prompt = `You are an architectural reviewer evaluating code compliance.

## Rule
${context.rule}

## Rubric
- PASS if: ${context.rubric.pass}
- FAIL if: ${context.rubric.fail}
- Evidence required: ${context.rubric.evidenceRequired}

## Source Code
\`\`\`typescript
${context.codeSnippet}
\`\`\``;

  if (context.apgSubgraph) {
    prompt += `\n\n## Architectural Graph Context\n\`\`\`json\n${context.apgSubgraph}\n\`\`\``;
  }

  if (context.adrProse) {
    prompt += `\n\n## ADR Context\n${context.adrProse}`;
  }

  prompt += `\n\n## Instructions
Evaluate the code against the rule and rubric above.
Return your verdict as JSON: { "pass": boolean, "confidence": 0.0-1.0, "reasoning": "...", "evidence": ["..."], "violations": [{"filePath": "...", "message": "..."}] }
Return ONLY the JSON object, no other text.`;

  return prompt;
}

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4; // rough approximation
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n... [truncated]';
}
