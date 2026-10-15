/**
 * The v1.3 rewrites of a compiled query, in one place for the three compile paths (core, hexagonal, DDD). Each is
 * off unless its `CompileOptions` flag is set (`V13_COMPILE_OPTIONS` sets all of them); with every flag off the text is
 * returned unchanged, so the v1.2E compile output is byte-identical.
 * - `roleTokens`: role detection by the class name's last camel-case token(s) (`v13-role-names.ts`).
 * - `edgeViews`: the template's literal or resolved import-edge view (ADR-V13-01, `edge-views.ts`). Applied last, on
 *   the final text.
 * - `fieldState`: FF-P06 `domain-state-purity` reads its field half from HOLDS_STATE_OF (`field-state.ts`, extracted
 *   with `ExtractorOptions.fieldState`) instead of FLOWS_TO (`FIELD_STATE_PURITY_TEXT`). The constructor-injection half
 *   is unchanged. Field rows keep their own `relType` (`HOLDS_STATE_OF`), which `rule-tiers.ts` reports N/A with the
 *   FLOWS_TO rows (the sealed field half), so the half becomes measurable without moving the tier. Applied first.
 * - `memberFacts`: not a text rewrite. The DDD compile path selects the member-fact text of FF-DT03
 *   (`DDD_MEMBER_FACT_TEMPLATES`) instead of the setter-name proxy; the other paths ignore it.
 */
import { applyEdgeView } from './edge-views.js';
import { applyRoleTokens } from './v13-role-names.js';

export interface V13RewriteFlags {
  readonly edgeViews: boolean;
  readonly roleTokens: boolean;
  readonly memberFacts?: boolean;
  readonly fieldState?: boolean;
}

/** The FF-P06 match of the frozen text, and its field-state variant. */
export const FIELD_STATE_PURITY_TEXT = Object.freeze({
  frozen: '(c:Class)-[e:FLOWS_TO|CONSTRUCTOR_INJECTS]->(t)',
  variant: '(c:Class)-[e:HOLDS_STATE_OF|CONSTRUCTOR_INJECTS]->(t)',
});

/** FF-P06 field half from HOLDS_STATE_OF; every other template, and a text without the frozen match, is unchanged. */
export function applyFieldState(templateName: string, cypher: string): string {
  if (templateName !== 'domain-state-purity') return cypher;
  return cypher.split(FIELD_STATE_PURITY_TEXT.frozen).join(FIELD_STATE_PURITY_TEXT.variant);
}

export const NO_V13_REWRITES: V13RewriteFlags = Object.freeze({ edgeViews: false, roleTokens: false });

export function applyV13Rewrites(templateName: string, cypher: string, flags: V13RewriteFlags): string {
  const fieldState = flags.fieldState === true ? applyFieldState(templateName, cypher) : cypher;
  const named = flags.roleTokens ? applyRoleTokens(templateName, fieldState) : fieldState;
  return flags.edgeViews ? applyEdgeView(templateName, named) : named;
}
