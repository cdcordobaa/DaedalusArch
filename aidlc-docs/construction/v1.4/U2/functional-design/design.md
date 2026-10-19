# U2 functional design: two declared post-seal norm rules (D5, N3)

**Cycle:** AI-DLC v1.4 "instrument-alignment". **Map part:** C2 declared norms (P2). **Objective:** SO1.
**Depth:** minimal (no NFR, infrastructure or user-story stages).
**Inputs read:** `ops/decisions.md` (D5, N3); `ops/03-build-list.md` (C2 row); `ops/notes/ns-01-what-rules-cannot-see.md` §3, §4a and §9; `Docs/v1.3/compendium/nulls-and-limits.md` N17; `Docs/DiagnosticRuns/v1.3-reference-baseline-2026-10-15.md` (blind name mapping); `Docs/DiagnosticRuns/v1.3-complementarity-2026-10-16.md` §2 and §5; `Docs/v1.3/construct-decisions.md` Q16; `Docs/v1.3/rule-tiers.md`; `Docs/v1.3/sealed-hashes.md`; `Docs/v1.3/study2-deviation-2026-10-16.md` §2; `presets/*.yaml`; the compiler, tier and rule-gap code in `src/`.

---

## 1. What the unit delivers

Two rules, each added **after the seal** as a declared deviation with its own ADR:

| Rule | Decision | Construct | Rule id | Cypher |
|---|---|---|---|---|
| DDD dependency-cycle rule | D5 (N17) | acyclic dependencies (ADP) in the DDD rule set | **FF-S02** (existing id) | the frozen `no-cyclic-deps` template, **unchanged** |
| Application purity | N3 (Q26, NS-01 §4a) | the delivery mechanism (HTTP framework) is a detail, so no application-layer file depends on it | **FF-P07** (new id) | a new template `application-purity`, the `domain-purity` pattern read over the application layers |

Cypher stays the only rule definition. Neither rule gets a TypeScript mirror. Tests run the Cypher text through the in-process interpreter (`src/cypher-interp`).

---

## 2. Findings from the checks the brief asked for

### 2.1 Does FF-S02 already cover cycles in DDD? No.

- The DDD library `DDD_FUNCTIONS` (`src/spec-parser/ddd-template.ts`) lists ten functions: FF-DS01, FF-DS02, FF-DT01..FF-DT06, FF-S01, FF-S03. There is no FF-S02.
- `presets/ddd.yaml` declares the same ten. The DDD reference scope is "the preset's functions" (`scripts/v1.3/lib/reference-model.ts`), so FF-S02 is outside DDD's compared set. That is why the blind key's ddd FF-S02 row was "not scored" (`Docs/DiagnosticRuns/v1.3-reference-baseline-2026-10-15.md`, blind name mapping), and it is N17.
- **But the construct needs no new Cypher.** The `no-cyclic-deps` template (`src/fitness-compiler/cypher-templates.ts`) has no `applicableStyles` and no `requiredLayerKinds`. It compiles for any style. Its edge view is already `literal` (`src/fitness-compiler/edge-views.ts`).
- **And the tier needs no new row.** The sealed row FF-S02 in `Docs/v1.3/rule-tiers.md` is "blocking — acyclic dependencies principle; a structural fact", with no per-style exception. `ruleTier('FF-S02', 'ddd')` already returns `blocking` from the table.
- **And the change was already designed as construct switch Q16 B.** `Docs/v1.3/construct-decisions.md` Q16 recommends B ("ADP is stated for components in general, not for a style"), and `src/construct-switches/compile.ts` already appends FF-S02 to a ddd spec when Q16 = B. Q16 is still at A.

**So D5 stays minimal.** It changes only the **membership** of the DDD rule set (FF-S02 joins it). The template text and the sealed tier row stay as they are. ADR-V14-01 says exactly this. D5 makes the same change as Q16 B. Recording Q16 = B in the answers file is left to the author (section 8). The switch code stays, and its `!has('FF-S02')` guard makes it a no-op once the post-seal rule is present.

### 2.2 Application purity (Q26)

- FF-P01 `domain-purity` reads `src.layer = $domainLayer` only (`presets/clean-architecture.yaml:71-83`; template in `cypher-templates.ts`).
- The `AP-FRAMEWORK-LEAK` operator plants `import { Request } from 'express'` into **application-kind** layers only (`scripts/lib/mutation/antipatterns/ap-framework-leak.ts:1-17`, `expectedTemplates: []`). On the four styles other than layered (where the business layer is domain-kind, so FF-P01 already sees the seed), every operator seed is symbolic-blind (complementarity §2a and §5). That gives NS-01's tally of 12 K0 seeds.
- **Where the 12 come from** (`results/v1.3-complementarity/rows.csv`): 4 are round-1 operator seeds in the `antipattern-nest` fixture (style nestjs, `symbolicSource` interp, `antipattern-nest__AP-FRAMEWORK-LEAK__0..3`). The other 8 are round-2 operator seeds in E1 projects (stratum `e1-clean-arch`, `symbolicSource` recorded-neo4j). Their bases live outside this checkout (`../daedalus-e1-outcomes`). CHECK-2 adds one more blind operator seed in each of clean-architecture, nestjs, hexagonal and ddd, plus 10 twins. Those were re-materialised offline by `scripts/v1.3/complementarity.ts` and are not part of the 12.
- **A near-identical template already exists, opt-in and advisory:** rule-gap G1 `use-case-framework-free` (`src/fitness-compiler/rule-gap-templates.ts`). It has `applicableStyles: ['clean-architecture', 'hexagonal']`, reuses the spec's **domain** forbidden list, and its a priori tier is advisory. The reason given: "ch. 32 lets some frameworks be 'married'; the forbidden list is the spec's domain list reused, a proxy".
- G1 cannot be promoted as it stands:
  1. Its styles leave out nestjs and ddd. G1 would reach the 8 E1 clean-architecture seeds, but not the 4 nestjs fixture seeds or the CHECK-2 nestjs and ddd seeds.
  2. The domain list (`@nestjs/*`, `typeorm`, ...) would fire on every NestJS or NestJS-hosted DDD application service. Those services legitimately import `@nestjs/common` for `@Injectable()`. Measured: 13 application files in `fixtures/unit/ap-hosts` import `@nestjs/*`. A transport-only list matches 1 application file across `fixtures/` and `tests/fixtures/` (`tests/fixtures/v1.3-rule-gaps/layers/src/application/main.ts`, a fixture that only the rule-gap mirror tests read).
  3. Its advisory tier was sealed a priori for **that** construct.

