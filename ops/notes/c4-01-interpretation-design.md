# C4-01: interpretation design (link L7)

**2026-10-19. Design note. Zero model calls to write it.** This note designs link **L7, interpretation (part C4)** of `ops/notes/trust-01-path-to-a-trusted-instrument.md` (branch `v14/trust-path`, §2 row L7 and §4). Every threshold marked **proposed** is the author's to change. Comments go in `> AUTHOR:` lines. `Nxx` and `Lxx` ids are from `Docs/v1.3/compendium/nulls-and-limits.md`.

It follows these decisions:
- **N1:** the model supplies facts, not verdicts (`ops/decisions.md:59`).
- **M4:** the model interprets before detection, as facts (`ops/decisions.md:57`).
- **Exceptions live only in C2.** C4 proposes them, and a human accepts them (`ops/01-instrument-map.md:25`).
- **NS-03 design rule:** the model reads the code *and* the docs, and the graph is added on top (`ops/notes/ns-03-graph-complements-reading.md`, "Design rule"). C4 gets the docs and ADRs, not only the subgraph (same note, table row "C4 interpretation").

---

## 1. The claim, in one sentence

**Given a correct finding, its subgraph, the A2 facts and the project's docs and ADRs, a model explains the finding, says whether it matches or contradicts the declared intent, proposes a declared exception only when a cited doc line grants one, and ranks its severity, and it never changes the blocking verdict.**

What C4 is not:
- It is not a judge. It does not pass or fail code. The C3 verdict is copied into its output, never computed by it.
- It is not an exception mechanism. An exception claim is a *proposal* written for C2. It changes nothing until a human accepts it and the spec changes (`ops/01-instrument-map.md:25`).

## 2. Why the old judge is replaced

| Fact about judge v1 | Source |
|---|---|
| Catch rate on planted anti-patterns 16/21 = 0.76 [0.55, 0.89], below the 0.80 target; the operator restriction was post hoc | N63 |
| At its registered 8 % weight it changed 0 of 65 E1 verdicts and no E7 verdict | N85 |
| E1 panel: 34/36 raw agreement but Cohen's κ = 0 (it passed everything) | N84 |
| v1 false-fails on 16 of 48 clean units | `ops/01-instrument-map.md:179` |
| A Gemini rater agreed with Claude v2.2 at κ = 0.954, on the same prompt and graph (exploratory) | L70 |
| The judge (V7) is waived: it is dropped from Study 2 | `Docs/v1.4/study2-deviation-2026-10-19-drift.md:100` |

**Reading.** The judge produced verdicts that either did not matter (N85) or were wrong too often (N63, the false-fails). Its job, "decide pass or fail on what rules can't see", is the job N1 takes away from models. C4 keeps the useful half: reading prose intent that rules cannot see. It drops the harmful half: verdicts.

**What happens to judge v1.**
- The code stays frozen (`src/llm-critic/frozen.ts`, `judge-v22.ts`). Nothing is deleted.
- Its results stay in the thesis as the reason for the redesign (N63, N84, N85, L70).

### 2.1 F3: C4 replaces the judge in F3 (REV-05 item a)

F3 today *is* the judge: "The judge has a bounded, complementary role: it catches 22/26 = 0.85 … at 2/48 = 0.04 false fails …; pooled catch is 16/21 = 0.76" (`Docs/v1.3/contribution-statement.md:32`). The claim is F1–F3 plus Study 2 (`ops/01-instrument-map.md:35`). GO-2 and SO3-2 also name the judge (`ops/notes/rev-04-gaps-and-promises-2026-10-19.md:172`, `:185`). If C4 only sits beside the judge, the thesis cites as a contribution a component it dropped from its study. So this note proposes that **C4, together with C1d, replaces the judge in F3**. The judge results move to the evaluation chapter as the earlier design and the reason for the change.

**Proposed F3 wording:**

