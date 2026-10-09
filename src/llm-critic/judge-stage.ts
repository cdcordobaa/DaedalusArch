import * as fs from 'node:fs';
import type { LLMProvider } from '../shared/interfaces/llm-provider.js';
import type { LLMProviderConfig } from '../shared/types/llm-config.js';
import type { CompiledFunctions, JudgeProvenance, NeuralResultRow } from '../shared/types/evaluation.js';
import type { EvaluationMode } from '../shared/types/enums.js';
import type { ParsedSpec } from '../shared/types/spec.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { DEFAULT_CASSETTE_DIR, JUDGE_EFFORT, JUDGE_MAX_TOKENS, JUDGE_MODEL } from './frozen.js';
import { sha256Hex } from './canonical-json.js';
import { knownSecretsFrom } from './cassette-provider.js';
import type { CassetteLLMProvider } from './cassette-provider.js';
import { clearRunManifest, writeRunManifest } from './cassette-manager.js';
import { ClaudeCliProvider } from './claude-cli-provider.js';
import type { NeuronalEvalOutput } from './llm-critic.js';
import { readBaselineSelections, toNeuralResultRows } from './neural-result-rows.js';
import { judgeProvenanceOf, provenanceWarning } from './provenance.js';
import { wrapJudgeProvider } from './provider-factory.js';
import type { JudgeRunSettings, NeuronalRunOptions, RunCompleteness, RunManifest } from './types.js';
import { DEFAULT_NEURONAL_RUN_OPTIONS } from './types.js';

/**
 * The judge stage of a pipeline run (U4 plan Step 25, C9 hunks; BR-U4-AGG-03, SEL-07, CAS-10,
 * ISO-04, ISO-09; D-U4-8). The U3-owned evaluation commands call it around the router or the
 * critic: `prepareJudgeStage` wraps the provider once (record-mode C14 pre-flight: a failure is
 * `LLM_CLI_ISOLATION` or `LLM_CLI_VERSION_DRIFT`, exit 2), reads the baseline selections
 * (`LLM_BASELINE_SELECTION_MISSING`, exit 2) and derives the critic options from the parsed spec;
 * `finishJudgeStage` writes the `RunManifest` and fails with `JUDGE_RUN_INCOMPLETE` (exit 3, no
 * report) for an incomplete run, otherwise clears it and records the output and the provenance
 * that the report assembly reads (`neuralRowsOf`, `holder.judge`); mixed replay provenance comes
 * back as the `JUDGE_PROVENANCE_MIXED` warning (BR-U4-CAS-10). The commands call
 * `disposeJudgeProvider` in a `finally`, so the C14 neutral cwd is removed on every path (ISO-05),
 * and call `prepareJudgeStage` only when `judgeStageNeeded` (no pre-flight for a run without
 * neural work).
 */

/** Filled by the evaluation command; read by `AssembleReportCommand` at assembly time. */
export interface JudgeRunHolder {
  provider?: CassetteLLMProvider;
  output?: NeuronalEvalOutput;
  judge?: JudgeProvenance;
}

export interface JudgeStageSettings {
  readonly projectRoot: string;              // absolute
  readonly specSha: string;                  // manifest key part (DE §4.7)
  readonly run: JudgeRunSettings;
  readonly knownSecrets: readonly string[];
  readonly holder: JudgeRunHolder;
}

export interface PreparedJudgeStage {
  readonly provider: CassetteLLMProvider;
  readonly options: Partial<NeuronalRunOptions>;
  readonly excludePaths: Readonly<Record<string, readonly string[]>>;
}

export const JUDGE_RUN_INCOMPLETE = 'JUDGE_RUN_INCOMPLETE';

/**
 * The scrubber's known secrets for a pipeline run (BR-U4-CAS-07): the values of parent-env
 * variables named /KEY|TOKEN|SECRET|PASSWORD/i, united with the Neo4j scrub policy's secrets
 * (password, URI, host:port). Deduplicated and sorted.
 */
export function judgeKnownSecrets(policySecrets: readonly string[], env: NodeJS.ProcessEnv = process.env): readonly string[] {
  return [...new Set([...knownSecretsFrom(env), ...policySecrets])].sort();
}

/** Whether the mode-filtered run has neural work (neuronal instructions, or hybrid pairs in full mode). */
export function judgeStageNeeded(compiled: CompiledFunctions, mode: EvaluationMode): boolean {
  if (mode === 'symbolic-only') return false;
  if (compiled.neuronalInstructions.length > 0) return true;
  return mode === 'full' && compiled.hybridPairs.length > 0;
}

/** Removes the C14 neutral cwd of a Claude CLI inner provider (ISO-05); idempotent, a no-op otherwise. */
export function disposeJudgeProvider(inner: LLMProvider): void {
  if (inner instanceof ClaudeCliProvider) inner.dispose();
}

