/**
 * The anti-pattern operator registry (v1.3 DRAFT; `Docs/operator-catalogue-antipatterns.md`).
 *
 * A separate registry from the frozen catalogue (`operators/index.ts`): its `catalogueVersion` is the sha256 of the
 * DRAFT anti-pattern catalogue, read from an explicit `repoRoot`, so no manifest row of these operators can carry the
 * frozen catalogue's version. Ten entries (five positives, five twins), all judge probes outside coverage. A unit test
 * asserts the registry and the catalogue table match one to one.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import { OperatorRegistry, catalogueVersionOf } from '../registry.js';
import type { MutationOperator } from '../types.js';
import { AP_DUP_RULE, AP_DUP_RULEN } from './ap-dup-rule.js';
import { AP_FAT_CONTROLLER, AP_FAT_CONTROLLERN } from './ap-fat-controller.js';
import { AP_FRAMEWORK_LEAK, AP_FRAMEWORK_LEAKN } from './ap-framework-leak.js';
import { AP_PERSIST_IN_DOMAIN, AP_PERSIST_IN_DOMAINN } from './ap-persist-in-domain.js';
import { AP_REPO_BYPASS, AP_REPO_BYPASSN } from './ap-repo-bypass.js';

export const ANTIPATTERN_CATALOGUE_PATH = 'Docs/operator-catalogue-antipatterns.md';

export const ANTIPATTERN_OPERATORS: readonly MutationOperator[] = Object.freeze([
  AP_REPO_BYPASS,
  AP_REPO_BYPASSN,
  AP_FAT_CONTROLLER,
  AP_FAT_CONTROLLERN,
  AP_PERSIST_IN_DOMAIN,
  AP_PERSIST_IN_DOMAINN,
  AP_DUP_RULE,
  AP_DUP_RULEN,
  AP_FRAMEWORK_LEAK,
  AP_FRAMEWORK_LEAKN,
]);

/** True for an anti-pattern operator id (`AP-…`). */
export function isAntipatternId(id: string): boolean {
  return id.startsWith('AP-');
}

/** A registry holding the ten anti-pattern entries, frozen on return. */
export function buildAntipatternRegistry(catalogueVersion: string): OperatorRegistry {
  const registry = new OperatorRegistry(catalogueVersion);
  for (const op of ANTIPATTERN_OPERATORS) {
    const r = registry.register(op);
    if (!r.success) throw new Error(`anti-pattern registration failed: ${r.errors.map((e) => e.message).join('; ')}`);
  }
  registry.freeze();
  return registry;
}

/** Reads `Docs/operator-catalogue-antipatterns.md` under `repoRoot` and builds the frozen registry with its sha256. */
export function loadAntipatternRegistry(repoRoot: string): DomainResult<OperatorRegistry> {
  const file = path.resolve(repoRoot, ANTIPATTERN_CATALOGUE_PATH);
  if (!fs.existsSync(file)) return DomainResult.fail([{ code: 'CAT_NOT_FOUND', message: `${ANTIPATTERN_CATALOGUE_PATH} not found` }]);
  return DomainResult.ok(buildAntipatternRegistry(catalogueVersionOf(fs.readFileSync(file))));
}