> **F3.** A model has a bounded, complementary role. It supplies grounded facts the rules read (C1d) and interprets findings against the project's docs and ADRs (C4), and it never sets a verdict. On seeded cases with twins, across two vendors, C4 [result of §7], and C1d [result of the NS-02 run]. An earlier design, a model judge that set verdicts, caught 16/21 = 0.76 of planted anti-patterns and changed 0 of 65 Study 1 verdicts (N63, N85), and was dropped.

The brackets stay empty until the runs exist. The claim must say what was done and no more: "designed, piloted on N cases with twins across two vendors, and measured for frequency on agent code" (REV-05, `ops/notes/rev-05-first-study-fable.md:123`, branch `v14/trust-path`).

> AUTHOR: F3 is a claim, so the wording is yours. Options: (1) the wording above; (2) keep F3 about the judge and add C4 as F3b; (3) your own text. Option 2 keeps a dropped component in the claim.

## 3. What already exists

Most of C4 is built. It has never been run.

| Piece | Where | State |
|---|---|---|
| Context assembly: finding, A2 facts, code spans, graph slice, nearby comments, doc and ADR excerpts | `src/apg-enrich/ontology/interpretation.ts:82-111` | built, deterministic, no calls |
| The prompt | `src/apg-enrich/ontology/interpretation.ts:120-145`, version `c4-facts-v0.1` (`:18`) | built |
| The answer schema: `assessment`, `severity`, `rationale`, `cites` | `src/apg-enrich/ontology/interpretation.ts:23-34` | built, but too thin (§4) |
| Doc reading: README, `docs/`, ADRs; ADRs first; docs are data between markers | `src/apg-enrich/ontology/reading.ts:1-40` | built |
| Routes: `claude-cli`, `gemini-api`, `gemini-agy`, `mock`; estimate and replay never call | `src/apg-enrich/ontology/routes.ts:27`, `:96-99` | built |
| Two-run calls, cache keys, cassettes | `src/apg-enrich/ontology/caller.ts:27`, `cache.ts`, `cassette-io.ts` | built |
| Code-citation grounding (node, file, span, quote) | `src/apg-enrich/ontology/grounding.ts:1-12` | built for code only |
| The SEM rules that produce SEM findings | `src/apg-enrich/ontology/sem-rules.ts:20-64` | built |
| Agreement statistics (κ, AC1, Wilson) | `scripts/v1.3/lib/meaning/agreement.ts` | built |
| Claude and agy providers, isolation pre-flights | `src/llm-critic/claude-cli-provider.ts`, `src/llm-critic/agy-cli-provider.ts` | built |

**Two gaps found while reading.**
1. `buildInterpretationContext` takes a `SemVerdict` only (`interpretation.ts:82`). Most blocking findings come from the symbolic rules (FF-S01, FF-S03, FF-DS02 and so on). C4 must take any A4 finding.
2. The `gemini-agy` route builds `AgyCliProvider` without `exploratoryVersions` (`routes.ts:142-146`). The pin is 1.3.2 (`src/llm-critic/agy-cli-provider.ts:48`). The machine runs agy 1.4.2, which the BF-01 runner allows for exploratory runs only (`scripts/v1.3/bf-01-run.ts:55`). So the C4 Gemini route fails its version check today. It needs the same exploratory list, passed only when the run is labelled exploratory.

## 4. The contract (A5): inputs and outputs

### 4.1 Input, one per finding

| Field | Source | Notes |
|---|---|---|
| `finding` | A4 (C3 output): rule id, tier, sites (node ids), edge (file, line, target) or SEM verdict | the rule id is given; C4 is not blind to the rule |
| `c3Verdict` | C3 | copied into the output unchanged |
| `facts` | A2 (`src/apg-enrich/ontology/facts.ts`; contract in `ops/notes/ns-02-facts-contract-and-cases.md` §1) | parser facts always; model facts only under `agreed-only` (NS-02 §2) |
| `subgraph` | A1, the graph slice of each site's class (`interpretation.ts:108`) | with the cited statistics (`FACT_GRAPH_QUERIES`, `facts.ts`) |
| `code` | the site spans, line-numbered | as today |
| `comments` | lines within 10 of each site (`interpretation.ts:21`) | as today |
| `docs` | excerpts that mention the site, ADRs first; ADR heads if none do (`interpretation.ts:104-106`) | limits in `reading.ts:34-40` |

