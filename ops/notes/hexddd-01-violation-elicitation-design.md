# HEXDDD-01: eliciting and measuring Hexagonal and DDD violations by coding agents

**Status:** design v1, 2026-10-20. Thinking note, written before any call. **Zero model or generator calls** were made
for it; no loop, agent, jest suite or Neo4j was run. Track: Study 2 follow-up (drift and conformance on Hexagonal and
DDD), exploratory. Comments go in `> AUTHOR:` lines. Nothing here changes the instrument, which stays frozen for the
Study 2b scoring; §8 lists the changes for after that scoring.

## 0. Summary

- **The floor was partly a design artefact.** In the earlier Hexagonal/Clean/DDD pilots the agents did make
  style-relevant errors, but D did not count them (§2). There are three reasons. The errors were present from step 1, so
  they count in Y₁, not in D. They fell in advisory rules (FF-S03, FF-P02, FF-DT06). Or the DDD runs were unscored
  (defect T1).
- **The literature agrees with the practitioner view**, but its evidence is thin. Coding agents follow structural
  constraints less reliably as the constraints accumulate. Code volume predicts structural decay. Long-horizon and
  brownfield tasks are far harder than single issues. No controlled study of DDD violations by agents was found (§1).
- **Recommendation: a 2-case brownfield pilot** (one Hexagonal seed, one DDD seed, each carrying one planted debt, k = 5
  pressure steps, Sonnet, `none` arm). It costs **10 generator calls (hard cap 12)** and runs only after the 2b scoring.
  It also records a hand-read miss log, which measures what the instrument cannot see (§5).

## 1. Literature (every page below was opened; abstract-level unless noted)

