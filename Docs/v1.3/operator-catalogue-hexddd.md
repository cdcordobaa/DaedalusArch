# Hexagonal and DDD Operator Catalogue (v1.3 DRAFT)

> **Status: DRAFT 2026-10-16 (v1.3, branch `v1.3-operators-hexddd`).** Not registered, not frozen, not part of any pre-registration. It does not change, extend or replace the frozen v1.2E catalogue `Docs/operator-catalogue.md` (a registered artefact, byte-identical on this branch) or the anti-pattern catalogue `Docs/operator-catalogue-antipatterns.md`. No Cypher template, tier or preset is edited.
> **Purpose**: the SO4 seeded-detection operators target the Clean, Layered and NestJS libraries only; the hexagonal and DDD libraries of v1.3 had none (`Docs/v1.3-hexagonal-notes.md` §5, `Docs/v1.3-ddd-notes.md` §7). This catalogue gives every **blocking** hexagonal and DDD rule of `Docs/v1.3/rule-tiers.md` at least one operator with a near-miss twin, plus one operator for the advisory `layer-skip-graph` (the "adapter imports another adapter" case named in the task).
> **Source of truth**: the operators are built in code (`scripts/lib/mutation/hexddd/`). The registry (`hexddd/index.ts`) is separate from the frozen and anti-pattern ones; its `catalogueVersion` is the sha256 of this file. `tests/unit/scripts/mutation/hexddd.test.ts` asserts that the entry table below and the registry match one to one (id, twin, dimension, expected templates, coverage, source) and that every site kind and precondition reason is a known one.
> **Measured**: `Docs/DiagnosticRuns/v1.3-operators-hexddd-2026-10-16.md` (development data). Runner: `scripts/v1.3/operators-hexddd-run.ts`.

## 1. Entries (12 operators, 13 twins)

Expected templates name the template whose row the application must produce; the function id is resolved per spec at run time (a template the spec does not enable gives no key and is reported as absent). Twins carry no expected key: a twin is a **false fire** when its application adds any blocking violation (§3). `Core` is `extension` for every entry: none is part of the frozen SO4 core set.

