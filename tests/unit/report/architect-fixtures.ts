/**
 * Shared loader of the architect HTML report reference variants (captured by scripts/v1.3/html-report-fixtures.ts).
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseSpec } from '../../../src/spec-parser/index.js';
import type { EvaluationReport } from '../../../src/shared/types/evaluation.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import type { ArchitectGraphInput, ArchitectReportInput } from '../../../src/report/architect/index.js';
import { STATUS_QUO_ANSWERS } from '../../../src/shared/construct-switches.js';

export const REPO_ROOT = resolve(__dirname, '../../..');
export const VARIANTS = ['correct-reference', 'variant-a-structural', 'variant-b-pattern'] as const;
export type Variant = (typeof VARIANTS)[number];

interface Fixture {
  readonly variant: Variant;
  readonly spec: string;
  readonly report: EvaluationReport;
  readonly graph: ArchitectGraphInput;
}

export function loadFixture(variant: Variant): Fixture {
  return JSON.parse(readFileSync(join(REPO_ROOT, 'tests/fixtures/html-report', `${variant}.json`), 'utf-8')) as Fixture;
}

let specCache: ParsedSpec | undefined;

export async function loadSpec(): Promise<ParsedSpec> {
  if (specCache !== undefined) return specCache;
  const parsed = await parseSpec({ specFilePath: join(REPO_ROOT, 'specs/clean-arch.yaml') });
  if (!parsed.success) throw new Error(parsed.errors.map((e) => e.message).join('; '));
  specCache = parsed.data;
  return specCache;
}

export async function reportInput(variant: Variant): Promise<ArchitectReportInput> {
  const fx = loadFixture(variant);
  return {
    report: fx.report,
    spec: await loadSpec(),
    graph: fx.graph,
    projectRoot: join(REPO_ROOT, 'fixtures', variant),
    projectName: variant,
    specPath: fx.spec,
    // The fixture reports were recorded at the construct status quo, before the answers were applied (ADR-V13-03 draft).
    constructAnswers: STATUS_QUO_ANSWERS,
  };
}
