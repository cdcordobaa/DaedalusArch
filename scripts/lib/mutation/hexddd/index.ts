/**
 * The hexagonal and DDD operator registry (v1.3 DRAFT; `Docs/v1.3/operator-catalogue-hexddd.md`).
 *
 * A separate registry from the frozen catalogue (`operators/index.ts`) and from the anti-pattern one: its
 * `catalogueVersion` is the sha256 of the v1.3 hexagonal/DDD catalogue, read from an explicit `repoRoot`, so no row of
 * these operators can carry another catalogue's version. Twenty-five entries (twelve positives, thirteen twins), in
 * catalogue order. A unit test asserts that the registry and the catalogue table match one to one.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import { OperatorRegistry, catalogueVersionOf } from '../registry.js';
import type { MutationOperator } from '../types.js';
import { DDD_OPERATORS } from './ddd.js';
import { HEXAGONAL_OPERATORS } from './hexagonal.js';

export const HEXDDD_CATALOGUE_PATH = 'Docs/v1.3/operator-catalogue-hexddd.md';

export const HEXDDD_OPERATORS: readonly MutationOperator[] = Object.freeze([...HEXAGONAL_OPERATORS, ...DDD_OPERATORS]);

/**
 * The style each operator is run under in the v1.3 measurement: the hexagonal operators on `hexagonal` specs, the
 * three whose rules the `ddd` library also composes (`dependency-direction-graph`, `domain-purity`) on `ddd` specs too,
 * the DDD operators on `ddd` specs.
 */
export const HEXDDD_STYLES: Readonly<Record<string, readonly ('hexagonal' | 'ddd')[]>> = Object.freeze({
  'MO-H01': ['hexagonal', 'ddd'],
  'MO-H02': ['hexagonal', 'ddd'],
  'MO-H03': ['hexagonal'],
  'MO-H04': ['hexagonal'],
  'MO-H05': ['hexagonal', 'ddd'],
  'MO-H06': ['hexagonal'],
  'MO-H07': ['hexagonal'],
  'MO-D01': ['ddd'],
  'MO-D02': ['ddd'],
  'MO-D03': ['ddd'],
  'MO-D05': ['ddd'],
  'MO-D06': ['ddd'],
});

/** The positive an entry belongs to (`MO-H01n` → `MO-H01`, `MO-D05a` → `MO-D05`). */
export function positiveIdOf(op: MutationOperator): string {
  return op.twinOf ?? op.id;
}

export function stylesOf(op: MutationOperator): readonly ('hexagonal' | 'ddd')[] {
  return HEXDDD_STYLES[positiveIdOf(op)] ?? [];
}

/** True for a hexagonal or DDD operator id (`MO-H…`, `MO-D…`). */
export function isHexDddId(id: string): boolean {
  return /^MO-[HD]\d{2}[na]?$/.test(id);
}

/** A registry holding the entries, frozen on return. */
export function buildHexDddRegistry(catalogueVersion: string): OperatorRegistry {
  const registry = new OperatorRegistry(catalogueVersion);
  for (const op of HEXDDD_OPERATORS) {
    const r = registry.register(op);
    if (!r.success) throw new Error(`hexddd registration failed: ${r.errors.map((e) => e.message).join('; ')}`);
  }
  registry.freeze();
  return registry;
}

/** Reads the catalogue under `repoRoot` and builds the frozen registry with its sha256. */
export function loadHexDddRegistry(repoRoot: string): DomainResult<OperatorRegistry> {
  const file = path.resolve(repoRoot, HEXDDD_CATALOGUE_PATH);
  if (!fs.existsSync(file)) return DomainResult.fail([{ code: 'CAT_NOT_FOUND', message: `${HEXDDD_CATALOGUE_PATH} not found` }]);
  return DomainResult.ok(buildHexDddRegistry(catalogueVersionOf(fs.readFileSync(file))));
}
