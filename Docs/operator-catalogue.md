# Operator Catalogue (DRAFT)

> **Status: DRAFT** (U5a Code Generation, 2026-10-08; D-U5a-10). Frozen in Build and Test after the dev-split declaration gate (BR-U5a-36 a), the base type-check measurement and the site-feasibility table (BR-U5a-36 b, c) and the `sitesPerOperator` rule (BR-U5a-37), before the FR-18 re-baseline or the first corpus/E1 run (BR-U5a-40). `catalogueVersion` = sha256 of this file's bytes (BR-U5a-38); every manifest header and row carries it, so the freeze edit changes it.
> **Source of truth**: the operators are built in code (`scripts/lib/mutation/operators/index.ts`); `tests/unit/scripts/mutation/catalogue.test.ts` asserts that the entry table below and the registry match one to one on id, twin, dimension, expected templates, coverage and source (BR-U5a-39).
> **Design**: `aidlc-docs/construction/v1.2E-u5a-mutation-manifest-generator/functional-design/business-rules.md` §3 (operator content), BR-U5a-01..40; worked sites and keys in `business-logic-model.md` §2.3–§2.5.

## 1. Entries (11 operators, 11 twins)

Expected templates name C5 templates; function ids are resolved per spec at seeding time (BR-U5a-19), never written here. "Operator collateral" templates are keyed like the expected keys (BR-U5a-14); site collateral (new cycles, metric crossings, created files without a test, project-level metrics) is computed per application. Twins carry no expected key; a twin is checked by the dev-split gate for undeclared new keys (BR-U5a-22, 36 a).

