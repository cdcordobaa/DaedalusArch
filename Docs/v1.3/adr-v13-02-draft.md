# ADR-V13-02 (draft): FF-P06 domain-state-purity applies only to styles with an isolated domain

**Date**: 2026-10-15. **Status**: Draft, for the author. Implemented on `v1.3-fixes` as a v1.3 style-applicability rule (`V13_COMPILE_OPTIONS.styleApplicability`); the v1.2E compile is unchanged. Written before the reference validation was rerun with the change.

This is a development-cycle decision for v1.3. It does not change Study 1 (v1.2E, frozen), the sealed tier table (`Docs/v1.3/rule-tiers.md`) or any manifest.

## Context

FF-P06 (`domain-state-purity`, blocking, partial) reports a class in the layer of kind `domain` that holds a class or interface of the layer of kind `infrastructure`, through a constructor-injected parameter (`CONSTRUCTOR_INJECTS`; the `FLOWS_TO` half is reported N/A). Its sealed construct is "core isolation of state" (`rule-tiers.md`).

The rule binds layers by **kind**. The layered preset (`presets/layered.yaml`, closed layering after Buschmann et al. 1996) declares three layers, bottom-up: `persistence` (kind `infrastructure`), `business` (kind `domain`) and `presentation`. FF-P06 therefore reads "a business class holds a persistence class".

In the U-E baseline (`Docs/DiagnosticRuns/v1.3-reference-baseline-2026-10-15.md`) FF-P06 produced **53 of the 60 blocking false positives** in `layered` (5 distinct rows, repeated on every variant): `OrderService -> {Customer,Order,Product}Gateway`, `CatalogService -> ProductGateway`, and `SalesReportService -> Database` on n02. It also failed the layered clean variant, which both manifests and the reference notes judge clean. The reference notes had predicted this before the tool ran (RDQ-1, `Docs/v1.3-reference-notes.md`): "In closed layering, a business service holding a persistence gateway is the intended dependency, so there is nothing to plant."

## The construct

- **Layered.** Fowler (2002, ch. 1 "Layering") and the POSA Layers pattern (Buschmann et al. 1996): a higher layer uses the services of the layer below it; the lower layer does not use the upper one. Under closed layering the business layer's use of the persistence layer is the defining *allowed* dependency, not a breach. Nothing in the layered style requires the business layer to be free of persistence state: holding a gateway or a table data gateway is how the business layer reaches the layer below (Fowler 2002, ch. 10 "Data Source Architectural Patterns"). `Docs/v1.3/style-rule-sources.md` lists no isolated-domain rule for Layered.
- **Clean, Hexagonal, DDD, NestJS.** Each requires an isolated domain whose dependencies on infrastructure are inverted:
  - Clean: the Dependency Rule; entities and use cases do not depend on databases (Martin 2017, ch. 22).
  - Hexagonal: the core reaches the outside only through ports and does not depend on adapters (Cockburn 2005).
  - DDD: "Isolating the Domain" (Evans 2003, ch. 4).
  - NestJS: the repo's NestJS preset (`presets/nestjs.yaml`) is not a Clean Architecture layering. Its order, inner to outer, is domain → infrastructure → application → presentation, and application services call the repositories in the infrastructure layer directly (Controller → Service → Repository). The preset does keep an isolated domain at the bottom. The innermost layer is `domain` (kind `domain`: entities, value objects, domain services and repository interfaces). The preset declares `no-domain-outward-dep`, `domain-purity` and `domain-state-purity` for that layer. So the isolated-domain reasoning applies to the `domain` layer, while the Clean ordering of the outer layers does not.

  In these styles, a domain class that holds an infrastructure object is exactly the breach FF-P06 names.

The rule's construct is therefore style-dependent: it exists only where the style requires an isolated domain. In `layered`, "a business class holding a persistence class" is not a violation of the style. It is not a weaker violation either: the style permits it.

## Options

- **(A) Applicability.** FF-P06 is not applicable in `layered`. It is disabled with the reason "not applicable to style layered" (`COMPILER_004`, listed under `disabledFunctions`, as the Clean-Architecture-only templates are). Its tier is untouched: wherever it applies it stays blocking, partial.
- **(B) Rebind.** Keep FF-P06 in `layered` but exclude the adjacent lower layer from its target. In the three-layer preset that excludes the only infrastructure layer, so the rule would select nothing: (A) with extra machinery.
- **(C) Tier change.** Make FF-P06 advisory in `layered`, like FF-S03's style-dependent tier. This would still report a dependency that the style defines as correct, now as advice. A tier is for how strongly a constraint binds; here no constraint exists. A tier change also needs the sealed-file ADR route, and the reason would rest on a precision observation, which `rule-tiers.md` does not accept on its own.

## Decision (proposed)

**A.** In v1.3, FF-P06 applies only where the style requires an isolated domain: `clean-architecture`, `hexagonal`, `ddd` and `nestjs`. In `layered` it is not applicable. A spec without a declared style keeps the rule, as before.

This works like FF-S03's style dependence: the style decides whether the construct exists, and the tiers are not touched. FF-S03's dependence is in the tier table (blocking only for `layered`); FF-P06's is in applicability, because in `layered` the construct does not exist at all, rather than existing with a weaker force.

## Implementation (v1.3 only)

- `src/fitness-compiler/v13-applicability.ts`: `V13_STYLE_APPLICABILITY` maps `domain-state-purity` to the four styles. `compileFunctions` checks it when `CompileOptions.styleApplicability` is set. `V13_COMPILE_OPTIONS` sets it, so the pipeline's `CompileCommand` and `validate --rules v1.3` apply it.
- The frozen catalogue (`CYPHER_TEMPLATES`, its `applicableStyles`) is not edited. `compileFunctions(input)` without the option compiles exactly as before, so the v1.2E compile output is byte-identical (asserted by a test).
- `RULE_TIERS` and `Docs/v1.3/rule-tiers.md` are not edited.

## Consequences

- **Expected on the reference set** (written before the rerun): the 53 FF-P06 rows in `layered` disappear, the layered clean variant passes, and layered blocking precision rises. No layered manifest expects FF-P06 (`reference.json`: `noViolatingVariant`), so no recall is lost. The other styles are unaffected.
- A layered project whose business layer holds infrastructure state *without* going through the layer below cannot be expressed with the current three-layer binding anyway; if a Study 2 spec author wants such a check, it needs its own rule over a declared "data source" boundary, not FF-P06.
- The thesis reports FF-P06 per style with "n/a (layered)", and the applicability table is an instrument fact to report next to the tier table.

## Note: factual correction (v1.3 fix batch)

The NestJS bullet under "The construct" used to call the NestJS preset "a Clean Architecture layering inside Nest modules". That contradicts `presets/nestjs.yaml`: in the preset, services call repositories directly, with infrastructure as an inner data-access layer (`Docs/v1.3/construct-decisions.md` Q13, action item). The bullet now describes the preset as it is. The decision does not change. FF-P06 still applies to `nestjs`, because the preset's `domain` layer is innermost and isolated, and FF-P06 reads a domain class that holds an infrastructure object. This correction does not answer Q13 (the layer order and FF-P04).
