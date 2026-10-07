/**
 * C16 golden regression cases (FR-30): the five fixture projects evaluated
 * against specs/clean-arch.yaml in symbolic-only mode.
 */
import * as path from 'node:path';
import type { EvaluationMode } from '../../src/shared/types/enums.js';

export interface GoldenCase {
  readonly id: string;
  readonly projectPath: string;
  readonly specPath: string;
  readonly mode: EvaluationMode;
}

export const REPO_ROOT = path.resolve(__dirname, '../..');

const SPEC_PATH = path.join(REPO_ROOT, 'specs', 'clean-arch.yaml');

const FIXTURE_IDS = [
  'correct-reference',
  'variant-a-structural',
  'variant-b-pattern',
  'variant-c-everything',
  'variant-d-subtle',
] as const;

export const GOLDEN_CASES: readonly GoldenCase[] = FIXTURE_IDS.map((id) => ({
  id,
  projectPath: path.join(REPO_ROOT, 'fixtures', id),
  specPath: SPEC_PATH,
  mode: 'symbolic-only' as const,
}));