| Id | Core | Dimension | Tags | Defect | Expected templates | Coverage | Site kinds | Preconditions | Operator collateral | Twin | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MO-S01 | yes | structural | — | domain file imports and uses (value reference) an infrastructure symbol | `dependency-direction`, `no-domain-outward-dep` | in | `import-edge` | `edge-exists`, `cycle-cap` | — | MO-S01n | Martin 2017 |
| MO-S01n | yes | structural | twin | non-controller infrastructure file imports a non-entity domain symbol it does not yet import | — | in | `import-edge` | `controller-or-entity`, `edge-exists`, `cycle-cap` | — | MO-S01 | Martin 2017 |
| MO-P01 | yes | pattern | — | domain file default-imports a package of the spec's FF-P01 forbidden list | `domain-purity` | in | `package-import` | `already-imported` | — | MO-P01n | Martin 2017; Evans 2003 |
| MO-P01n | yes | pattern | twin | non-controller infrastructure file imports the same package | — | in | `package-import` | `controller-or-entity`, `already-imported` | — | MO-P01 | Martin 2017; Evans 2003 |
| MO-C04 | yes | coupling | — | new layered file with no imports and no importer | `no-orphan-files` | in | `created-file` | — | — | MO-C04n | Lippert and Roock 2006 |
| MO-C04n | yes | coupling | twin | the same new file imported by an existing module of its layer | — | in | `created-file` | `cycle-cap` | — | MO-C04 | Lippert and Roock 2006 |
| MO-SO01 | yes | solid | — | methods added past max_public_methods (t − b + 1) | `single-responsibility-proxy` | in | `class-members` | `metric-already-violating` | — | MO-SO01n | Martin 2003 |
| MO-SO01n | yes | solid | twin | methods added up to exactly the threshold (t − b) | — | in | `class-members` | `metric-already-violating`, `threshold-arithmetic` | — | MO-SO01 | Martin 2003 |
| MO-CV02 | yes | convention | — | application class renamed from the frozen list (contains Service/UseCase, ends with neither) | `naming-services` | in | `class-rename` | `type-shape` | `naming-conventions` | MO-CV02n | Martin 2008; BR-U1-38 |
| MO-CV02n | yes | convention | twin | application class renamed to another conforming name | — | in | `class-rename` | `type-shape` | `naming-conventions` | MO-CV02 | Martin 2008; BR-U1-38 |
| MO-DF01 | yes | pattern | checks: data-flow (FR-21) | domain class holds private readonly field = new InfraClass() | `domain-state-purity` | in | `field-new` | `edge-exists`, `type-shape`, `cycle-cap` | `dependency-direction`, `no-domain-outward-dep` | MO-DF01n | FR-21; Evans 2003 |
| MO-DF01n | yes | pattern | twin, checks: data-flow (FR-21) | non-controller infrastructure class holds new DomainClass(primitive literals) | — | in | `field-new` | `controller-or-entity`, `edge-exists`, `type-shape`, `cycle-cap` | — | MO-DF01 | FR-21; Evans 2003 |
| MO-X01 | yes | structural | outside coverage | domain class loads an infrastructure module with import() | `dependency-direction`, `no-domain-outward-dep` | outside | `dynamic-import` | `edge-exists`, `threshold-arithmetic`, `type-shape` | — | MO-X01n | Martin 2017 |
| MO-X01n | yes | structural | twin, outside coverage | non-controller infrastructure class loads a non-entity domain module with import() | — | outside | `dynamic-import` | `controller-or-entity`, `edge-exists`, `threshold-arithmetic`, `type-shape` | — | MO-X01 | Martin 2017 |
| MO-X02 | yes | semantic | judgeProbe: semantic | entity guard moved into a controller handler as inline checks on request data | — | outside | `guard-move` | `not-removable-guard`, `type-shape`, `entity-import`, `judge-unit-not-selected` | — | MO-X02n | Fowler 2002; Evans 2003 |
| MO-X02n | yes | semantic | twin, judgeProbe: semantic | local extraction inside a controller handler (no import, no rule moved) | — | outside | `guard-move` | `judge-unit-not-selected` | — | MO-X02 | Fowler 2002; Evans 2003 |
| MO-SO02 | extension | solid | — | interface method signatures added past max_interface_methods (t − b + 1), implementers completed | `interface-segregation-proxy` | in | `interface-members` | `metric-already-violating`, `implementer-over-threshold` | — | MO-SO02n | Martin 2003 (ISP) |
| MO-SO02n | extension | solid | twin | interface signatures added up to exactly the threshold (t − b) | — | in | `interface-members` | `metric-already-violating`, `threshold-arithmetic`, `implementer-over-threshold` | — | MO-SO02 | Martin 2003 (ISP) |
| MO-X03 | extension | integrity | judgeProbe: integrity | entity invariant split into a free rule module imported by the use case and duplicated inline | — | outside | `invariant-split` | `not-removable-guard`, `type-shape`, `judge-unit-not-selected`, `cycle-cap` | — | MO-X03n | Evans 2003 |
| MO-X03n | extension | integrity | twin, judgeProbe: integrity | entity invariant extracted into a private method of the same entity | — | outside | `invariant-split` | `threshold-arithmetic`, `judge-unit-not-selected` | — | MO-X03 | Evans 2003 |
| MO-S03 | extension | structural | layered only | presentation file imports a persistence symbol directly | `no-layer-skip` | in | `import-edge` | `style-disabled`, `edge-exists`, `cycle-cap` | — | MO-S03n | Buschmann et al. 1996 |
| MO-S03n | extension | structural | twin, layered only | presentation file imports a non-entity business-layer symbol | — | in | `import-edge` | `style-disabled`, `edge-exists`, `cycle-cap` | — | MO-S03 | Buschmann et al. 1996 |
Measurement policy (BR-U5a-01, 05): golden-set instances are held-out rows of symbolic positives (in or outside coverage). Twins, the judge probes MO-X02/MO-X03, dev rows and SP probe rows never count. No golden operator targets the ratio or cannot-fire templates `dependency-inversion` (FF-P02), `domain-stability` (FF-C01), `component-instability` (FF-C03) or `abstraction-ratio` (FF-C06), nor `naming-conventions` (FF-CV01) or `naming-controllers` (FF-CV04); they appear only as collateral or as SP probes, and FF-CV01/FF-CV04 recall is measured by SP probes only (ADR-016 b). MO-DF01 records dimension `pattern` with the tag `checks: data-flow (FR-21)`; no row carries `data-flow` (BR-U5a-21).

## 2. Site rules and edits

