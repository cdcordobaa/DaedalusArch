import type { FunctionId } from './value-objects.js';
import type { Severity } from './enums.js';
import type { Violation } from '../taxonomy/violation-types.js';

export type BaselineStatus = 'baseline' | 'new' | 'none';

export interface BaselineEntry {
  readonly key: string;
  readonly ruleId: FunctionId;
  readonly filePath: string;
  readonly severity: Severity;
  readonly description: string;
}

export interface BaselineSnapshot {
  readonly version: '1.0';
  readonly createdAt: string;
  readonly specFile: string;
  readonly totalViolations: number;
  readonly violations: readonly BaselineEntry[];
}

export interface BaselineResult {
  readonly baselineViolations: readonly Violation[];
  readonly newViolations: readonly Violation[];
  readonly removedFromBaseline: readonly BaselineEntry[];
  readonly baselineFilePath: string;
}
