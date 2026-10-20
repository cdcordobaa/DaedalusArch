# v1.4 Architectural Decision Records

These are development-cycle decisions of the v1.4 "instrument-alignment" cycle. Each one is a declared post-seal deviation: it changes what the v1.3 instrument checks after the v1.3 inputs were sealed (`Docs/v1.3/sealed-hashes.md`). Neither record changes Study 1 (v1.2E, frozen).

The numbers ADR-V14-01 and ADR-V14-02 were the next free ones when this file was written. If another v1.4 unit claims them first, the orchestrator assigns the next free numbers at merge, and `POST_SEAL_RULES.adr` (`src/fitness-compiler/post-seal-rules.ts`) and `POST_SEAL_RULE_TIERS` (`src/scoring-engine/rule-tiers.ts`) change with them.

Design: `aidlc-docs/construction/v1.4/U2/functional-design/design.md`. Code summary: `aidlc-docs/construction/v1.4/U2/code/summary.md`.

## ADR-V14-01: The DDD rule set gains FF-S02 (acyclic dependencies), post-seal (D5)

**Date:** 2026-10-18. **Status:** declared post-seal deviation (author decision D5, board 2026-10-18). The mechanism (author question Q-A) is **Accepted: Q-A = A**, overlay in the v1.3 scoring mode only, `presets/ddd.yaml` not edited (signed 2026-10-19 by the author via the decision desk). Q16 = B is recorded in `Docs/v1.3/construct-answers.json`.

**Context.**
- N17 (`Docs/v1.3/compendium/nulls-and-limits.md`): the DDD preset has no cycle rule, so a real three-file cycle in the DDD reference case v09 is not reported.
- The blind key's ddd FF-S02 row was "not scored" (`Docs/DiagnosticRuns/v1.3-reference-baseline-2026-10-15.md`, blind name mapping). The DDD reference scope is "the preset's functions", and FF-S02 is not one of them.
- Construct question Q16 (`Docs/v1.3/construct-decisions.md`) recommends B: "ADP is stated for components in general, not for a style". Construct switch Q16 B already adds FF-S02 to a ddd spec. Q16 is still at A.

**Check.** FF-S02 was not in the DDD rule set. `DDD_FUNCTIONS` (`src/spec-parser/ddd-template.ts`) and `presets/ddd.yaml` list the same ten functions: FF-DS01, FF-DS02, FF-DT01 to FF-DT06, FF-S01 and FF-S03.

**Decision.**
- FF-S02 `no-cyclic-deps` joins the DDD rule set. Only the membership changes.
- The template text is the frozen `no-cyclic-deps` (`src/fitness-compiler/cypher-templates.ts`), unchanged. It has no `applicableStyles` and no `requiredLayerKinds`, so it compiles for ddd as it is.
- It reads the literal edge view (ADR-V13-01). Barrel-induced cycles therefore count as findings.
- It is added by a compile-time overlay (`applyPostSealRules`), only in the v1.3 scoring mode (`CompileOptions.postSealRules`, `PipelineConfig.postSealRules`, CLI `--post-seal on|off`). `presets/ddd.yaml` is not edited, because it is hashed in the sealed inputs.
- A spec that declares FF-S02, or `no-cyclic-deps` under another id, keeps its own declaration. The overlay then adds nothing.
- Q16 is settled as B in substance. The overlay runs before the construct overlays, so Q16 B's `!has('FF-S02')` guard adds nothing and a ddd spec never holds two FF-S02. Recording Q16 = B in the answers file is left to the author (ADR-V13-03).

**Tier and source.** The tier is the sealed FF-S02 row of `Docs/v1.3/rule-tiers.md`: blocking, "acyclic dependencies principle; a structural fact", with no per-style exception. `ruleTier('FF-S02', 'ddd')` returns blocking with source `table`. The post-seal tier record (`Docs/v1.4/rule-tiers-post-seal.md`) lists the row as "membership only".