**So N3 is a new, narrower construct, scoped per style.** Its forbidden list is **HTTP delivery-mechanism packages**, not "any framework". This is Martin's "the web is a detail / delivery mechanism" and Cockburn's "the use case does not know the delivery mechanism". It is not Martin's general "frameworks are details", which ch. 32 qualifies. G1 stays opt-in and advisory, unchanged.

**Sight of the data, stated.** The narrowing in point 2 was made after counting matches in development fixtures (`fixtures/unit/ap-hosts`). Point 2 is therefore partly a precision observation. The ADR says so, in the same way U6's ADR drafts state "written with sight of development effects". The construct reason (the transport, not frameworks in general) is the primary argument. The fixture count is reported as what was seen, not as the reason.

---

## 3. Business rules

### BR-U2-01 Post-seal rule table (single source)
One data table, `POST_SEAL_RULES` (`src/fitness-compiler/post-seal-rules.ts`), lists every rule added after the seal. Each entry has: `ruleId`, `name` (template), `dimension`, `severity`, `styles`, `adr`, `decision` (D5 or N3), and, for FF-P07, the default `forbiddenImports`. Nothing else in the code names these rules by hand. The ADRs, the post-seal tier record and the tests read this table or are checked against it.

### BR-U2-02 Where the rules apply (mode gate)
- The post-seal rules are added **at compile time**, by `applyPostSealRules(input)`, only when `CompileOptions.postSealRules === true`.
- `V13_COMPILE_OPTIONS` sets the flag. The pipeline's `CompileCommand` takes it from the scoring mode, as it already does for the construct switches (R30): on only when `config.scoringMode === 'v1.3'`, off in the v1.2e mode.
- `compileFunctions(input)` with no options (the frozen v1.2E reproduction, `FitnessCompilerStage`, `tests/golden`) does not change, byte for byte.
- **A sealed-rule-set option stays available.** `V13_SEALED_COMPILE_OPTIONS` is `V13_COMPILE_OPTIONS` as it is today, with `postSealRules` false. The pipeline config gains `postSealRules?: boolean`, which defaults to `scoringMode === 'v1.3'`. The CLI gains `--post-seal on|off`, default `on` under `--scoring v1.3`. With the option off, a v1.3 run is byte-identical to the pre-U2 run. That is how any registered v1.3 figure is reproduced after U2 (BR-U2-10).
- **The presets are not edited.** `presets/ddd.yaml`, `presets/clean-architecture.yaml` and `presets/hexagonal.yaml` are hashed in `Docs/v1.3/sealed-hashes.md`, in its loop-pilot freeze section. Every reference manifest names `presets/ddd.yaml`. The clean, nestjs and layered libraries sit in the frozen `TEMPLATE_REGISTRY`. A compile overlay therefore reaches every spec of a style, user specs included, and still leaves those inputs untouched. *(Author question Q-A.)*
- **The overlay reaches hand-written specs too.** The 15 external specs, the spec ladder (`results/v1.3-spec-ladder/specs/`) and the fixes-mined specs all gain FF-P07 when re-run under v1.3, and the ddd ones gain FF-S02, although their authors never declared these rules. So the report tags each overlay function with origin `post-seal` (map artefact A3, "per rule: origin"). The figures registered on those sets are reproduced with `--post-seal off` (BR-U2-10).