| # | Source | What it shows | Use here |
|---|---|---|---|
| L1 | Dente, Satriani, Papotti, *Constraint Decay* (arXiv 2605.06445, v2 2026-09-18) https://arxiv.org/abs/2605.06445 | 80 greenfield and 20 feature-implementation backend tasks, eight frameworks, with behavioural tests and static verifiers. Assertion pass rates fall by 27.28 points on average from baseline to fully specified structural requirements. *(Checked against the v2 full text 2026-10-23: 27.28 is the abstract figure, the mean over the 11 configurations of Table 2; §5.1 gives 27.48 pp for the 9 configurations with L0 A% > 50%. The static verifiers barely move the decay, 26 to 27 pp, App. D. Venue COLM 2026. See `Docs/sources/sources-ledger.md`.)* Data-layer defects (ORM misuse, query composition) are the leading root cause | Pressure grows with stacked structural constraints; the data layer is the weak spot (S1 step 5, S2 step 3) |
| L2 | Zhu, Tsantalis, Rigby, *AI-Generated Smells* (arXiv 2605.02741) https://huggingface.co/papers/2605.02741 | MetaGPT, 5 apps × 4 incremental prompts. Total LOC correlates with architectural smells (ρ = 0.94). Agents split code into many files without cohesion (the "modular mirage"). Prompt detail had no significant effect (p > 0.8) | Longer horizons and growth elicit decay; more instruction does not stop it |
| L3 | Slater, *Technical Debt and Pattern Violation in LLM Architectures* (arXiv 2512.04273) https://arxiv.org/abs/2512.04273v1 | One hexagonal microservice, three models, AST-checked layering. GPT-5.1 had 0 % violations and Llama 3 8B 80 % (adapter bypass, domain ⇄ infra cycles). The abstract gives no rate for Claude | The same "frontier floor" as ours on a small greenfield task: small greenfield tasks do not discriminate |
| L4 | Le et al., *SWE-EVO* (arXiv 2512.18470) https://arxiv.org/abs/2512.18470 | 48 release-transition tasks, about 21 files each. GPT-5.4 + OpenHands resolves 25 %, against about 73 % on SWE-bench Verified | Multi-step evolution of an existing codebase is the realistic hard regime |
| L5 | Scale AI, *SWE-Bench Pro* https://scale.com/blog/swe-bench-pro | 1,865 tasks, 41 repos, and a private commercial subset to resist contamination. Experts write requirements that state "the expected behavior but not how to implement the solution". Top models score about 23 % | Task-writing rule against leaks: state behaviour, never the design (§6 T2) |
| L6 | Jimenez et al., *SWE-bench* (ICLR 2024) https://arxiv.org/abs/2310.06770; SWE-bench Verified https://www.swebench.com/verified.html | Real issue + PR pairs on 12 repos (2,294 tasks). Verified is a 500-task human-checked subset (clear statements, valid tests, solvable from the given information) | Brownfield "feature on an existing repo" design; task statements need a clarity check |
| L7 | Li et al., *FEA-Bench* (ACL 2025) https://aclanthology.org/2025.acl-long.839 | Feature-implementation tasks from PRs in 83 repos; LLMs do markedly worse on incremental repository-level development | Feature requests on existing code are the step shape |
| L8 | Li, Xu et al., *Learning to Commit* (arXiv 2603.26664) https://arxiv.org/abs/2603.26664 | Agent PRs get rejected for a lack of "organicity": they ignore conventions, duplicate internal APIs and violate architectural constraints, and seeing the latest snapshot is not enough | Brownfield is where violations are expected |
| L9 | Horikawa et al., *Agentic Refactoring* (arXiv 2511.04824) https://arxiv.org/abs/2511.04824 | 15,451 agent refactorings in 12,256 PRs, dominated by low-level edits (renames, type changes); few high-level design changes | A migration or refactor step tests design-level behaviour the agents rarely show |
| L10 | Su et al., *LLMs for Detecting Architectural Decision Violations* (arXiv 2602.07609) https://www.arxiv.org/abs/2602.07609 | 980 ADRs in 109 repos. Strong accuracy on explicit, code-inferable decisions; weaker on implicit ones | The semantic layer (C1d/C4) is plausible only for code-visible rules |
| L11 | Li, Liang, Avgeriou, Wang, *Violation Symptoms of Architecture Erosion* (arXiv 2306.08616) https://arxiv.org/abs/2306.08616 | Classifiers over code-review comments (OpenStack, Qt). Developers shown the detected symptoms found 64.7 % of them, against 25.9 % without | Erosion is real in human code review, and detection support matters |
| L12 | GitClear 2025 report, via DevClass https://devclass.com/2025/02/20/ai-is-eroding-code-quality-states-new-in-depth-report/ | 211 M changed lines: 8× more duplicated blocks in 2024 and 39.9 % fewer moved lines; attributed to assistants and small context windows | Duplication across contexts (SEM-DUP) is a likely agent failure. Industry data, correlational |
| L13 | Eisenreich, Jusic, Wagner, *Automating DDD* (arXiv 2603.26244) https://arxiv.org/abs/2603.26244 | A five-step LLM DDD framework: the strategic steps are usable, but errors accumulate until the aggregate design and technical mapping steps become impractical | Aggregates are where LLM DDD fails (DT01–DT03) |
| P1 | Cockburn, *Hexagonal Architecture* https://alistair.cockburn.us/hexagonal-architecture/ | Business logic "seeps into" UI and data code. Each adapter talks to the application through a port | Families H1–H6 |
| P2 | Fowler, *AnemicDomainModel* https://martinfowler.com/bliki/AnemicDomainModel.html | "Bags of getters and setters" with the logic in services. Evans: the application layer stays thin | Family D3 |
| P3 | Fowler, *BoundedContext* https://martinfowler.com/bliki/BoundedContext.html | Each context has its own model, with mappings between polysemic concepts | Family D6 |
| P4 | Vernon, *Effective Aggregate Design* I–II https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_1.pdf , https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_2.pdf | Rules: "Model True Invariants In Consistency Boundaries", "Design Small Aggregates", modify one aggregate instance per transaction, "Use Eventual Consistency Outside the Boundary" | Families D1, D2, D4 |
| P5 | Özkan, Babur, van den Brand, *DDD SLR* (arXiv 2310.01905, JSS) https://arxiv.org/abs/2310.01905v4 | 36 studies. Needed expertise and onboarding are the challenges; empirical evaluations are lacking | There is no empirical DDD-smell catalogue to borrow, so ours is built from P1–P4 |