| Id | Core | Dimension | Tags | Defect | Expected templates | Coverage | Site kinds | Preconditions | Operator collateral | Twin | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MO-H01 | extension | structural | hexagonal + ddd, blocking: FF-S01 FF-S04, DRAFT v1.3 | a core (domain) file imports an inbound or outbound adapter file | `dependency-direction-graph`, `core-isolation` | in | `import-edge` | `edge-exists`, `ddd-boundary` | — | MO-H01n | Cockburn 2005; Martin 2017 |
| MO-H01n | extension | structural | twin, hexagonal + ddd, DRAFT v1.3 | an outbound adapter file imports a core file (the allowed direction) | — | in | `import-edge` | `edge-exists`, `ddd-boundary`, `cycle-cap` | — | MO-H01 | Cockburn 2005; Martin 2017 |
| MO-H02 | extension | structural | hexagonal + ddd, blocking: FF-S01, DRAFT v1.3 | a use-case class gains a constructor parameter typed with a concrete outbound adapter class | `dependency-direction-graph` | in | `constructor-injection` | `edge-exists`, `ddd-boundary`, `type-shape` | — | MO-H02n | Cockburn 2005; Seemann 2011 |
| MO-H02n | extension | structural | twin, hexagonal + ddd, DRAFT v1.3 | the same parameter typed with a port (an interface of the core or of a use-case layer) | — | in | `constructor-injection` | `edge-exists`, `ddd-boundary`, `cycle-cap`, `layer-pair`, `type-shape` | — | MO-H02 | Cockburn 2005; Seemann 2011 |
| MO-H03 | extension | structural | hexagonal, ADVISORY: FF-S03, DRAFT v1.3 | an inbound adapter file imports an outbound adapter file | `layer-skip-graph` | in | `import-edge` | `edge-exists`, `ddd-boundary` | — | MO-H03n | Cockburn 2005 |
| MO-H03n | extension | structural | twin, hexagonal, DRAFT v1.3 | an inbound adapter file imports a use-case file | — | in | `import-edge` | `edge-exists`, `ddd-boundary`, `cycle-cap` | — | MO-H03 | Cockburn 2005 |
| MO-H04 | extension | pattern | hexagonal, blocking: FF-P03, DRAFT v1.3 | an outbound adapter class (adapter-role name) drops every port from its `implements` clause | `port-adapter-pattern` | in | `implements-clause` | `type-shape`, `no-port` | — | MO-H04n | Cockburn 2005 |
| MO-H04n | extension | pattern | twin, hexagonal, DRAFT v1.3 | the class keeps its ports and also implements a new local interface of its own file | — | in | `implements-clause` | `type-shape`, `no-port` | — | MO-H04 | Cockburn 2005 |
| MO-H05 | extension | pattern | hexagonal + ddd, blocking: FF-P01 / FF-DT04, DRAFT v1.3 | a core file imports a named symbol of a forbidden framework package and references it | `domain-purity` | in | `package-import` | `already-imported` | — | MO-H05n | Evans 2003; Cockburn 2005 |
| MO-H05n | extension | pattern | twin, hexagonal + ddd, DRAFT v1.3 | the same import in an outbound adapter file | — | in | `package-import` | `already-imported` | — | MO-H05 | Evans 2003; Cockburn 2005 |
| MO-H06 | extension | pattern | hexagonal, blocking: FF-P06 (constructor half) FF-S01 FF-S04, DRAFT v1.3 | a core class gains a constructor parameter typed with an outbound adapter class | `domain-state-purity`, `dependency-direction-graph`, `core-isolation` | in | `constructor-injection` | `edge-exists`, `ddd-boundary`, `type-shape` | — | MO-H06n | Evans 2003; Cockburn 2005 |
| MO-H06n | extension | pattern | twin, hexagonal, DRAFT v1.3 | the same parameter typed with a core interface | — | in | `constructor-injection` | `edge-exists`, `ddd-boundary`, `cycle-cap`, `layer-pair`, `type-shape` | — | MO-H06 | Evans 2003; Cockburn 2005 |
| MO-H07 | extension | structural | hexagonal, blocking: FF-S02, DRAFT v1.3 | a core file B imports a core file A that already imports B (a new two-file cycle) | `no-cyclic-deps` | in | `import-edge` | `edge-exists`, `ddd-boundary`, `type-shape` | — | MO-H07n | Martin 2017 (ADP) |
| MO-H07n | extension | structural | twin, hexagonal, DRAFT v1.3 | the same file B imports a core file C that does not reach B | — | in | `import-edge` | `edge-exists`, `ddd-boundary`, `cycle-cap` | — | MO-H07 | Martin 2017 (ADP) |
| MO-D01 | extension | structural | ddd, blocking: FF-DT01, DRAFT v1.3 | a file of the aggregate's context, outside its module, imports an inner entity | `aggregate-boundary` | in | `import-edge` | `edge-exists`, `layer-pair` | — | MO-D01n | Evans 2003 ch. 6; Vernon 2013 ch. 10 |
| MO-D01n | extension | structural | twin, ddd, DRAFT v1.3 | the same file imports the aggregate root | — | in | `import-edge` | `edge-exists`, `layer-pair`, `cycle-cap` | — | MO-D01 | Evans 2003 ch. 6; Vernon 2013 ch. 10 |
| MO-D02 | extension | pattern | ddd, blocking: FF-DT02 (FF-DT01 outside the module), DRAFT v1.3 | a new repository file, named to match the declared repository globs, keeps a collection of an inner entity | `repository-aggregate-root`, `aggregate-boundary` | in | `created-file` | `type-shape`, `layer-pair` | — | MO-D02n | Evans 2003 ch. 6; Vernon 2013 ch. 12 |
| MO-D02n | extension | pattern | twin, ddd, DRAFT v1.3 | the same new repository keeps a collection of the aggregate root | — | in | `created-file` | `type-shape`, `layer-pair`, `cycle-cap` | — | MO-D02 | Evans 2003 ch. 6; Vernon 2013 ch. 12 |
| MO-D03 | extension | pattern | ddd, blocking: FF-DT03, DRAFT v1.3 | a value object becomes mutable: a public set method assigning an own field (its readonly dropped), or a new public mutable field | `value-object-immutability` | in | `value-object-member` | `type-shape`, `metric-already-violating` | — | MO-D03n | Evans 2003 ch. 5; Vernon 2013 ch. 6 |
| MO-D03n | extension | pattern | twin, ddd, DRAFT v1.3 | a public side-effect-free query method on the same field, or a new public readonly field | — | in | `value-object-member` | `type-shape`, `metric-already-violating` | — | MO-D03 | Evans 2003 ch. 5; Vernon 2013 ch. 6 |
| MO-D05 | extension | structural | ddd, blocking: FF-DS02, DRAFT v1.3 | a file of context A outside A's ACL imports a file of context B that B does not publish | `context-isolation` | in | `cross-context-import` | `edge-exists`, `layer-pair` | — | MO-D05n | Evans 2003 ch. 14; Vernon 2013 ch. 3, 13 |
| MO-D05n | extension | structural | twin, ddd, DRAFT v1.3 | the same file imports a public-API file of B | — | in | `cross-context-import` | `edge-exists`, `layer-pair`, `cycle-cap` | — | MO-D05 | Evans 2003 ch. 14; Vernon 2013 ch. 3, 13 |
| MO-D05a | extension | structural | twin (ACL exception), ddd, DRAFT v1.3 | a file of A's declared ACL imports the unpublished file of B | — | in | `cross-context-import` | `edge-exists`, `layer-pair`, `cycle-cap` | — | MO-D05 | Evans 2003 ch. 14; Vernon 2013 ch. 3, 13 |
| MO-D06 | extension | structural | ddd, blocking: FF-DS01, DRAFT v1.3 | a new module under the source root, outside every context and every outside-context path | `bounded-context-modules` | in | `created-file` | — | — | MO-D06n | Evans 2003 ch. 14; Vernon 2013 ch. 3, 13 |
| MO-D06n | extension | structural | twin, ddd, DRAFT v1.3 | the same module created next to an existing file of a context | — | in | `created-file` | — | — | MO-D06 | Evans 2003 ch. 14; Vernon 2013 ch. 3, 13 |