**Why this is not a quiet fix.** The DDD rule set was sealed. Adding a rule after the seal changes what every later DDD run is scored on, so it is declared here with its effect.

**Effect.**

The fixture delta (`results/v1.4-u2/fixture-delta.md`, 83 committed fixture/spec pairs, cypher-interp). The FF-S02 rows:

| Pair | Change | Rule | File | Target | Tier |
|---|---|---|---|---|---|
| v1.3-reference/ddd/v09-domain-imports-application | added | FF-S02 | src/ordering/application/PlaceOrder.ts, src/ordering/domain/customer/Customer.ts, src/ordering/domain/customer/CustomerRepository.ts | - | blocking |

- The tiered verdict does not change on any pair. v09 already failed on FF-S01.
- No other DDD variant gains a cycle. The barrel-heavy clean project gains none (design risk R3).
- **Reference re-score, both directions.** The hand manifests are not edited. Scored with the post-seal scope (`loadReference(…, { postSeal: true })`), the ddd v09 FF-S02 row is a finding that the hand manifest does not hold, so ddd manifest precision can drop. Against the blind key, the ddd FF-S02 row goes from "not scored" to a hit, so blind-key recall recovers (Q16: 7/8 to 8/8). Saved pre-U2 outputs are re-scored with the sealed scope (the default), so their registered scores do not change.
- **Study 2.** Y counts distinct blocking edges at the sealed tier. ddd runs now count cycle edges too, so the base rate of Y and the power-simulation inputs move. Study 2 has not run.
- **Dependency on Q3.** Construct question Q3 (in-layer cycles, `src/construct-switches/tiers.ts`) applies by rule id. If the author answers Q3 B or C, DDD cycles are split by it as well. That is not changed here.

**What is not changed.** The FF-S02 template text; `Docs/v1.3/rule-tiers.md`; `presets/*.yaml` and the DDD library; the hand manifests (`reference.json`, `expected-findings.json`); the construct-switch code (the Q16 B guard stays).

## ADR-V14-02: Application purity FF-P07, post-seal (N3, Q26)

**Date:** 2026-10-18. **Status:** declared post-seal deviation (author decision N3, board 2026-10-18). The forbidden list (Q-B), the tiers (Q-C), the MCP fast-path choice (Q-D) and the hold-out scope (Q-E) are **Accepted at their defaults: Q-B = A, Q-C = A, Q-D = A, Q-E = A** (signed 2026-10-19 by the author via the decision desk). Q-C was signed before the freeze, so under Q-E FF-P07 and the ddd FF-S02 enter M1 to M6 with the sealed-scope figures reported next to them. Action item from Q-C and Q13 B: the nestjs reason must be argued from the preset's own layer order (service below controller), not from the "Clean reading" of ADR-V13-02, which Q13 B corrects (ADR-V13-03 action item).

**Context.**
- NS-01 §4a (`ops/notes/ns-01-what-rules-cannot-see.md`): every AP-FRAMEWORK-LEAK operator seed outside the layered style is symbolic-blind. The operator plants `import { Request } from 'express'` into an application-kind layer. FF-P01 reads the domain layer only.
- That gives 12 K0 seeds (`results/v1.3-complementarity/rows.csv`): 4 round-1 seeds in the `antipattern-nest` fixture (nestjs, `symbolicSource` interp), and 8 round-2 seeds in E1 projects (stratum `e1-clean-arch`, `symbolicSource` recorded-neo4j, bases outside this checkout).
- **G1 is not promoted.** The rule-gap template G1 `use-case-framework-free` (`src/fitness-compiler/rule-gap-templates.ts`) is close, but it is opt-in and advisory, and it cannot become this rule as it stands:
  1. Its styles leave out nestjs and ddd.
  2. It reuses the spec's domain list (`@nestjs/*`, `typeorm`, ...). That list would fire on every NestJS or NestJS-hosted DDD application service, which imports `@nestjs/common` for `@Injectable()`.
  3. Its advisory tier was set a priori for that wider construct.