**Gaps.** No empirical catalogue of DDD smells, and no controlled study of agent-made DDD violations, was found;
mutation-seeded *architectural* benchmarks were not found either. Khononov's book chapter was not reachable (HTTP 403)
and is not cited. OpenAI's SWE-bench Verified post was also unreachable, so the swebench.com page stands in for it.

## 2. The cheap check: did the earlier runs err without D counting it?

Sources: `experiments/loop-pilot/run-2026-10-16/analysis/steps.json`, `experiments/v1.3-floor-probe-3/run-2026-10-16/analysis/steps.json`
(`advisoryByRule`), `results/v1.3-floor-probe*/**/step-0N.json`, the step-4 reports' `violations`, and the DDD re-score
`results/v1.4-ddd-b2-v9/cypher-interp/cli/ddd/relief-volunteers/*/dc/on/step-0N.json`. The counts below are at the final
step. FF-CV05 (test pairing) is left out because it is noise. Every number is read as recorded; nothing was re-run.

| Run (generator) | Style | Blocking | Style-relevant advisory findings (final step) | Proxies |
|---|---|---|---|---|
| loop shelter-adoptions/none (Sonnet) | hex | 0 | **FF-S03 = 1 at steps 1–4**: `adapters/inbound/http-server.ts` imports `adapters/outbound/fake-mail-sender.ts` (a type-only import), an inbound → outbound adapter edge | C03 1, SO01 1 |
| loop shelter-adoptions/gate (Sonnet) | hex | 0 | — | C03 1, SO01 4, SO02 1 |
| loop market-vendors/none (Sonnet) | clean | 0 | **FF-P02 = 1 from step 3**, the TillWave vendor-integration step: `application/tillwave-sync.ts` injects concrete classes | C03 1, SO01 1, SO02 1 |
| loop market-vendors/gate (Sonnet) | clean | 0 | — | SO01 1, SO02 1 |
| probe-3 repair-cafe (Sonnet) | hex | 0 | — | SO01 1, SO02 1 |
| probe-3 school-bus (Sonnet) | clean | 0 | — | C03 2, SO01 1, SO02 1 |
| probe-1 shelter-adoptions none and tool (Opus, by hand) | hex | 0 | **FF-P02 = 1 at step 3 (SMS vendor), 4 at step 4 (audit)** | C03 2, SO01 3 |
| probe-1 food-bank, garden-plots (Opus) | hex | 0 | — (CV03 1) | C03 1; SO01 2 |
| probe-2 shelter-adoptions C1 / C2 / C3 (Opus) | hex | 0 | **FF-P02 = 4 / 0 / 3** (appearing at step 3) | C03 3/2/1, SO01 3/3/3 |
| probe-2 market-vendors C1–C3 (Opus) | clean | 1 / 0 / 0 | FF-P02 1 each (step 4) | C03, SO01 |
| loop relief-volunteers none and gate; probe-3 vineyard-harvest (Sonnet) | ddd | **unscored (T1, BR-SPEC-10)** | vineyard-harvest is still unscored. relief-volunteers, re-scored (TIER-A3, `dc`, post-seal on): Y = 1–4 per step, from FF-DS01 (`src/shared/http.ts` outside every context) and FF-DS02 (gate: `deployment/api` → `registry/domain`; both arms through the ACL once `acl: []`). New at step 4 (none): an FF-S02 domain cycle `deployment.ts` ⇄ `report.ts`. **FF-DT06 = 2 per tree**, with the services growing from 8 → 14 and 6 → 12 methods | — |