### Coverage of the blocking rules

| Library | Rule (template) | Tier | Operator |
|---|---|---|---|
| hexagonal | FF-S01 `dependency-direction-graph` | blocking | MO-H01, MO-H02, MO-H06 |
| hexagonal | FF-S02 `no-cyclic-deps` | blocking | MO-H07 |
| hexagonal | FF-S04 `core-isolation` | blocking | MO-H01, MO-H06 |
| hexagonal | FF-P01 `domain-purity` | blocking | MO-H05 |
| hexagonal | FF-P03 `port-adapter-pattern` | blocking | MO-H04 |
| hexagonal | FF-P06 `domain-state-purity` (constructor half; the field half is N/A, rule-tiers.md) | blocking, partial | MO-H06 |
| hexagonal | FF-S03 `layer-skip-graph` | advisory | MO-H03 (not counted as blocking) |
| hexagonal | FF-P02 `port-dependency-inversion` | advisory | none (MO-H02 may raise it as collateral) |
| ddd | FF-DS01 `bounded-context-modules` | blocking | MO-D06 |
| ddd | FF-DS02 `context-isolation` | blocking | MO-D05 (twins MO-D05n public API, MO-D05a ACL) |
| ddd | FF-DT01 `aggregate-boundary` | blocking | MO-D01, MO-D02 (outside the module) |
| ddd | FF-DT02 `repository-aggregate-root` | blocking | MO-D02 |
| ddd | FF-DT03 `value-object-immutability` | blocking | MO-D03 |
| ddd | FF-DT04 `domain-purity` | blocking | MO-H05 |
| ddd | FF-S01 `dependency-direction-graph` | blocking | MO-H01, MO-H02 |
| ddd | FF-DT05, FF-DT06, FF-S03 | advisory | none |

## 2. Site rules and edits

**Roles come from the spec, never from names** (`hexddd/common.ts`): the core is the `domain`-kind layer; the use-case layers are the `application`-kind layers some allowed edge points to (the composition root is the application-kind layer no edge points to, as in `Docs/v1.3-hexagonal-notes.md` §3); inbound adapters are the `presentation`-kind layer; outbound adapters the `infrastructure`-kind layer. DDD roles are the `architecture.ddd` declarations matched with picomatch. The one name heuristic is the adapter-role list of `port-adapter-pattern` itself (`Repository`, `Repo`, `Adapter`, `Gateway`), used by MO-H04 so that the template can see the class at all.

**Import edits** (MO-H01/H03/H07, MO-D01/D05 and twins): `import { S } from '<relative path>';` after the existing imports, and `export const sRef = S;` (a value) or `export type SRef = S;` (a type) at the end of the file, so the import is used and the edge is a real, non-type-only IMPORTS edge. S is the target's first exported class, else first exported function or variable, else first exported interface or type alias without a required type parameter. A site is dropped when S is already a name in the source file.

**Injection edits** (MO-H02, MO-H06 and twins): the first exported, non-abstract class of the host file that can take one more constructor parameter (one constructor without a rest parameter, or no constructor and no `extends`) gains a public `readonly` parameter property. Form `default-new` (`x: T = new T()`, the default-instance idiom) when T can be built without arguments, else `optional` (`x?: T`); twins always use `optional` (an interface cannot be built). Both forms keep every `new` call site compiling. See §4 for why the form matters.

