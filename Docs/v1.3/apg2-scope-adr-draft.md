# ADR draft: scope of the APG v2 templates (composition roots, ACL, tests, one edge one rule)

**Date**: 2026-10-15. **Status**: Draft, for the author. Branch `v1.3-apg2-scope`, base `origin/v1.3` at `95637b7`.

**Written and committed before any re-measure.** The live run of `Docs/DiagnosticRuns/apg2-live-2026-10-15.md` (§2.3, §2.4) named the false alarms. Each change below is decided on the construct of the rule, with a literature reason. The numbers in that run are why the scope was looked at; they are not the reason for any change. The minimum type count of change 5 is fixed here, before the fixture components' type counts are looked at.

This is a v1.3 development-cycle decision about the APG v2 extension templates (`src/fitness-compiler/apg2-templates.ts`). It does not change:

- Study 1 (v1.2E, frozen): the v1.2E extraction stays byte-identical (`tests/unit/apg-extractor/v12e-byte-identity.test.ts`);
- the v1.3 default graph: `apg2` stays off in `V13_DEFAULT_OPTIONS`;
- the sealed tier table (`Docs/v1.3/rule-tiers.md`) or `APG2_TEMPLATE_TIERS`: no tier moves;
- any pre-registration or manifest.

## Context

The APG v2 templates are generic: they know components, layers and public APIs, but not the file roles that a style's own rules already exempt. In the live run:

- `src/main.ts`, the DDD composition root, gives 9 `deep-import-declared-api` rows on every DDD variant;
- the DDD anti-corruption layer (n01) gives one more `deep-import-declared-api` row;
- the hexagonal test composition root `config/testContainer.ts` (n02) gives a `boundary-type-leak` row;
- `component-adp-cycle` reports, on layer components, the same backward import that FF-S01 already reports;
- `component-main-sequence-distance` fires on layer components (domain, config) whose stability is prescribed by the style;
- one sub-barrel (`business/model/index.ts`, layered n03) makes the whole `business` layer's inferred public API a single file.

## Changes

Each change has one construct reason.

### 1. Composition roots are exempt from deep-import and boundary-type-leak

**Construct.** Martin (2017, ch. 26 "The Main Component"): Main is the dirtiest component of the system. It creates the factories, strategies and other global facilities, and it may depend on everything; nothing depends on it. Wiring concrete classes from every component, past their public APIs, and naming adapters in its signatures is its job. So an import from Main into a component's internals is not a bypass of that component's information hiding (Parnas 1972 is about what *other modules* rely on, and Main relies on nothing being stable), and an adapter type in Main's signature is not a leak across a boundary Main sits outside of.