**Reading.** **Yes, the agents erred, and D did not count it:**

- **Adapter → adapter.** One Cockburn violation (P1), adapter → adapter, sat in advisory FF-S03. Under the signed
  Q5 C it is an FF-S01 (blocking) finding. It is present from step 1, though, so it would raise Y₁, not D. *This
  reclassification is read from ADR-V13-03 §Q5 and was not re-scored.*
- **FF-P02** (use cases injecting concretes) appears exactly at the vendor-integration and cross-cutting steps. It
  shows in 8 of 18 Hexagonal/Clean runs, counting both probe-1 shelter-adoptions arms, whose step records are
  identical. It is advisory, a ratio, and its construct is mixed: a
  service injecting another service also counts. So it is a signal, not a finding.
- **DDD.** Real blocking DDD findings existed, but only at step 1, and at the time they were unscored. Application
  services roughly doubled in size, the anemic-model signature (P2), and only advisory FF-DT06 sees it.
- **What the runs did not show.** The proxies (SO01, SO02, C03) carry no style construct. There are no domain-purity
  or core-isolation errors on greenfield scaffolds. So the floor is real for the *blocking edge* rules on scaffolded
  greenfield trees, and not real for style violations in general.

## 3. Detectability today (B1)

Classes: **(i)** blocking-detectable; **(ii)** advisory only; **(iii)** semantic only (C1d SEM-*, C4); **(iv)**
undetectable. File grain unless noted. "Q5 C" and similar mark signed construct switches.

| Family (A3) | Class | Rules / why |
|---|---|---|
| H1 Domain imports a framework or ORM | (i) | FF-P01 / FF-DT04 (package list), FF-P06 (constructor-injection half) |
| H1b Domain imports a **vendor SDK** that is not on the list | **(iv)** | The list holds frameworks only. A pilot spec can extend `forbidden_imports` (a spec parameter, not a rule change) |
| H2 Application imports an adapter (for example an HTTP error type) | (i) | FF-S01; FF-S04 under Q6 B |
| H3 Adapter → adapter | (i) | FF-S01 under Q5 C (sealed: advisory FF-S03) |
| H4 Adapter with no port; use case on a concrete adapter | (i) / (ii) | FF-P03 blocking; FF-P02 advisory ratio |
| H5 Port shaped by infrastructure (an ORM or HTTP type in a port signature) | (i) only if the port file imports the package (FF-P01; post-seal application-purity for HTTP packages); otherwise **(iv)** | `SIGNATURE_USES` exists only in APG v2, which is off |
| H6 Business logic in an adapter or controller | (iii) | SEM-MISPLACED (NS-02 cases 07, 09); no symbolic rule |
| H7 Cycles domain ⇄ infra | (i) | FF-S02 (hex native; DDD post-seal, Q16 B) |
| D1 Aggregate bypassed (outside code holds an inner entity) | (i) at file grain; **(iv) on agent code** | FF-DT01. Agent trees put inner entities in the root's file (DDD-BETA §A.3) |
| D2 Repository for a non-root, or returning one | (i) file grain, weak reach | FF-DT02 (2 of 15 real repos) |
| D3 Anemic model / logic in application services | (ii) / (iii) | FF-DT06 (method count), FF-SO01; SEM-MISPLACED. No "entity without behaviour" rule |
| D4 One transaction changes two aggregates | **(iv)** | No rule. The facts exist (`CALLS`, repository globs) |
| D5 Invariant broken outside the aggregate (setter, public field) | (i) value objects only; else (iii) | FF-DT03 (value-object classes). Member facts exist for entities, but no rule reads them; SEM-DUP for a duplicated rule |
| D6 Bounded-context leakage | (i) | FF-DS02 (public API or ACL), FF-DS01 (module outside every context) |
| D7 Shared kernel misused | **(iv)** | FF-DS02 ignores non-context files (DDD-BETA §A.1) |
| D8 Repository returning ORM entities | (i) only through the import (FF-DT04); else (iv) | — |
| D9 DTO/entity confusion at the boundary | **(iv)** in hex/ddd | FF-P05 is not in either preset, and inbound adapters may import the domain |
| D10 One concept modelled twice; one rule duplicated across contexts | (iii) | SEM-FRAG, SEM-DUP |
| D11 Domain events outside the domain | (ii) | FF-DT05 |

