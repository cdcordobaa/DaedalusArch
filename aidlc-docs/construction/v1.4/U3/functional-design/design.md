# U3 Functional Design: semantic facts (A2), one-context fragmentation, vendor-neutral model route, a true K3 case

**AI-DLC v1.4, construction, unit U3. Depth: minimal. Written 2026-10-18. Zero model calls.**

- **Map parts:** C1d enrich (P1), and C4 through facts (M4).
- **Requirements:** `ops/01-instrument-map.md` (v3), `ops/03-build-list.md` (row C1d), `ops/04-north-star.md` (SO3), `ops/decisions.md` (N1, M4, N4, CDX, D3).
- **Inputs read:**
  - `ops/notes/ns-02-facts-contract-and-cases.md` (NS-02);
  - `ops/notes/ns-01-what-rules-cannot-see.md` (NS-01);
  - `Docs/v1.3/ontology-v0-design.md`;
  - `tests/fixtures/v1.3-ontology/` (with `ns02/`);
  - `src/apg-enrich/ontology/`, `scripts/v1.3/ontology-run.ts`;
  - `src/llm-critic/{claude-cli,agy-cli,gemini}-provider.ts`;
  - `src/cypher-interp/`, `src/neo4j-ingestion/graph-ingester.ts`.
- **Stages skipped:** NFR requirements, NFR design, infrastructure design and user stories, as the orchestrator asked.

---

## 1. What U3 delivers

| # | Deliverable | NS-02 ref | Today |
|---|---|---|---|
| D1 | **A2 writer.** `OntologyRunDetail` → `facts.json`, validated against the four invariants | §1, §6 item 3 | not built |
| D2 | **A2 loader and the three Sem rules.** A1 + A2 go into a `GraphRepository` through the ingestion statements. SEM-MISPLACED, SEM-DUP and SEM-FRAG then run as Cypher on the in-process interpreter | §2, §6 item 3 | not built |
| D3 | **N4 in the pipeline.** Fragmentation only inside one *declared* bounded context. Cross-context concept identity becomes a fact with no finding | §6 item 1 | `clustering.ts` pairs only across components; `pipeline.ts` needs at least 3 names in at least 2 components |
| D4 | **`enforcesRule.kind`** (`business` or `input-validation`) in the pass-(c) schema and prompt, with a `PROMPT_VERSION` bump | §6 item 4 | not built |
| D5 | **Vendor-neutral model route.** A route registry, plus `LlmOntologyProvider`, a generic adapter over any `LLMProvider`. Two Gemini routes: `gemini-api` (`GeminiProvider`) and `gemini-agy` (`AgyCliProvider`). Mock-tested only | §6 item 2 | only `claude-cli` and `mock` |
| D6 | **Fact policy.** `agreed-only` (the default) or `any`. This is also the runs = 1 fallback | §6 item 6 | `requireAgreement` is fixed at true in the runner |
| D7 | **Fact scorer and verdict scorer.** They read the manifests' `ns02.expectedFacts` and `ns02.expectedVerdicts` | §6 item 5 | the scorer reads only `expect` and `forbid` |
| D8 | **A cheap-blind K3 pair replaces case-06.** Two new cases: the defect and its twin differ in one guarded expression. Manifests are committed before any model run | §3 pair 2, build list C1d | case-06 pair: the cheap role proxy already separates it |
| D9 | **Runner wiring.** `--provider claude-cli|gemini-api|gemini-agy|mock`, `--model`, `--fact-policy`, `--ns02`; writes `facts.json`, `verdicts.json` and the fact and verdict scores | §4, §5 | — |
| D10 | **`ns02` blocks for the four parent cases** (pairs 4 and 5, which include the pilot pair), as sidecar files. The parent manifests stay byte-unchanged. Without these, D7 cannot score the pilot bar ("correct facts on both cases", build list C1d) | §3 pairs 4–5 | the parent manifests have no `ns02` block, so there is nothing to score facts against |
| D11 | **Registered figures stay traceable.** The Ontology v0 numbers that the claims ledger and the replication harness cite (`Docs/v1.3/ontology-v0-design.md` lines 64–273, group `g-onto-mock`) are not edited in place. Each one that U3 changes is declared (BR-U3-17) | — | not considered in the first version |

**Out of U3:**
- any live run, including the pilot;
- Q26 (lane A / U2);
- the generator-side Gemini adapter (U5, CDX);
- edits to `ops/`, `aidlc-docs/audit.md` and `aidlc-docs/aidlc-state.md`.

## 2. Data flow

```text
 project dir --extract--> A1 (APG) --cheap proxies--> CheapEnrichment
                            |                              |
                            v                              v
                     runOntology(passes a,b,c,d) <--- OntologyRoute (claude-cli | gemini-api | gemini-agy | mock)
                            |
                            v
                   OntologyRunDetail  ---(legacy path, N4 applied)---> result.json, scorer.ts findings
                            |
                       buildFacts (D1)
                            v
                       A2 facts.json  (validated: invariants I1..I4)
                            |
                     loadFacts (D2): A1 + A2 -> GraphRepository (cypher-interp; Neo4j-compatible statements)
                            v
                   Sem rules (Cypher): SEM-MISPLACED, SEM-DUP, SEM-FRAG  ($policy)
                            v
                     verdicts.json (A4-shaped rows, each citing factIds)
                            |
                 scoreFacts / scoreVerdicts (D7) vs ns02 manifests
```

The model's output reaches the rules **only as A2 facts** (N1 and M4). The loader writes them through the same ingestion statements the A1 graph uses, so the rules read facts through the query layer (C1c), never through prompts.

## 3. Data contracts

### 3.1 A2 file (`facts.json`)

The A2 file follows NS-02 §1 exactly. The envelope fields are `schemaVersion: 1`, `artifact: "A2"`, `project`, `inputs.a1.apgHash`, `inputs.layerModel` and `producer`.

`producer` carries:
- `part: "C1d"`;
- `pipeline: "ontology-v0"`;
- `promptVersion`;
- `provider`;
- `model`, the requested model;
- `runs`;
- `runId`;
- `factPolicy`: `agreed-only` or `any`, the policy the **run** used. It is not only a rule parameter. `requireAgreement` decides which assertions are clustered in pass (d), and it also changes the pass (b) prompts (`capabilityPass` takes it). So an `agreed-only` A2 and an `any` A2 are different runs with different cache keys, and an `any` sensitivity row at runs = 2 needs its own pass (b) and (d) calls. It is **not** a zero-call rescore: a `--replay` of `agreed-only` cassettes gives cassette misses. `runSemRules` refuses a `$policy` that differs from `producer.factPolicy` (BR-U3-06).