### BR-U2-03 Overlay semantics
For a spec whose `architecture.style` (lower-cased) is in an entry's `styles`:
1. If the spec declares no function with that `ruleId`, the overlay appends the entry as a built-in function (`isBuiltIn: true`, `enabled: true`, `excludePaths: []`, and FF-P07's default `forbiddenImports`).
2. If the spec already declares the id, the spec wins. It can narrow or widen FF-P07's `forbidden_imports`, or set `enabled: false`. That is the declared, justified-exception idiom of C2, and it is reported as a disabled function, as today.
3. A spec without a style gets no post-seal rule (the same convention as `v13InapplicableReason`).
4. The order is post-seal overlay first, then `applyConstructCompileOverlays`. Q16 B's `!has('FF-S02')` guard then sees FF-S02 and adds nothing, so a ddd spec never holds two FF-S02.
5. The function is appended **after** the spec's functions. The DDD compiler already sorts `symbolicQueries` by declaration index, so every existing query keeps its position.
6. **Same template under another id.** If the spec declares a function whose `name` is the entry's template (for example `application-purity` as `FF-X01`, or a ddd `no-cyclic-deps` under a custom id), the spec wins. The overlay adds nothing and records a `COMPILER_004`-style warning naming both ids. Without this rule the same edge would be counted twice.
7. **Declared side and identity I1.** `CompileCommand` computes the declared counts from `applyConstructCompileOverlays(compilerInputFromSpec(spec), answers)` (BR-U3-52). Without a change, FF-P07 would be compiled but not declared, so `declared + adrDerived = compiled + disabled + dropped` fails and every v1.3 report ends in `REPORT_COUNTS_INCONSISTENT`. The declared side therefore applies the same order, post-seal overlay first and then the construct overlays. This follows the precedent for switch-added carriers ("declared by the switch, so identity I1 holds", R09). `CompileFacts` also lists the ids that the overlay added (`postSealAdded`), so the report can tell them apart from rules the spec declared.

### BR-U2-04 D5: FF-S02 in DDD
- `styles: ['ddd']`, `name: 'no-cyclic-deps'`, `dimension: structural`, `severity: critical`.
- It compiles through the DDD compiler's `rest` path, that is, the core compiler with the v1.3 rewrites. So it reads the **literal** edge view (ADR-V13-01), and barrel-induced cycles count as findings.
- Tier: `ruleTier('FF-S02', 'ddd')` = blocking from the sealed row (source `table`). No tier code changes for D5.
- The Study 2 count unit is unchanged: "a cycle counts once, as its sorted file set" (`study2-deviation-2026-10-16.md` §2).

### BR-U2-05 N3: FF-P07 application-purity
- **Template** `application-purity`, in a new catalogue `POST_SEAL_TEMPLATES`. The frozen `CYPHER_TEMPLATES` is not touched:

  ```
  MATCH (src:File)-[i:IMPORTS|RE_EXPORTS]->(p:Package)
  WHERE src.layer IN $applicationLayers
    AND NOT src.layer IN $compositionRootLayers
    AND NONE(sp IN $compositionRootPatterns WHERE src.filePath =~ sp)
    AND NONE(sp IN $testPatterns WHERE src.filePath =~ sp)
    AND ANY(fp IN $forbiddenImports WHERE p.name = fp OR (fp ENDS WITH '/*' AND p.name STARTS WITH left(fp, size(fp) - 1))) /*EXCLUDE:src*/
  RETURN src.filePath AS source, p.name AS target, src.layer AS layer, type(i) AS relType,
         CASE type(i) WHEN 'IMPORTS' THEN 'imports' ELSE 're-exports' END AS verb,
         i.line AS line, i.lines AS lines, coalesce(i.isTypeOnly, false) AS isTypeOnly
  ORDER BY source, target, relType
  ```

  - `requiredParams: ['applicationLayers', 'forbiddenImports', 'compositionRootLayers', 'compositionRootPatterns', 'testPatterns']`.
  - `requiredLayerKinds: ['application']`, tag `pattern-proxy`.
  - `applicableStyles: ['clean-architecture', 'hexagonal', 'nestjs', 'ddd']`.
  - The result mapping matches `domain-purity` (`DEP_EDGE`, `FR12_DEP_COLUMNS(['target'])`). Message: `Application file {source} ({layer}) {verb} delivery-framework package {target}`.
  - The final text is checked against the interpreter's supported subset (`src/cypher-interp/typecheck.ts`), and its predicate stays a top-level conjunction (BR-U1-44). The only OR sits inside `ANY(…)`, as in `domain-purity`. The `src.layer IS NULL` branch of the first draft was dead code, because `src.layer IN $applicationLayers` already implies a non-null layer, so it was dropped.
  - `$compositionRootLayers` may be `[]` (clean, nestjs). `buildParams` keeps `[]` as a value (BR-U1-03), and `NOT x IN []` is true.
  - **Regex dialect.** `APG2_COMPOSITION_ROOT_NAME_PATTERNS` and `APG2_TEST_PATTERNS` are written as JavaScript `RegExp` sources. `=~` is a Java full-match regex in Neo4j and `javaRegex` in the interpreter. The patterns are anchored `^…$` and use only `(?:…)`, classes and escapes, which both dialects read the same way. A test pins this (section 6, test 8).
- **Default forbidden list (HTTP delivery mechanism):** `express`, `fastify`, `koa`, `@koa/*`, `@hapi/*`, `restify`, `@nestjs/platform-express`, `@nestjs/platform-fastify`. *(Author question Q-B.)* It deliberately leaves out `@nestjs/common`, ORMs, DI and validation libraries. Type-only imports count, as in FF-P01 (D3), because the seed's `Request` is used only as a type.
- **Composition roots and tests are out of scope.** They are excluded through the layers that carry role `composition-root` (`compositionRootLayers()`; that is ddd `composition` = `src/main.ts` and hexagonal `config`), the name patterns `APG2_COMPOSITION_ROOT_NAME_PATTERNS` (`main.ts`, `*.module.ts`, ...) and `APG2_TEST_PATTERNS` (`src/shared/apg2-scope.ts`). Wiring code legitimately imports the HTTP framework.
- **Layered:** not applicable. It has no application-kind layer, and its business layer is domain-kind, so FF-P01 already covers it. `requiredLayerKinds` and `styles` both exclude it.
- **Edge view:** `resolved`, the same reason as `domain-purity` (by symbol). Added to `edge-views.ts`.
- **Parameters:** `buildParams` gets three more candidates, `compositionRootLayers`, `compositionRootPatterns` and `testPatterns`. BR-U1-33 restricts each query to the parameters its template declares, so no existing query's params change. `checkBoundParameters` gets the active template catalogue, so BR-SPEC-10 also guards FF-P07.
- **Tier** (post-seal record, not the sealed table): see BR-U2-06. *(Author question Q-C.)*

### BR-U2-06 Post-seal tiers
- `Docs/v1.3/rule-tiers.md` stays byte-identical, and its hash in `sealed-hashes.md` stays valid.
- A new, dated record `Docs/v1.4/rule-tiers-post-seal.md` holds one table: rule, template, styles, tier, construct reason, ADR. `src/scoring-engine/rule-tiers.ts` holds the same rows as `POST_SEAL_RULE_TIERS`, with `byStyle` and `adr`. A unit test parses the record and fails when the two disagree, in the same idiom as the sealed table.
- `ruleTier(id, style)` looks up `RULE_TIERS`, then `DDD_ID_TIERS`, then `POST_SEAL_RULE_TIERS`. A post-seal hit returns `source: 'post-seal'`, so every report and every MCP finding shows the deviation. FF-S02 in ddd stays `source: 'table'`, because its tier is the sealed one.
- **Recommended FF-P07 tier:** blocking in clean-architecture, hexagonal and ddd, and blocking in nestjs through the Clean reading the nestjs preset composes (as L07 says for FF-P06 and FF-S04). The construct reason is about the construct, not about precision: an HTTP request type inside the application layer is a precise structural fact (an import edge), and it breaks a defining constraint (the delivery mechanism is outside the application). The narrowed list removes both of G1's reasons for advisory.

### BR-U2-07 Construct switch interplay
- Q16 B becomes redundant (BR-U2-03.4). A test pins that Q16 B together with the post-seal rule gives exactly one FF-S02.
- Q3 (in-layer cycles, `src/construct-switches/tiers.ts`) applies by rule id. If the author answers Q3 B or C, DDD cycles would be split as well. This is recorded in ADR-V14-01 as a dependency and is not changed here.

### BR-U2-08 Downstream consumers updated so the rules are first-class
- `src/fitness-compiler/extension-templates.ts`: register `post-seal` in `V13_EXTENSION_TEMPLATE_CATALOGUES`, so a v1.3 spec that declares FF-P07 validates, and add it to the `getExtensionTemplate` fallback, so report tags resolve.
- `src/mcp-server/rule-meta.ts`: `CONSTRUCTS['application-purity']`, `OTHER_SOURCES['application-purity']` (Martin 2017 ch. 21 and 22; Cockburn 2005), and the `tierSource` mapping for `post-seal`. FF-S02 in ddd already resolves to the Clean ADP row through `COMPOSED.DDD`.
- `scripts/v1.3/lib/labelling/correctness.ts`: an `application-purity` checker (the `domainPurity` checker over the application layers, minus composition roots and tests), its edge view, the `templateOf(ruleType, ruleId)` mapping from FF-P07's report rows to `application-purity`, and `BLOCKING_COVERAGE` rows for each style where FF-P07 is blocking, plus `ddd:no-cyclic-deps`. The existing coverage test requires a row for every blocking DDD rule, and it checks `ruleTier(row.ruleId, row.style).tier === 'blocking'`. The post-seal fallback satisfies that check.
- `scripts/v1.3/lib/reference-model.ts`: the compared scope of each reference style gains the post-seal rules for that style, **only when the caller asks for it**: `loadReference(…, { postSeal: true })`, default `false`. The scorer turns it on only for outputs produced with the post-seal rules. Those outputs record `postSealRules: true` in their compile facts, and the scorer refuses a mixed set. The reason: `ue-score.ts` and its siblings re-score **saved** outputs (`results/v1.3-reference/baseline-pre-barrel`, ...), and those have no FF-S02 rows in ddd. If the scope grew unconditionally, re-scoring them would turn the blind key's ddd FF-S02 row from "not scored" into a scored miss. Registered recall and precision would then change without a new run. The hand-written `reference.json` and `expected-findings.json` files are **not** edited (fixture README rule). Rows that differ from a manifest are reported as findings of the change.
- Report schema: the `tierSource` enum gains `post-seal` (`src/scoring-engine/report-schema.ts`, two places; `src/shared/types/evaluation.ts`; `src/mcp-server/types.ts`). When post-seal rules are on, `TieredScoring.tierTable` names both records (`Docs/v1.3/rule-tiers.md` and `Docs/v1.4/rule-tiers-post-seal.md`). The compile facts carry `postSealRules` and `postSealAdded` (BR-U2-03.7).
- `scripts/v1.3/lib/freeze-check.ts`: `MANIFEST_FILES` gains `Docs/v1.4/rule-tiers-post-seal.md` and `Docs/v1.4/adr-v14.md`, so the one-time hold-out run byte-freezes the post-seal tier record it scores with. `src/fitness-compiler/post-seal-rules.ts` is already covered by `MANIFEST_DIRS`.

### BR-U2-09 MCP tools see the same rule set
The MCP default ("fast") path reads the parsed spec and re-states some templates in TypeScript (`src/mcp-server/fast-rules.ts`, `FAST_RULE_NAMES`; `file-check.ts` `IMPORT_RULES`). A compile-only overlay would be invisible to it.
- `withPostSealRules(spec: ParsedSpec)` applies BR-U2-03 to a parsed spec. It runs where the MCP context loads its spec (`src/mcp-server/context.ts`, `spec-view.ts`), always under the v1.3 rules the MCP server serves.
- FF-S02 in ddd is then checked by the existing fast `no-cyclic-deps`.
- FF-P07 has **no** fast re-statement in this unit, because Cypher stays the only rule definition. The fast path lists it in `notes`: "checked by the compiled Cypher only (`--fast-rules-engine cypher-interp`, `evaluate_project`)". The `cypher-interp` engine runs it through the pipeline, as for any compiled rule. *(Author question Q-D.)*

### BR-U2-10 No registered figure moves silently
`V13_COMPILE_OPTIONS` is imported directly by about 20 callers outside the pipeline. Once it carries `postSealRules: true`, each of them computes over a larger rule set. The callers include `src/rule-mining/propose.ts` (the C2 mined-recall figures), `src/ise/propose.ts`, `src/cli/cli.ts`, `src/mcp-server/rule-meta.ts`, `scripts/lib/loop/specs.ts` (the Study 2 harness), `scripts/v1.3/rule-mutation.ts`, `study1-rerun.ts`, `convergent-run.ts`, `declared-rules-live.ts`, `apg2-live.ts`, `scc-large-latency.ts`, `scripts/v1.3/lib/construct-rescore.ts`, `scripts/v1.3/lib/freeze-check.ts` and the semantic test harness. The rule is:
- **Forward callers keep `V13_COMPILE_OPTIONS`, and so get the post-seal rules:** the pipeline, the MCP server, the CLI, `ise/propose`, `rule-mining/propose`, the loop and Study 2 harness, the freeze check and the test harness. D5 explicitly changes what Study 2 is scored on.
- **A `scripts/v1.3/` caller that regenerates a registered figure (a claims-ledger row or a `replication/v1.3` group) switches to `V13_SEALED_COMPILE_OPTIONS`.** Its figure is then reproduced unchanged. The alternative is to keep the forward options and list the changed figure in the ADR effect table. The code summary carries one table of every caller, its choice and the reason. A caller that is missing from the table fails the U2 test that greps the imports (section 6, test 9).
- **Before and after the change** (offline, run one after another, never in parallel): `node replication/v1.3/run.mjs --fast --json` and `node scripts/v1.3/claims-ledger-check.mjs`. A number that goes from PASS to FAIL is either fixed by the pin above or listed in the ADR effect table. Groups marked needs-Neo4j or needs-LLM are not run (the runner never runs them).
- **Hold-out.** `Docs/v1.3/holdout-prespec.md` scores with "`rule-tiers.md` at its sealed hash, plus the tier ADRs merged at `<FREEZE_SHA>`" (line 13). It also keeps a rule whose tier is still deferred out of M1 and M2, and reports that rule's findings separately (line 59). So: if Q-C is signed before the freeze, FF-P07 and the ddd FF-S02 enter M1–M6 as the prespec allows. If Q-C is not signed, FF-P07 is listed under line 59 in the freeze commit. Either way, the hold-out manifests were written blind from the sealed sources, so FF-P07 rows they do not expect lower M2 per style. That is a direct consequence of the post-seal addition, and it is stated in ADR-V14-02 before the run. *(Author question Q-E.)*

---

## 4. Data contracts

```ts
// src/fitness-compiler/post-seal-rules.ts
export interface PostSealRule {
  readonly ruleId: 'FF-S02' | 'FF-P07';
  readonly name: 'no-cyclic-deps' | 'application-purity';
  readonly dimension: Dimension;            // structural | pattern
  readonly severity: Severity;              // critical
  readonly styles: readonly string[];       // ['ddd'] | ['clean-architecture','hexagonal','nestjs','ddd']
  readonly decision: 'D5' | 'N3';
  readonly adr: 'ADR-V14-01' | 'ADR-V14-02';
  readonly forbiddenImports?: readonly string[];
}
export const POST_SEAL_RULES: readonly PostSealRule[];
export const POST_SEAL_TEMPLATES: ReadonlyMap<string, CypherTemplate>;   // 'application-purity' only
export function applyPostSealRules(input: CompilerInput): CompilerInput;  // identity (same object) when nothing applies

// src/fitness-compiler/fitness-compiler.ts
interface CompileOptions { readonly postSealRules?: boolean }             // V13_COMPILE_OPTIONS: true
export const V13_SEALED_COMPILE_OPTIONS: Readonly<CompileOptions>;        // today's V13_COMPILE_OPTIONS, postSealRules false

// src/shared/types/evaluation.ts (PipelineConfig) and src/scoring-engine/report-builder.ts (CompileFacts)
readonly postSealRules?: boolean;                                         // default: scoringMode === 'v1.3'
readonly postSealAdded?: readonly string[];                               // ids the overlay added (A3 origin)

// scripts/v1.3/lib/reference-model.ts
loadReference(repoRoot, style, root?, opts?: { readonly postSeal?: boolean })  // default false

// src/scoring-engine/rule-tiers.ts
export const POST_SEAL_RULE_TIERS: ReadonlyMap<string, RuleTierEntry & { readonly adr: string }>;
type ResolvedTier['source'] = 'table' | 'untiered-default' | 'post-seal';
```

A finding row of FF-P07 has the same shape as FF-P01: `source`, `target` (the package), `layer`, `relType`, `line`, `lines` and `isTypeOnly`. Its violation identity is (rule, file, package), as for FF-P01.

---

## 5. Where the code goes

| Path | Change |
|---|---|
| `src/fitness-compiler/post-seal-rules.ts` | **new**: table, template, overlay |
| `src/fitness-compiler/fitness-compiler.ts` | `postSealRules` option; overlay call; catalogue merge; three `buildParams` candidates; catalogue passed to the bound checker |
| `src/fitness-compiler/bound-param-checker.ts` | accept a template catalogue (default `CYPHER_TEMPLATES`) |
| `src/fitness-compiler/edge-views.ts`, `extension-templates.ts`, `index.ts` | register `application-purity` |
| `src/pipeline/commands/compile-command.ts`, `src/pipeline/pipeline-factory.ts` | `postSealRules` taken from `config.postSealRules ?? scoringMode === 'v1.3'`; the declared side applies the overlay too (BR-U2-03.7) |
| `src/cli/cli.ts` | `--post-seal on\|off` |
| `scripts/v1.3/lib/freeze-check.ts` | two entries in `MANIFEST_FILES` |
| `scripts/v1.3/*.ts` callers of a registered figure | `V13_SEALED_COMPILE_OPTIONS` where the caller table says so (BR-U2-10) |
| `src/scoring-engine/rule-tiers.ts`, `report-schema.ts`, `src/shared/types/evaluation.ts` | post-seal tiers and the `post-seal` source |
| `src/mcp-server/rule-meta.ts`, `src/mcp-server/types.ts` | construct, source and tier source |
| `src/mcp-server/context.ts`, `spec-view.ts`, `file-check.ts` | `withPostSealRules` at spec load; the fast-path note for FF-P07 |
| `scripts/v1.3/lib/labelling/correctness.ts`, `scripts/v1.3/lib/reference-model.ts` | checker, coverage and scope |
| `scripts/v1.4/u2-fixture-delta.ts` | **new**: before/after delta over the committed fixtures (cypher-interp, no Neo4j) |
| `Docs/v1.4/adr-v14.md` | **new**: ADR-V14-01 (D5), ADR-V14-02 (N3) |
| `Docs/v1.4/rule-tiers-post-seal.md` | **new**: dated post-seal tier record |
| `tests/unit/post-seal/*.test.ts` | **new** tests (section 6) |
| `results/v1.4-u2/` | delta output (`fixture-delta.json`, `fixture-delta.md`), the replication before and after (`replication-{before,after}.json`), the symbolic K-tally re-run (`complementarity/`) |

**ADR location and numbering.** The repo keeps one ADR file per development cycle (`Docs/v1.3/adr-v13.md`, ids `ADR-V13-nn`; V13-02 is a draft and V13-03 is reserved for the construct answers). This is the v1.4 cycle, so the file is `Docs/v1.4/adr-v14.md` with `ADR-V14-01` and `ADR-V14-02`. If another v1.4 unit (U6 also writes rule-fix ADRs) claims these numbers first, take the next free ones and update `POST_SEAL_RULES.adr`. The orchestrator assigns at merge.

Each ADR states:
- **Status:** declared post-seal deviation (date; author decision D5 or N3, board 2026-10-18).
- **Context:** N17, or NS-01 §4a with the 12 seeds.
- **Decision.**
- **Tier and source:** sealed row FF-S02, or the post-seal record.
- **Why it is not a quiet fix:** the seal.
- **Effect:** the exact fixture delta table from `results/v1.4-u2/fixture-delta.md`; every replication or claims-ledger number that changed (BR-U2-10); the caller table; the hold-out consequence (Q-E); the Study 2 consequence (Y counts more blocking edges in ddd, and in every style for FF-P07); the reference re-score (ddd v09: one FF-S02 row that the hand manifest does not hold); the construct-switch consequence (Q16 settled as B).
- **What is not changed:** the template text of FF-S02; `rule-tiers.md`; the presets; the hand manifests; the operator's `expectedTemplates`; G1.

---

## 6. Test strategy

All tests run in jest with `--maxWorkers=2`, without Neo4j, without network and without a model. Every pipeline run in a test or script uses `graphEngine: 'cypher-interp'` **and `evaluationMode: 'symbolic-only'`**. That is the only mode in which `createPipeline` builds no LLM provider (`pipeline-factory.ts`), so the presets' neuronal functions can never reach a model.

1. **Overlay unit tests** (`tests/unit/post-seal/post-seal-rules.test.ts`):
   - identity without the option, so `compileFunctions(input)` for all five presets is deep-equal to the pre-change output, and none of them holds FF-P07 or a ddd FF-S02;
   - with the option: ddd gains FF-S02 and FF-P07; clean, hexagonal and nestjs gain FF-P07; layered gains nothing; an unstyled spec gains nothing;
   - a spec-declared FF-P07 with `enabled: false` stays disabled, and one with its own `forbidden_imports` keeps them;
   - Q16 B plus the overlay gives one FF-S02;
   - every existing query's text and params are unchanged (compare query by query);
   - `V13_SEALED_COMPILE_OPTIONS` gives, for all five presets, output deep-equal to the pre-change `V13_COMPILE_OPTIONS` output. The pre-change output is the committed baseline from plan step 0.2;
   - a spec that declares `application-purity` under another id gets no FF-P07, plus the warning (BR-U2-03.6);
   - **identity I1:** a v1.3 pipeline run (cypher-interp, symbolic-only) on each reference spec with post-seal rules on ends without `REPORT_COUNTS_INCONSISTENT`, and its compile facts list `postSealAdded`.
2. **Seeded positives and twins, hand-built graphs** (`tests/unit/post-seal/application-purity.test.ts`, `ddd-cycle.test.ts`). These use `tests/unit/semantic-rules/semantic-harness.ts`: real ingestion into `MemoryGraphRepository`, the style's reference spec compiled with the v1.3 options, and the catalogue's Cypher as it stands.
   - **FF-P07 positives** (each style: clean, hexagonal, nestjs, ddd): an application service with `import { Request } from 'express'`; the same as `import type`; a re-export of `fastify`. Expect one row each, the tier per the post-seal table, and source `post-seal`.
   - **FF-P07 twins**, which must pass with zero FF-P07 rows:
     - the DTO twin (`context?: XContextDto`, no package import);
     - `express` in the composition root (`src/main.ts`, hexagonal `src/config/**`, a nestjs `*.module.ts`);
     - `express` in an application **test** file;
     - `@nestjs/common` (`Injectable`) in a nestjs or ddd application service;
     - `express` in the presentation layer or inbound adapter;
     - `express` in the domain. FF-P01 or FF-DT04 fires there, and FF-P07 does not, so there is no double count.
   - **Layered:** FF-P07 is not compiled.
   - **FF-S02 positive (ddd):** `PlaceOrder → CustomerRepository → Customer → PlaceOrder`. Expect exactly one violation identity, the sorted file set, however many rows the template emits for it. It is blocking, with source `table`.
   - **FF-S02 twins:** the same files with `Customer` not importing `PlaceOrder`, which gives 0 rows; and a cross-context path through a public `index.ts`, which gives a row only if the literal edges close a cycle.
3. **Operator-seeded positives** (`tests/unit/post-seal/framework-leak-seeds.test.ts`): apply `AP-FRAMEWORK-LEAK` and `AP-FRAMEWORK-LEAKn` (the existing operators, unchanged) to temporary copies of `fixtures/unit/antipattern-nest` (nestjs) and `fixtures/unit/ap-hosts/translation-jobs` (hexagonal). Extract, then run the pipeline with `graphEngine: 'cypher-interp'`, `evaluationMode: 'symbolic-only'` and `scoringMode: 'v1.3'`. The seeded file has an FF-P07 row, and the twin file has none.
   - **Non-vacuity:** the test requires at least one applied seed per host. The operator's precondition needs `express` to be visible: a `paths` entry, a declared dependency, or an existing import (`projectUsesPackage`). The v1.3 clean reference project has none of these (its express typings sit in `types/vendor.d.ts` and nothing imports them), so every site would be rejected as `type-shape` and the test would pass on nothing. That is why it is not a host here. Clean and ddd are covered by test 2 and by test 3b.
   - **3b. The K-tally re-run, symbolic arm only** (plan step 8.4): `scripts/v1.3/complementarity.ts`, unchanged, with output to `results/v1.4-u2/complementarity/` (never over `results/v1.3-complementarity/`). It runs `firewall evaluate --symbolic-only --engine cypher-interp --scoring v1.3`. It reads judge verdicts from committed files and makes no model call. Expected: the 4 round-1 `antipattern-nest` seeds turn symbolic-visible through FF-P07, and every twin stays without an alarm. If a read-only `git archive` export of `v1.3-judge-v22-prep` can be made (never a checkout of v1.3 or v1.2e), the 4 non-layered CHECK-2 seeds also turn visible, and their 10 twins stay at 0. The 8 E1 seeds (`recorded-neo4j`; their bases are outside this checkout) are **not** re-run here. They go to U7.
   - **Circularity, stated:** the operator plants `express`, and the default list holds `express`. So "the seeds become rule hits" holds by construction and is not evidence of validity. The evidence for the rule is the twins (test 2 and 3b) and real code, which goes to U7 as a descriptive count with no tuning.
4. **Extracted reference fixtures:** the ddd reference v09 overlay through the pipeline (cypher-interp) holds the FF-S02 row with the three files. The ddd clean variant holds no FF-S02 row, unless the delta (step 5) declares one.
5. **Fixture delta, "listed exactly"** (`scripts/v1.4/u2-fixture-delta.ts` plus `tests/unit/post-seal/fixture-delta.test.ts`):
   - The script runs every committed fixture/spec pair that a test asserts on, with `postSealRules` off and on:
     - `tests/golden` (5 cases);
     - `tests/fixtures/v1.3-reference` (5 styles, the clean projects and every variant);
     - `tests/fixtures/hexagonal`;
     - `tests/fixtures/mcp-interp-parity`;
     - `fixtures/unit/antipattern-nest`;
     - `fixtures/unit/ap-hosts`.
   - **Memory:** each fixture is extracted once into one `MemoryGraphRepository`, and the two compiles (off, on) run over that same graph. The pairs run one after another in one process, never in parallel, and each graph is released before the next one.
   - It writes the added and removed (rule, file, target) rows to `results/v1.4-u2/fixture-delta.{json,md}`.
   - The test parses the ADRs' effect tables and requires them to equal the committed delta. A change outside the list fails.
   - Expected (to be confirmed by the run): golden unchanged (v1.2e mode); ddd v09 +1 FF-S02; the mcp parity golden gains FF-P07 in `checkedRules` for application files; antipattern-nest has no FF-P07 rows before seeding.
6. **Tier and record tests:**
   - `Docs/v1.4/rule-tiers-post-seal.md` matches `POST_SEAL_RULE_TIERS` and `POST_SEAL_RULES`;
   - `rule-tiers.md` still has its sealed hash, and the existing `rule-tiers.test.ts` passes unchanged;
   - `ruleTier('FF-P07', s)` equals the record for each style; `ruleTier('FF-S02', 'ddd')` is blocking, source `table`.
7. **Existing tests changed as declared** (each listed in the ADR):
   - `tests/fixtures/mcp-interp-parity/default-golden.json`, if the delta shows it. It is regenerated only by its own documented command, never by hand.
   - The correctness coverage test, through the new rows.
   - The report-schema enum test, if one exists.
   - Nothing else may change.
8. **Interpreter subset check:** `parseCypher` and `typecheck` accept the new template text, so npx mode runs it. Each composition-root and test pattern matches and rejects the same sample paths under `new RegExp(p)` and under the interpreter's `javaRegex(p)` (full match): `src/main.ts`, `src/app.module.ts`, `src/application/x.spec.ts`, `src/application/OrderService.ts`.
9. **Caller table** (`tests/unit/post-seal/compile-option-callers.test.ts`): this test lists every file under `src/` and `scripts/` that imports `V13_COMPILE_OPTIONS` or `V13_SEALED_COMPILE_OPTIONS`. It requires that list to equal the caller table in `Docs/v1.4/adr-v14.md` (ADR-V14-02, "Callers"). A new caller cannot then pick up the post-seal rules without being listed.
10. **Replication before and after** (BR-U2-10): this is not a jest test. It is a plan step, and its two JSON outputs are committed under `results/v1.4-u2/`.

---

## 7. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | **Count of deviations.** The examiner review counts post-seal deviations as a risk in itself (`ops/decisions.md`). | Both ADRs are written to be listed in the orchestrator's single dated deviation list. D5 is shown to change membership only (template and tier sealed). |
| R2 | **The FF-P07 rule, list and tier were chosen after seeing the data.** The trigger was a recall gap on development seeds, and the list was narrowed after counting `@nestjs/*` matches in `fixtures/unit/ap-hosts` (§2.2). | The ADR states both facts: "written with sight of development effects", as U6 does. The primary argument is the construct reason (delivery mechanism, a precise edge fact). The fixture count is reported as what was seen. The tier is an author decision (Q-C). No further change to the list after the fixture delta (Q16 caveat: run once, no tuning loop). |
| R3 | **Barrel-induced cycles in DDD.** The literal view counts cycles through `index.ts` public APIs (ADR-V13-01; N36, N37). DDD contexts are barrel-heavy, so D5 may add rows beyond v09. | The fixture delta lists every row before merge. Q16's caveat holds: run once on the development set, no tuning loop, and anything surprising goes into the ADR. |
| R4 | **Study 2's Y changes.** Y counts distinct blocking edges at the sealed tier (`study2-deviation-2026-10-16.md` §2). More blocking rules mean a higher base rate, so the power simulation inputs move. | Flagged in both ADRs and to the orchestrator. The V4 count and the power re-run depend on it. Study 2 has not run. |
| R5 | **Transport-only list misses other leaks** (`HttpException` or `@Req()` from `@nestjs/common` inside a service; `http` built-ins). | Stated as a limit in ADR-V14-02. The list can be overridden per spec. G1 stays available opt-in. |
| R6 | **Overlay instead of preset edits.** A reader of `presets/*.yaml` will not see FF-P07 or the ddd FF-S02. | The presets carry a hash; editing them breaks sealed inputs. The overlay is reported (`tierSource: post-seal`, the declared and compiled counts). The post-seal record names the rules. Q-A lets the author choose preset edits instead. |
| R7 | **Composition-root detection.** A nestjs spec with no composition-root role relies on the name patterns (`main.ts`, `*.module.ts`). A bootstrap file with another name inside an application glob would be a false positive. | A twin test for each pattern. The limit goes in the ADR. |
| R8 | **ADR number collision** with parallel v1.4 units. | Numbers are confirmed at merge (section 5). |
| R9 | **The K-tally redo** (N3's "the K-tally is redone") needs the E1 recorded seeds. Those used recorded Neo4j findings, and their bases are outside this checkout. | Test 3b re-runs the symbolic arm offline for the 4 interp-sourced fixture seeds (and the CHECK-2 seeds when the read-only export is available). The 8 E1 seeds are handed to U7 with the rule in place. The ADR reports "4 of 12 re-run and visible; 8 pending", never "12 of 12". |
| R12 | **Circularity.** The operator plants `express`, and the list contains `express`, so the seed hits hold by construction. | Stated in ADR-V14-02. Seed hits are not offered as validity evidence. The evidence is the twins (DTO, composition root, test file, `@nestjs/common`, presentation, domain) and U7's descriptive count on real code. |
| R13 | **Silent change to registered figures.** About 20 direct callers of `V13_COMPILE_OPTIONS`, the reference scorer's scope and the overlay on hand-written specs would all move registered v1.3 numbers on a re-run. | BR-U2-10: `V13_SEALED_COMPILE_OPTIONS`, `--post-seal off`, the gated reference scope, the caller table with its test, and the replication package plus the claims-ledger check run before and after. |
| R14 | **I1 identity break.** FF-P07 compiled but not declared fails `REPORT_COUNTS_INCONSISTENT` on every v1.3 report. | BR-U2-03.7, pinned by the I1 test in section 6.1. |
| R15 | **Double count with G1.** A clean or hexagonal spec that opts into the rule-gap catalogue gets both G1 (advisory) and FF-P07 (blocking) on the same `express` edge. | Study 2's Y counts blocking edges only, so Y is unaffected. The advisory duplicate is listed in ADR-V14-02, and G1 stays unchanged. |
| R16 | **Hold-out M2.** The blind hold-out manifests cannot expect FF-P07 rows, so any FF-P07 hit there lowers manifest precision per style (threshold 0.90). | BR-U2-10: the prespec's own lines 13 and 59 decide inclusion. Stated before the run. Q-E. |
| R11 | **MCP arm asymmetry in Study 2.** If the `daedalus-mcp` arm runs the default fast path, its tools do not check FF-P07, while Y scores it. | BR-U2-09 states the gap in every tool response. Q-D: add a parity-tested fast re-statement, or run the arm with `--fast-rules-engine cypher-interp`. |
| R10 | **Reference scope change.** The ddd compared set grows, so ddd precision against the hand manifest can drop (v09: an FF-S02 row not in the manifest), while blind-key recall recovers (Q16: 7/8 → 8/8). | Both directions are reported in ADR-V14-01. Manifests are not edited. |

---

## 8. Open author decisions

- **Q-A** Mechanism: a compile-time overlay in the v1.3 scoring mode, with presets untouched (recommended), or edits to `presets/*.yaml` and the ddd library (re-hash the sealed inputs)?
- **Q-B** The FF-P07 forbidden list: HTTP delivery mechanism only (recommended, section 3 BR-U2-05), or also each style's FF-P01 list for clean and hexagonal?
- **Q-C** The FF-P07 tier per style: blocking in clean, hexagonal and ddd, and in nestjs through the composed Clean reading (recommended), or advisory in nestjs, or advisory everywhere (then the 12 seeds become advisory hits only)?

- **Q-D** MCP fast path for FF-P07: leave it to the compiled Cypher (recommended; a note in each tool response), or add a TypeScript fast re-statement guarded by the interp-parity tests, or require the Study 2 MCP arm to run `--fast-rules-engine cypher-interp`?
- **Q-E** Hold-out scope: score the hold-out with the post-seal rules as the prespec allows when Q-C is signed before the freeze (recommended, with the sealed-scope figures reported next to them), or keep the post-seal rules out of M1 and M2 and report them separately under prespec line 59, whatever Q-C says?
- **D5 and Q16.** D5 is the same change as construct switch Q16 B. Recording Q16 = B in the answers file belongs to the construct-answers ADR (ADR-V13-03) and to the author. U2 only hands this on.

The code shape does not depend on these answers. Each one is a data value in `POST_SEAL_RULES` or `POST_SEAL_RULE_TIERS`, or a flag. The defaults above are built and marked "Proposed" in the ADRs. The author's PR review is the code-approval gate (`ops/03-build-list.md`).