## 4. Candidate scenarios

All three run on the loop harness with a static spec, scoring v1.3 with the signed switches, on `cypher-interp`.
Each is scored by **D_seed**: correct (check-correct) blocking identities that are new relative to the seed tree,
summed over steps 1..k, with the edge-grain identity rule of `driftRun`. **Also reported:** Y per step, new advisory
identities in the construct-bearing rules (FF-S03, FF-P02, FF-DT05, FF-DT06), per-rule exposure, and the hand-read miss
log (§5.3).

| | **S1 Brownfield Hexagonal** | **S2 Brownfield DDD with seeded debt** | **S3 Long-horizon greenfield, no scaffold** |
|---|---|---|---|
| Start | Seed tree: the hex reference project (`tests/fixtures/v1.3-reference/hexagonal`, hotel booking, 31 files, about 0.9 kLOC, vendored typings, no install). Later: a real hex repo at its pin (for example `nalhin-movies`, 119 files) | Seed: the DDD reference project (`ddd/clean`: 2 contexts, 3 aggregates, inner entities and value objects at file grain, so FF-DT01–DT03 are reachable) | Empty tree: no style sentence and no layout sentence. Only a one-line style name, or none in a control |
| Pre-seeded debt | Condition *debt*: variant `v05` (an inbound adapter reads an outbound adapter) | Condition *debt*: variant `v08` (cross-context internal import) | — |
| Steps k | 5 | 5 | 8 |
| Pressure families | 1 vendor SDK (payments SDK typings in `types/`); 2 "fix double booking today, small change"; 3 cross-cutting audit with the user id from a request header; 4 a slow occupancy/revenue report with a latency bound; 5 a migration to an SQL client (typings present), with in-memory kept for tests | 1 refuse an order when unpaid invoices exceed a limit, and mark the order paid when its invoice is paid (cross-aggregate, cross-context); 2 "negative quantities reach the API, fix it today"; 3 a monthly revenue-per-customer report over orders and invoices; 4 one tax rule by country used by both contexts; 5 support staff discount single order lines through a new endpoint | 1–2 first slices; 3 vendor SDK; 4 cross-cutting; 5 report across entities; 6 bug fix on step-2 code; 7 an ORM migration; 8 a second channel (CLI) |
| Expected violations → layer | H1b (seen once the SDK is listed), H2/H3/H4 → FF-S01/S04/P03 (i); H6 → SEM (iii); H5 → (iv) / hand-read | D6 → FF-DS02 (i); D1 → FF-DT01 (i), as the seed has file grain; D5 → FF-DT03 (i), or SEM-DUP (iii); D3 → FF-DT06 (ii); D4, D7 → hand-read (iv) | H1–H4 and H7 (i) **only if** the spec freeze works. DDD hits T1 and the file-grain gap, so it is not recommended for DDD now |
| Conditions | clean seed vs debt seed; arm `none` (later `daedalus-mcp`) | the same | style named vs not |
| Generators | Sonnet (CLI); later a Gemini arm (agy or API) as a dated extension | the same | the same |
| Main risk | Seed authored by the same project, so it is small and familiar | The same, plus the DDD-beta limits | Repeats the floor; the spec freeze is unsolved |

## 5. Recommended pilot: 2 cases (S1-debt and S2-debt)