It is written to `<out>/<project>/facts.json`, beside `result.json`.

**Hashes:**
- `apgHash` = `sha256(canonicalJSON(apg))`;
- `contentHash` = the existing `projectHash`, exported;
- the layer-model hash = `sha256(canonicalJSON(layerModel))`;
- `path` is repo-relative, or null when no layer model was given.

**`Fact`** (TypeScript, in `src/apg-enrich/ontology/facts.ts`):

| Field | Type | Rule (BR = business rule below) |
|---|---|---|
| `id` | `fact:<16 hex>` | `sha256(canonicalJSON([subject, predicate, value', source, runIndex])).slice(0,16)` (BR-U3-03). `value'` is `value` **without** the derived cluster ids (`conceptId`, `ruleId`, `capabilityId`), so a fact keeps its identity when the clustering changes |
| `subject` | APG node id | must be in A1 (I1) |
| `predicate` | `FactPredicate` | the closed vocabulary of §3.2 |
| `value` | per predicate | the shape is fixed in §3.2 |
| `source` | `'parser' \| 'model'` | |
| `basis` | `'apg' \| 'spec' \| 'verifier' \| null` | parser facts only; null for model facts |
| `modelId` | string \| null | the **served** model, from `provenance.model` (VRD-07) |
| `promptHash` | string \| null | `provenance.promptHash` |
| `date` | ISO 8601 | model facts: the `recordedAt` of the primary run's cassette entry (a replay keeps it). Parser facts: the earliest `recordedAt` of the run's cassette entries, or the run's `now()` when the run made no model call. A wall-clock `now()` would make every replay a different file, which breaks I5 and risk 5 of the instrument map |
| `confidence` | number \| null | the model's own figure, from the primary run |
| `agreement` | `'agreed' \| 'single-run' \| null` | |
| `runIndex` | int \| null | null when agreed. Otherwise the primary run's index |
| `evidence` | `GroundedEvidence[]` | non-empty for model facts (I2) |
| `citations` | `{ locations: { kind: 'code' \| 'doc', file, startLine, endLine }[], graph: { statistic, value, query }[] }` | **Amendment A1.** At least one code or doc location (I6); graph statistics with their Cypher over the loaded A1 graph where one applies (`inLayer` → `layerKind`, `inContext` → `context`, class facts → `fanOut`/`fanIn`, `enforcesRule` → `callers` plus the class degree, `ruleEquivalenceVerified` → `callers` of both). Model facts cite their grounded evidence spans and the doc excerpts their prompt carried; parser facts cite the class or method span. Not part of the fact id |

### 3.2 Predicate vocabulary v1 (closed)

| Predicate | Subject | Value | Source / basis | Built from |
|---|---|---|---|---|
| `inLayer` | Class | `LayerKind` | parser / `apg` | `ClassUnit.layerKind` (omitted when null) |
| `inContext` | Class | `{ context: string, declared: boolean }` | parser / `spec` if declared, else `apg` | `componentOf()`. `declared` is true when a `ddd.contexts[].root` matched (BR-U3-10) |
| `logicDensity` | Method | number | parser / `apg` | `MethodUnit.logicDensity` (omitted when null) |
| `hasResponsibility` | Class | `{ name, description, naturalLayer }` | model | `ClassSemantics.responsibilities` |
| `embodiesConcept` | Class | `{ concept, relation, conceptId }` | model | `ClassSemantics.concepts`. `conceptId` is the Sem cluster id |
| `enforcesRule` | Method | `{ statement, subject, operator, threshold, unit, kind, ruleId }` | model | `RuleSite`. `ruleId` is the Sem cluster id for `kind: business`, and null for `kind: input-validation`, which is never clustered (BR-U3-18) |
| `realizesCapability` | Class | `{ capability, capabilityId }` | model | `GroupSemantics` (one fact per `realizedBy` class) |
| `sameConceptAs` | Class | `{ other, same }` | model (adjudicated), or parser / `apg` (exact-name merge) | concept clusters and adjudications |
| `sameRuleAs` | Method | `{ other, same }` | model (adjudicated), or parser / `apg` (exact-statement merge) | rule clusters and adjudications |
| `ruleEquivalenceVerified` | Method | `{ other, verified, method }` | parser / `verifier` | `verifyRuleDuplication([m1, m2])` on **every** pair of members of one business-rule cluster whose classes are in different contexts, with `m1 < m2`. Not only on the `sameRuleAs: true` pairs: union-find is transitive, so two members of one cluster may have no `sameRuleAs` fact between them |

**Change to NS-02 §1.3, stated:** `embodiesConcept` and `enforcesRule` also carry the deterministic cluster id (`conceptId`, `ruleId`). It is derived by union-find over the `same*As` facts, so it is not a new model output. It lets the Cypher rules match on the shared Sem node, exactly as the pipeline does (§3.4). `inContext` is an object, so a rule can tell a declared context from a directory fallback.

### 3.3 Invariants, checked on write (`validateFacts`, which throws `A2InvariantError`)

- **I1.** Every `subject` is an A1 node id. So is every `value.other`.
- **I2.** A model fact has a non-null `modelId` and `promptHash`, and at least one evidence item with `grounded: true`.
- **I3.** A parser fact has a null `modelId`, `promptHash`, `confidence`, `agreement` and `runIndex`, and empty evidence.
- **I4.** No predicate outside §3.2. A unit test also asserts that the vocabulary contains no verdict-shaped name (`violates`, `isDefect`, `misplaced`, `fragmented`, `duplicated`).
- **I5 (added).** Fact ids are unique. The file is sorted by `(predicate, subject, id)` with `hostIndependentCompare`, so two writes are byte-identical.
- **I6 (amendment A1).** Every fact cites at least one code or doc location. It is checked **when the fact is written** (`writeFact` throws `A2InvariantError`), not at scoring, and again by `validateFacts`. A graph statistic alone is not a citation.

### 3.3a Amendment A1: the graph complements reading