/** The run settings carried by a `parseLLMOptions` result, else the frozen defaults on the config's cassette. */
export function judgeRunSettingsOf(config: LLMProviderConfig | undefined): JudgeRunSettings {
  const run = (config as (LLMProviderConfig & { readonly run?: JudgeRunSettings }) | undefined)?.run;
  if (run !== undefined) return run;
  return {
    llm: { model: JUDGE_MODEL, effort: JUDGE_EFFORT, maxTokens: JUDGE_MAX_TOKENS },
    repetition: 0,
    cassette: { mode: config?.cassette.mode ?? 'record', dir: config?.cassette.dir ?? DEFAULT_CASSETTE_DIR, omitPrompt: false },
  };
}

/** sha256 of the spec file bytes (manifest key, DE §4.7); `''` when the file cannot be read. */
export function specShaOf(specFilePath: string): string {
  try {
    return sha256Hex(fs.readFileSync(specFilePath, 'utf8'));
  } catch {
    return '';
  }
}

export async function prepareJudgeStage(
  inner: LLMProvider,
  settings: JudgeStageSettings,
  spec: ParsedSpec | undefined,
): Promise<DomainResult<PreparedJudgeStage>> {
  const { run } = settings;
  const wrapped = await wrapJudgeProvider(inner, run.cassette, {
    omitPrompt: run.cassette.omitPrompt, knownSecrets: settings.knownSecrets,
    // ADR-021 SO3-5: the project id keys judge repetition reliability; unit ids alone repeat across projects.
    ...(run.cassette.projectId !== undefined ? { projectId: run.cassette.projectId } : {}),
  });
  if (!wrapped.success) return DomainResult.fail(wrapped.errors);

  let baseline: NeuronalRunOptions['baseline'];
  if (run.baselineReport !== undefined) {
    const read = readBaselineSelections(run.baselineReport);
    if (!read.success) return DomainResult.fail(read.errors);
    baseline = read.data;
  }

  const excludePaths: Record<string, readonly string[]> = {};
  for (const fn of spec?.fitnessFunctions ?? []) {
    if (fn.excludePaths.length > 0) excludePaths[String(fn.id)] = fn.excludePaths;
  }
  settings.holder.provider = wrapped.data;
  return DomainResult.ok({
    provider: wrapped.data,
    options: {
      llm: run.llm,
      repetition: run.repetition,
      cassette: run.cassette,
      ...(baseline !== undefined ? { baseline } : {}),
      evaluatorSpecLayers: spec?.layerModel.layers ?? [],
    },
    excludePaths,
  });
}

export function finishJudgeStage(
  settings: JudgeStageSettings,
  provider: CassetteLLMProvider,
  outcome: { readonly output?: NeuronalEvalOutput; readonly completeness: RunCompleteness; readonly manifest?: RunManifest },
): DomainResult<void> {
  const { run, holder } = settings;
  disposeJudgeProvider(provider.innerProvider);
  if (outcome.completeness.status === 'incomplete') {
    const manifest: RunManifest = outcome.manifest ?? {
      projectRoot: settings.projectRoot, stop: outcome.completeness.stop, message: 'judge run incomplete', completedCalls: 0, outstanding: [],
    };
    const file = writeRunManifest(run.cassette.dir, settings.projectRoot, settings.specSha, manifest);
    return DomainResult.fail([{
      code: JUDGE_RUN_INCOMPLETE,
      message: `Judge run incomplete (${outcome.completeness.stop}): ${String(outcome.completeness.outstanding)} call(s) outstanding; `
        + `manifest ${file}; rerun in record mode to resume. No report is written.`,
      context: { stop: outcome.completeness.stop, outstanding: outcome.completeness.outstanding },
    }]);
  }
  clearRunManifest(run.cassette.dir, settings.projectRoot, settings.specSha);
  if (outcome.output !== undefined) holder.output = outcome.output;
  holder.judge = judgeProvenanceOf(provider, {
    runsPerUnit: DEFAULT_NEURONAL_RUN_OPTIONS.runsPerEvaluation, repetition: run.repetition, seededList: DEFAULT_NEURONAL_RUN_OPTIONS.seededList,
  });
  const mixed = provenanceWarning(holder.judge);
  return DomainResult.ok(undefined, mixed !== undefined ? [mixed] : undefined);
}

/** `neuralResults[]` for U3's builder (BR-U3-65): the rows of the recorded output, `[]` when no neural half ran. */
export function neuralRowsOf(holder: JudgeRunHolder): readonly NeuralResultRow[] {
  return toNeuralResultRows(holder.output?.results ?? []);
}
