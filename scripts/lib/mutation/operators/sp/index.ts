/**
 * The SP-* sensitivity probe set (ADR-015 item 10; ADR-016 b; Q12; BR-U5a-30).
 *
 * One probe per symbolic function `compileFunctions(compilerInputFromSpec(…))` compiles for `specs/clean-arch.yaml`,
 * plus FF-S03 (`no-layer-skip`) under the layered fixture spec, plus SP-DF01-ci (the constructor-injection branch of
 * `domain-state-purity`, FF-P06, which U3 adds; until then its rows list the template under `absentTemplates`).
 * Probes run with `split: 'probe'` on fixtures only and never count toward the golden set (BR-U5a-01). The probe
 * registry is separate from the catalogue registry (same `catalogueVersion`, the sha256 of
 * `Docs/operator-catalogue.md`). The §5 table of the catalogue is `renderProbeTable(probeEntries())`; its own hash
 * (`SP hash`) is the sha256 of that table text and is written on the line after the table, outside the hashed block.
 * Probes are frozen with the catalogue; they are never edited after the freeze (BR-U5a-30).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { DomainResult } from '../../../../../src/shared/errors/domain-result.js';
import { PROBE_TABLE_HEADER, renderProbeTable } from '../../catalogue-parser.js';
import type { ProbeEntry } from '../../catalogue-parser.js';
import { OperatorRegistry, catalogueVersionOf } from '../../registry.js';
import type { MutationOperator } from '../../types.js';
import { CATALOGUE_PATH } from '../index.js';
import type { SpProbe } from './common.js';
import { COUPLING_PROBES } from './coupling.js';
import { PATTERN_PROBES } from './pattern.js';
import { SOLID_CONVENTION_PROBES } from './solid-convention.js';
import { STRUCTURAL_PROBES } from './structural.js';

export type { SpProbe } from './common.js';

/** Function id of each probe's target template under its spec (clean-arch ids; FF-S03 layered; FF-P06 per U3 BR-U3-24). */
export const PROBE_TARGET_IDS: Readonly<Record<string, string>> = Object.freeze({
  'dependency-direction': 'FF-S01',
  'no-cyclic-deps': 'FF-S02',
  'no-layer-skip': 'FF-S03',
  'no-domain-outward-dep': 'FF-S04',
  'domain-purity': 'FF-P01',
  'dependency-inversion': 'FF-P02',
  'repository-pattern': 'FF-P03',
  'use-case-isolation': 'FF-P04',
  'controller-no-entity': 'FF-P05',
  'domain-state-purity': 'FF-P06',
  'domain-stability': 'FF-C01',
  'module-fan-out': 'FF-C02',
  'component-instability': 'FF-C03',
  'no-orphan-files': 'FF-C04',
  'max-fan-in': 'FF-C05',
  'abstraction-ratio': 'FF-C06',
  'single-responsibility-proxy': 'FF-SO01',
  'interface-segregation-proxy': 'FF-SO02',
  'inheritance-depth': 'FF-SO03',
  'naming-conventions': 'FF-CV01',
  'naming-services': 'FF-CV02',
  'naming-repos': 'FF-CV03',
  'naming-controllers': 'FF-CV04',
  'test-file-pairing': 'FF-CV05',
  'no-index-logic': 'FF-CV06',
});

/** The frozen probe set, catalogue §5 order. */
export const SP_PROBES: readonly SpProbe[] = Object.freeze([...STRUCTURAL_PROBES, ...PATTERN_PROBES, ...COUPLING_PROBES, ...SOLID_CONVENTION_PROBES]);

export const SP_OPERATORS: readonly MutationOperator[] = Object.freeze(SP_PROBES.map((p) => p.op));

function passCriterion(p: SpProbe, functionId: string): string {
  switch (p.declaredBy) {
    case 'cycle-collateral':
      return `${functionId} returns a new row with the declared cycle collateral key`;
    case 'project-metric':
      return `${functionId} returns a new violating project row (keyless project-metric entry)`;
    default:
      return `${functionId} returns a new row with the declared expected key`;
  }
}

/** Catalogue §5 rows of the probe set. */
export function probeEntries(): ProbeEntry[] {
  return SP_PROBES.map((p) => {
    const functionId = PROBE_TARGET_IDS[p.targetTemplate] ?? p.targetTemplate;
    const fixture = p.spec.startsWith('specs/') ? p.fixture : `${p.fixture} + ${p.spec}`;
    return { id: p.op.id, targetFunctionId: functionId, fixture, edit: p.edit, passCriterion: passCriterion(p, functionId) };
  });
}

/** The probe table block of a catalogue markdown (header row through the last table row, newline-terminated). */
export function probeTableText(markdown: string): string | undefined {
  const lines = markdown.split('\n');
  const header = `| ${PROBE_TABLE_HEADER.join(' | ')} |`;
  const start = lines.indexOf(header);
  if (start < 0) return undefined;
  let end = start;
  while (end + 1 < lines.length && (lines[end + 1] ?? '').startsWith('|')) end++;
  return lines.slice(start, end + 1).join('\n') + '\n';
}

/** SP hash = sha256 hex of the probe table text. */
export function spHashOf(tableText: string): string {
  return createHash('sha256').update(tableText, 'utf8').digest('hex');
}

/** The rendered §5 table and its hash. */
export function renderedProbeTable(): { readonly table: string; readonly hash: string } {
  const table = renderProbeTable(probeEntries());
  return { table, hash: spHashOf(table) };
}

/** A registry of the probe operators, frozen on return. */
export function buildProbeRegistry(catalogueVersion: string): OperatorRegistry {
  const registry = new OperatorRegistry(catalogueVersion);
  for (const op of SP_OPERATORS) {
    const r = registry.register(op);
    if (!r.success) throw new Error(`probe registration failed: ${r.errors.map((e) => e.message).join('; ')}`);
  }
  registry.freeze();
  return registry;
}

/** Reads `Docs/operator-catalogue.md` under `repoRoot` and builds the frozen probe registry with its sha256. */
export function loadProbeRegistry(repoRoot: string): DomainResult<OperatorRegistry> {
  const file = path.resolve(repoRoot, CATALOGUE_PATH);
  if (!fs.existsSync(file)) return DomainResult.fail([{ code: 'CAT_NOT_FOUND', message: `${CATALOGUE_PATH} not found` }]);
  return DomainResult.ok(buildProbeRegistry(catalogueVersionOf(fs.readFileSync(file))));
}