- **Prompts (`ontology-v0.3`).** Every model prompt carries the code **and** the graph slice. Passes (a) and (c): the class source, the APG neighbourhood with its statistics (methods, fan-out and fan-in by relation), the JSDoc and leading comments of the class and its methods, and the project docs that mention the class or its component. Pass (b): each class's declaration line, the APG relations inside the group with its statistics, and the docs. Pass (d): each side's quoted code and its site's graph slice, and the docs that mention either side. The docs section appears only where docs exist.
- **Docs.** `prepareOntologyInput` collects the project's Markdown (README, `docs/`, ADRs under `adr/`, `adrs/`, `decisions/` or named `adr-*`), skipping `node_modules`, `dist`, `build` and `.git`. Excerpts are line windows that mention a term, ADRs first, at most 6 per prompt, between `DOC-BEGIN`/`DOC-END` markers that the system prompt declares as data.
- **C4.** `buildInterpretationContext` / `interpretationPrompt` (`src/apg-enrich/ontology/interpretation.ts`) give the interpreter, for one Sem verdict, its A2 facts with their citations, the site code, the graph slice, the comments within 10 lines of each site and the class JSDoc, and the docs and ADRs that mention the sites (the ADR heads when none does). U3 wires no C4 run and makes no call; the frozen v2.2 judge is not changed.

### 3.4 Graph load (`loadFacts`) and the Sem rules

**Load into `MemoryGraphRepository`.** Neo4j would take the same statements, but it is never started in U3.
1. A1 goes in through `annotateNodes`, `ingestNodes` and `ingestEdges` (`src/neo4j-ingestion/graph-ingester.ts`), unchanged.
   - Class nodes get two extra properties from the parser facts: `layerKind`, and `context` with `contextDeclared`. The loader adds them to a **copy** of each APG Class node's `properties`, and `flattenProperties` carries them. The APG object is never mutated.
2. Sem nodes go in through `nodeIngestCypher(label)`: `SemResponsibility`, `SemBusinessRule`, `SemBusinessConcept` and `SemCapability`. The interpreter accepts this exact shape (`NODE_INGEST`).
3. Sem edges go in through `edgeIngestCypher(type)`: `SemRESPONSIBLE_FOR`, `SemENFORCES`, `SemEMBODIES`, `SemREALIZES`, `SemSAME_RULE_AS`, `SemSAME_CONCEPT_AS` and `SemRULE_VERIFIED`.
   - Edge props are scalars only: `factId`, `source`, `agreement`, `confidence`, `relation`, `same`, `verified` and `method`.
   - Evidence stays in A2 and is not copied into the graph.
   - `SemRULE_VERIFIED` is written **once per pair**, from the lower method id to the higher. Two directed edges would make the undirected `OPTIONAL MATCH` below return each pair twice.
   - Only `kind: business` rules get a `SemBusinessRule` node and `SemENFORCES` edges (BR-U3-18). An `input-validation` rule stays an A2 fact only.
4. **Ablation (instrument map §3, SO3).** Loading A1 alone (an empty A2) must give zero Sem verdicts. A test asserts it, so "C3 alone" vs "C3 + A2" is a real row and not an assumption.

**Rules.** The Cypher text is a constant in `src/apg-enrich/ontology/sem-rules.ts`. `$policy` is `'agreed-only'` or `'any'`.
- **SEM-MISPLACED:**
  ```cypher
  MATCH (c:Class)-[e:SemRESPONSIBLE_FOR]->(r:SemResponsibility)
  WHERE c.layerKind IS NOT NULL AND r.naturalLayer <> c.layerKind
    AND ($policy = 'any' OR e.agreement = 'agreed')
  RETURN c.id AS site, c.layerKind AS classLayer, r.naturalLayer AS naturalLayer, e.factId AS fact
  ```
  The site is the **Class**. The pipeline's `misplaced-responsibility` finding names the first cited method when there is one (`site(cls, methodIds[0])`), and the manifests write `Class.method` (`OrderController.create`). So the parity test and `scoreVerdicts` compare SEM-MISPLACED at the **owning class**: a `Class.method` subject resolves to its class for this rule. Matching a class id against a method id would fail every case for the wrong reason.
- **SEM-DUP** (one rule cluster, two contexts; `context` may be a directory fallback):
  ```cypher
  MATCH (c1:Class)-[:CONTAINS]->(m1:Method)-[e1:SemENFORCES]->(r:SemBusinessRule)<-[e2:SemENFORCES]-(m2:Method)<-[:CONTAINS]-(c2:Class)
  WHERE m1.id < m2.id AND c1.context <> c2.context
    AND ($policy = 'any' OR (e1.agreement = 'agreed' AND e2.agreement = 'agreed'))
  OPTIONAL MATCH (m1)-[v:SemRULE_VERIFIED]-(m2)
  RETURN r.id AS rule, m1.id AS siteA, m2.id AS siteB, coalesce(v.verified, false) AS verified, e1.factId AS factA, e2.factId AS factB
  ```
  `runSemRules` groups the rows by `rule`. The verdict's `sites` are the union of the row sites, and its `verified` is true only when every row is verified. The pipeline verifies the whole cluster in one call, so the two agree on a two-site cluster (every parent case and every NS-02 case). For three or more sites they can differ, and the parity test is stated for two-site clusters only.
- **SEM-FRAG (N4)** (declared context only):
  ```cypher
  MATCH (a:Class)-[ea:SemEMBODIES {relation: 'defines'}]->(k:SemBusinessConcept)<-[eb:SemEMBODIES {relation: 'defines'}]-(b:Class)
  WHERE a.id < b.id AND a.name <> b.name
    AND a.contextDeclared = true AND b.contextDeclared = true AND a.context = b.context
    AND ($policy = 'any' OR (ea.agreement = 'agreed' AND eb.agreement = 'agreed'))
  RETURN a.context AS context, k.name AS concept, a.id AS classA, b.id AS classB
  ```
  Unlike NS-02 §2, the rows are pairs and the grouping happens in TypeScript. That avoids depending on `collect(...) + collect(...)` list semantics in the interpreter.

**`SemVerdict`** (one per rule row; written to `verdicts.json`):

```json
{ "rule": "SEM-MISPLACED|SEM-DUP|SEM-FRAG", "verdict": "fail", "sites": ["<APG id>"], "context": "sales|null", "verified": true, "facts": ["fact:..."], "policy": "agreed-only" }
```

`verified` is set for SEM-DUP only. A rule with no row produces no record, and `scoreVerdicts` treats "no row" as `pass`.

These rows are **A4-like**, not A4: the instrument map's A4 is `schemas/report.schema.json`, and mapping Sem verdicts into it is out of U3.

