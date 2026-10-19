# NS-02: the A2 facts contract, the K3/K2m case set, and the run specs

**Lane E, 2026-10-18. Zero model calls.** Every count below comes from the harness's `--estimate` mode or from the scripted mock provider, run on 2026-10-18. Neither calls a model. This note follows `decisions.md`:
- **N1 = A:** the model supplies facts, not verdicts.
- **M4 = A:** interpretation happens before detection, as facts.
- **N4 = A:** the fragmentation check works within one declared bounded context.
- **N3 = B:** Q26 application purity becomes a rule (lane A; it is K0, so it is not in this set).

Comments go in `> AUTHOR:` lines.

---

## 0. What exists, and what this note adds

- **Harness.**
  - Code: `src/apg-enrich/ontology/` (Ontology v0).
  - Runner: `scripts/v1.3/ontology-run.ts`.
  - Cases: `tests/fixtures/v1.3-ontology/`, six cases with mock answers and mock cassettes.
- **Providers.** The runner has two: `claude-cli` (the judge's isolated route, `claude-opus-5-5`, CLI 2.1.294) and `mock` (the scripted answers).
  - `--estimate` and `--replay` use `NoCallProvider` and never call anything.
- **This note adds:**
  - the A2 contract (§1);
  - the C3 rules that read it (§2);
  - eight new case projects under `tests/fixtures/v1.3-ontology/ns02/`. With four existing cases they make **six defect cases plus six twins** (§3);
  - the pilot spec (§4) and the six-case run spec (§5);
  - the code that is still missing (§6).

## 1. The A2 facts file

**One file per project per run:** `results/<study>/<provider>/<project>/facts.json`. It is written beside `result.json` and derived from it. Results are **replayed from the cassettes, not regenerated**, which covers risk 5 of the instrument map.

### 1.1 Envelope

```json
{
  "schemaVersion": 1,
  "artifact": "A2",
  "project": { "id": "case-02-misplaced-pricing", "contentHash": "<sha256 of the project files>", "commit": null },
  "inputs": {
    "a1": { "apgHash": "<sha256 of canonical APG JSON>" },
    "layerModel": { "path": "tests/fixtures/v1.3-ontology/layers.json", "hash": "<sha256>" }
  },
  "producer": {
    "part": "C1d", "pipeline": "ontology-v0", "promptVersion": "ontology-v0.1",
    "provider": "claude-cli", "runs": 2, "runId": "<ontology runId>"
  },
  "facts": [ "...Fact..." ]
}
```

### 1.2 One fact

| Field | Type | Rule |
|---|---|---|
| `id` | `fact:<sha256[0..16]>` | the hash of `subject`, `predicate`, `value`, `source` and `runIndex`, so it is stable |
| `subject` | APG node id (Class or Method), or a Sem id | **must** be an APG node of the A1 named in `inputs.a1` |
| `predicate` | one of §1.3 | closed vocabulary; a new predicate needs a schema bump |
| `value` | JSON scalar or object, per predicate | its shape is fixed per predicate (§1.3) |
| `source` | `parser` \| `model` | `parser` covers every deterministic derivation, including mapping a file to a **spec-declared** context (`basis: "spec"`) |
| `basis` | `apg` \| `spec` \| `verifier` | parser facts only |
| `modelId` | string \| null | the **served** model id (VRD-07); null if and only if `source = parser` |
| `promptHash` | sha256 \| null | the SHA-256 of the exact prompt (an existing provenance field); null for parser facts |
| `date` | ISO 8601 | when the answer was recorded; replays keep the recorded date |
| `confidence` | 0..1 \| null | the model's own figure; null for parser facts. **Never** used as a gate on its own |
| `agreement` | `agreed` \| `single-run` \| null | from the two-run match (design §6); null for parser facts |
| `runIndex` | int \| null | `null` once both runs are merged into one agreed fact |
| `evidence` | `GroundedEvidence[]` | **non-empty for every model fact**. Each citation has passed all nine grounding checks (design §4). Facts that fail grounding never reach A2; they are counted under `hallucinations` |

**Invariants**, checked on write:
1. Every `subject` exists in A1.
2. A model fact has `modelId`, `promptHash` and at least one grounded citation.
3. A parser fact has none of these.
4. No fact has a verdict-shaped predicate such as `violates` or `isDefect`. Verdicts belong to C3 (N1).

### 1.3 Predicate vocabulary v1

| Predicate | Subject | Value | Source | Produced today by |
|---|---|---|---|---|
| `inLayer` | Class | layer kind | parser (`apg`) | the layer model |
| `inContext` | Class | context name | parser (`spec`) | `componentOf()` with `ddd.contexts` |
| `logicDensity` | Method | number | parser (`apg`) | cheap proxy |
| `hasResponsibility` | Class | `{name, description, naturalLayer}` | model | pass (a), `SemRESPONSIBLE_FOR` |
| `embodiesConcept` | Class | `{concept, relation: defines\|uses}` | model | pass (a), `SemEMBODIES` |
| `enforcesRule` | Method | `{statement, subject, operator, threshold, unit, kind}` | model | pass (c), `SemENFORCES`. **`kind` (`business` \| `input-validation`) is new**; see §6 item 4 |
| `realizesCapability` | Class | `{capability}` | model | pass (b), `SemREALIZES` |
| `sameConceptAs` | Class | `{other: <Class id>, same: bool}` | model | pass (d) adjudication, or an exact name match (then `source: parser`) |
| `sameRuleAs` | Method | `{other: <Method id>, same: bool}` | model | pass (d) adjudication |
| `ruleEquivalenceVerified` | Method | `{other, verified, method}` | parser (`verifier`) | `verifyRuleDuplication` |

Today's pipeline already produces every model fact above except `enforcesRule.kind`. A2 is a **projection** of `OntologyResult` (Sem nodes and edges, plus adjudications), with one change: Ontology v0's `findings[]` **do not go into A2**, because they are verdicts. Under N1 and M4 they move to C3 (§2).

Example: the case-02 fact, rebuilt by hand from the mock result. The mock is not a model, so the values are illustrative.

```json
{ "id": "fact:…", "subject": "<Method OrderNotificationService.sendConfirmation>", "predicate": "hasResponsibility",
  "value": { "name": "Compute the order discount and the payable amount", "naturalLayer": "domain" },
  "source": "model", "modelId": "claude-opus-5-5", "promptHash": "<sha256>", "date": "2026-10-20T…Z",
  "confidence": 0.85, "agreement": "agreed", "runIndex": null,
  "evidence": [{ "nodeId": "…", "file": "src/notifications/application/order-notification.service.ts",
                 "startLine": 9, "endLine": 9, "quote": "const discount = order.lines.length > 3 ? subtotal * 0.1 : 0;", "grounded": true }] }
```

## 2. How C3 consumes the facts

**Loading.** A loader writes A2 into the graph next to A1:
- model facts become the existing `Sem*` nodes and edges;
- parser facts become properties: `c.layer` already exists, and `c.context` is new.

Every Sem edge carries `factId`, `source`, `agreement` and `confidence`. **The rules see facts, never prompts or model output.**

That gives the ablation for free (instrument map §3):
- **C3 alone:** A1 only. Every Sem rule returns empty.
- **C3 + A2:** A1 plus the facts.
- **The judge alone:** the current verdict arm.

**Fact policy, one parameter per rule run:**
- `agreed-only` (the default, as design §5 has it): a model fact is used only if `agreement = agreed`.
- `any`: single-run facts are also used. This is reported as a sensitivity row, never as the primary result.

Confidence is reported but is never a threshold.

**The three Sem rules.** The Cypher is in the shape of the sealed templates; edge names follow the APG: `File-[:DECLARES]->Class-[:CONTAINS]->Method`.

**SEM-MISPLACED.** A responsibility whose natural layer differs from the declared layer.
```cypher
MATCH (c:Class)-[e:SemRESPONSIBLE_FOR]->(r:SemResponsibility)
WHERE c.layer IS NOT NULL AND r.naturalLayer <> c.layer
  AND ($policy = 'any' OR e.agreement = 'agreed')
RETURN c.id AS site, c.layer AS classLayer, r.naturalLayer AS naturalLayer, e.factId AS fact
```
The model supplies `naturalLayer`, a fact about meaning. The rule compares it with the parser's `layer`. This is today's `pipeline.ts` logic, moved behind the contract.

**SEM-DUP.** One business rule enforced in two contexts.
```cypher
MATCH (m1:Method)-[s:SemSAME_RULE_AS {same: true}]->(m2:Method),
      (c1:Class)-[:CONTAINS]->(m1), (c2:Class)-[:CONTAINS]->(m2)
WHERE c1.context <> c2.context AND ($policy = 'any' OR s.agreement = 'agreed')
OPTIONAL MATCH (m1)-[v:SemRULE_VERIFIED]->(m2)
RETURN m1.id, m2.id, coalesce(v.verified, false) AS verified
```
Every row is a finding. `verified` splits each one into **verified** and **model-only**, and both are reported (design §5).

**SEM-FRAG (N4).** One concept defined under two or more names **inside one declared context**.
```cypher
MATCH (a:Class)-[ea:SemEMBODIES {relation: 'defines'}]->(k:SemBusinessConcept)<-[eb:SemEMBODIES {relation: 'defines'}]-(b:Class)
WHERE a.id < b.id AND a.name <> b.name
  AND a.context IS NOT NULL AND a.context = b.context
  AND ($policy = 'any' OR (ea.agreement = 'agreed' AND eb.agreement = 'agreed'))
RETURN a.context AS context, k.name AS concept, collect(DISTINCT a.id) + collect(DISTINCT b.id) AS classes
```
**Across contexts the rule is silent by construction.** A model that says "Customer and Payer are the same party" produces a true fact and no finding. That is DDD's translation at the boundary.
- K3 (concept identity) comes from the model.
- K4 (the context map) comes from the spec.
- The verdict comes from the rule.

**Also at C3, but not neural.** Q26 application purity (N3) is a K0 rule over A1 and needs no A2. Lane A owns it, and it turns the 12 framework-leak seeds into rule hits.

> AUTHOR: the Cypher above is the target shape. Until the loader exists (§6 item 3), the pilot and the six-case run score with `scorer.ts`. It applies the same three conditions in TypeScript, except N4, which needs §6 item 1.

## 3. The case set: six defect cases plus six twins, DDD first

Every manifest was written on 2026-10-18, before any model run on these cases. Existing manifests are unchanged. Each new manifest's `ns02` block holds:
- `expectedFacts`: subject, predicate, value, source, and a polarity of `required`, `forbidden` or `tolerated`;
- `expectedVerdicts`: per rule, `fail` or `pass`.

Location: `tests/fixtures/v1.3-ontology/ns02/`, plus the four parent cases.

| # | Defect case | Twin (should pass) | Level | DDD framing | Expected verdict: defect / twin | Harness today |
|---|---|---|---|---|---|---|
| 1 | `ns02/case-05-fragmentation-in-context`: `Customer` and `Client` both defined in the **sales** context | `ns02/case-05t-control-contexts-own-models`: `Customer` (sales), `Payer` (billing), `Requester` (support), with an ACL translator | K3 + K4 | ubiquitous language per context | SEM-FRAG fail / pass | **not findable** (§6 item 1) |
| 2 | `ns02/case-06-invariant-only-in-controller`: the purchase limit (≤ 20 units) is checked only in `OrderController.create` | `ns02/case-06t-control-input-check-in-controller`: the controller checks only `Number.isInteger`; `Order.create` enforces the limit | K3 | aggregate invariant | SEM-MISPLACED fail (presentation → domain) / pass | findable |
| 3 | `ns02/case-07-policy-in-repository`: gold-tier eligibility inside `InMemoryMemberRepository.findGoldEligible` | `ns02/case-07t-control-specification-in-domain`: the `GoldEligibility` specification in the domain; the repository applies the spec it is given | K3 | Specification pattern | SEM-MISPLACED fail (infrastructure → domain) / pass | findable |
| 4 | `case-02-misplaced-pricing`: a 10 % discount computed in `OrderNotificationService.sendConfirmation` | `case-04b-control-clean-notification` | K3 | domain logic in an application service | SEM-MISPLACED fail (application → domain) / pass | findable (mock 1/1) |
| 5 | `case-01-rule-dup-shapes`: `total >= 50` vs `!(sum < 5000)` cents | `case-04a-control-near-miss-rules` | K2m | one policy, two owners | SEM-DUP fail, **verified** / pass | findable (mock 1/1) |
| 6 | `ns02/case-08-refund-window-shapes`: `days <= 30` (returns) vs `!(now - t > 2_592_000_000)` ms (support) | `ns02/case-08t-control-same-window-different-rules`: the same 30-day ms constant and shape, but as the **invoice payment term** | K2m | one policy, two owners | SEM-DUP fail, **model-only** (`verified: false`; 30 vs 2.592e9 is not a power-of-ten scale) / pass | findable if pass (d) proposes the pair |

**Expected facts**, in short. The full list is in each manifest.
- **Pair 1.** Required:
  - `inContext(Customer)` = `inContext(Client)` = `sales`;
  - both have `embodiesConcept defines` the customer concept;
  - `sameConceptAs(Customer, Client)` = true.

  Forbidden: `DiscountPolicy` defining it.

  Twin: `sameConceptAs` across contexts is **tolerated** either way. The verdict must not depend on it.
- **Pair 2.** Required:
  - `inLayer(OrderController)` = presentation;
  - `enforcesRule(OrderController.create).kind` = business, threshold 20;
  - `hasResponsibility(OrderController).naturalLayer` = domain.

  Twin: the controller's rule kind = input-validation, and `Order.create` kind = business.
- **Pair 3.** Required:
  - `inLayer(InMemoryMemberRepository)` = infrastructure;
  - its `findGoldEligible` enforces a business rule;
  - its natural layer = domain.

  Twin: the rule sits on `GoldEligibility.isSatisfiedBy`. `findMatching` enforcing a business rule is forbidden.
- **Pair 4 and pair 5:** as in the existing manifests (`naturalLayer` domain; one rule at two sites, verified by comparison pattern).
- **Pair 6.** Required:
  - both methods enforce a business rule;
  - `sameRuleAs` = true;
  - `ruleEquivalenceVerified` = false.

  Twin: `sameRuleAs(ReturnPolicy.accepts, PaymentTermService.isWithinPaymentTerm)` = false.

**Already known before any model run.** All of this comes from the zero-call mock dry run (§7).
- **Pair 2 is not cheap-blind.** The cheap role proxy flags `OrderController` in case-06 and not in its twin. On this pair a deterministic heuristic already separates the defect from the twin. That is NS-01 §7 falsifier 1, so pair 2 cannot carry the "a model is needed" claim alone. It stays in the set because it is the canonical K3 case of NS-01 §4c. The manifest records this.
- The cheap proxies miss the other five defects and flag none of the 17 forbidden items on the new cases.
- **Excluded from the NS set:** `case-03-concept-fragmentation` and its twin `case-04c`. Case-03 plants the names across three contexts, which N4 makes correct DDD. Both stay unchanged, because the mock regression tests use them.

**Threats this set does not remove:**
- One author wrote the cases, the manifests and the prompts. Mitigations: the Gemini arm, and the D3 rater labelling the K3 cases first.
- The cases are textbook-sized.
- Pairs 2 and 3 carry explanatory comments. That makes them legible to any reader, which favours models.

## 4. The pilot: case-02 and its control case-04b

**The runs = 1 trap (found in the dry run).** With `--runs 1`:
- every assertion is `single-run`;
- `requireAgreement: true` (the default, which the runner cannot change) drops every finding.

The mock at runs = 1 finds **0 of 1** on case-02, even though the `SemMISPLACED_IN` fact is there. A runs = 1 pilot would score "missed" whatever the model answers. **So the pilot runs at `--runs 2`.**
- The fallback is runs = 1, read on the facts and not on the score table. It costs 13 calls per vendor instead of 26.

> AUTHOR: OK runs = 2 (26 calls per vendor)? Or runs = 1, read as facts (13 per vendor)?

**Call count, from the mock profile.** These are exact for passes (a) and (c). The (b) and (d) counts depend on the answers, so the cap below is the hard bound.

| Project | Classes | Groups | Rule candidates | runs = 1 (mock) | runs = 2 (mock) | `--estimate` upper bound, runs = 2 |
|---|---|---|---|---|---|---|
| case-02 | 4 | 2 | 2 | 8 | 16 (a 8, b 4, c 4, d 0) | 96 (d ≤ 80 is the default cap) |
| case-04b | 2 | 3 | 0 | 5 | 10 (a 4, b 6) | 90 |
| **Pilot, per vendor** | | | | **13** | **26** | hard cap with `--budget 20`: **40** |

**Claude route.** It exists today and uses the judge's isolated CLI. Run from the repository root:
```bash
F=tests/fixtures/v1.3-ontology
for c in case-02-misplaced-pricing case-04b-control-clean-notification; do
  npx tsx scripts/v1.3/ontology-run.ts --project $F/$c --layers $F/layers.json --estimate --runs 2
done
# after the estimate is read and OK'd:
for c in case-02-misplaced-pricing case-04b-control-clean-notification; do
  npx tsx scripts/v1.3/ontology-run.ts --project $F/$c --layers $F/layers.json --provider claude-cli \
    --runs 2 --budget 20 --cassettes $F/cassettes-claude-cli --out results/v1.3-ontology/ns02-pilot/claude-cli/$c
done
```
- Use one `--out` per case. The runner writes `scores.json` per invocation, so a shared directory overwrites it.
- Rescore with no calls: run the same command with `--replay`.

**Gemini route.** This is the second vendor. **It does not exist yet** (§6 item 2). The proposed command keeps the same shape:
```bash
  npx tsx scripts/v1.3/ontology-run.ts --project $F/$c --layers $F/layers.json --provider gemini-agy --model gemini-4-argon-high \
    --runs 2 --budget 20 --cassettes $F/cassettes-gemini-agy --out results/v1.3-ontology/ns02-pilot/gemini-agy/$c
```
- `gemini-4-argon-high` through the `agy` CLI is the second-vendor rater already registered for CHECK-2 (`scripts/v1.3/judge-v22-check2-gemini.ts`).
- The alternative is the Gemini API route (`GeminiProvider`, the accepted `GEMINI_API_KEY`).
- Same call structure, so the same count: **26 calls at runs = 2, hard cap 40.**
- On Gemini, a schema-invalid answer is retried once. The budget cap holds anyway.

**Pilot total:** 26 + 26 = **52 calls** (13 + 13 = 26 at runs = 1). The hard cap is 80.

**What we read together:**
- every accepted and rejected assertion;
- the per-pass agreement;
- whether case-02's fact is `naturalLayer = domain`, and case-04b has no non-application responsibility.

**Pilot bar:** case-02 found, case-04b clear, on each vendor, with hallucinations reported.

## 5. The six-case run: 12 projects, 2 vendors

The pairs are §3's table. Run each project as in §4: one `--project`, its own `--layers` (each `ns02/*/layers.json`; the parent `layers.json` for the four parent cases), `--runs 2`, `--budget 30`.

**Call count per vendor at runs = 2.**
- Four parent cases (mock profile with the real scripted answers): case-02 16, case-04b 10, case-01 18, case-04a 20, so **64**.
- Eight new cases (mock with empty answers, so a + b + c are exact and d = 0):
  - case-05 26, case-05t 20, case-06 16, case-06t 20;
  - case-07 12, case-07t 16, case-08 14, case-08t 14;
  - total **138**.
- Pass (d) allowance for the new cases, from the candidate pairs the cases plant: case-05t ≤ 3 concept pairs, case-05 1 (after §6 item 1), case-08 and case-08t 1 rule pair each. That is ≤ 6 pairs × 2 runs = **≤ 12**.
- **Expected per vendor: about 202 to 214 calls.** The hard cap is 12 × 30 = **360**. The theoretical `--estimate` bound, with d at the default cap, is 1,158. The budget cap makes it irrelevant.
- **Both vendors: about 404 to 428 calls, hard cap 720.**

Prompt tokens per vendor at runs = 2, passes (a) to (c) only:
- new cases about 79k (sum of the `--estimate` figures);
- parent cases about 33k;
- total about 112k input tokens before pass (b) and (d) prompts.

**Order:** pilot first, then pairs 4, 5, 2, 3, 6, then pair 1 last, once §6 item 1 has landed.

## 6. Code still needed (none of it written by this note)

| # | Item | Blocks | Size |
|---|---|---|---|
| 1 | **N4 in the pipeline.** `clustering.ts:85` pairs only items in *different* components. `pipeline.ts:344` needs ≥ 3 names in ≥ 2 components. Both must change to "≥ 2 names, same declared context". Cross-context concept clusters become info-only. The mock tests' case-03 expectation (`pipeline.test.ts:61`) changes with them | pair 1 (and pair 1's twin is a possible forbidden-hit until then) | small, plus one ADR line (N4) |
| 2 | **Gemini ontology provider.** A generic `OntologyProvider` adapter around any `LLMProvider` (agy or API): pass `systemPrompt` and `responseSchema`, then parse the JSON content. Plus `--provider gemini-agy\|gemini --model` in the runner | the Gemini arm of the pilot and of the six-case run | small; lane C's CDX adapter work overlaps |
| 3 | **A2 writer and loader.** `OntologyResult` → `facts.json` (§1), plus the A2 → graph loader for the §2 Cypher | C3 reading facts; the with/without-A2 ablation | medium. The scorer covers the pilot without it |
| 4 | **`enforcesRule.kind`** (business vs input-validation) in the pass-(c) schema and prompt. This is a `PROMPT_VERSION` bump, which invalidates the cache | the fact-level checks of pairs 2 and 3 (the verdicts work without it, through `naturalLayer`) | small |
| 5 | **Fact scorer.** Reads `ns02.expectedFacts` against A2 | fact-level results (the verdict-level results don't need it) | small |
| 6 | **`--require-agreement false` flag** in the runner | the runs = 1 fallback (§4) and the `any`-policy sensitivity row | trivial |

## 7. Dry-run record, 2026-10-18 (zero model calls)

All outputs went to the session scratchpad. No committed cassette or result was touched.

- **Parent set:**
  - `--fixtures --provider mock --replay`: 110 cache hits, 0 calls, 3/3 found, 0/14 forbidden hits;
  - the same as the design's §9.
- **New cases: `--estimate` loads all 8**, extracting the APG and building the units. Classes per case: 5, 4, 4, 5, 3, 4, 3, 3. No estimate exceeds the budget.
- **New cases: mock record with empty scripted answers.** This calls the mock responder, not a model.
  - All 8 manifests load and score.
  - Calls: 26, 20, 16, 20, 12, 16, 14, 14 (138).
  - Every expected item is `missed` (empty answers) and every forbidden item `clear`. That is correct for empty answers.
  - The cheap proxies caught 1 of the 4 new defects (case-06) and flagged 0 of 17 forbidden items.
- **Pilot pair: mock record with the real scripted answers.**
  - runs = 1: 8 + 5 = 13 calls, case-02 **0/1 found**: the trap in §4.
  - runs = 2: 16 + 10 = 26 calls, case-02 1/1 found, case-04b clear.

## Changelog
- 2026-10-18: first version.