**Why these two.** The pilot asks one question: *are violations elicited at all?* So it maximises pressure (a
brownfield seed, planted debt, explicit time and performance cues, no layout sentence). It contrasts nothing. Seeds at
file grain sidestep T1 and the DDD grain gap, so every rule in §3 class (i) has a precondition.

### 5.1 Exact protocol

- **Before any call.** The task texts, the seed tree hashes, the spec files (the hex reference `spec.yaml`, plus the two
  SDK packages added to `forbidden_imports`; the `presets/ddd.yaml` declarations) and this pass bar are committed.
  The frames are written to `hint-audit/` and read for leaks (§6 T2).
- **Run.** 2 runs × 5 steps, arm `none`, `claude-sonnet-5-5` through the Claude CLI at a recorded pin. The frame says:
  "existing TypeScript service in this directory; <request>; keep `tsc` passing". It names no style, no layer and no
  folder.
- **Calls.** **10 generator calls** (one CLI session per step), 0 repair turns, **hard cap 12** (one infrastructure
  redraw per run). Scoring, check-correct, exposure and the hand read are all zero-call.
- **Semantic layer.** It is not run in the pilot. If the hand-read log holds at least one SEM-shaped miss (H6, D3, D5,
  D10), C1d runs afterwards on the two step-5 snapshots, `--estimate` first, with a hard budget the author signs. The
  upper bound is 154 calls per snapshot (sem-01).
- **When.** Only after the Study 2b scoring is complete, on one lane, at most 2 lanes in all, with no Neo4j.

### 5.2 Pass bar: "violations are elicited"

The pilot **passes** when either:

- **(a)** D_seed ≥ 1 in at least 1 of the 2 runs; or
- **(b)** in **both** runs, ≥ 1 new advisory identity in FF-S03, FF-P02, FF-DT05 or FF-DT06 that the hand read
  confirms as a P1–P4 violation.

The planted debt never counts; copying it counts as new identities of the same rule.

**Fail:** neither (a) nor (b). Then exactly one revision is allowed: swap in a real-repo seed (S1 at its pin). After
that, the floor is reported as a finding. There is no third loop.

**Separately recorded:** the instrument's construct gap = the hand-read violations with no matching finding, per §3
family.

### 5.3 Hand-read miss log (zero calls)

For each step diff, one reader checks families H1–H7 and D1–D11. Each entry records: file:line, family, the P1–P4
source sentence, and whether a finding matches. The log is written before the reader sees the instrument output for
that step. It is the only way to see families of class (iv).

> AUTHOR: reader = you (preferred, independent of the generator vendor), or the coordinator with your spot check of both runs?

### 5.4 How it feeds a registered study

If the pilot passes:

- **Frozen as written:** S1 and S2, the pressure texts and the seeds.
- **Added to the design:**
  - a *clean vs debt* seed condition and arms `none` vs `daedalus-mcp`;
  - 2 tasks per style;
  - replicates sized from the pilot's D_seed variance (as `study2b-pilot-power.ts` does);
  - the hand-read log on a sample, to estimate construct coverage.
- **Primary outcome:** D_seed.
- **Pre-registered before its first call:** the per-family rules added after §8, each with its tier set a priori
  (rule-tiers principle).

## 6. Threats