**The edge names are an assumption to confirm at build time.** NS-02 assumes `File-[:DECLARES]->Class-[:CONTAINS]->Method`. Step 2 of the plan checks it on a fixture's ingested graph before the Cypher is frozen.

### 3.5 Route registry (`src/apg-enrich/ontology/routes.ts`)

```ts
export const ONTOLOGY_ROUTES = ['claude-cli', 'gemini-api', 'gemini-agy', 'mock'] as const;
export type OntologyRouteName = (typeof ONTOLOGY_ROUTES)[number];
export interface OntologyRouteSpec { readonly route: OntologyRouteName; readonly model?: string; readonly temperature?: number; readonly maxTokens?: number; }
export function describeRoute(spec: OntologyRouteSpec): OntologyProviderDescription;   // no I/O, no env, no construction
export interface RouteDeps { /* factories injected by the runner: claudeCli(), geminiApi(cfg), agyCli(cfg); tests inject fakes */ }
export async function openRoute(spec: OntologyRouteSpec, deps: RouteDeps): Promise<DomainResult<OntologyProvider>>;
```

**`LlmOntologyProvider`** (the generic adapter, in `provider.ts`) wraps any `LLMProvider`:
1. It calls `evaluate(prompt, { model, maxTokens, temperature? }, { runIndex, repetition: 0, functionId: 'ontology:<pass>', unitId: itemId, systemPrompt: system, responseSchema })`.
2. `responseSchema` is the pass schema, run through `toVendorSchema(route, schema)`.
   - For `gemini-api`, each `type: [T, 'null']` becomes `{ type: T, nullable: true }`.
   - `GeminiProvider` then keeps only its supported subset.
   - `ModelCaller`'s Ajv still validates the **original** schema, so nothing is relaxed.
3. `content` goes through `JSON.parse`. A failure gives `LLM_BAD_JSON`, which is not a stop code, so `ModelCaller` retries it once.
4. **Served model (VRD-07):** `res.model` must equal the requested id. For `gemini-api` it may also start with `<requested>-`, a dated variant. Anything else gives `LLM_MODEL_MISMATCH`. The served id is what reaches `provenance.model`, and so A2's `modelId`.
5. Error codes pass through unchanged, so `STOP_CODES` keep working: `LLM_AUTH`, `LLM_USAGE_LIMIT`, `LLM_CLI_ISOLATION`, and so on.

`ClaudeCliOntologyProvider` is unchanged, and so are the existing `src/llm-critic/` providers.

**No hidden calls.** The runner's `main(argv, deps = DEFAULT_ROUTE_DEPS)` takes the route factories as a parameter. Every runner test passes fakes, so no test can reach a real `GeminiProvider`, `AgyCliProvider` or `ClaudeCliProvider` even on a mistyped flag. The runner never loads `.env` (no `dotenv` import). `GEMINI_API_KEY` is read from `process.env` by the `geminiApi` factory alone.

## 4. Business rules

| Id | Rule |
|---|---|
| BR-U3-01 | A2 holds **facts only**. `OntologyResult.findings` never enter A2 (N1). Verdicts come only from the Sem rules over A1 + A2 |
| BR-U3-02 | A grounding-rejected assertion never becomes a fact. It stays counted under `hallucinations` in `result.json` |
| BR-U3-03 | Fact ids are content hashes. The same answers give the same file, byte for byte (I5) |
| BR-U3-04 | An agreed assertion gives **one** fact with `runIndex: null`. A single-run assertion gives one fact with `agreement: 'single-run'` and its run index. Today the pipeline drops single-run assertions before clustering when `requireAgreement` is on; under `--fact-policy any`, `requireAgreement` is off, so they are clustered and written |
| BR-U3-05 | `confidence` is reported and never gates anything (NS-02 §2) |
| BR-U3-06 | Fact policy: `agreed-only` (the default, primary) or `any` (a sensitivity row). It is a **run-level** setting. The runner maps `any` to `requireAgreement: false`, records it in `producer.factPolicy`, and passes the same value to the Sem rules as `$policy`. `runSemRules` refuses a `$policy` that differs from `producer.factPolicy`. An `any` row at runs = 2 needs its own pass (b) and (d) calls (§3.1), so it is budgeted separately and is not part of the 26-call pilot. A runs = 1 run must use `any` (the NS-02 §4 trap). The runner refuses `--runs 1` with `agreed-only` (exit 2) in record and replay modes, with a message that names the trap. `--estimate --runs 1` stays allowed, since it calls nothing and the 13-call figure is what the author is asked to compare |
| BR-U3-07 (N4) | **Concept fragmentation is a finding only inside one declared bounded context.** The definers of one concept cluster are grouped by declared context. Each context with at least `minFragmentClasses` (now 2) differently-named `defines` classes gives one finding. Definers with no declared context never count. A cluster that spans contexts can still give a finding for a context inside it that has two names. Identity **across** contexts gives `sameConceptAs` facts and no finding |
| BR-U3-08 | Concept candidate pairs (pass d) are proposed **within a declared context** (new), as well as across components (kept, so cross-context identity is still recorded as a fact). Two items in the same *undeclared* (directory-fallback) component are still not paired. So the parent set's call counts don't change: no parent case declares contexts. Rule and capability pairing are unchanged |
| BR-U3-09 | The pipeline's `concept-fragmentation` finding (legacy `scorer.ts`) applies BR-U3-07 too, as NS-02 §6 item 1 requires. This changes two registered mock figures; BR-U3-17 declares them. So `case-03-concept-fragmentation`, which has no declared contexts, no longer yields a finding. `pipeline.test.ts` changes with it (NS-02 §6 item 1). The case-03 manifest stays unchanged, and the runner prints its expected item as "missed (N4: no declared context)" |
| BR-U3-10 | `inContext.declared` is true only when a `ddd.contexts[].root` prefix matched the file. A directory fallback is `declared: false`, `basis: 'apg'` |
| BR-U3-11 | `enforcesRule.kind` is in `business`, `input-validation`. It is required in `RULE_SCHEMA`. `PROMPT_VERSION` becomes `ontology-v0.2`. **The rule prompt's scope changes with it.** Today it says to extract business rules and *not* technical checks ("a null check, formatting, parsing"), so a model that obeys it never returns an `input-validation` rule, and the twin's expected fact could never appear. The new task text asks for the business rules *and* the limits or thresholds checked on incoming data, each labelled with its kind. Null checks and parsing stay excluded. The two kinds are defined neutrally: business = a rule of the domain that must hold whichever entry point is used; input-validation = a check of the form, type or size of incoming data. No example is drawn from any case |
| BR-U3-17 | **No registered figure changes silently.** `Docs/v1.3/ontology-v0-design.md` lines 1–279 are cited by claims-ledger rows C0212–C0220 and by replication group `g-onto-mock` (by line number). U3 does not edit them. All new text goes in a new section appended after §12, so no cited line moves. Two `g-onto-mock` numbers change under N4: `g-onto-min-fragment` ("(3)" becomes "(2)") and `g-onto-found` ("3 of 3" becomes "2 of 3"). Each gets a `known: { actual, note }` entry in `replication/v1.3/groups/g-ontology.mjs`, citing decision N4 and `ADR-V13-N4`, so the harness reports KNOWN, not FAIL (the `d-audit.mjs` precedent). Row C0215 (and the min-fragment number) go to the orchestrator for the ledger's supersession list. U3 does not regenerate the ledger. Every other `g-onto-mock` number must still PASS: the runner keeps the `--fixtures` output lines that `parseRunLines` and the estimate regex read, keeps the six-case `--fixtures` set, and keeps the `scores.json` aggregate keys |
| BR-U3-18 | **Only business rules are clustered.** `kind: input-validation` rules become `enforcesRule` facts but never enter pass (d), never get a `SemBusinessRule` node, and never feed `semantic-rule-duplication` or SEM-DUP. Without this, the prompt change of BR-U3-11 would let two input checks in two contexts become a "duplicated business rule" |
| BR-U3-12 | A route never reads credentials in `--estimate`, `--replay` or `mock` mode, and never builds a provider there (`NoCallProvider`). `gemini-api` reads `GEMINI_API_KEY` from `process.env` only when it opens a live record, and the key is never logged or written. `gemini-agy` uses `LABELLER_AGY_HOME` / `AGY_HOME_DEFAULT` and the existing isolation pre-flight. **U3 never opens a live route** |
| BR-U3-13 | Gemini routes have **no default model**. `--model` is required, as `GeminiProvider` already requires (BR-U4-VRD-09) |
| BR-U3-14 | The cache key keeps provider and model, so cassettes of different vendors never collide. The default cassette directory is `cassettes-<route>` |
| BR-U3-15 | **The pilot pair's call count is invariant.** At runs = 2, the mock profile of `case-02` + `case-04b` stays 16 + 10 = 26 calls, and `--estimate` with `--budget 20` stays capped at 40 per vendor. A test asserts it. The pilot is **not run**, live or otherwise, beyond the mock profile |
| BR-U3-16 | The replacement K3 pair (§5) must be **cheap-blind**, which here means **non-separating**: every cheap proxy gives the same outcome on the defect's expected item and on the twin's matching forbidden item (`caught` with `flagged`, or `missed` with `clear`), as the zero-call mock dry run observes. It does not mean the proxies miss the defect. The likely outcome is `caught` on case-09 and `flagged` (a cheap false positive) on case-09t, because both controllers carry the same guard. The manifests record both outcomes, and they are committed before any model run |