### 4.2 Output, schema `c4-v0.2` (proposed; replaces `c4-facts-v0.1`)

```json
{
  "explanation": "One paragraph: what the dependency or responsibility is, and why the rule flags it.",
  "intentMatch": {
    "status": "contradicts-declared-intent | consistent-with-declared-intent | no-declared-intent",
    "cites": ["docs/architecture.md:14"]
  },
  "exceptionClaim": {
    "claimed": true,
    "citation": { "path": "docs/adr/0004-read-side.md", "startLine": 9, "endLine": 11, "quote": "Controllers may query read repositories directly." },
    "scope": "the import of src/infra/read/order-read.repository.ts from src/web/order.controller.ts"
  },
  "severityClass": "high | medium | low",
  "cites": ["src/web/order.controller.ts:3", "docs/adr/0004-read-side.md:9"]
}
```

Rules on the output, all checked on write:
1. **No verdict field.** The schema has `additionalProperties: false` and no `pass`, `fail`, `violates` or `tier` key (N1).
2. **`exceptionClaim.citation` is required when `claimed = true`**, and it must be a **doc or comment** line, never code. A claim that cites code only is rejected.
3. **Doc grounding.** The cited path is one of the project's docs (or a comment line in a source file). The lines exist. The quote, with whitespace collapsed, occurs in those lines. This is new code: today's grounding checks code citations only (`grounding.ts:1-12`), and doc locations in A2 are checked for shape only (`facts.ts:171`).
4. **A rejected citation** turns the claim into `claimed: false`, and it is counted as a **hallucinated exception**. The validator never repairs a citation (as `grounding.ts:11`).
5. **`severityClass` ranks inside the C3 tier.** For a blocking finding it orders the work (high, medium, low). It never moves a finding out of the blocking tier.
6. **Two runs per finding.** A field counts as stable only when both runs agree. A claim made in one run only is reported as `single-run` and never forwarded to C2 (the same policy as A2 `agreed-only`, NS-02 §2).

### 4.3 The A5 record

`results/<study>/c4/<provider>/<project>/interpretations.json`: one entry per finding, with the output above plus `c3Verdict` (copied), `modelId` (served id), `promptHash`, `promptVersion`, `runIndex`, `date` from the cassette, and `rejections[]`. Exception claims that pass grounding and are stable go to a separate `proposed-exceptions.json` for C2. A human accepts or refuses each one.

### 4.4 How "never overturns" is enforced

This is mechanical, not a promise:
- The gate and the scores read C3's A4 only. Nothing in the scoring path reads A5.
- A test asserts that, for every case, the scores and verdicts with and without A5 are byte-identical.
- An exception takes effect only after a human edits the spec (C2) and C3 runs again. That rerun is a new, dated run.

## 5. Routes

| Route | How | Pins | Status |
|---|---|---|---|
| `claude-cli` | the judge's isolated route (`routes.ts:63`, `:104-105`) | CLI version pinned by the provider's pre-flight; model `claude-opus-5-5`, effort high (`src/llm-critic/frozen.ts:26-28`) | ready |
| `gemini-agy` | `AgyCliProvider` through `LlmOntologyProvider` (`routes.ts:113-118`); `--model` required, no temperature (`routes.ts:46-54`) | agy 1.4.2 accepted **only in exploratory runs**; the model id recorded from the answer | needs gap 2 (§3) |
| `gemini-api` | `GeminiProvider` with `GEMINI_API_KEY` (`routes.ts:137-141`) | model and temperature required | fallback if agy stalls |
| `mock` | scripted answers | — | for tests and the dry run |