| Id | Threat | Mitigation |
|---|---|---|
| T1 Construct | The instrument misses H5, D4, D7 and D9, and sees D1 only at file grain. A "pass" may then rest on a few rules | The hand-read log measures the gap per family. The claim is limited to class (i) rules. The advisory and SEM layers are reported apart from D |
| T2 Task leak | Pressure text that names the shortcut ("call the database from the controller") measures compliance, not drift. Text that names the architecture tells the agent the answer | Requests state behaviour and constraints only (L5 rule). They name no layer, port, adapter, aggregate or context. The `hint-audit` read happens before any call, and a step that names its expected violation is rewritten |
| T3 Realism | The reference seeds are small (31 files), written by the same project, and live in a public repo | One revision allowed: a real repo at its pin (§5.2). A seed size above 100 files in the registered study |
| T4 Same vendor | Sonnet generates. Claude sessions wrote the seeds, specs and operators, and may hand-read | The author reads, or spot-checks, the log. A Gemini arm as a dated extension. Report it as a limitation (as in BF-01 and DDD-BETA) |
| T5 Y₁ vs D | Violations present from step 1 are invisible in D (seen in §2) | D_seed is measured against the seed, so step 1 counts. Y per step is reported too |
| T6 Debt as instruction | Planted debt may read as house style, so copying it is "conformance" | Debt is a condition in the registered study (clean vs debt), not a constant |
| T7 Advisory construct | FF-P02 mixes service → service with service → adapter injection | Under (b), only a hand-confirmed advisory finding counts |
| T8 Interference with 2b | Machine load; the frozen instrument | The pilot runs after the 2b scoring. No 2b path is read or changed. Its domains differ from the sealed 2b tasks |

## 7. What can be reused as is

| Piece | Use |
|---|---|
| Loop harness (`scripts/lib/loop/`), arms, step records, `snapshots.git` | Run, per-step scoring, archive |
| `shared-start.ts` | Model for the seed start (§8 item 1). A synthetic step-0 source run could stand in for it |
| Reference variants `hexagonal/variants/v05`, `ddd/variants/v08`; `scripts/lib/mutation/hexddd` (MO-H01..H07, MO-D01..D06) | The planted debt. Operators for further seeds in the registered study |
| `scripts/v1.3/check-correct.ts`, `scripts/lib/drift/` (`driftRun`, identities) | D_seed, correct-only |
| `scripts/v1.4/stage-c-rescore.ts` | Re-score at the instrument of record |
| `scripts/v1.4/exposure-count.ts` | Per-rule exposure, **Layered templates only today** (§8 item 3) |
| `scripts/v1.4/lib/rehearsal-frames.ts` (`hint-audit/`) | The frame leak read |
| `scripts/v1.3/ontology-run.ts` (C1d), `scripts/v1.4/c4-run.ts` | Semantic layer, gated (§5.1) |
| Construct switches Q5 C, Q6 B, Q16 B (`src/construct-switches/`) | Must be on in the pilot evaluator |

## 8. Changes needed (all after the 2b scoring; the instrument is frozen for 2b)

| # | Change | Kind | Needed for |
|---|---|---|---|
| 1 | Seed start: the loop starts from a seed tree as step 0; D_seed is counted against it | harness | S1, S2 |
| 2 | Brownfield frame: no style or layout sentence | harness (prompts) | S1, S2, S3 |
| 3 | Opportunity queries for the hex/DDD templates (dependency-direction-graph, core-isolation, port-adapter-pattern, DS01, DS02, DT01–DT04) | analysis | per-rule exposure |
| 4 | Per-project `forbidden_imports` for vendor SDKs (spec only). Later, an allowlist mode for domain packages (rule, ADR) | spec / rule | H1b |
| 5 | Declaration-grain FF-DT01/DT02/DT03 (DDD-BETA §C, a post-seal deviation) | rule | D1, D2, D5 on agent code; S3-DDD |
| 6 | Fix T1 (the step-1 spec freeze lacks DDD aggregates → BR-SPEC-10) | spec freeze | S3-DDD |
| 7 | Candidate rules, tiered a priori: one application method writing two aggregates (D4, Vernon P4); contexts' use of the shared kernel (D7); entity with no behaviour but public mutators (D3, member facts) | rule (ADR) | D3, D4, D7 |
| 8 | A hand-read miss-log schema and its checker (file:line resolves, family known) | analysis | §5.3 |

DDD remains a beta instrument (DDD-BETA). FF-DT02 and FF-P07 are not beta-ready, and the hold-out cannot reach a 0.90
lower bound by design. Every DDD number from this design is therefore development-grade until items 5 and 6 land.
