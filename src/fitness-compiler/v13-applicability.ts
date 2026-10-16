/**
 * v1.3 style applicability (ADR-V13-02 draft, `Docs/v1.3/adr-v13-02-draft.md`).
 *
 * Some constructs exist only in some styles. The frozen catalogue states a template's styles in its own
 * `applicableStyles` (`cypher-templates.ts`); that text is the v1.2E instrument and is not edited. This table adds
 * the v1.3 readings on top of it, applied only when `CompileOptions.styleApplicability` is set (`V13_COMPILE_OPTIONS`).
 * A spec without a declared style is not affected. Tiers are not touched (`src/scoring-engine/rule-tiers.ts`).
 */

export interface V13StyleApplicability {
  /** The styles in which the template's construct exists. */
  readonly styles: readonly string[];
  readonly reason: string;
}

export const V13_STYLE_APPLICABILITY: ReadonlyMap<string, V13StyleApplicability> = new Map([
  ['domain-state-purity', {
    styles: ['clean-architecture', 'hexagonal', 'ddd', 'nestjs'],
    reason: 'FF-P06 needs a style with an isolated domain; layered permits the business layer to use the layer below (ADR-V13-02 draft)',
  }],
]);

/** `undefined` when the template applies under v1.3 to `style`; else the reason it does not. */
export function v13InapplicableReason(templateName: string, style: string | undefined): string | undefined {
  if (style === undefined) return undefined;
  const entry = V13_STYLE_APPLICABILITY.get(templateName);
  if (entry === undefined || entry.styles.includes(style)) return undefined;
  return `not applicable to style ${style} (v1.3: ${entry.reason})`;
}
