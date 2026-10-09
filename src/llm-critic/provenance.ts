import type { LLMProvider } from '../shared/interfaces/llm-provider.js';
import type { JudgeProvenance, JudgeProviderName } from '../shared/types/evaluation.js';
import type { LLMEffort } from '../shared/interfaces/llm-provider.js';
import type { PipelineWarning } from '../shared/errors/domain-result.js';
import type { VCRMode } from '../shared/types/llm-config.js';
import { CassetteLLMProvider } from './cassette-provider.js';
import type { CassetteEntry } from './types.js';

/**
 * Judge provenance (U4 plan Step 23, U4-K7; BR-U4-CAS-10, OPS-06, SEL-06, ISO-09; DE §4.6;
 * BR-U3-63). Built once per run, after the critic has run, from the run's provider:
 *
 * - no provider (symbolic-only): exactly `{provider: 'none', model: 'none', runsPerUnit: 0}`, the
 *   shape of U3's `NO_JUDGE` stub, with no other key;
 * - record: `describe()` (provider, model, effort, `cliVersion` once C14 has run its pre-flight),
 *   the decorator's run provenance (`cliVersion` from `claude --version`, probe and listing
 *   hashes), `resolvedModel` from the entries this run used, `cassetteMode`, `runsPerUnit`,
 *   `repetition`, `seededList` (sorted);
 * - replay: every entry-borne field read from the entries used; when entries differ, the most
 *   frequent value (ties: lexicographically first) with `provenanceMixed: true`. Nothing is spawned:
 *   only `describe()` is read, which never runs a process.
 */

export interface JudgeRunFacts {
  readonly runsPerUnit: number;
  readonly repetition: number;
  readonly seededList: readonly string[];
}

const NONE: JudgeProvenance = Object.freeze({ provider: 'none', model: 'none', runsPerUnit: 0 });

function mostFrequent(values: readonly (string | undefined)[]): { value: string | undefined; mixed: boolean } {
  const counts = new Map<string, number>();
  for (const v of values) if (v !== undefined) counts.set(v, (counts.get(v) ?? 0) + 1);
  if (counts.size === 0) return { value: undefined, mixed: false };
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))[0];
  return { value: best?.[0], mixed: counts.size > 1 };
}

function isProviderName(value: string | undefined): value is JudgeProviderName {
  return value === 'claude-cli' || value === 'gemini' || value === 'agy' || value === 'mock' || value === 'null' || value === 'none';
}

function isEffort(value: string | undefined): value is LLMEffort {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'xhigh' || value === 'max';
}

/** `JudgeProvenance` of one run (BR-U4-CAS-10). */
export function judgeProvenanceOf(provider: LLMProvider | undefined, run?: JudgeRunFacts): JudgeProvenance {
  if (provider === undefined || run === undefined) return { ...NONE };
  const cassette = provider instanceof CassetteLLMProvider ? provider : undefined;
  const description = provider.describe();
  const mode: VCRMode = cassette?.mode ?? 'record';
  const entries: readonly CassetteEntry[] = cassette?.entriesUsed() ?? [];
  const seededList = [...run.seededList].sort();

  if (mode === 'replay' && entries.length > 0) {
    const providerName = mostFrequent(entries.map((e) => e.provider));
    const model = mostFrequent(entries.map((e) => e.model));
    const effort = mostFrequent(entries.map((e) => e.effort ?? undefined));
    const cliVersion = mostFrequent(entries.map((e) => e.cliVersion));
    const resolvedModel = mostFrequent(entries.map((e) => e.resolvedModel));
    const probe = mostFrequent(entries.map((e) => e.isolationProbeSha256));
    const listing = mostFrequent(entries.map((e) => e.configListingSha256));
    const repetition = mostFrequent(entries.map((e) => String(e.repetition)));
    const mixed = [providerName, model, effort, cliVersion, resolvedModel, probe, listing, repetition].some((f) => f.mixed);
    return {
      provider: isProviderName(providerName.value) ? providerName.value : description.provider,
      model: model.value ?? description.model,
      ...(isEffort(effort.value) ? { effort: effort.value } : {}),
      ...(cliVersion.value !== undefined ? { cliVersion: cliVersion.value } : {}),
      cassetteMode: 'replay',
      runsPerUnit: run.runsPerUnit,
      ...(resolvedModel.value !== undefined ? { resolvedModel: resolvedModel.value } : {}),
      repetition: repetition.value !== undefined ? Number(repetition.value) : run.repetition,
      ...(probe.value !== undefined ? { isolationProbeSha256: probe.value } : {}),
      ...(listing.value !== undefined ? { configListingSha256: listing.value } : {}),
      provenanceMixed: mixed,
      seededList,
    };
  }

  const fromRun = cassette?.runProvenance ?? {};
  const resolvedModel = mostFrequent(entries.map((e) => e.resolvedModel)).value;
  const cliVersion = fromRun.cliVersion ?? description.cliVersion;
  return {
    provider: description.provider,
    model: description.model,
    ...(description.effort !== undefined ? { effort: description.effort } : {}),
    ...(cliVersion !== undefined ? { cliVersion } : {}),
    cassetteMode: mode,
    runsPerUnit: run.runsPerUnit,
    ...(resolvedModel !== undefined ? { resolvedModel } : {}),
    repetition: run.repetition,
    ...(fromRun.isolationProbeSha256 !== undefined ? { isolationProbeSha256: fromRun.isolationProbeSha256 } : {}),
    ...(fromRun.configListingSha256 !== undefined ? { configListingSha256: fromRun.configListingSha256 } : {}),
    provenanceMixed: false,
    seededList,
  };
}

/** The warning that accompanies mixed replay provenance (BR-U4-CAS-10); `undefined` otherwise. */
export function provenanceWarning(judge: JudgeProvenance): PipelineWarning | undefined {
  if (judge.provenanceMixed !== true) return undefined;
  return {
    code: 'JUDGE_PROVENANCE_MIXED',
    stage: 'llm-critic',
    context: { provider: judge.provider, model: judge.model, ...(judge.cliVersion !== undefined ? { cliVersion: judge.cliVersion } : {}) },
    message: 'Replayed cassettes carry differing provenance values; the most frequent value of each field is reported',
  };
}
