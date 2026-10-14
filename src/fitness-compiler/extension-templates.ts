/**
 * Templates added after the v1.2E freeze (v1.3), one map per style library, all outside `CYPHER_TEMPLATES`.
 * Lookups that fall back from the frozen map (validator, evaluator, report tags) go through here.
 */
import type { CypherTemplate } from './types.js';
import { HEXAGONAL_TEMPLATES } from './hexagonal-templates.js';
import { DDD_TEMPLATES } from './ddd-templates.js';

export function getExtensionTemplate(name: string): CypherTemplate | undefined {
  return HEXAGONAL_TEMPLATES.get(name) ?? DDD_TEMPLATES.get(name);
}