**Decision.**
- **Construct.** A new, narrower construct: the delivery mechanism (the HTTP framework) is a detail, so no application-layer file depends on it. This is Martin 2017 ch. 21 ("the Web is a delivery mechanism") and ch. 22, and Cockburn 2005 ("the use case does not know the delivery mechanism"). It is not Martin's general "frameworks are details", which ch. 32 qualifies.
- **Template.** `application-purity`, in a new catalogue `POST_SEAL_TEMPLATES` (`src/fitness-compiler/post-seal-rules.ts`). It is the `domain-purity` pattern read over `$applicationLayers`. The frozen `CYPHER_TEMPLATES` is not touched. The predicate is a top-level conjunction, and the only OR sits inside `ANY(…)`. The interpreter parses and type-checks it.
- **Rule.** FF-P07, dimension pattern, severity critical, route symbolic. It is added by the same overlay as ADR-V14-01, in the v1.3 scoring mode only, to the styles clean-architecture, hexagonal, nestjs and ddd. Layered gets nothing: it has no application-kind layer, and its business layer is domain-kind, so FF-P01 already covers it.
- **Forbidden list (Q-B = A, signed 2026-10-19 by the author via the decision desk).** HTTP delivery-mechanism packages only: `express`, `fastify`, `koa`, `@koa/*`, `@hapi/*`, `restify`, `@nestjs/platform-express`, `@nestjs/platform-fastify`. It leaves out `@nestjs/common`, ORMs, DI and validation libraries. Type-only imports count, as in FF-P01 (D3). A spec that declares FF-P07 keeps its own list or its `enabled: false`.
- **Exclusions.** Composition roots and tests are out of scope, because wiring code legitimately imports the HTTP framework. A file is excluded when its layer has role `composition-root` or is detected as one (`compositionRootLayers`: ddd `composition`, hexagonal `config`), when its name matches `APG2_COMPOSITION_ROOT_NAME_PATTERNS` (`main.ts`, `*.module.ts`, ...), or when it matches `APG2_TEST_PATTERNS`.
- **Edge view.** Resolved, as for `domain-purity`. The view is recorded in `POST_SEAL_EDGE_VIEWS` (`src/fitness-compiler/edge-views.ts`), apart from the 38-entry v1.3 table, because that table's counts are registered figures (`Docs/v1.3/edge-views.md`).

**Tier and source (Q-C = A, signed 2026-10-19 by the author via the decision desk).** FF-P07 is blocking in clean-architecture, hexagonal and ddd, and blocking in nestjs through the Clean reading that the nestjs preset composes (as L07 says for FF-P06 and FF-S04). The record is `Docs/v1.4/rule-tiers-post-seal.md`, and `ruleTier` reports `tierSource: post-seal`. The reason is about the construct, not about precision: an HTTP request type inside the application layer is a precise structural fact (an import edge), and it breaks a defining constraint (the delivery mechanism is outside the application). The narrowed list removes both of G1's reasons for advisory.

**Written with sight of development effects.** The trigger was a recall gap on development seeds (the 12 K0 seeds). The list was narrowed after counting matches in development fixtures: 13 application files in `fixtures/unit/ap-hosts` import `@nestjs/*`, while a transport-only list matches 1 application file across `fixtures/` and `tests/fixtures/` (`tests/fixtures/v1.3-rule-gaps/layers/src/application/main.ts`). The construct reason above is the primary argument. The fixture count is reported as what was seen, not as the reason. After the fixture delta there was no further change to the list (Q16 caveat: run once, no tuning loop).