| Id | Site | Edit (as implemented) |
|---|---|---|
| MO-S01 / MO-S01n | (source file, target file, symbol); `line` 1 | `import { <symbol> } from '<relative>';` after the existing imports, plus `export const <symbol>Ref = <symbol>;` (value) or `export type <symbol>Ref = <symbol>;` (type) at the end |
| MO-P01 / MO-P01n | (file, package) over the literal entries of FF-P01 `forbidden_imports` | `import <local> from '<package>';` plus `export const <local>Ref = <local>;`; an unresolvable package gets a default-export stub (BR-U5a-10) |
| MO-C04 / MO-C04n | created `<dir>/OrphanHelper.ts` in each directory holding a layered file (twin: × importer of the same layer) | file `export const orphanHelperValue = 1;`; twin adds `import { orphanHelperValue } from './OrphanHelper';` to the importer |
| MO-SO01 / MO-SO01n | named class of a layered file, `detail.limit` = `max_public_methods` | `extraOperation<i>(): number` methods appended |
| MO-SO02 / MO-SO02n | interface of a layered file, `detail.limit` = `max_interface_methods`, `detail.classLimit` = `max_public_methods` | `extraQuery<i>(): number;` signatures; each implementer gains `extraQuery<i>(): number { return 0; }` |
| MO-CV02 / MO-CV02n | class of an application-kind layer whose name contains `Service` or `UseCase` | ts-morph symbol rename (references updated, file name unchanged) to a name drawn with the application RNG from §3 |
| MO-DF01 / MO-DF01n | (holder class, target class) | `private readonly repo = new <InfraClass>();` (twin: `private readonly held = new <DomainClass>('u5a' \| 0 \| false …);`) plus the class import |
| MO-X01 / MO-X01n | (file with a class, module file) | `async load<Name>Module(): Promise<unknown> { return import('<relative>'); }` added to the file's first class |
| MO-X02 / MO-X02n | (entity guard method, controller handler) | guard method and its guard statements removed; `if (!(<rule>)) { throw new Error('Invalid request data'); }` first in the handler (twin: `const result = <expr>; return result;`) |
| MO-X03 / MO-X03n | entity guard method whose guards sit in one use case | `<domain root>/rules/<entity>Rules.ts` exporting `<method><Entity>(<fields>): boolean`, imported and called by the use case, rule duplicated inline before construction (twin: `private <method>Invariant(): boolean`) |
| MO-S03 / MO-S03n | (presentation file, persistence / business file, symbol) | as MO-S01 |

The FR-24 acceptance uses the forced sites of `business-logic-model.md` §2.3 (BR-U5a-55); their keys are pinned in `tests/unit/scripts/mutation/expected-keys.test.ts`.

## 3. MO-CV02 rename list (frozen; BR-U5a-23)

| Role | Rule | Values |
|---|---|---|
| Positive | `<name><suffix>` | suffixes `Impl`, `Default`, `Core` |
| Twin | `<prefix><name>` when `<name>` ends with `Service` or `UseCase`, else `<prefix><name>Service` | prefixes `Default`, `Core`, `Main` |

Candidates equal to an existing class name are dropped; the name is drawn with `mulberry32(rngSeed)` (`rng.pick` over the remaining candidates, list order). Positive names contain `Service` or `UseCase` and do not match U1's compiled FF-CV02 pattern `^(?:[^/]*Service|[^/]*UseCase)$`; twin names match it.

## 4. Seeds

- `masterSeed = 20261008` (BR-U5a-15).
- `rngSeed = uint32BE(sha256(utf8(masterSeed + '|' + projectId + '|' + operatorId + '|' + k))[0..3])`; the site sample uses `k = 'select'`, the BR-U5a-37 subsample `k = 'subsample'`.
- Pinned vector (Step 6, cross-checked by an independent `node -e` computation): `(20261008, correct-reference, MO-S01, 0)` → `2184350454`; `(20261008, correct-reference, MO-S01, 'select')` → `757368179`. `mulberry32(1)` first three outputs: `0.6270739405881613`, `0.002735721180215478`, `0.5274470399599522`.
- `sitesPerOperator: TBD` — set and dated at the freeze by the BR-U5a-37 rule over the held-out feasibility table.

## 5. SP-* sensitivity probes

Placeholder: the SP-* probe set (one probe per compiled symbolic function, `split: 'probe'`, fixtures only; BR-U5a-30) and its own hash are added by U5a plan Step 33. The SP hash is `TBD` until then.

## 6. Changelog

| Date | Change |
|---|---|
| 2026-10-08 | DRAFT: 22 entries registered in code (U5a plan Step 31); rename list, master seed and vectors recorded; `sitesPerOperator` and the SP section pending |
