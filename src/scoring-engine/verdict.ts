import type { OverallVerdict } from '../shared/types/enums.js';
import type { VerdictThresholds } from '../shared/types/spec.js';
import type { AHSScore } from '../shared/types/value-objects.js';

/**
 * Determine overall verdict based on AHS and thresholds.
 */
export function determineVerdict(ahs: AHSScore, thresholds: VerdictThresholds): OverallVerdict {
  const score = Number(ahs);
  if (score >= thresholds.pass) return 'pass';
  if (score >= thresholds.warning) return 'warning';
  if (score >= thresholds.softBlock) return 'soft-block';
  return 'hard-block';
}