## 5. The replacement for case-06: a cheap-blind K3 pair

**Why replace it.** The cheap role proxy flags `OrderController.create` in case-06, but not in case-06t, whose controller does only an `isInteger` check and so has lower density. A deterministic heuristic therefore already separates the pair, which is NS-01 §7 falsifier 1.

**The fix.** Hold the code shape fixed, and let **only the meaning** of one guarded expression differ.

| | `ns02/case-09-limit-only-in-controller` (defect) | `ns02/case-09t-control-length-check-in-controller` (twin) |
|---|---|---|
| Context / layers | one declared context `ordering`; `presentation`, `application`, `domain`, `infrastructure` | identical |
| Files | `presentation/order.controller.ts`, `application/place-order.service.ts`, `domain/order.ts`, `domain/order-repository.ts`, `infrastructure/in-memory-order.repository.ts` | identical file set, byte-identical except the controller |
| DTO | `{ sku: string; quantity: number; giftNote: string }` | identical |
| Service and aggregate | `PlaceOrderService.place(sku, quantity, giftNote)` and `Order.create(id, sku, quantity, giftNote)`: both fields reach the domain model, so neither guarded field is presentation-only vocabulary | identical |
| Controller guard | `if (dto.quantity > MAX_QUANTITY) throw new Error('quantity too high');` with `const MAX_QUANTITY = 20;` | `if (dto.giftNote.length > MAX_GIFT_NOTE) throw new Error('gift note too long');` with `const MAX_GIFT_NOTE = 20;` |
| Order aggregate | checks neither the quantity nor the gift note | identical |
| Meaning | "at most 20 units of one SKU per order" is a business invariant, and it lives only at one entry point | "a gift note of at most 20 characters" is input format checking. It belongs at the edge |

**Choices:**
- **No explanatory comments in either file.** This removes NS-02 §3's legibility threat for this pair.
- **Same constant, operator, branch count, throw and method count.** The identifiers differ, and the twin's guard has **one more property access** (`.length`). Logic density counts branches, value comparisons, numeric arithmetic and validation throws (`roles.ts`), so it should see the same shape. The guard-clone key keeps property names, which differ anyway because each case has only one guard. The dry-run gate (plan step 9) checks every proxy rather than trusting this argument.
- The vocabulary proxy only tags when there are fewer than 3 components, and this pair has one context. It is still read in the gate.

**Manifests,** written before any model run (schema as NS-02 §3):
- **case-09.**
  - `expect.misplacedResponsibilities`: `OrderController.create`, `naturalLayer: domain`, `classLayer: presentation`.
  - `ns02.expectedFacts`:
    - required: `inLayer(OrderController) = presentation` (parser);
    - required: `inContext(OrderController) = {ordering, declared: true}`;
    - required: `enforcesRule(OrderController.create) ⊇ {kind: business, threshold: 20}`. The operator is **not** scored. The rule prompt tells the model to state the rule as the business would (`!(a < b)` states `a >= b`), so a correct answer reads `quantity <= 20`, while the guard reads `>`. Case-06's manifest already writes `<=`;
    - required: `hasResponsibility(OrderController).naturalLayer = domain`;
    - forbidden: `enforcesRule(Order.create) kind business`. A wildcard such as `Order.*` is not used, because `resolveSubject` resolves only `Class` and `Class.method`.
  - `expectedVerdicts`: SEM-MISPLACED **fail** at `OrderController.create`.
