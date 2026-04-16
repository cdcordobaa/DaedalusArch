import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Violation } from '../shared/taxonomy/violation-types.js';
import type { BaselineEntry, BaselineSnapshot, BaselineResult } from '../shared/types/baseline.js';
import { DomainResult } from '../shared/errors/domain-result.js';

/**
 * Generate a stable key for a violation.
 * Uses ruleId + filePath + violationType — no line numbers (too volatile).
 */
export function generateKey(violation: Violation): string {
  const parts = [
    String(violation.functionId),
    violation.filePath,
    violation.type,
  ];
  return stableHash(parts.join('::'));
}

/**
 * Simple deterministic string hash (djb2 variant).
 * Returns a hex string for readability.
 */
function stableHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) & 0xffffffff;
  }
  // Convert to unsigned 32-bit hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Create a baseline snapshot from current violations.
 */
export function createBaseline(violations: readonly Violation[], specFile: string): BaselineSnapshot {
  const entries: BaselineEntry[] = violations.map((v) => ({
    key: generateKey(v),
    ruleId: v.functionId,
    filePath: v.filePath,
    severity: v.severity,
    description: v.message,
  }));

  return {
    version: '1.0',
    createdAt: new Date().toISOString(),
    specFile,
    totalViolations: entries.length,
    violations: entries,
  };
}

/**
 * Load a baseline snapshot from a JSON file.
 */
export function loadBaseline(filePath: string): DomainResult<BaselineSnapshot> {
  const absPath = path.resolve(filePath);

  if (!fs.existsSync(absPath)) {
    return DomainResult.fail<BaselineSnapshot>([{
      code: 'BASELINE_NOT_FOUND',
      message: `Baseline file not found: ${absPath}`,
    }]);
  }

  try {
    const content = fs.readFileSync(absPath, 'utf-8');
    const data = JSON.parse(content) as unknown;

    if (!isBaselineSnapshot(data)) {
      return DomainResult.fail<BaselineSnapshot>([{
        code: 'BASELINE_INVALID',
        message: `Invalid baseline format: missing required fields (version, violations)`,
      }]);
    }

    return DomainResult.ok(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return DomainResult.fail<BaselineSnapshot>([{
      code: 'BASELINE_PARSE_ERROR',
      message: `Failed to parse baseline file: ${msg}`,
    }]);
  }
}

/**
 * Save a baseline snapshot to a JSON file.
 */
export function saveBaseline(snapshot: BaselineSnapshot, filePath: string): DomainResult<void> {
  try {
    const absPath = path.resolve(filePath);
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(absPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');
    return DomainResult.ok(undefined);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return DomainResult.fail<void>([{
      code: 'BASELINE_WRITE_ERROR',
      message: `Failed to write baseline: ${msg}`,
    }]);
  }
}

/**
 * Compare current violations against a baseline.
 * Returns: baselineViolations (in baseline), newViolations (not in baseline),
 *          removedFromBaseline (fixed since baseline).
 */
export function compareBaseline(
  currentViolations: readonly Violation[],
  baseline: BaselineSnapshot,
  baselineFilePath: string,
): BaselineResult {
  const baselineKeySet = new Set(baseline.violations.map((e) => e.key));
  const currentKeyMap = new Map<string, Violation>();

  for (const v of currentViolations) {
    currentKeyMap.set(generateKey(v), v);
  }

  const baselineViolations: Violation[] = [];
  const newViolations: Violation[] = [];

  for (const v of currentViolations) {
    const key = generateKey(v);
    if (baselineKeySet.has(key)) {
      baselineViolations.push(v);
    } else {
      newViolations.push(v);
    }
  }

  // Removed = in baseline but not in current
  const currentKeySet = new Set(currentKeyMap.keys());
  const removedFromBaseline = baseline.violations.filter(
    (entry) => !currentKeySet.has(entry.key),
  );

  return {
    baselineViolations,
    newViolations,
    removedFromBaseline,
    baselineFilePath,
  };
}

/**
 * Type guard for BaselineSnapshot.
 */
function isBaselineSnapshot(data: unknown): data is BaselineSnapshot {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    obj['version'] === '1.0' &&
    typeof obj['createdAt'] === 'string' &&
    typeof obj['specFile'] === 'string' &&
    typeof obj['totalViolations'] === 'number' &&
    Array.isArray(obj['violations'])
  );
}
