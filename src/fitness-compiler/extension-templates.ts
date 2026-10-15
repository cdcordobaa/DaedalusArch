/**
 * v1.3 extension template registry: every Cypher catalogue added after the v1.2E freeze, by name. `CYPHER_TEMPLATES`
 * stays the frozen v1.2E instrument (NFR-V1) and is not listed here. The v1.3 spec validation
 * (`validateSpecAgainstProject(..., { rules: 'v1.3' })`) accepts any function name found in these catalogues; a new
 * v1.3 library (the DDD templates, U-C1) registers its catalogue by adding one entry.
 */
import type { CypherTemplate } from './types.js';
import { HEXAGONAL_TEMPLATES } from './hexagonal-templates.js';
import { V13_CYPHER_TEMPLATES } from './v13-templates.js';

export const V13_EXTENSION_TEMPLATE_CATALOGUES: ReadonlyMap<string, ReadonlyMap<string, CypherTemplate>> = new Map([
  ['hexagonal', HEXAGONAL_TEMPLATES],
  ['module-wiring', V13_CYPHER_TEMPLATES],
]);

/** The catalogue that holds a v1.3 extension template, or undefined. */
export function v13ExtensionCatalogueOf(name: string): string | undefined {
  for (const [catalogue, templates] of V13_EXTENSION_TEMPLATE_CATALOGUES) {
    if (templates.has(name)) return catalogue;
  }
  return undefined;
}
