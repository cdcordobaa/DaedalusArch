# v1.3 member facts and value-object immutability (FF-DT03)

Branch `v1.3-member-facts`, cut from `origin/v1.3`. A unit of the approved AI-DLC v1.3 cycle. It closes the extractor gap M3 of `Docs/v1.3-ddd-notes.md` §6 (probe g01: a value-object `set` accessor is invisible to the extractor) and lets FF-DT03 check the construct the sealed tier names ("checked as a declaration fact (readonly, no setters)", `Docs/v1.3/rule-tiers.md`) instead of a setter-name proxy.

Not done here, by instruction: no pre-registration work, no run or edit of the reference manifests (`tests/fixtures/v1.3-reference/**`, `results/v1.3-reference/**`), no edit of `aidlc-docs/audit.md` or `aidlc-docs/aidlc-state.md`, no edit of the sealed `Docs/v1.3/*` files or of `presets/*.yaml`.

## 1. Extractor: class-member facts

New option `ExtractorOptions.memberFacts`: **OFF** in `V12E_DEFAULT_OPTIONS`, **ON** in `V13_DEFAULT_OPTIONS` (so in `DEFAULT_OPTIONS` on this branch), like `dynamicImports`, `moduleWiring` and `reExportEdges`. Code: `src/apg-extractor/member-facts.ts`, called from `node-extractor.ts`.

### Properties on existing nodes, not Member nodes

The facts are written as properties of the existing Class and Method nodes. Reasons:

- Every fact is a list of member names, which Neo4j stores as a property (`flattenProperties` keeps arrays). No fact needs an edge to point at a member.
- A `Member` node type with `HAS_MEMBER` edges would change the node and edge set that other readers count or filter: the abstraction ratio and orphan counts, the graph-mode allow-list (`ast-only`), the ingestion count checks, the report graph and the judge excerpt. Each would need its own v1.3 decision. Properties on Class nodes change none of them.
- Methods are already nodes (CONTAINS from the class). Their per-method facts go on them.
- The template then needs one `MATCH (c:Class)` and no traversal.

### Class node properties (with `memberFacts`)

Every list holds member names in source order, without duplicates. A `#private` name keeps its `#`. A constructor parameter property (`constructor(readonly value: number)`) is a field.

| Property | Content |
|---|---|
| `fields` | property declarations and constructor parameter properties, instance and static |
| `readonlyFields` | the `readonly` ones |
| `staticFields` | the `static` ones |
| `publicFields`, `protectedFields`, `privateFields` | visibility: an explicit `public` or no modifier is public; `#name` is private |
| `getAccessors`, `setAccessors` | non-static `get` / `set` accessors, any visibility |
| `mutatorMethods` | public non-static methods, and public non-static properties initialised with an arrow function, whose body assigns a `this.<field>` |
| `fieldsAssignedOutsideConstructor` | fields assigned through `this.<field>` in any non-static member body other than the constructor (methods of any visibility, accessors, arrow-function initialisers) |

### Method node properties (with `memberFacts`)

`visibility` (`public` / `protected` / `private`) and `assignedFields` (the `this.<field>` names the body assigns).

### What counts as an assignment

`=` and every compound assignment (`+=`, `??=`, …), prefix and postfix `++` / `--`, `delete this.x`, and `this` fields inside a destructuring assignment (`[this.a, this.b] = …`). The target must be the object's own field: `this.x`, `this.#x` or `this['x']`. Not counted:

- `this.x.y = …` and `this.items.push(…)`: they mutate what a field holds, not the field. Deep immutability is not a declaration fact (§4).
- assignments to another instance (`other.x = …`, as in a `with…` copy method).
- assignments inside a nested `function`, class or object-literal method (their `this` is another object). Arrow functions are walked: they share the member's `this`.

Static accessors and static methods are left out of the accessor and mutator lists: they act on the class, not on a value.

### v1.2E byte-identity

As in `aidlc-docs/construction/v1.3-barrels/barrels-notes.md` §1: the full `APGResult` JSON was hashed (SHA-256 of `JSON.stringify`) with `V12E_DEFAULT_OPTIONS` on a worktree of `origin/v1.3` and on this branch, over **every fixture project in the repository** (each directory with a `tsconfig.json` under `fixtures/` and `tests/fixtures/`, 20 projects): the 5 golden fixtures, six `fixtures/unit/*` projects (`antipattern-nest`, `u2-alias`, `u3-reexport`, and the three under `u3-state-purity`), `fixtures/unit/v13-barrels`, `tests/fixtures/{hexagonal/clean,hexagonal/violating,u5a/no-domain}`, and the five v1.3 reference projects (`clean-architecture/project`, `ddd/clean`, `hexagonal/project`, `layered/project`, `nestjs/project`). All 20 hashes are **identical**.