**MO-H04 / H04n**: the site records the class's port entries (an `implements` entry whose interface is declared in the core or a use-case layer). MO-H04 removes them all (TypeScript typing is structural, so the class still satisfies every use). MO-H04n inserts `export interface <Class>Contract {}` before the class and adds it to `implements`, ports kept.

**MO-H05 / H05n**: the framework package is the first entry of a fixed preference list (`@nestjs/common`→`Injectable`, `typeorm`→`Entity`, `class-validator`, `class-transformer`, `express`, `mongoose`, `@prisma/client`, `sequelize`, `@mikro-orm/core`, `inversify`, `tsyringe`) that the spec's `domain-purity` list names literally or by glob. `import { X } from '<pkg>';` and `export const xRef = X;`. When the package does not resolve from the copy (the reference projects have no `node_modules`), a stub package is written into the copy by the existing rule (`scripts/lib/mutation/stubs.ts`, BR-U5a-10).

**MO-H07 / H07n**: a site is (B, A) where A and B are core files and A imports B. MO-H07 adds B → A; its precondition requires that the edge closes a cycle (A reaches B in the base graph) and does not exist yet. MO-H07n adds B → C for a core file C that does not reach B.

**MO-D02 / D02n**: one site per (directory holding a declared repository file of the aggregate's context, or outside the source root; entity file). The new file takes the first name of `<Entity>Repository.ts`, `<entity-kebab>.repository.ts`, `<entity-kebab>-repository.ts`, `<entity-kebab>.repo.ts` that the declared repository globs accept and no file has; it imports the entity and holds `private readonly items = new Map<string, E>()` with `save` and `findById`. The twin's entity is the root, named `<Root>Archive…` so the file is new. When the new file lies inside the aggregate's own module, FF-DT01 does not apply and its key is not expected (`detail.notExpected`).

**MO-D03 / D03n**: sites are the classes of the declared value-object files. Mode `method` when the class declares an own instance field (property or parameter property): MO-D03 drops that field's `readonly` (adding `public` to a parameter property whose only modifier was `readonly`) and adds `public set<Field>(value: T): void { this.<field> = value; }`; MO-D03n adds `public <field>Equals(value: T): boolean`. Mode `field` otherwise (the real projects keep a `props` bag in a base class): a new `public label: string | undefined = undefined;`, `readonly` for the twin. Precondition `metric-already-violating`: the class is already mutable by the FF-DT03 definition, so a seed would only change an existing row.

**MO-D05 / D05n / D05a**: "published" means a public-API file of B or a file that one of B's public-API files re-exports (the template's M1 rule, `Docs/v1.3-ddd-notes.md` §6). MO-D05 sources lie outside A's ACL; MO-D05a sources lie inside it.

**MO-D06 / D06n**: one site per directory holding a context file. MO-D06 creates `<source_root>common/<dir>-helpers.ts` (the first `common`, `common2`, … that no file or context uses) exporting `describe<Dir>(): string`; the twin creates the same file in the directory itself. No imports, so no other rule can see it.

**Preconditions** (reason codes; the four new ones are added to `PRECONDITION_REASONS`):