**Circularity.** The operator plants `express`, and the default list holds `express`. So "the seeds become rule hits" holds by construction and is not validity evidence. The evidence for the rule is its twins (DTO, composition root, test file, `@nestjs/common`, presentation or inbound adapter, domain), which all stay at zero rows (`tests/unit/post-seal/application-purity.test.ts`, `framework-leak-seeds.test.ts`, and the K-tally twins below), and U7's descriptive count on real code.

**Limits.**
- An HTTP type that comes from `@nestjs/common` (`HttpException`, `@Req()`) inside a service is not caught. Neither are Node `http` built-ins. A spec can widen its own FF-P07 list.
- A bootstrap file with a name outside the composition-root patterns, placed inside an application glob, is a false positive.
- **MCP fast path (Q-D = A, signed 2026-10-19 by the author via the decision desk).** FF-P07 has no TypeScript re-statement, because Cypher stays the only rule definition. `check_file` and `check_diff` list it under `notChecked` and add the note "FF-P07 application-purity is checked by the compiled Cypher only (--fast-rules-engine cypher-interp, evaluate_project)" for application files. If the Study 2 `daedalus-mcp` arm runs the default fast path, its tools do not check FF-P07 while Y scores it (design R11).
- **Advisory duplicate with G1.** A clean or hexagonal spec that opts into the rule-gap catalogue gets G1 (advisory) and FF-P07 (blocking) on the same `express` edge. Y counts blocking edges only, so Y is unaffected.

**Effect.**

The fixture delta (`results/v1.4-u2/fixture-delta.md`, 83 committed fixture/spec pairs, cypher-interp) has no FF-P07 rows.

- No committed fixture gains an FF-P07 row. `antipattern-nest` has none before seeding.
- The MCP default-path golden (`tests/fixtures/mcp-interp-parity/default-golden.json`) was re-captured with its own command (`npx tsx tests/unit/mcp-server/interp-parity-capture.ts`). Its only changes are additions: FF-P07 in `notChecked`, and the fast-path note on the two application files. `check_import` is unchanged.
- **K-tally, symbolic arm only** (`results/v1.4-u2/complementarity/`, `scripts/v1.3/complementarity.ts` unchanged, CLI `--symbolic-only --engine cypher-interp --scoring v1.3`). The 4 round-1 `antipattern-nest` seeds are now symbolic-visible, through FF-P07 blocking. Every AP-FRAMEWORK-LEAKn twin stays without an alarm: 4 fixture, 2 near-miss, 14 reference-clean and 1 hand-planted. The 8 E1 seeds (recorded Neo4j findings, bases outside this checkout) were not re-run and go to U7. The CHECK-2 seeds were not re-run either (no read-only export of `v1.3-judge-v22-prep` was made). So the tally is **4 of 12 re-run and visible; 8 pending**, never "12 of 12". No other row of the matrix changed, and the clean units are unchanged.
- **Registered figures.** The offline replication package (`node replication/v1.3/run.mjs --fast`) and `node scripts/v1.3/claims-ledger-check.mjs` were run before and after the change (`results/v1.4-u2/replication-{before,after}.json`). Before: PASS 4366, FAIL 0. After: PASS 4366, FAIL 0. The claims ledger has 0 failures before and after. On a first run after the change, two numbers failed (`e-ev-names` 38 to 39 and `e-ev-res` 4 to 5, `Docs/v1.3/edge-views.md:71`), because the FF-P07 view sat in the v1.3 edge-view table. They were fixed by moving the view to `POST_SEAL_EDGE_VIEWS`. Groups marked needs-Neo4j, needs-LLM or needs-external are not run by the package.
- **Study 2.** Y also counts FF-P07 blocking edges in clean-architecture, hexagonal, nestjs and ddd. The base rate and the power inputs move (design R4).
- **Hold-out (Q-E = A, signed 2026-10-19 by the author via the decision desk).** `Docs/v1.3/holdout-prespec.md` scores with "`rule-tiers.md` at its sealed hash, plus the tier ADRs merged at `<FREEZE_SHA>`" (line 13). It keeps a rule whose tier is still deferred out of M1 and M2 and reports it separately (line 59). If Q-C is signed before the freeze, FF-P07 and the ddd FF-S02 enter M1 to M6 as the prespec allows, with the sealed-scope figures reported next to them. If it is not signed, FF-P07 is listed under line 59 in the freeze commit. Either way, the hold-out manifests were written blind from the sealed sources, so FF-P07 rows that they do not expect lower M2 per style. `scripts/v1.3/lib/freeze-check.ts` now byte-freezes this file and `Docs/v1.4/rule-tiers-post-seal.md`.

