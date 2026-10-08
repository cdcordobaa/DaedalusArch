/**
 * The registered operator catalogue (FR-v1.2E-24 amendment; BR-U5a-38, 39; `business-rules.md` §3).
 *
 * `CATALOGUE_OPERATORS` lists the 22 entries (11 operators, 11 twins) in catalogue order. A registry is built in
 * code and frozen as soon as it is built (`register` afterwards fails with `CAT_FROZEN`); its `catalogueVersion` is
 * the sha256 of `Docs/operator-catalogue.md`, read from an explicit `repoRoot` (D-U5a-13). A unit test asserts the
 * registry and the catalogue table match one to one (id, twin, dimension, expected templates, coverage, source).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import { OperatorRegistry, catalogueVersionOf } from '../registry.js';
import type { MutationOperator } from '../types.js';
import { MO_C04, MO_C04N } from './mo-c04.js';
import { MO_CV02, MO_CV02N } from './mo-cv02.js';
import { MO_DF01, MO_DF01N } from './mo-df01.js';
import { MO_P01, MO_P01N } from './mo-p01.js';
import { MO_S01, MO_S01N } from './mo-s01.js';
import { MO_S03, MO_S03N } from './mo-s03.js';
import { MO_SO01, MO_SO01N } from './mo-so01.js';
import { MO_SO02, MO_SO02N } from './mo-so02.js';
import { MO_X01, MO_X01N } from './mo-x01.js';
import { MO_X02, MO_X02N } from './mo-x02.js';
import { MO_X03, MO_X03N } from './mo-x03.js';

/** Repository-relative path of the catalogue (D-U5a-10: DRAFT until the Build and Test freeze). */
export const CATALOGUE_PATH = 'Docs/operator-catalogue.md';

/** The frozen master seed (BR-U5a-15), also written in the catalogue. */
export const MASTER_SEED = 20261008;

export const CATALOGUE_OPERATORS: readonly MutationOperator[] = Object.freeze([
  MO_S01,
  MO_S01N,
  MO_P01,
  MO_P01N,
  MO_C04,
  MO_C04N,
  MO_SO01,
  MO_SO01N,
  MO_CV02,
  MO_CV02N,
  MO_DF01,
  MO_DF01N,
  MO_X01,
  MO_X01N,
  MO_X02,
  MO_X02N,
  MO_SO02,
  MO_SO02N,
  MO_X03,
  MO_X03N,
  MO_S03,
  MO_S03N,
]);

/** A registry holding the 22 catalogue entries, frozen on return. */
export function buildCatalogueRegistry(catalogueVersion: string): OperatorRegistry {
  const registry = new OperatorRegistry(catalogueVersion);
  for (const op of CATALOGUE_OPERATORS) {
    const r = registry.register(op);
    if (!r.success) throw new Error(`catalogue registration failed: ${r.errors.map((e) => e.message).join('; ')}`);
  }
  registry.freeze();
  return registry;
}

/** Reads `Docs/operator-catalogue.md` under `repoRoot` and builds the frozen registry with its sha256. */
export function loadCatalogueRegistry(repoRoot: string): DomainResult<OperatorRegistry> {
  const file = path.resolve(repoRoot, CATALOGUE_PATH);
  if (!fs.existsSync(file)) return DomainResult.fail([{ code: 'CAT_NOT_FOUND', message: `${CATALOGUE_PATH} not found` }]);
  return DomainResult.ok(buildCatalogueRegistry(catalogueVersionOf(fs.readFileSync(file))));
}
