/**
 * v1.3 role detection by class name (fix round, fix 4; reasons in aidlc-docs/construction/v1.3-fixes/fixes-notes.md).
 *
 * The frozen templates select a class by role with a substring test (`c.name CONTAINS 'Repo'`). A role word inside
 * another word, or a role word that qualifies a different role, then selects the wrong class: `CsvReportWriter`
 * ("Repo" in "Report") and `GatewayRetryPolicy` (a policy object whose first word is "Gateway") were reported by
 * FF-P03 in the U-E baseline. TypeScript names a class's role with its LAST camel-case token(s): `OrderRepository`,
 * `PaymentGateway`, `PlaceOrderUseCase`, `OrderEntity`. A trailing `Impl` qualifies the implementation of that role
 * (`OrderRepositoryImpl`) and keeps it.
 *
 * So under v1.3 a role matches when the class name ENDS with the role word, or with the role word followed by `Impl`.
 * Every role word starts with an upper-case letter, so a match always starts at a camel-case token boundary
 * ("Repo" matches `UserRepo`, not `CsvReportWriter`).
 *
 * The rewrite is applied to the compiled text when `CompileOptions.roleTokens` is set (`V13_COMPILE_OPTIONS`); the
 * frozen template text is not edited, and `compileFunctions` without the option compiles it unchanged (v1.2E).
 * Not rewritten: the naming conventions (FF-CV02 naming-services, FF-CV03 naming-repos). Their construct is the name
 * itself: they select classes that mention the role word and check that the name follows the suffix convention, so a
 * suffix selection would make them vacuous.
 */

/** Exact text replacements per template name. Every `from` must occur in the compiled text. */
export const V13_ROLE_NAME_REWRITES: ReadonlyMap<string, readonly (readonly [from: string, to: string])[]> = new Map([
  // FF-P03 (clean, nestjs): repositories.
  ['repository-pattern', [[
    "(c.name CONTAINS 'Repository' OR c.name CONTAINS 'Repo')",
    "c.name =~ '.*(Repository|Repo)(Impl)?'",
  ]]],
  // FF-P03 (hexagonal, ddd's composed layering): outbound adapters ($adapterRoles: Repository, Repo, Adapter, Gateway).
  ['port-adapter-pattern', [[
    'ANY(role IN $adapterRoles WHERE c.name CONTAINS role)',
    "ANY(role IN $adapterRoles WHERE c.name ENDS WITH role OR c.name ENDS WITH role + 'Impl')",
  ]]],
  // FF-P04: use cases ($useCaseRoles: UseCase, Service, Handler).
  ['use-case-isolation', [[
    'ANY(role IN $useCaseRoles WHERE uc.name CONTAINS role)',
    "ANY(role IN $useCaseRoles WHERE uc.name ENDS WITH role OR uc.name ENDS WITH role + 'Impl')",
  ]]],
  // FF-P05: entities ($entityRoles: Entity, Aggregate, ValueObject).
  ['controller-no-entity', [[
    'ANY(role IN $entityRoles WHERE entity.name CONTAINS role)',
    "ANY(role IN $entityRoles WHERE entity.name ENDS WITH role OR entity.name ENDS WITH role + 'Impl')",
  ]]],
]);

/** Rewrites one compiled query's role selection; a template outside the table is returned unchanged. */
export function applyRoleTokens(templateName: string, cypher: string): string {
  const rewrites = V13_ROLE_NAME_REWRITES.get(templateName);
  if (rewrites === undefined) return cypher;
  let out = cypher;
  for (const [from, to] of rewrites) {
    if (!out.includes(from)) throw new Error(`role names: ${templateName} no longer contains ${JSON.stringify(from)}`);
    out = out.split(from).join(to);
  }
  return out;
}
