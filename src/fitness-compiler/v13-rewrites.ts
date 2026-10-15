/**
 * The v1.3 rewrites of a compiled query, in one place for the three compile paths (core, hexagonal, DDD). Each is
 * off unless its `CompileOptions` flag is set (`V13_COMPILE_OPTIONS` sets all of them); with every flag off the text is
 * returned unchanged, so the v1.2E compile output is byte-identical.
 * - `roleTokens`: role detection by the class name's last camel-case token(s) (`v13-role-names.ts`).
 * - `edgeViews`: the template's literal or resolved import-edge view (ADR-V13-01, `edge-views.ts`). Applied last, on
 *   the final text.
 * - `memberFacts`: not a text rewrite. The DDD compile path selects the member-fact text of FF-DT03
 *   (`DDD_MEMBER_FACT_TEMPLATES`) instead of the setter-name proxy; the other paths ignore it.
 * - `signatureTypes`: not a rewrite of the compiled text. The core compile path adds the SIGNATURE_USES branch to the
 *   FF-P05 template text before instantiation (`v13-signature-types.ts`), so its exclude markers are injected too.
 */
import { applyEdgeView } from './edge-views.js';
import { applyRoleTokens } from './v13-role-names.js';

export interface V13RewriteFlags {
  readonly edgeViews: boolean;
  readonly roleTokens: boolean;
  readonly memberFacts?: boolean;
  readonly signatureTypes?: boolean;
}

export const NO_V13_REWRITES: V13RewriteFlags = Object.freeze({ edgeViews: false, roleTokens: false });

export function applyV13Rewrites(templateName: string, cypher: string, flags: V13RewriteFlags): string {
  const named = flags.roleTokens ? applyRoleTokens(templateName, cypher) : cypher;
  return flags.edgeViews ? applyEdgeView(templateName, named) : named;
}
