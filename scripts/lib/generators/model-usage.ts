/**
 * Pre-registered model-usage rule (FR-v1.2E-28; SO5; Q18; BR-U5a-47). Unchanged after E1 starts.
 *
 * A run is model-valid when the pinned id is a key of `modelUsage` and has the largest share of output tokens,
 * read strictly: its `outputTokens` exceed every other key's (a tie is not "the largest" and fails, the conservative
 * reading). Every other key goes to `auxiliaryModels[]` (`id`, `outputTokens`; sorted by id; missing tokens = 0)
 * without failing the run. Otherwise the verdict is invalid with `pinned-absent`, `pinned-not-dominant` or
 * `no-model-usage` (no or empty `modelUsage`); the outcome maps any invalid verdict to `failed-agent`, reason
 * `model-mismatch` (BR-U5a-48 order row 5).
 */
import type { AuxiliaryModel, CliEnvelopeSummary, ModelUsageVerdict } from './types.js';

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function judgeModelUsage(pinned: string, env: CliEnvelopeSummary): ModelUsageVerdict {
  const usage = env.modelUsage ?? {};
  const ids = Object.keys(usage).sort(cmp);
  const tokens = (id: string): number => usage[id]?.outputTokens ?? 0;
  const auxiliaryModels: AuxiliaryModel[] = ids
    .filter((id) => id !== pinned)
    .map((id) => ({ id, outputTokens: tokens(id) }));
  if (ids.length === 0) return { valid: false, reason: 'no-model-usage', auxiliaryModels };
  if (!ids.includes(pinned)) return { valid: false, reason: 'pinned-absent', auxiliaryModels };
  const mine = tokens(pinned);
  if (auxiliaryModels.some((a) => a.outputTokens >= mine)) {
    return { valid: false, reason: 'pinned-not-dominant', auxiliaryModels };
  }
  return { valid: true, resolvedModelId: pinned, auxiliaryModels };
}