### Callers

Every file under `src/` and `scripts/` that imports one of the two option sets (design BR-U2-10). `tests/unit/post-seal/compile-option-callers.test.ts` fails when this table and the imports disagree. "Forward" callers get the post-seal rules. "Sealed" callers regenerate a registered v1.3 figure and keep the sealed rule set, so the figure is reproduced unchanged.

| File | Options | Choice and reason |
|---|---|---|
| `src/cli/cli.ts` | V13_COMPILE_OPTIONS | Forward. `validate --rules v1.3` compiles the forward rule set; `--post-seal off` passes `postSealRules: false` |
| `src/ise/propose.ts` | V13_COMPILE_OPTIONS | Forward. A proposed spec is checked against the rule set it will be evaluated with |
| `src/mcp-server/rule-meta.ts` | V13_COMPILE_OPTIONS | Forward. The MCP server serves the v1.3 rules, post-seal ones included (BR-U2-09) |
| `src/pipeline/commands/compile-command.ts` | V13_COMPILE_OPTIONS | Forward. Sets `postSealRules` from `config.postSealRules ?? scoringMode === 'v1.3'` |
| `src/rule-mining/propose.ts` | V13_COMPILE_OPTIONS | Forward. Mined rules compile against the forward rule set; the offline C2 figures replicate unchanged |
| `scripts/lib/loop/specs.ts` | V13_COMPILE_OPTIONS | Forward. The Study 2 harness: D5 and N3 change what Study 2 is scored on |
| `scripts/v1.3/lib/freeze-check.ts` | V13_COMPILE_OPTIONS | Forward. The hold-out freeze manifest records the compile the hold-out run will use |
| `scripts/v1.3/lib/study2-tunables.ts` | V13_COMPILE_OPTIONS | Forward. Hashes the forward options; the drift of `compiler/v13-compile-options` and the new `template/post-seal/*` entries is expected |
| `scripts/v1.4/u2-fixture-delta.ts` | V13_COMPILE_OPTIONS | Forward. U2's own delta script |
| `scripts/v1.3/apg2-live.ts` | V13_SEALED_COMPILE_OPTIONS | Sealed. Regenerates the APG v2 live figures |
| `scripts/v1.3/convergent-run.ts` | V13_SEALED_COMPILE_OPTIONS | Sealed. Regenerates the convergent-validity figures |
| `scripts/v1.3/cycle-collapse-sensitivity.ts` | V13_SEALED_COMPILE_OPTIONS | Sealed. Regenerates the cycle-collapse sensitivity figures |
| `scripts/v1.3/declared-rules-live.ts` | V13_SEALED_COMPILE_OPTIONS | Sealed. Regenerates the declared-rules live figures |
| `scripts/v1.3/scc-large-latency.ts` | V13_SEALED_COMPILE_OPTIONS | Sealed. Regenerates the SCC latency figures |
| `scripts/v1.3/lib/construct-rescore.ts` | V13_SEALED_COMPILE_OPTIONS | Sealed. Regenerates the construct re-score figures |

