/**
 * v1.3 extension template registry: every Cypher catalogue added after the v1.2E freeze, by name, all outside
 * `CYPHER_TEMPLATES`, which stays the frozen v1.2E instrument (NFR-V1) and is not listed here.
 *
 * - The v1.3 spec validation (`validateSpecAgainstProject(..., { rules: 'v1.3' })`) accepts any function name found
 *   in these catalogues; a new v1.3 library registers its catalogue by adding one entry (hexagonal #76, module
 *   wiring #69, DDD U-C1 #83).
 * - Lookups that fall back from the frozen map (evaluator, report tags) go through `getExtensionTemplate`.
 */
import type { CypherTemplate } from './types.js';
import { HEXAGONAL_TEMPLATES } from './hexagonal-templates.js';
import { DDD_TEMPLATES } from './ddd-templates.js';
import { V13_CYPHER_TEMPLATES } from './v13-templates.js';
import { APG2_TEMPLATES } from './apg2-templates.js';
import { CHEAP2_TEMPLATES } from './cheap2-templates.js';
import { CONSTRUCT_TEMPLATES } from '../construct-switches/compile.js';
import { RULE_GAP_CATALOGUE, RULE_GAP_TEMPLATES } from './rule-gap-templates.js';
import { POST_SEAL_TEMPLATES } from './post-seal-rules.js';

export const V13_EXTENSION_TEMPLATE_CATALOGUES: ReadonlyMap<string, ReadonlyMap<string, CypherTemplate>> = new Map([
  ['hexagonal', HEXAGONAL_TEMPLATES],
  ['module-wiring', V13_CYPHER_TEMPLATES],
  ['ddd', DDD_TEMPLATES],
  // APG v2 generic templates (`apg2-templates.ts`); they need a graph extracted with `V13_APG2_OPTIONS`.
  ['apg2', APG2_TEMPLATES],
  // Batch-2 cheap-proxy templates (`cheap2-templates.ts`), all advisory; they read the cheap facts once persisted.
  ['cheap2', CHEAP2_TEMPLATES],
  // v1.4 U2 post-seal templates (`post-seal-rules.ts`, ADR-V14-02): FF-P07 application-purity.
  ['post-seal', POST_SEAL_TEMPLATES],
]);

/**
 * Opt-in catalogues: OFF by default. They are not in `V13_EXTENSION_TEMPLATE_CATALOGUES`, so neither the v1.3 spec
 * validation nor any lookup sees them unless a caller names the catalogue (`v13OptInCatalogueOf`).
 * - `rule-gaps` (`rule-gap-templates.ts`, `Docs/v1.3/rule-gap-catalogue.md`): advisory constraints the style sources
 *   state and no other template checks.
 */
export const V13_OPT_IN_EXTENSION_CATALOGUES: ReadonlyMap<string, ReadonlyMap<string, CypherTemplate>> = new Map([
  [RULE_GAP_CATALOGUE, RULE_GAP_TEMPLATES],
]);

/** The enabled opt-in catalogue that holds `name`, or undefined (`enabled` lists the catalogues switched on). */
export function v13OptInCatalogueOf(name: string, enabled: readonly string[]): string | undefined {
  for (const catalogue of enabled) {
    if (V13_OPT_IN_EXTENSION_CATALOGUES.get(catalogue)?.has(name) === true) return catalogue;
  }
  return undefined;
}

/** The catalogue that holds a v1.3 extension template, or undefined. */
export function v13ExtensionCatalogueOf(name: string): string | undefined {
  for (const [catalogue, templates] of V13_EXTENSION_TEMPLATE_CATALOGUES) {
    if (templates.has(name)) return catalogue;
  }
  return undefined;
}

/**
 * A style-library template (hexagonal or DDD, or the construct-switch carrier) by name, for lookups that fall back from `CYPHER_TEMPLATES`.
 * The module-wiring example templates are reached only through `CompileOptions.v13Templates`, not here.
 */
export function getExtensionTemplate(name: string): CypherTemplate | undefined {
  // The construct-switch carrier (only compiled while a switch is set) is found too, so its function result gets the
  // template's tag like any other row; without it a report with a carrier rule fails the schema (R09).
  // The post-seal template (v1.4 U2) is found too, so FF-P07's function result gets its tag.
  return HEXAGONAL_TEMPLATES.get(name) ?? DDD_TEMPLATES.get(name) ?? CONSTRUCT_TEMPLATES.get(name) ?? POST_SEAL_TEMPLATES.get(name);
}