The same check with `{ ...V13_DEFAULT_OPTIONS, memberFacts: false }` on this branch against `V13_DEFAULT_OPTIONS` on `origin/v1.3`: all 20 identical. So the option changes nothing else in the v1.3 graph either. `v13-member-facts.test.ts` asserts both properties in the suite (no fact property under the v1.2E defaults; for the 5 golden fixtures, the v1.3 graph minus the member facts equals the v1.3 graph without the option).

The new fixture `fixtures/unit/v13-member-facts` was added after the hash check and is not in the 20.

## 2. FF-DT03 value-object-immutability over the member facts

### Definition

Source: Evans, E. (2003). *Domain-Driven Design*, ch. 5, VALUE OBJECTS: treat a value object as immutable; do not change it, replace it (the row of `Docs/v1.3/style-rule-sources.md`; also Vernon 2013, ch. 6). The definition is unchanged from `Docs/v1.3-ddd-notes.md` §1 "definition used (literature)"; what changes is that the tool now evaluates it.

A class declared in a value-object file (the spec's `ddd.value_objects` globs) is **mutable** when any of these holds:

- **(a)** it has a **public, non-readonly, non-static field**: a property declaration or a constructor parameter property;
- **(b)** it has a **non-static `set` accessor**, of any visibility;
- **(c)** it has a **public non-static method** (or a public arrow-function property) **whose body assigns a `this.<field>`**. The constructor is not a method, so assignment in the constructor only is immutable.

Consequences of the definition:

- Private (or protected) fields behind public getters only are immutable, even when not `readonly`.
- A private helper that assigns a field is not a mutation by itself (clause (c) needs a public method). A public method that calls it is not seen (§4).
- A static mutable field (a class-level counter) is not part of a value's state; it is not reported.
- A public non-readonly arrow-function property is reported under (a): it can be reassigned from outside.

Each clause is a precise structural fact about declarations (a modifier, an accessor, an assignment statement in a method body), so the rule fits the blocking tier sealed for it. No threshold, name or ratio is involved.

### Template

`DDD_MEMBER_FACT_TEMPLATES` in `src/fitness-compiler/ddd-templates.ts`, a v1.3 extension template beside the frozen DDD catalogue (as `DDD_LITERAL_VIEW_TEMPLATES` is):

```cypher
MATCH (c:Class)
WHERE ANY(p IN $valueObjectPatterns WHERE c.filePath =~ p) /*EXCLUDE:c*/
WITH c,
     [f IN coalesce(c.publicFields, [])
        WHERE NOT f IN coalesce(c.readonlyFields, []) AND NOT f IN coalesce(c.staticFields, []) | c.name + '.' + f + ' (public mutable field)']
     + [s IN coalesce(c.setAccessors, []) | c.name + '.' + s + ' (set accessor)']
     + [m IN coalesce(c.mutatorMethods, []) | c.name + '.' + m + ' (mutator method)'] AS members
WHERE size(members) > 0
RETURN c.filePath AS filePath, c.name AS class, reduce(acc = head(members), x IN tail(members) | acc + ', ' + x) AS method,
       members
ORDER BY filePath, class
```

**One row per mutable value object**, not one per member: the rule's unit is the value object, the manifests name one finding per class, and the reference runner matches findings one-to-one by rule and file (`scripts/v1.3/lib/compare.ts`), so a second row for a second member of the same class would be scored as a false positive. `members` lists every offending member with its clause (clause order, then source order); `method` joins them for the message. A first version emitted one row per member; it was changed before commit, after reading `compare.ts`, not after any reference run. It reads no edge, so its edge view stays `none` (`Docs/v1.3/edge-views.md` lists it as "reads CONTAINS only", which was the proxy text; the view is the same).

### Selection

- New compile flag `CompileOptions.memberFacts`, **ON** in `V13_COMPILE_OPTIONS` (the pipeline's `CompileCommand` and `validate --rules v1.3`), OFF otherwise. `compileDddFunctions` picks the member-fact text for FF-DT03 when the flag is set; the frozen compile (`{}`) keeps the setter-name proxy text byte for byte. The `clean-architecture`, `nestjs` and `layered` compiles do not reach this path.
- The member-fact text binds only `$valueObjectPatterns` (no `$setterPattern`).
- On a graph extracted without `memberFacts` (v1.2E) the lists are absent and the query returns **no row**. It is not a fallback to the proxy: the v1.3 compile goes with the v1.3 extraction, as the literal-view `context-isolation` text does.

### Result mapping

The evaluator looks a mapping up by template name, so both texts share one mapping. It keeps the discriminators `['class', 'method']` (violation ids of proxy rows are unchanged). The message changed from "declares setter {method}", which is wrong for a field or an accessor, to `Value object {class} in {filePath} is mutable through {method}`. The `tag` the report shows is still the proxy's `pattern-proxy` (looked up by name); the member-fact template is tagged `structural`.

### Tier

FF-DT03 was already `blocking` in the preset, the built-in library and `DDD_RULE_TIERS`, as sealed. Nothing changes. Proposed ADR 1 of `Docs/v1.3-ddd-notes.md` §2 (keep FF-DT03 advisory until the extractor records member modifiers) is answered by this unit under the v1.3 options: the condition evaluated is now the sealed construct. Under the frozen compile it is still the proxy.

## 3. Expected effect on the reference set (not run)

The reference manifests were neither run nor edited. The effects below are read off the variant files and the extractor's facts for them. They are predictions for the next reference run, which uses `V13_DEFAULT_OPTIONS` and `V13_COMPILE_OPTIONS`.

- **DDD g01** (`Quantity` with `private current` behind `get value` / `set value`). Facts: `setAccessors: ['value']`, `privateFields: ['current']`, no public field, no mutator method. Clause (b) gives one row, `Quantity.value (set accessor)`, on `src/ordering/domain/value-objects/Quantity.ts`. Both manifests (author and blind) expect FF-DT03 on that file. **Expected: the miss becomes a match.** M3 closes. DDD FF-DT03 recall on this set: 1/2 → 2/2; DDD blocking recall 8/9 → 9/9 (author); the planted rule detected in 12/12.
- **DDD v03** (`constructor(public value: number)` plus `setValue(value) { this.value = value; }`). Facts: `publicFields: ['value']`, not readonly; `mutatorMethods: ['setValue']`. One row for the class, `method` = `Quantity.value (public mutable field), Quantity.setValue (mutator method)`, on the same file. The manifest has one FF-DT03 entry for the file, so **expected: still a match**, with no extra row. The proxy found it through `setValue` only; now both reasons the manifest gives ("a public setter (setValue) and a non-readonly field (value)") are in the row. The violation id changes (its `method` discriminator is different), which matters only to a comparison of ids across runs.
- **The value objects of the clean project** (`CustomerId`, `OrderId`, `Quantity`, `InvoiceId`: one `readonly` parameter property each; `Money`: `private constructor(readonly cents, readonly currency)`, a static factory, methods returning new instances). No public mutable field, no accessor, no method assigns a `this` field. **Expected: no row**, in the clean variant and in every variant that keeps these files.
- **DDD v04** overlays `InvoiceId` with a static `fromPlain` (calls a framework, assigns nothing). Static methods are excluded and nothing is assigned. **Expected: no FF-DT03 row**; its FF-DT04 finding is unaffected.
- **Near-misses.** DDD n01 (ACL internal import) and the probe g02 (import through a barrel) touch no value-object file: **no FF-DT03 row, no change**. The near-misses of the other four styles (clean-architecture, hexagonal, layered, nestjs n01–n03) are not affected: FF-DT03 is in the `ddd` preset only, and the facts are only properties that no other template reads. The proxy's known false-positive shape (a side-effect-free `setScale()` returning a new instance, `Docs/v1.3-ddd-notes.md` §2) is no longer reported under the v1.3 compile; no reference variant contains one.
- **Other rules.** No other template reads the new properties, so no other finding changes.

## 4. What the definition does not cover

- **Deep mutability**: a `readonly items: number[]` with a public `add(n) { this.items.push(n); }` is not reported. Mutation of a held object is not a declaration fact without type and alias analysis.
- **Mutation through a private helper**: a public method that calls a private method that assigns a field. The CALLS edges exist, but following them makes the fact transitive; left for a later unit if a case needs it.
- **Inherited members**: a value object that extends a mutable base class is checked on its own declarations only.
- **Mutation from outside the class** (`(q as any).current = 1`) and `Object.assign(this, …)`: not seen.
- **A value object that is not a class** (a type alias or interface with a factory function): the rule matches Class nodes only, as before.

## 5. Tests

- `tests/unit/apg-extractor/v13-member-facts.test.ts` (19 tests), fixture `fixtures/unit/v13-member-facts`: option defaults; readonly parameter properties and static readonly (`Money`); private fields with public getters only, assigned only in the constructor (`Email`, immutable); visibility, readonly and static facts (`Counter`); set accessor (`Quantity`, the g01 shape); mutators: public methods and arrow properties count, private, protected, static, nested-function and other-object assignments do not (`Range`); Method `visibility` and `assignedFields`; assignment forms (compound, `++`/`--`, `delete`, destructuring, `this['x']`, nested arrow; not `this.o.x =` or `push`); constructor-only assignment; static accessors; v1.2E byte-identity (no fact property with the v1.2E defaults; the 5 golden fixtures equal without the facts).
- `tests/unit/ddd/ddd-member-facts.test.ts` (11 tests, 2 of them on Neo4j): the preset compiled with `V13_COMPILE_OPTIONS` selects the member-fact text, the frozen compile and `memberFacts: false` keep the proxy text; parameters; Cypher text pins; `exclude_paths` injection; the shared mapping; the compiled query evaluated by a TypeScript mirror over the extracted fixture gives exactly the three expected rows (`Counter` through `count`; `Quantity` through the `value` set accessor; `Range` through `widen`, `swap` and the arrow property `bump`), none for `Money`, `Email` or the entity `Order` outside the value-object globs, and none on a v1.2E extraction.
- `tests/unit/ddd/ddd-neo4j.test.ts`: `KNOWN_GOT_V13` no longer lists g01, so under the v1.3 compile every DDD case is expected to equal its manifest. The frozen-compile expectations (`KNOWN_GOT`, and `KNOWN_MISMATCHES` in `ddd-reference.test.ts`) still record g01 as missed, which stays true for the proxy text.

**Neo4j was not available in this environment** (no `NEO4J_PASSWORD`; it is a cloud container). The two Neo4j tests of `ddd-member-facts.test.ts` and all of `ddd-neo4j.test.ts` were **skipped** (the guard prints the reason), so the Cypher of the member-fact template has not run against a database. It was checked through the mirror and by text. Run before trusting it:

```
NEO4J_PASSWORD=… npx jest tests/unit/ddd/ddd-member-facts.test.ts tests/unit/ddd/ddd-neo4j.test.ts
```

The parts most worth seeing run: the concatenation of list comprehensions over stored string lists, `NOT f IN coalesce(…, [])` on an empty stored list, and the `reduce` over `head` / `tail`.

### Other tests adapted

- `tests/unit/fitness-compiler/v13-fix-round.test.ts` pins `V13_COMPILE_OPTIONS`; it now includes `memberFacts: true`.
- `tests/unit/apg-extractor/v13-reexport-edges.test.ts` › "nodes … are the same in both modes" compares the re-export modes with the v1.3 defaults on one side; the member-fact properties (`MEMBER_FACT_KEYS`, a separate option) are removed before the node comparison. Edges, warnings, coverage and import statistics are compared unchanged.

### Full unit run

`npx jest --maxWorkers=4` on this branch (commit `a1c64630`): **4032 passed, 6 failed, 40 skipped** (4078; 276 suites passed, 5 failed, 2 skipped). The 6 failures also fail on a worktree of `origin/v1.3` in this container, run the same way, and none touches this unit's code: `replay-no-binary.test.ts` ×2, `skeleton.test.ts` (`npm ci --offline`), `guards.test.ts` (`origin/v1.2e` not fetched), `score-golden-acceptance.test.ts` (git history), `import-graph-parity.test.ts` (F-BARREL parity with the literal barrel edges of the v1.3 extractor). The 40 skipped include every Neo4j test.

tsc (`npx tsc --noEmit`) passes. The new files are lint-clean (`eslint`). The edited source and test files have the same lint errors as on `origin/v1.3` (all on lines this unit did not touch).

## 6. Open items

1. Run the two Neo4j suites above.
2. The next reference run (not this unit) will show whether §3's predictions hold; the g01 row in `Docs/DiagnosticRuns/v1.3-reference-after-fixes-2026-10-15.md` §5 is the one expected to go.
3. `presets/ddd.yaml` still carries the comment "The check is still a method-name proxy"; it is true of the frozen compile only. The preset was not edited (registered pattern `presets/*.yaml`, no pre-registration work in this unit).
4. Proposed ADR 1 of `Docs/v1.3-ddd-notes.md` §2 can be closed by the author with a pointer to this unit.
5. §4's gaps (deep mutability, private helpers, inheritance), if a case needs them.