- **case-09t.**
  - `forbid.misplacedResponsibilities`: `OrderController`, `Order`, `PlaceOrderService` and `InMemoryOrderRepository`.
  - `ns02.expectedFacts`:
    - forbidden: `enforcesRule(OrderController.create) kind business`;
    - forbidden: `hasResponsibility(OrderController).naturalLayer = domain`;
    - tolerated: `enforcesRule(OrderController.create) kind input-validation` (pass c may or may not propose it).
  - `expectedVerdicts`: SEM-MISPLACED **pass**.
- **`cheapExpectation`** is filled from the dry run (step 9 of the plan). It records the outcome on the defect and on the twin, and it must say `same outcome on defect and twin` in the BR-U3-16 sense. If the dry run shows a difference, the case is changed **before** the manifest is committed, and the change is recorded in the manifest's `revisions[]`.

**Retirement.** The old case-06 and case-06t stay on disk unchanged, as the recorded evidence for falsifier 1. They are marked `retired` in a new set index, `tests/fixtures/v1.3-ontology/ns02/set.json`, which lists the six pairs with their parent-relative paths. The `--ns02` runner mode and the tests read that index. `ns02/README.md` gets the new pair 2 row and a retirement line.

**K3 claim strength.** Pair 2 now carries the "a model is needed" claim only if the cheap outcome is the same on both cases (BR-U3-16). The construct (business invariant or input check) remains contestable for people. The D3 rater labels this pair first (NS-01 §8).

### 5.1 `ns02` blocks for the parent cases (D10)

The four parent manifests (`case-01`, `case-02`, `case-04a`, `case-04b`) have no `ns02` block. NS-02 §3 says pairs 4 and 5 are scored "as in the existing manifests", but those hold only the legacy `expect`/`forbid` items. So the pilot pair could not be scored at the fact level, which is the build list's pilot bar.

