import type { NeuronalInstruction, NeuronalFunctionResult, NeuronalRun } from '../shared/types/evaluation.js';
import type { Violation } from '../shared/taxonomy/violation-types.js';
import type { PipelineWarning } from '../shared/errors/domain-result.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { confidence as makeConfidence, functionId as makeFunctionId } from '../shared/types/value-objects.js';
import type { NeuronalEvalInput, CriticVerdict } from './types.js';
import { DEFAULT_NEURONAL_OPTIONS } from './types.js';
import { assembleContext, constructPrompt } from './context-assembler.js';
import { parseVerdict } from './verdict-parser.js';
import { saveCassette, loadCassette } from './cassette-manager.js';

export interface NeuronalEvalOutput {
  readonly results: readonly NeuronalFunctionResult[];
  readonly warnings: readonly PipelineWarning[];
}

/**
 * Evaluate all neuronal instructions via LLM Critic.
 */
export async function evaluateNeuronal(input: NeuronalEvalInput): Promise<DomainResult<NeuronalEvalOutput>> {
  const opts = { ...DEFAULT_NEURONAL_OPTIONS, ...input };
  const results: NeuronalFunctionResult[] = [];
  const allWarnings: PipelineWarning[] = [];

  for (const instruction of input.instructions) {
    const result = await evaluateSingleFunction(instruction, input, opts);
    if (result.success) {
      results.push(result.data);
    } else {
      allWarnings.push({ code: 'CRITIC_001', message: `Evaluation failed for ${instruction.name}: ${result.errors[0]?.message}`, stage: 'llm-critic' });
    }
  }

  return DomainResult.ok({ results, warnings: allWarnings });
}

async function evaluateSingleFunction(
  instruction: NeuronalInstruction,
  input: NeuronalEvalInput,
  opts: Required<typeof DEFAULT_NEURONAL_OPTIONS> & NeuronalEvalInput,
): Promise<DomainResult<NeuronalFunctionResult>> {
  // Assemble context (simplified — real impl would query Neo4j for subgraph)
  const context = assembleContext(instruction, '// Source code placeholder — retrieved at runtime');
  const prompt = constructPrompt(context);

  const runs: NeuronalRun[] = [];
  const verdicts: CriticVerdict[] = [];
  const functionId = String(instruction.functionId);

  for (let i = 0; i < opts.runsPerEvaluation; i++) {
    let verdict: CriticVerdict | null = null;

    if (opts.vcrMode === 'replay') {
      const cassette = loadCassette(opts.cassettePath, functionId, i);
      if (cassette?.parsedVerdict) {
        verdict = cassette.parsedVerdict;
      }
    }

    if (!verdict) {
      const llmResult = await input.provider.evaluate(prompt, { temperature: 0, seed: 42, maxTokens: 1000 });
      if (!llmResult.success) {
        continue; // Run failed, use remaining runs
      }

      verdict = parseVerdict(llmResult.data.content);
      if (!verdict) {
        continue; // CRITIC_002 — parse failure
      }

      if (opts.vcrMode === 'record') {
        saveCassette(opts.cassettePath, {
          functionId,
          runIndex: i,
          prompt,
          response: llmResult.data.content,
          parsedVerdict: verdict,
          timestamp: new Date().toISOString(),
        });
      }
    }

    verdicts.push(verdict);
    runs.push({
      runIndex: i,
      verdict: verdict.pass ? 'pass' : 'fail',
      confidence: makeConfidence(verdict.confidence),
      reasoning: verdict.reasoning,
    });
  }

  if (verdicts.length < 2) {
    return DomainResult.fail([{
      code: 'INSUFFICIENT_VALID_RUNS',
      message: `Only ${verdicts.length} valid run(s) for ${instruction.name}`,
    }]);
  }

  // Compute stats
  const confidences = verdicts.map((v) => v.confidence);
  const meanConf = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  const stddev = Math.sqrt(confidences.reduce((sum, c) => sum + (c - meanConf) ** 2, 0) / confidences.length);

  // Majority vote for pass/fail
  const passCount = verdicts.filter((v) => v.pass).length;
  const overallPass = passCount > verdicts.length / 2;

  // Merge evidence and violations from all runs
  const allEvidence = [...new Set(verdicts.flatMap((v) => v.evidence))];
  let vIdx = 0;
  const allViolations: Violation[] = verdicts
    .flatMap((v) => v.violations)
    .map((cv) => ({
      id: `nv-${String(instruction.functionId)}-${++vIdx}`,
      type: (instruction.dimension === 'intent' ? 'INTENT_VIOLATION' : 'SEMANTIC_RULE_VIOLATION') as import('../shared/taxonomy/violation-types.js').ViolationType,
      dimension: instruction.dimension,
      severity: instruction.severity,
      functionId: makeFunctionId(String(instruction.functionId)),
      route: instruction.route as import('../shared/types/enums.js').Route,
      filePath: cv.filePath,
      message: cv.message,
      deterministic: false,
    }));

  // Deduplicate violations by filePath+message
  const uniqueViolations = deduplicateViolations(allViolations);

  return DomainResult.ok<NeuronalFunctionResult>({
    functionId: instruction.functionId,
    verdict: overallPass ? 'pass' : 'fail',
    confidence: makeConfidence(Math.round(meanConf * 1000) / 1000),
    confidenceStdDev: Math.round(stddev * 10000) / 10000,
    icc: 0, // Not computing ICC per Q4:B — using stddev
    reasoning: verdicts[0]?.reasoning ?? '',
    evidence: allEvidence,
    violations: uniqueViolations,
    runs,
    deterministic: false,
    flaggedUnstable: stddev > opts.unstableThreshold,
  });
}

function deduplicateViolations(violations: Violation[]): Violation[] {
  const seen = new Set<string>();
  return violations.filter((v) => {
    const key = `${v.filePath}:${v.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