Both vendors get the **same prompt and schema**. The prompt says docs are data, not instructions (`reading.ts:8-9`). Every call is cassetted. Replay makes 0 calls.

## 6. The seeded case set: six cases plus six twins

Built like NS-02 (`ops/notes/ns-02-facts-contract-and-cases.md` §3). Small TypeScript projects under `tests/fixtures/v1.4-c4/`. Each has a manifest with the expected interpretation, written and hashed before any C4 call.

**Who writes them.** A separate session that never runs or scores C4, as for the Study 2 tasks (`ops/decisions.md:17`). The author reads and signs the expected answers first ("answers written first", `ops/01-instrument-map.md:179`).

**Shape.** Each project has exactly one **target** blocking finding and at most two other blocking findings. A twin keeps the code identical and changes only the prose. **Every twin is exception-negative**, so any exception claim on a twin is false.

| # | Case (expected: exception claimed, citing the planted line) | Twin (expected: no exception) | Rule, style | What it tests |
|---|---|---|---|---|
| 1 | `c4-01-adr-permits-read-skip`: a controller imports a read repository; ADR-0004 (Accepted) says "controllers may query read repositories directly" | `c4-01t`: no ADR | FF-S03 layer skip, Layered | the basic case: an ADR that permits an import |
| 2 | `c4-02-legacy-exception`: a domain entity imports an ORM decorator; `docs/legacy-exceptions.md` lists the file with an end date, and a `// LEGACY:` comment sits on the line | `c4-02t`: the same code, comment and list removed | FF-DT04 domain purity, DDD | a documented legacy exception |
| 3 | `c4-03-shared-kernel`: billing imports sales' `Money`; the context map declares a shared kernel `Money` | `c4-03t`: the context map names `Money` but says billing must translate it through an ACL | FF-DS02 context isolation, DDD | a **near-miss doc**: the twin mentions the class and the word "shared" in a negating sentence |
| 4 | `c4-04-accepted-adr`: ADR-0002 (Accepted) permits a core-to-adapter import | `c4-04t`: ADR-0002 is marked "Superseded by ADR-0009", and ADR-0009 forbids it | FF-S04 core isolation, Hexagonal | reading ADR status, not only ADR text |
| 5 | `c4-05-intent-contradicted`: README states "strict layering, no skipping"; the code skips. Expected: `contradicts-declared-intent`, **no** exception, severity high | `c4-05t`: README is silent on layering. Expected: `no-declared-intent`, no exception | FF-S03, Layered | intent match without any permission. Both members are exception-negative |
| 6 | `c4-06-sem-documented`: the NS-02 case-02 code (discount computed in a notification service) plus an ADR that places a preview discount there on purpose | the existing `case-02-misplaced-pricing` (no ADR), unchanged | SEM-MISPLACED, K3 | a SEM finding, read with A2 facts |

**What "correct" means for one case.** All of these must hold, in both runs:
- the exception claim is right (claimed or not);
- when claimed, the citation resolves to the planted lines;
- `intentMatch.status` is the expected one;
- `severityClass` is in the manifest's allowed set (for example, case 5 allows only `high`).

A twin is **clean** when it has no exception claim on any of its findings (target or not).

**Case 6 depends on L3.** Its A2 facts come from the L3 cassettes of case-02. Until L3 has run live, it uses the mock facts, which are illustrative (NS-02 §1.3). Cases 1 to 5 are symbolic and need no model facts. So the C4 pilot can use pairs 1 and 2, with no L3 dependency.

### 6.1 Non-author cases (REV-05 item e)

All twelve projects above are written by one author working with Claude sessions. A 6/6 result would show that a model can label textbook cases written to be labelled (REV-05, `rev-05:104-109`). So the set gets **three more targets that neither the author nor Claude wrote**:

| # | Source | How it is chosen | Who writes the expected answer, and when |
|---|---|---|---|
| X1, X2 | **Real external findings**: blocking findings from `results/v1.3-external*/` whose repository's own README, `docs/` or ADRs mention the site file, class or folder | a zero-call script greps each project's docs for the site names; it takes the first two hits in seeded order, one with a permission-like sentence and one without; it excludes the MEAN-01 sample and its siblings (`ops/notes/mean-01-codebook-and-sample.md:82`, `:103`) without printing their ids | the author, from the developers' own text, committed and hashed before any C4 call |
| X3 | **A Gemini-written pair**: one exception case and its twin, written by a Gemini session from a one-paragraph brief (style, rule, "an ADR that permits it") | the brief is fixed in the fixture README | the Gemini session writes the manifest; it is committed, hashed and read by the author **before** any C4 call |

These are scored as a **separate row** and never pooled with the six. Real findings carry contamination risk: the repositories are public, and models may have seen them (`ops/01-instrument-map.md:216`). That is stated beside the row.

### 6.2 Baselines (REV-05 item d)

**A zero-call baseline.** A deterministic rule: "an exception is claimed if any doc or comment line names the site file or class *and* contains `allow`, `permit`, `exception`, `legacy` or `shared`". Twins 3 and 4 are built so that this baseline fails on them (a false claim). If C4 does no better than this baseline, C4 adds nothing over a text search (§10). The baseline also runs on X1 to X3.

**The C1d heuristic baseline (NS-01 falsifier 1).** Case 6 rests on C1d facts, and so does every SEM finding C4 reads. NS-01's first falsifier is "a dumb heuristic does as well" (`ops/notes/ns-01-what-rules-cannot-see.md:100`). The cheap proxies (`src/apg-enrich/cheap/`) are that heuristic. On the NS-02 cases they caught 1 of 4 new defects and flagged 0 of 17 forbidden items (`ops/notes/ns-02-facts-contract-and-cases.md:313`), and REV-05 notes that a heuristic already beats the model on pair 2 (`rev-05:112`). So the L3 run must report the heuristic and the model **side by side, on the same 12 projects, as a row of the result**, not as an aside. The same holds for the non-author rule: L3 should add 2 or 3 C1d cases that neither the author nor Claude wrote (real external code, or Gemini-written with answers committed first). That belongs to the L3 run spec (NS-02 §5), so it is recorded here and left to that note.

## 7. Bars

All **proposed**. Applied per vendor, on the six-case run, at the freeze tag.

| Bar | Value | Why this value |
|---|---|---|
| Correct interpretations on the six cases | **≥ 5/6 per vendor** | the same bar as the L3 confirmatory run (trust-01 §2 row L3) |
| False exception claims on the six twins (all findings) | **0, both vendors** | a false exception is the costly error: it would hide a real violation once accepted |
| Hallucinated exception citations | **reported**; any one is listed with its text | the validator removes them, so they cannot pass, but their rate is a quality figure |
| Beats the zero-call baseline | C4 correct on **both** near-miss twins (3, 4) where the baseline fails | otherwise C4 is text search |
| Cross-vendor agreement on the exception label and on `intentMatch` | **κ and AC1 reported, not gated** | n is 12 targets plus the side findings, far too few for a gate; AC1 because κ collapses when one answer dominates (N84) |
| Verdict invariance (§4.4) | **0 changed verdicts** | mechanical check |
| Non-author row (X1 to X3) | **≥ 2/3 correct per vendor, 0 false exception claims on the X3 twin**; reported separately | the only row the author's framing did not shape |

**Pilot bar** (pairs 1 and 2, both vendors): case 1 and case 2 correct, twins clean, citations grounded. A failed pilot is reported as it came out. Then the prompt may be fixed **once**, before the six-case run, and the change is logged.