- **Where:** `tests/fixtures/v1.3-ontology/ns02/parent-blocks/<case>.json`, one file per parent case, each holding just an `ns02` block. `set.json` points to it. The parent manifests stay **byte-unchanged**, so the legacy scorer, the mock regression tests and `g-onto-mock` are untouched.
- **Content:** derived from each parent manifest's own `expect`/`forbid` items and NS-02 §3's prose, nothing else:
  - case-02: required `inLayer(OrderNotificationService) = application` and `hasResponsibility(OrderNotificationService).naturalLayer = domain`; forbidden a non-declared `naturalLayer` on `Order`, `PlaceOrderUseCase` and `ConsoleMailer` (the manifest's `forbid` list); verdict SEM-MISPLACED fail at `OrderNotificationService.sendConfirmation` (scored at the class, §3.4);
  - case-04b: forbidden a non-declared `naturalLayer` on `ShipmentNotificationService` and `Shipment`; SEM-MISPLACED pass;
  - case-01: required `enforcesRule kind business` at `ShippingPolicy.shippingFor` and `InvoiceAssembler.assemble`, `sameRuleAs = true` between them, and `ruleEquivalenceVerified = true`; forbidden a non-declared `naturalLayer` on `InvoiceNumber` and `ShippingPolicy`; SEM-DUP fail, verified;
  - case-04a: forbidden `sameRuleAs = true` on the three site pairs the manifest forbids (`BulkDiscount.rateFor`, `FreeShippingRule.costFor`, `AgeCheck.mayPurchaseAlcohol`); SEM-DUP pass.
- **Dating:** `writtenAt: 2026-10-18`, `writtenBefore: any model run on these cases`. The hand-written mock answers already exist for these cases, and the blocks are written from the manifests, not from them. That is stated in each file.

## 6. Where the code goes (existing idiom: ESM `.js` import suffixes, `DomainResult`, `canonicalJSON`/`sha256Hex`, `hostIndependentCompare`, frozen option objects)

| File | Change |
|---|---|
| `src/apg-enrich/ontology/facts.ts` | **new.** `Fact`, `FactsFile`, `FACT_PREDICATES`, `buildFacts(detail, input, opts)`, `validateFacts(file, apg)`, `factId()` |
| `src/apg-enrich/ontology/facts-loader.ts` | **new.** `loadFacts(apg, layerModel, facts, repo)`: A1 + A2 → `GraphRepository` |
| `src/apg-enrich/ontology/sem-rules.ts` | **new.** `SEM_RULES` (Cypher constants), `runSemRules(repo, policy) → SemVerdict[]` |
| `src/apg-enrich/ontology/fact-scorer.ts` | **new.** `scoreFacts(manifest.ns02, facts, apg, policy)` and `scoreVerdicts(manifest.ns02, verdicts, apg)` |
| `src/apg-enrich/ontology/routes.ts` | **new.** The route registry (§3.5) |
| `src/apg-enrich/ontology/provider.ts` | add `LlmOntologyProvider` and `toVendorSchema` |
| `src/apg-enrich/ontology/units.ts` | `ClassUnit.declaredContext: string \| null` |
| `src/apg-enrich/cheap/context.ts` | export `declaredContextOf(file, layerModel)`, a pure helper beside `componentOf`, so the two use the same prefix test |
| `src/apg-enrich/ontology/clustering.ts` | `ClusterItem.context?: string \| null`, plus the BR-U3-08 pairing |
| `src/apg-enrich/ontology/pipeline.ts` | the BR-U3-07 fragmentation rule; `minFragmentClasses` default 2; only `kind: business` rules become rule cluster items (BR-U3-18); `OntologyRunDetail` gains `units`, `recordedAt` and `factPolicy`; export `projectHash` |
| `src/apg-enrich/ontology/passes.ts` | `Kept.runIndex` (the primary run's index) |
| `src/apg-enrich/ontology/caller.ts` | keep `recordedAt` per `(promptHash, runIndex)` and expose it with `recordedDates()`. Result JSON is unchanged |
| `src/apg-enrich/ontology/types.ts`, `prompts.ts` | `RuleOut.kind`; `RULE_SCHEMA`; the rule prompt's task text (scope and the two kinds, BR-U3-11); `PROMPT_VERSION = 'ontology-v0.2'` |
| `src/apg-enrich/ontology/index.ts` | export the new modules |
| `scripts/v1.3/ontology-run.ts` | the D9 flags; A2, verdict and fact-score outputs; route opening through `routes.ts` |
| `tests/fixtures/v1.3-ontology/mock-answers/*.json` | add `kind` to every scripted rule answer |
| `tests/fixtures/v1.3-ontology/cassettes-mock/**` | re-recorded with the mock (zero model calls), because of the prompt bump |
| `tests/fixtures/v1.3-ontology/ns02/case-09*/`, `ns02/set.json`, `ns02/README.md` | the new pair, the index and the README row |
| `tests/fixtures/v1.3-ontology/ns02/parent-blocks/{case-01,case-02,case-04a,case-04b}*.json` | **new.** The parent `ns02` blocks (§5.1). The parent manifests are not edited |
| `replication/v1.3/groups/g-ontology.mjs` | `known` entries for `g-onto-min-fragment` and `g-onto-found` only (BR-U3-17). No other number, regex or command changes |
| `tests/unit/apg-enrich/ontology/{facts,facts-loader,sem-rules,fact-scorer,routes,llm-provider}.test.ts` | **new** |
| `tests/unit/apg-enrich/ontology/{clustering,pipeline,provider}.test.ts`, `tests/unit/scripts/ontology-run.test.ts` | updated |
| `Docs/v1.3/ontology-v0-design.md` | **append-only** (BR-U3-17): a new §13 "Ontology v0.2 (v1.4 U3)" after §12 covers A2 and the loader, N4 pairing and fragmentation, `ontology-v0.2` and `kind`, and the new mock baseline (2 of 3 parent defects; case-03 out of N4 scope). §1–§11 are not edited, so the ledger and replication line numbers hold. §12 lines may be struck through, not deleted, with a pointer to §13 |
| `Docs/v1.3/adr-v13.md` | one ADR entry for N4 and the A2 contract. The id is assigned at build time (§8, R6) |

## 7. Test strategy (jest `--maxWorkers=2`; no Neo4j; no model or network call)

| Test | Asserts |
|---|---|
| `facts.test.ts` | the four invariants plus I5. Each invariant has its own negative test (a hand-built fact that breaks it throws). Fact ids are stable, and do not change when only a cluster id changes. Byte-identical rebuilds, **including record then replay** of the same mock run (parser-fact dates come from the cassettes). No verdict-shaped predicate. `findings` never leak into A2. `ruleEquivalenceVerified` exists for a transitive cluster pair that has no `sameRuleAs` fact |
| `facts.test.ts` (golden) | the mock replay of `case-02` gives an A2 that holds `hasResponsibility(OrderNotificationService) naturalLayer domain`, agreed, with a grounded citation at line 9 (NS-02 §1.3 example) |
| `facts-loader.test.ts` | it loads into `MemoryGraphRepository`. The Class `layerKind`/`context`/`contextDeclared` properties are present. Edge names `DECLARES`/`CONTAINS` are confirmed on a fixture. Neo4j is never touched |
| `sem-rules.test.ts` | **parity:** on the six parent mock replays, SEM-MISPLACED verdicts equal the pipeline's `misplaced-responsibility` findings at the owning class, and SEM-DUP verdicts equal `semantic-rule-duplication` site for site, `verified` included (two-site clusters). SEM-FRAG: case-03 gives no row (N4). A synthetic A2 with two `defines` classes in one declared context gives one row, and across contexts none. A synthetic three-member cluster with two names in `sales` and one in `billing` gives one `sales` row. `$policy` `any` vs `agreed-only` on a single-run fact; a `$policy` that differs from `producer.factPolicy` is refused. **Ablation:** A1 with an empty A2 gives zero verdicts. An `input-validation` rule at two contexts gives no SEM-DUP row |
| `clustering.test.ts` | concept pairs within a declared context are proposed. Within an undeclared component they are not. Rules are still never paired within a component |
| `pipeline.test.ts` | the case-03 expectation changes (BR-U3-09). The aggregate becomes `expected 3, found 2`, with case-03 reported as N4. Everything else is unchanged after re-recording |
| `llm-provider.test.ts` | with a fake `LLMProvider`: JSON parsing; `LLM_BAD_JSON` → retried once by `ModelCaller`, then invalid; served-model mismatch → `LLM_MODEL_MISMATCH`; the `gemini-api` dated-variant rule; stop codes pass through; `toVendorSchema` turns `['number','null']` into `nullable`; Ajv still rejects an answer the original schema forbids |
| `routes.test.ts` | `describeRoute` does no I/O. `openRoute` in estimate/replay/mock mode never calls a factory and never reads `GEMINI_API_KEY` (the test deletes it from a copied env and spies on the factories). A Gemini route without `--model` fails |
| `fact-scorer.test.ts` | required, forbidden and tolerated polarity. `Class` and `Class.method` names resolve to APG ids, and an ambiguous name is an error. Verdict scoring: no row = pass |
| `ontology-run.test.ts` | Every case passes fake route factories to `main` and a temporary `--cassettes` and `--out` directory; no test writes under `tests/fixtures/`. `--ns02 --estimate` lists the 12 set projects (the retired pair is excluded) and calls nothing. `--provider gemini-api --estimate` and `--provider gemini-agy --replay` with empty cassettes call nothing, and the fake factories record zero constructions. `--runs 1` with `agreed-only` gives exit 2 on record and replay, and `--estimate --runs 1` still prints. **Output format (BR-U3-17):** the `--fixtures` per-case lines still match `g-ontology.mjs`'s `parseRunLines` regex and the estimate regex, `--fixtures` still lists six cases, and `scores.json` keeps its aggregate keys. **Pilot invariant (BR-U3-15):** a mock record of case-02 + case-04b at runs = 2 makes exactly 26 provider calls, and the `--estimate` bound stays within `--budget 20`'s cap. Neither case declares contexts, so the N4 change adds no pair to the pilot |
| `ns02-set.test.ts` (in `ontology-run.test.ts`) | every set manifest and every parent block loads. Every manifest subject resolves in its case's APG. The parent manifests' bytes equal their committed hashes (they are not edited). The cheap outcome is the same on case-09 and case-09t (BR-U3-16) |
| `pipeline.test.ts` / `prompts` | a `kind: input-validation` scripted rule is kept as a rule site but enters no rule cluster and no `semantic-rule-duplication` finding (BR-U3-18). The rule prompt no longer contains the "not a technical check" exclusion and contains no identifier from any case |

**Memory.** The parity tests build ts-morph projects for the six parent cases. They share one `beforeAll` per file that prepares each case once, and each graph is a fresh `MemoryGraphRepository` dropped after its case. The `--ns02` runner handles its 12 projects one at a time, as the runner already does.

**Neo4j:** none of these tests need it. The loader uses only the statements that the interpreter accepts, and Neo4j would accept them too. A Neo4j parity run of the Sem rules is listed as not done (it needs a capped Neo4j, which is not started in this cycle).

## 8. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | The `PROMPT_VERSION` bump invalidates every mock cassette, and the "prompts have not drifted" test fails until they are re-recorded | Re-record with `--provider mock` (a scripted responder, zero model calls), as one plan step. Record into a scratch directory, then **replace** `cassettes-mock/` with it, so no stale `ontology-v0.1` entries stay behind. No live cassette exists yet (only `cassettes-mock/`), so nothing real is lost. `g-onto-mock-record-calls` (110) and `g-onto-accepted` (128) must be unchanged after it |
| R2 | The interpreter may reject part of the Sem Cypher: `OPTIONAL MATCH` after a multi-hop `MATCH`, a relationship property map, `coalesce` | The queries avoid list concatenation. Plan step 6 parses each query first. A rejection is fixed in the query text, never by editing the interpreter in U3 |
| R3 | APG edge names differ from NS-02's assumption (`CONTAINS` vs another Class→Method edge) | Read in review: `src/apg-extractor/edge-extractor.ts` writes `DECLARES` (File→Class) and `CONTAINS` (Class→Method). Plan step 6 still confirms it on an ingested fixture |
| R4 | Union-find clusters of 3 or more members: pairwise rows multiply | SEM-DUP returns pairs, and `runSemRules` groups by `rule` (one verdict per rule cluster). That matches the pipeline's one finding per cluster |
| R5 | Gemini's response-schema subset (union types, `additionalProperties`) | `toVendorSchema` plus Ajv on the original schema, unit-tested with mocks. The live behaviour is unknown until an OK'd run, and that is stated |
| R6 | Parallel units (U2 adds ADRs, U5 adds a Gemini generator adapter) touch the same files | U3 never edits `src/llm-critic/`. The ADR id is assigned by the orchestrator at merge time, and the plan uses the placeholder `ADR-V13-N4` |
| R7 | The replacement pair turns out not cheap-blind | The step 9 dry-run gate. Change the case before the manifest is committed, and record it in `revisions[]` |
| R8 | **Same-author legibility.** One author wrote the cases, manifests and prompts | No comments in the new pair. The Gemini route exists for the cross-vendor arm (risk 4 of the instrument map). The D3 rater labels the K3 pair first |
| R9 | The `gemini-agy` route inherits ADR-034: agy cannot deny `search_web`, so any call with a tool step is invalid | The adapter keeps `AgyCliProvider`'s classification, which already invalidates such calls. Which Gemini route the pilot uses is an author question |
| R10 | The case-03 scoring change reads as a regression | The runner prints the N4 note on its own line (not on the per-case line the replication regex reads). The design doc's new §13 records the new mock baseline: 2 of 3 parent defects, case-03 out of scope under N4. §9 keeps the v0.1 figure the ledger cites |
| R11 | **Registered figures.** The claims ledger (rows C0212–C0220) and replication group `g-onto-mock` cite `ontology-v0-design.md` by line and value. In-place doc edits, or a changed default with no declaration, would break them silently | BR-U3-17: append-only doc, `known` entries for the two N4 numbers, every other `g-onto-mock` number still PASS (plan step 12 runs `node replication/v1.3/run.mjs --group g-onto-mock`, which is offline and calls only the mock), and the ledger rows handed to the orchestrator |
| R12 | **Scope tension in the requirements.** The build list asks for "a Gemini route". The instrument map v3 §8 cuts "the cross-family C1d arm" to future work and gives the pilot as 10–20 calls, while NS-02 §4 gives 26 per vendor at runs = 2 | U3 builds the route, mock-tested only, which is cheap and needed for any later arm. Whether the Gemini arm runs, and runs = 1 or 2, are author questions. They are listed in the hand-back and are not decided here |
| R13 | **The `any` policy costs calls.** It changes the pass (b) prompts and the pass (d) pairs, so its cassettes differ from `agreed-only`'s | BR-U3-06: run-level policy recorded in A2. The sensitivity row is budgeted on its own, never assumed free |

## 9. Decisions this design takes (state them in the PR; the author can overturn any)

1. `inContext` is an object `{context, declared}`. SEM-DUP uses any context, and SEM-FRAG uses declared contexts only.
2. A2 rule and concept facts carry the deterministic cluster id. The Cypher matches on the shared Sem node, unlike NS-02 §2's `SemSAME_RULE_AS` shape.
3. The case-06 pair is retired, not deleted.
4. Both Gemini routes are built. The runner has no default Gemini model.
5. `--runs 1` requires `--fact-policy any` (except with `--estimate`).
6. The fact policy is run-level and recorded in A2 (`producer.factPolicy`).
7. Pass (c) now also extracts input checks, labelled `input-validation`, and only business rules are clustered.
8. The parent cases get `ns02` blocks as sidecar files; their manifests are not edited.
9. The two N4-changed Ontology v0 numbers are declared as `known` in the replication harness; the design doc is append-only.

## Changelog
- 2026-10-19: amendment A1 applied: `citations` and I6 (§3.1, §3.3), §3.3a (prompts `ontology-v0.3`, docs, C4 context).
- 2026-10-18: first version.
- 2026-10-18: adversarial review. Added D10 (parent `ns02` blocks, without which the pilot bar can't be scored), D11 and BR-U3-17 (ledger and `g-onto-mock` figures: append-only doc, `known` entries), and BR-U3-18 (only business rules are clustered). BR-U3-11 now changes the rule prompt's scope, which excluded input checks. BR-U3-06 and §3.1: the fact policy is run-level, and `any` is not a zero-call rescore. BR-U3-07 is reworded per context. SEM-MISPLACED is scored at the owning class. SEM-DUP `verified` is per cluster pair, written once per pair. Fact ids leave out the cluster ids, and parser-fact dates come from the cassettes. The case-09 manifest drops the operator and the `Order.*` wildcard. The twin's extra `.length` is stated, and `giftNote` reaches the domain in both cases. Runner tests inject the route factories. Ablation, output-format and memory notes added. R11–R13.