| Reason | Meaning here |
|---|---|
| `edge-exists` | the source already imports the target |
| `cycle-cap` | twins: the planned edge would close a cycle in the base graph (a twin must add no blocking row) |
| `layer-pair` | the planned import breaks the layer graph (DDD operators, so the expected key is the DDD rule's alone; injection twins) |
| `ddd-boundary` | on a `ddd` spec, a hexagonal operator's edge would cross into another context's unpublished files or reach an inner entity from outside its aggregate (so S01/S04 positives are not attributed to DDD rules, and twins stay legal) |
| `no-port` | MO-H04: the class implements no port, so there is nothing to drop (or keep) |
| `type-shape` | the class changed, cannot take a parameter, or (MO-H07) the edge would not close a cycle; (MO-D02) the file exists |
| `already-imported` | MO-H05: the file already imports the package |
| `metric-already-violating` | MO-D03: the value object is already mutable |

Every application is type-checked with the base's own tsc (`--noEmit`); any error makes the row a `typecheck` row, never repaired (BR-U5a-07).

## 3. Detection and false fire

- A base (a project under a spec) is evaluated unmodified once. A mutant violation is **new** when no base violation has the same function id, file, target and discriminator (lines are ignored, so a row whose line moves is not new).
- An expected key is (function id, file, target) from the location rule; class-keyed rules (`port-adapter-pattern`, `value-object-immutability`, `domain-state-purity`) also need the class in the discriminator; a `no-cyclic-deps` key needs both files in the reported cycle.
- A positive is **detected** when every expected key is matched by a new violation. Per-template hit counts are reported too.
- A twin **false-fires** when its mutant has any new violation of a blocking rule (v1.3 tiers, `src/scoring-engine/rule-tiers.ts`), not only of its positive's rule. New advisory rows are recorded but do not count.
- Recall and false-fire rates carry 95 % Wilson intervals (`scripts/lib/stats.ts`). Sites within a base are not independent (they share a project); the intervals are the "if independent" bound, as in ADR-020 item 3.

## 4. Known limits

1. **Optional injected parameters are invisible to FF-P06 and FF-P02.** The extractor resolves a constructor parameter's type symbol (`src/apg-extractor/edge-extractor.ts`); the type of `x?: T` under `strict` is `T | undefined`, a union with no symbol, so no CONSTRUCTOR_INJECTS edge is written. Found in the first trial run of MO-H06 (all `optional`-form seeds missed FF-P06 while S01 and S04 fired). The operators therefore prefer the `default-new` form; rows record the form, and the run reports FF-P06 hits per form. This is an extractor gap, not an operator defect, and is not fixed here (the extractor is shared with the frozen instrument).
2. **MO-H03 seeds an advisory rule.** In both libraries an adapter-to-adapter import is reported only by `layer-skip-graph`, sealed advisory (`Docs/v1.3/rule-tiers.md`; the DDD notes propose an ADR to make it blocking). Its recall is reported separately and does not enter the blocking figures.
3. **FF-P06's field half** (FLOWS_TO / HOLDS_STATE_OF) is N/A under the sealed tiers, so no operator plants a field-held adapter.
4. **MO-H04 depends on the adapter-role names**: an outbound class named otherwise is not checked by the template and is not a site.
5. **FF-DS02 deep imports of published files** (probe g03, `Docs/v1.3-ddd-notes.md` §6 M2) are not seeded: MO-D05 targets unpublished files only, so its recall does not measure that gap.
6. **DDD sites need declarations.** On a spec without inner entities (DDH, bitloops) MO-D01 and MO-D02 have no site; without an ACL folder MO-D05a has none.
7. **Real-project specs are author-written** (§5) and were written by the operator author before any operator ran, but after the projects' layouts were read. They are development data, not registered specs.

## 5. Real-project specs

`experiments/v1.3-operators-hexddd/arch/<project>-<style>.yaml` holds the architecture block; `build-specs.mjs` appends the `fitness_functions` and `scoring` of `presets/<style>.yaml` verbatim (`specs/`). Rule used to write each block, fixed before any operator was run on the project:

- **Layers by folder role**: `domain/**` (and the project's shared DDD base library) is the core; use-case folders (`interactors`, `commands`, `queries`, `application`, and outbound ports declared outside `domain`) are `application`; controllers, resolvers, request/response DTOs and the HTTP/API folder are the inbound adapters (`api` in DDD); persistence folders (`dal`, `database`, `repository`, infra libraries) are the outbound adapters (`infrastructure`); `main.ts`, `app.module.ts`, `*.module.ts` and config folders are the composition root. Where a folder mixes roles (DDH's `commands/<x>/` holds both controller and service) the inbound file-name globs are listed first, since the first matching layer wins.
- **Contexts**: the top-level business modules (zddd `accounting`, `cart`, `delivery`, `warehouse`; DDH `user`, `wallet`; bitloops `iam`, `marketing`, `todo`). Public API: module files, inbound ports (zddd), DTOs and domain events (DDH), `contracts/**` (bitloops). ACL: the outbound clients of other contexts (`api/**`, zddd only). Cross-cutting folders are outside the contexts.
- **Aggregates**: zddd: per module with a `domain/entities/` folder, root = `<module>.entity.ts`, inner entities = the other `*.entity.ts` there. DDH and bitloops: one aggregate per `*.entity.ts`, no inner entities (none can be identified by a folder rule).
- **Value objects, repositories, events, application services**: by the projects' own suffixes (`object-values/`, `value-objects/`, `*.value-object.ts`; `*.repository.ts`, `*.repo-port.ts`; `DomainEvent`).

## 6. Change log

- 2026-10-16: first version (25 entries).