If a bar fails at the freeze, L7 is labelled "characterised" and its scope is cut in the thesis (trust-01 §3).

## 8. How C4 feeds Study 2

The judge is out of Study 2 (V7 waived). **In the first study the semantic path (C1d then C4) is scoring-only** (REV-05 item b, `rev-05:51-52`). It runs after the study, on a **stratified sample of snapshots**, with the sample size and the call count fixed before the first call. All snapshots are out of reach: the six NS-02 cases and their twins are expected to cost about 202 to 214 calls per vendor at runs = 2 (`ops/notes/ns-02-facts-contract-and-cases.md:280`; REV-05 quotes about 110, the mock-record figure in trust-01's L3 row). In-loop use is decided **after** the first study, from its numbers.

**The snapshot sample (proposed).** 24 snapshots: 4 per stratum, stratified by arm (2) × style (Layered, DDD) × generator (Claude Sonnet, Gemini), plus the step (step 1 or the last step), drawn with a fixed seed. The count per vendor is (C1d calls from `--estimate` on those 24) + (blocking identities on those 24) × 2. Both figures are printed by `--estimate` and become the cap before any call.

**What it answers.** Two questions no other plan answers (REV-05):
- how often K3 and K2m facts arise on agent code at all (NS-01 falsifier 2);
- whether C4 would have changed any severity class, or claimed an exception, on agent code.

For the record, the two options for the confirmatory study are:

| | **Option A: in-loop tool** | **Option B: scoring-only** |
|---|---|---|
| What | the MCP tool returns each finding with its C4 explanation to the coding agent | C4 runs after the study, on the blocking identities of each cell |
| For | tests whether an explanation helps the agent fix or avoid violations; closer to the product idea | no change to the declared arms (`arms=none,daedalus-mcp` in the drift record's protocol line); fully replayable from cassettes; can feed the evasion check (M6) by spotting exception claims that cite **agent-written** comments or docs |
| Against | changes what the `daedalus-mcp` arm is, so it is a new deviation; adds model calls inside every step (latency, D5); a Gemini generator would read Claude explanations, which mixes vendors; new code means new prompts, so cassettes can only be recorded, never prepared | does not test the in-loop value; adds nothing to the primary outcome D |
| Calls | per step, per cell: new findings × 2 runs × 1 vendor; multiplies with the grid | per cell: distinct blocking identities (L6) × 2 runs × 2 vendors, once, after the study |

**First study: B, scoring-only, on the sample above.** It keeps the protocol as declared. Its evasion use is new evidence at low cost: in the tool arm, an agent could write a comment like "allowed here" to excuse a violation. C4 would flag a claimed exception citing a line the agent wrote. A is decided after the first study, as an exploratory arm of the confirmatory study at most.

> AUTHOR: confirm scoring-only for the first study and the 24-snapshot sample. If yes, I add "C4 exception claims citing generated lines" to the evasion measures as an exploratory row, not a registered one.

## 9. Call count and cap

**Method** (an `--estimate`-like upper bound, no calls). For each project, count its blocking findings from C3 (deterministic, free). Then:

```
calls per vendor  ≤  Σ_projects (blocking findings) × runs (2) × (1 + retries (1))
expected per vendor =  Σ_projects (blocking findings) × 2
```

A runner flag `--interpret --estimate` must print both figures, plus prompt tokens, before any record run. This is new code (§11). The figures below use the case design (1 target, at most 2 side findings per project), so they are bounds until the fixtures exist.

| Run | Projects | Findings | Expected per vendor | Upper bound per vendor | **Cap per vendor (proposed)** | Both vendors |
|---|---:|---:|---:|---:|---:|---:|
| Pilot (pairs 1, 2) | 4 | 4 to 12 | 8 to 24 | 48 | **24** | ≤ 48 |
| Six cases + twins | 12 | 12 to 36 | 24 to 72 | 144 | **80** | ≤ 160 |
| Non-author row (X1, X2, X3 pair) | 4 | 4 to 12 | 8 to 24 | 48 | **24** | ≤ 48 |
| First study, scoring-only (§8) | 24 snapshots | distinct identities | identities × 2 | identities × 4 | fixed from `--estimate` before the run | — |

The cap stops the run. It is never raised mid-run without the author's OK. A cache hit is free.

## 10. Falsifiers: what would show C4 does not work

1. **Any false exception claim on a twin** (either vendor). The model reads permission into code shape or naming.
2. **C4 does no better than the keyword baseline** on twins 3 and 4. Then C4 is text search.
3. **The two vendors disagree** on the exception label for more than 2 of the 12 targets (**proposed**). Then the interpretation depends on the vendor, and it cannot be a measurement.
4. **Inconsistency:** a run says `contradicts-declared-intent` and also claims an exception for the same finding. That is a broken output and is counted.
5. **Stability:** more than 2 of 12 targets differ between the two runs of one vendor (**proposed**).

## 11. Code still needed (none of it written by this note)

| # | Item | Size |
|---|---|---|
| 1 | Generalise `buildInterpretationContext` from `SemVerdict` to any A4 finding (symbolic edge, cycle, class) | small |
| 2 | Schema `c4-v0.2` (§4.2), a `PROMPT_VERSION` bump, and the prompt text for intent and exception | small |
| 3 | Doc and comment citation grounding (§4.2 rule 3) | small |
| 4 | A5 writer, `proposed-exceptions.json`, and the verdict-invariance test (§4.4) | small |
| 5 | Runner: `ontology-run.ts --interpret` with `--estimate`, `--replay`, record, `--budget` | small to medium |
| 6 | `gemini-agy` exploratory versions in `routes.ts` (gap 2, §3), passed only with an explicit exploratory flag | trivial |
| 7 | C4 scorer: manifests → correct, clean, baseline comparison, κ and AC1 (`scripts/v1.3/lib/meaning/agreement.ts`) | small |
| 8 | The 6 + 6 fixtures, by a separate session; manifests hashed before any call | medium |

**Also still to build, from NS-02 (REV-05 item c).** NS-02 lists the **Gemini ontology provider** and the **A2 writer and A2-to-graph loader** as missing (`ops/notes/ns-02-facts-contract-and-cases.md:250`, `:296`). On `main` today, `routes.ts` has a `gemini-agy` and a `gemini-api` route through `LlmOntologyProvider` (`routes.ts:27`, `:106-118`), and `src/apg-enrich/ontology/facts-loader.ts` loads A1 + A2 into a graph repository. Neither has ever run against a live model or a live Neo4j, and the agy route fails its version check (gap 2, §3). So for planning they count as **not done**: each needs a live smoke run (Gemini: one tiny call, with the author's OK; loader: the NS-02 §2 Cypher on Neo4j against the scorer's TypeScript result) before C4's case 6 or the scoring-only sample can rely on them.

**Reuse elsewhere.** The FP/FN review (FPFN, `ops/decisions.md:26`) needs "an agent explanation per item". C4's `explanation` field can serve it. This is a reuse, not a dependency.

## 12. Order

1. Items 1 to 7, with mock tests (0 calls).
2. Fixtures (item 8), signed by the author.
3. The pilot, after the author's OK, at most 48 calls.
4. The six-case run and the non-author row, counted by `--estimate` first, at most 160 + 48 calls.
5. After the first study: the scoring-only sample (§8), with its cap fixed first.
6. At the freeze, the end-to-end check replays the six-case cassettes (trust-01 §3, item 3).

## Changelog
- 2026-10-19: first version, with REV-05 items (a) to (e): F3 replacement and wording (§2.1), scoring-only semantic path in the first study (§8), the NS-02 build items (§11), the C1d heuristic baseline (§6.2) and non-author cases (§6.1).