The v1.3 scripts that build the pipeline themselves (`rule-mutation.ts`, `fix-hints-eval.ts`, `fixes-mined-run.ts`, `refactor-pr-run.ts`, `html-report-fixtures.ts`, `memory-parity.ts`, `cypher-interp-bench.ts`, `scale/equivalence.ts`, `scale/profile.ts`) pass `postSealRules: false` for the same reason. So do `scripts/sdd/lib/full-eval.ts` (the SDD demo, recorded on the sealed rule set, as `scripts/sdd/lib/replay.ts`), `scripts/v1.3/loop-fault-drills.ts`, `scripts/v1.3/ci-gate-synthetic.ts` and `scripts/v1.3/grid-scale-replay.ts` (added in the U2 verification, 2026-10-18). Every script that calls the CLI (`firewall evaluate`) passes `--post-seal` explicitly: `off` in all of them (the registered v1.3 figures), except `scripts/v1.3/complementarity.ts`, which passes `on` because it was run forward on purpose, for the K-tally above. Three are exempt and take the CLI default: `scripts/run-experiment.ts` runs the registered v1.2E plans with `--scoring v1.2e`, where `--post-seal` is not read; `scripts/v1.3/judge-catch-run.ts` is byte-frozen (`Docs/v1.3/judge-catch-frozen.md`), so a re-run of a judge-catch figure needs `--post-seal off` added by hand; `scripts/lib/freeze-gate-main.ts` is the U5a freeze gate, whose argv is pinned by its own test. `tests/unit/post-seal/compile-option-callers.test.ts` fails when a pipeline-building script does not set `postSealRules` or a CLI-calling script does not pass `--post-seal`.

**What is not changed.** The AP-FRAMEWORK-LEAK operator and its `expectedTemplates` (`[]`); G1 and the rule-gap catalogue; the presets; FF-P01 and `domain-purity`; the frozen `CYPHER_TEMPLATES`; `Docs/v1.3/rule-tiers.md`; the 38-entry v1.3 edge-view table.

## ADR-V14-03: Report schema amendment for the post-seal rules (v1.4 U2)

**Date:** 2026-10-18. **Status:** declared deviation from the frozen report schema (`schemas/report.schema.json`, "FROZEN at U3-R10 ... A change reopens U3 as a reviewed patch"). Raised by the U2 AI-DLC verification.

**Context.**
- ADR-V14-01 and ADR-V14-02 need two things in the report that the frozen schema could not hold. First, a rule row in `tiers` can take its tier from the post-seal record, so `tierSource` needs the value `post-seal`. Second, the report has to say whether the post-seal rules were compiled and which ids the overlay added (BR-U2-03.7, map artefact A3).
- Without the second, `CompileCommand` recorded `postSealRules` and `postSealAdded` in its compile facts, but `src/scoring-engine/report-builder.ts` did not copy them into the report. So `scripts/v1.3/ue-score.ts` (`postSealScopeOf`) always read `undefined`, every forward output was scored on the sealed reference scope, and the blind-key recovery that ADR-V14-01 claims (Q16: 7/8 to 8/8) could not happen through that path.

**Decision.** The schema (and its embedded copy, `src/scoring-engine/report-schema.ts`) is amended in three places, all additive and optional:
1. Both `tierSource` enums gain `post-seal` (in U2, commit "declared post-seal norm rules").
2. Optional top-level `postSealRules` (`const: true`), present only when the post-seal rules were compiled.
3. Optional top-level `postSealAdded` (array of function ids), the ids the overlay added, in table order; present exactly when `postSealRules` is.

The report builder writes items 2 and 3 from the compile facts. Each amendment is dated in the schema's `$comment`, as every earlier amendment is.

**Effect.** A report built with the post-seal rules off (the v1.2E mode, `--post-seal off`, every sealed caller in ADR-V14-02 "Callers") is unchanged, byte for byte. A forward v1.3 report gains the two fields, so `postSealScopeOf` now selects the post-seal reference scope for forward outputs. Saved pre-U2 outputs carry neither field and keep the sealed scope.

**What is not changed.** Every other field and enum of the schema; the v1.2E report shape; `validateReport` behaviour for any report that carries neither field.
