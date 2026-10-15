/**
 * The v1.3 rewrites of a compiled query, in one place for the three compile paths (core, hexagonal, DDD). Each is
 * off unless its `CompileOptions` flag is set (`V13_COMPILE_OPTIONS` sets all of them); with every flag off the text is
 * returned unchanged, so the v1.2E compile output is byte-identical.
 * - `roleTokens`: role detection by the class name's last camel-case token(s) (`v13-role-names.ts`).
 * - `edgeViews`: the template's literal or resolved import-edge view (ADR-V13-01, `edge-views.ts`). Applied last, on
 *   the final text.
 */
import { applyEdgeView } from './edge-views.js';
import { applyRoleTokens } from './v13-role-names.js';

export interface V13RewriteFlags {
  readonly edgeViews: boolean;
  readonly roleTokens: boolean;
}

export const NO_V13_REWRITES: V13RewriteFlags = Object.freeze({ edgeViews: false, roleTokens: false });

export function applyV13Rewrites(templateName: string, cypher: string, flags: V13RewriteFlags): string {
  const named = flags.roleTokens ? applyRoleTokens(templateName, cypher) : cypher;
  return flags.edgeViews ? applyEdgeView(templateName, named) : named;
}