**Scope.** Exempt from `deep-import-declared-api`, `deep-import-inferred-api` (the importing file) and `boundary-type-leak` (the member's file). The other templates are unchanged: a composition root that does I/O or reads the clock is still reported by the I/O templates.

**Which files are composition roots** (declared or detected by role, fixed here):

1. *Declared.* A file in a layer whose `roles` include `composition-root` (DDD preset `composition`, hexagonal `config`).
2. *Detected by layer structure.* With `allowed_dependencies`: a layer that no allowed edge points to and that may import every other layer. This is the rule `bindHexagonalLayers` already uses for the hexagonal composition root.
3. *Detected by file name.* The bootstrap and DI wiring names: `main.ts`, `*.module.ts` (the ADR-026 `COMPOSITION_ROOT_GLOBS`), `bootstrap.ts`, `composition-root.ts`, `compositionRoot.ts`, `container.ts`, `*.container.ts`, `di.ts`, in any directory.

### 2. A declared anti-corruption layer may import an upstream context's internals

**Construct.** Evans (2003, ch. 14 "Maintaining Model Integrity", Anti-Corruption Layer): the ACL is the isolating layer that talks to the other system through its existing interface and translates its model into the downstream model. To translate, it must know the upstream model, so its imports of the upstream context's types are the pattern working, not a bypass. This is the exemption FF-DS02 (`context-isolation`) already makes for a declared ACL (sealed tier table: "imports only through the declared public API or ACL").

**Scope.** A file that matches a declared ACL glob (`architecture.ddd.contexts[].acl`) is exempt from `deep-import-declared-api` and `deep-import-inferred-api` for imports into a **module** component (a context or declared module) other than its own. Only declared ACLs count; no ACL is detected by name. The ACL is not exempt from `boundary-type-leak` or the I/O templates.

### 3. Test composition roots and test files are out of scope

**Construct.** The templates check the production architecture: the dependency rule, component coupling, public APIs and core isolation are properties of the shipped code. Test code is a client of that architecture and is outside it. A test composition root wires fakes and exposes them for assertions by design (hexagonal n02: "a second composition root for acceptance tests"). Martin (2017, ch. 28 "The Test Boundary"): tests are the outermost circle, depend inward on everything, and nothing depends on them, which is the position of Main again.

**Which files** (fixed here):

- test files: `*.spec.*` and `*.test.*` (`.ts`, `.tsx`, `.mts`, `.cts`), and any file under a `__tests__`, `__mocks__`, `test` or `tests` directory;
- test composition roots: a file whose name starts with `test` or `Test` followed by an upper-case letter, `-`, `_` or `.` (`testContainer.ts`, `test-module.ts`, `TestContainer.ts`), in any directory.

**Scope.** Every APG v2 template. In the extractor (with `apg2` on), such a file belongs to no component, so it adds nothing to `DEPENDS_ON`, the Martin metrics or the entry files. In the templates, such a file is never the source of a row (the member, the importing file, the publisher or the subscriber). The extractor's default excludes already drop `*.spec.ts` and `*.test.ts`; this change covers the rest.

### 4. One edge, one rule: component-adp-cycle only on components that are not layers

**Construct.** Between ordered layers, every cycle contains at least one import against the allowed direction, and FF-S01 (`dependency-direction`) and FF-S02 (`no-cyclic-deps`) already report that import at file level, with its file and line. A layer-level ADP row restates the same edge one level up, without a file. One violating edge should be reported by one rule. The acyclic dependencies principle (Martin 2017, ch. 14) adds a fact only where no layer order exists: between modules, contexts and folders, where a cycle has no "backward" edge for a layer rule to find.

**Scope.** `component-adp-cycle` reads only `DEPENDS_ON` edges of kind `module` or `folder` (that is, not `layer`). `component-sdp-violation` is not changed by this ADR.

### 5. Main-sequence distance: components with at least 4 types, never layers

**Construct.**

- *Minimum type count.* A = abstract types / types. With n types, A can only take n + 1 values, so with fewer than 4 types one class moves A by at least 1/3 and alone decides whether D crosses the 0.7 threshold. Martin's main sequence (1994; 2017, ch. 14) describes components as populations of classes; A is not a meaningful ratio for one to three types. **The minimum is 4 types** (`typeCount ≥ 4`), fixed here a priori, before the type counts of the fixture or reference components are read. With 4 types A moves in steps of 0.25.
- *Not on layers.* A layer's position on the stability axis is prescribed by the style, not chosen per component. The domain layer of Clean Architecture, Hexagonal and DDD is meant to be maximally stable and holds concrete entities, so it sits near (0, 0) by design. Martin's zone of pain is about components that are both stable and *volatile* (ch. 14: non-volatile components in the zone are harmless). A composition-root layer (A = 1 or 0 with I = 1) is Main, which Martin also places outside the metric's concern. The distance is a design signal for modules, contexts and folders.

**Scope.** `component-main-sequence-distance` reports only components of kind `module` or `folder` with `typeCount ≥ 4`. The Component node keeps its metrics (A, I, D) as descriptive properties; the rule does not read them on layers.

### 6. Sub-barrels count as public API only when the component entry exports them

**Construct.** Information hiding (Parnas 1972): the public API of a component is what the component publishes at its entry. A barrel deep inside a component is an internal convenience of one sub-module. It becomes part of the component's API only when the component entry re-exports it. Treating every barrel as an entry file turns one sub-barrel into the whole component's API and makes ordinary imports of the rest of the component "deep".

**Scope.** Entry files of a component are:

- declared: the files that match its `publicApi` globs; inferred: `index.ts` (`.tsx`, `.mts`, `.cts`) at the component root;
- plus every barrel file (`isBarrel`) in the component that an entry file re-exports, directly or through other such barrels (`RE_EXPORTS` edges, inside the component).

A barrel that no entry file reaches is not an entry file. A component with no root index and no declared API therefore has no inferred public API, and imports into it are not checked (as today for a component with no entry files).

## Consequences

**Predicted before the re-measure** (dev set, 19 clean and near-miss variants; `apg2-live-2026-10-15.md` §2.3 as the before):

- Blocking rows: 29 before, **0 predicted** after. The 27 `src/main.ts` rows (changes 1 and 3: `main.ts`, and the DDD `composition` layer declares `composition-root`), the n01 ACL row (change 2) and the hexagonal n02 row (changes 1 and 3: `config` is a declared and detected composition root, and `testContainer.ts` is a test composition root).
- Advisory rows: 40 before, **21 predicted** after. Gone: the 15 main-sequence rows on layers (clean-architecture domain ×4, hexagonal domain and config ×4 each, DDD domain ×3) and the 4 layered n03 inferred-API rows. Kept: the 18 `nondeterminism-in-core` clock reads (no change here touches them; whether a style forbids them is still an author call) and the DDD `ordering` module's D = 0.71 ×3, if `ordering` has at least 4 types.
- Violation variants: the 9 `main.ts` rows leave all 12 DDD violation variants; the layer-level ADP rows leave the 16 violation variants, which keep their FF-S01 or FF-S04 finding.

**Ablation fixtures.** All 27 planted cases must still be caught, the 19 near-misses must stay silent, and the control must stay clean. Any planted case lost to these changes, for example a main-sequence case in a component with fewer than 4 types, is reported as lost; the minimum is not changed to keep it.

**Not decided here.** The tiers of the APG v2 templates; whether they enter a verdict; `component-sdp-violation` on layers; the `nondeterminism-in-core` clock reads; a "controller signature names a domain entity" template.

## References

- Evans, E. (2003). *Domain-Driven Design*. Addison-Wesley. Ch. 14, Maintaining Model Integrity (Anti-Corruption Layer).
- Martin, R. C. (1994). *OO Design Quality Metrics: An Analysis of Dependencies*.
- Martin, R. C. (2017). *Clean Architecture*. Prentice Hall. Ch. 14 (Component Coupling), ch. 26 (The Main Component), ch. 28 (The Test Boundary).
- Parnas, D. L. (1972). On the criteria to be used in decomposing systems into modules. *Communications of the ACM*, 15(12), 1053–1058.
