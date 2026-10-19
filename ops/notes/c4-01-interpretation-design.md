# C4-01: interpretation design (link L7)

**2026-10-19. Design note. Zero model calls to write it.** This note designs link **L7, interpretation (part C4)** of `ops/notes/trust-01-path-to-a-trusted-instrument.md` (branch `v14/trust-path`, §2 row L7 and §4). Every threshold marked **proposed** is the author's to change. Comments go in `> AUTHOR:` lines. `Nxx` and `Lxx` ids are from `Docs/v1.3/compendium/nulls-and-limits.md`.

**Revised 2026-10-19 after REV-06** (`ops/notes/rev-06-c4-mean02-fable.md`). Where REV-06 left a choice to the author, the coordinator's provisional choice is applied and marked **Provisional (coordinator, 2026-10-19, author confirms)**, with an `> AUTHOR:` line under it.

It follows these decisions:
- **N1:** the model supplies facts, not verdicts (`ops/decisions.md:59`).
- **M4:** the model interprets before detection, as facts (`ops/decisions.md:57`).
- **Exceptions live only in C2.** C4 proposes them, and a human accepts them (`ops/01-instrument-map.md:25`).
- **NS-03 design rule:** the model reads the code *and* the docs, and the graph is added on top (`ops/notes/ns-03-graph-complements-reading.md`, "Design rule"). C4 gets the docs and ADRs, not only the subgraph (same note, table row "C4 interpretation").

---

## 1. The claim, in one sentence

**Given a correct finding, its subgraph, the A2 facts and the project's docs and ADRs, a model explains the finding, says whether it matches or contradicts the declared intent, proposes a declared exception only when a cited doc line grants one, and ranks its severity. By construction it cannot change the blocking verdict (§4.4); a verdict changes only after a human accepts a proposal into the spec (C2) and C3 runs again.**

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
| The judge (V7) is waived: it is dropped from Study 2 | `Docs/v1.4/study2-deviation-2026-10-19-drift.md:100` |

(L70, Gemini agreeing with Claude v2.2 at κ = 0.954 on the same prompt and graph, is neutral about the judge's worth. It moved to §5, where it bears on what cross-vendor agreement can show. REV-06 minor.)

**Reading.** The judge produced verdicts that either did not matter (N85) or were wrong too often (N63, the false-fails). Its job, "decide pass or fail on what rules can't see", is the job N1 takes away from models. C4 keeps the useful half: reading prose intent that rules cannot see. It drops the harmful half: verdicts.

**What happens to judge v1.**
- The code stays frozen (`src/llm-critic/frozen.ts`, `judge-v22.ts`). Nothing is deleted.
- Its results stay in the thesis as the reason for the redesign (N63, N84, N85, L70).

### 2.1 F3: C4 replaces the judge in F3 (REV-05 item a)

F3 today *is* the judge: "The judge has a bounded, complementary role: it catches 22/26 = 0.85 … at 2/48 = 0.04 false fails …; pooled catch is 16/21 = 0.76" (`Docs/v1.3/contribution-statement.md:32`). The claim is F1–F3 plus Study 2 (`ops/01-instrument-map.md:35`). GO-2 and SO3-2 also name the judge (`ops/notes/rev-04-gaps-and-promises-2026-10-19.md:172`, `:185`). If C4 only sits beside the judge, the thesis cites as a contribution a component it dropped from its study. So this note proposes that **C4, together with C1d, replaces the judge in F3**. The judge results move to the evaluation chapter as the earlier design and the reason for the change.

**Proposed F3 wording:**

> **F3.** A model has a bounded, complementary role. It supplies grounded facts the rules read (C1d) and interprets findings against the project's docs and ADRs (C4). By construction it never sets a verdict: an exception it proposes changes a verdict only after a human accepts it into the spec. On seeded cases with twins, across two vendors, C4 [result of §7], and C1d [result of the NS-02 run]. An earlier design, a model judge that set verdicts, caught 16/21 = 0.76 of planted anti-patterns and changed 0 of 65 Study 1 verdicts (N63, N85), and was dropped.

"By construction" is deliberate (REV-06 M7): verdict invariance is an architectural property (§4.4), not an empirical finding, and F3 must not present it as one. The empirical part of C4 is the accept/refuse record of its proposals (§4.3). The brackets stay empty until the runs exist. The claim must say what was done and no more: "designed, piloted on N cases with twins across two vendors, and measured for frequency on agent code" (REV-05, `ops/notes/rev-05-first-study-fable.md:123`, branch `v14/trust-path`).

> AUTHOR: F3 is a claim, so the wording is yours. Options: (1) the wording above; (2) keep F3 about the judge and add C4 as F3b; (3) your own text. Option 2 keeps a dropped component in the claim.

## 3. What already exists

**The SEM-only prompt is built; everything the six cases need is not** (REV-06 B2). Nothing has ever run. Five of the six cases (1 to 5) are symbolic findings, and the context builder cannot take a symbolic finding today, so even the pilot (pairs 1 and 2) waits on new code (§11 items 1 to 8).

| Piece | Where | State |
|---|---|---|
| Context assembly: finding, A2 facts, code spans, graph slice, nearby comments, doc and ADR excerpts | `src/apg-enrich/ontology/interpretation.ts:82-111` | built for **SEM verdicts only**, deterministic, no calls |
| The prompt | `src/apg-enrich/ontology/interpretation.ts:120-145`, version `c4-facts-v0.1` (`:18`); `RULE_TEXT` keyed on the three SEM ids (`:113-117`) | built for SEM only |
| The answer schema: `assessment`, `severity`, `rationale`, `cites` | `src/apg-enrich/ontology/interpretation.ts:23-34` | built, but too thin (§4) |
| Doc reading: README, `docs/`, ADRs; ADRs first; docs are data between markers | `src/apg-enrich/ontology/reading.ts:1-40` | built |
| Routes: `claude-cli`, `gemini-api`, `gemini-agy`, `mock`; estimate and replay never call | `src/apg-enrich/ontology/routes.ts:27`, `:96-99` | built |
| Two-run calls, cache keys, cassettes | `src/apg-enrich/ontology/caller.ts:27`, `cache.ts`, `cassette-io.ts` | built |
| Code-citation grounding (node, file, span, quote) | `src/apg-enrich/ontology/grounding.ts:1-12` | built for code only |
| The SEM rules that produce SEM findings | `src/apg-enrich/ontology/sem-rules.ts:20-64` | built |
| Agreement statistics (κ, AC1, Wilson) | `scripts/v1.3/lib/meaning/agreement.ts` | built |
| Claude and agy providers, isolation pre-flights | `src/llm-critic/claude-cli-provider.ts`, `src/llm-critic/agy-cli-provider.ts` | built |

| Fixtures | `tests/fixtures/v1.4-c4/` | **absent** |
| Doc and comment citation grounding, schema `c4-v0.2`, runner, scorer | — | **absent** (§11) |

**Two gaps found while reading, both larger than first stated.**
1. **No site model for symbolic findings (REV-06 B2).** `buildInterpretationContext` takes a `SemVerdict` only (`interpretation.ts:82`). It resolves sites as class or method APG ids through `units.nodeSpans` and `classOf` (`:85-91`), and `RULE_TEXT` knows only the three SEM ids (`:113-117`). Symbolic findings (FF-S01, FF-S03, FF-DT04, FF-DS02, FF-S04, …) are **file-level edges** (source file, line, import target), not class ids. C4 needs a new site model: an edge site (source file and line, target file), its code span, its class (when one encloses the line), and rule text for every blocking rule. This is medium-sized work, not small (§11 item 1).
2. **The agy version policy (REV-06 B3).** `RouteDeps.agyCli` takes only `{model}` (`routes.ts:87`). The factory builds `AgyCliProvider` without `exploratoryVersions` (`routes.ts:142-146`), and `checkAgyIsolation` fails on any version other than the 1.3.2 pin unless it is listed (`src/llm-critic/agy-cli-provider.ts:466`, pin at `:48`). The machine runs agy 1.4.2. Its acceptance was a decision **for BF-01 only** (`scripts/v1.3/bf-01-run.ts:54-55`). Extending it to C4 or L3 is a new decision, and a six-case run at the freeze would otherwise rest on an unpinned CLI.

**Provisional (coordinator, 2026-10-19, author confirms).** Every Gemini C4 result, and every Gemini L3 result, is labelled **exploratory** until the author signs a dated agy pin for C4/L3 (for example, "agy 1.4.2 pinned for C4 and L3, 2026-MM-DD"). The code change passes `exploratoryVersions` only under an explicit `--exploratory` flag, and that flag is written into each A5 record. Until the pin exists, no Gemini C4 figure enters F3 or a bar as confirmatory; the Gemini column of §7 is reported but marked exploratory.

> AUTHOR: sign a dated agy pin for C4/L3 (which version, which date), or confirm that Gemini C4/L3 results stay exploratory.

## 4. The contract (A5): inputs and outputs

### 4.1 Input, one per finding

| Field | Source | Notes |
|---|---|---|
| `finding` | A4 (C3 output): rule id, tier, finding id, and a site: an **edge site** (source file, line, import target, enclosing class if any) for symbolic findings, or class/method node ids for SEM verdicts | the rule id is given; C4 is not blind to the rule. The edge site is new (§3 gap 1) |
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
6. **Two runs per finding.** A field counts as stable only when both runs agree. A claim made in one run only is reported as `single-run` and never forwarded to C2 (the same policy as A2 `agreed-only`, NS-02 §2). The CLI routes set no temperature (`routes.ts:46-54`), so two runs are not two draws at a known temperature. Two-run agreement is **reported** per field and per vendor as a figure; the design does not lean on it as a stability guarantee (REV-06 minor).

### 4.3 The A5 record

`results/<study>/c4/<provider>/<project>/interpretations.json`: one entry per finding, with the output above plus `c3Verdict` (copied), `modelId` (served id), `promptHash`, `promptVersion`, `runIndex`, `date` from the cassette, and `rejections[]`. Exception claims that pass grounding and are stable go to a separate `proposed-exceptions.json` for C2. A human accepts or refuses each one.

**The exception path, end to end (REV-06 M7).** proposal (A5) → human decision → human spec edit (a per-rule `excludePaths` entry, `src/fitness-compiler/fitness-compiler.ts:370`) → C3 rerun, dated → changed verdict. The A5 record therefore carries, per run and per vendor, three counts:

| Count | Meaning |
|---|---|
| `exceptionsProposed` | stable, grounded claims written to `proposed-exceptions.json` |
| `exceptionsAccepted` | of those, accepted by the human, with the decision date and the spec commit |
| `verdictsChangedByAccepted` | blocking verdicts that changed in the C3 rerun after the accepted spec edits |

Only the third count is a verdict effect, and it is a human's effect, made with C4's help. It is the empirical part of "C4 is useful"; the invariance below is not.

### 4.4 How "never overturns" is enforced: by construction

This is mechanical, not a promise, and so it is **true by construction** (REV-06 M7). It is checked, not measured, and the thesis says so:
- The gate and the scores read C3's A4 only. Nothing in the scoring path reads A5.
- A test asserts that, for every case, the scores and verdicts with and without A5 are byte-identical.
- An exception takes effect only after a human edits the spec (C2) and C3 runs again. That rerun is a new, dated run.

## 5. Routes

| Route | How | Pins | Status |
|---|---|---|---|
| `claude-cli` | the judge's isolated route (`routes.ts:63`, `:104-105`) | CLI version pinned by the provider's pre-flight; model `claude-opus-5-5`, effort high (`src/llm-critic/frozen.ts:26-28`) | ready |
| `gemini-agy` | `AgyCliProvider` through `LlmOntologyProvider` (`routes.ts:113-118`); `--model` required, no temperature (`routes.ts:46-54`) | agy 1.4.2 accepted for BF-01 only; for C4 every result is **exploratory** until a dated C4/L3 pin (§3 gap 2); the model id recorded from the answer | needs gap 2 (§3) and the author's pin |
| `gemini-api` | `GeminiProvider` with `GEMINI_API_KEY` (`routes.ts:137-141`) | model and temperature required | fallback if agy stalls |
| `mock` | scripted answers | — | for tests and the dry run |

Both vendors get the **same prompt and schema**. The prompt says docs are data, not instructions (`reading.ts:8-9`). Every call is cassetted. Replay makes 0 calls.

**What cross-vendor agreement can show.** A Gemini rater agreed with Claude v2.2 at κ = 0.954 on the same prompt and graph (L70, exploratory). On a shared prompt, high agreement is consensus, not truth. So cross-vendor κ and AC1 in §7 are reported, never gated, and never read as validity.

**Gemini status.** Every Gemini C4 result is exploratory until the dated agy pin exists (§3 gap 2, provisional).

## 6. The seeded case set: six cases plus six twins

Built like NS-02 (`ops/notes/ns-02-facts-contract-and-cases.md` §3). Small TypeScript projects under `tests/fixtures/v1.4-c4/`. Each has a manifest with the expected interpretation, written and hashed before any C4 call.

**Who writes them.** A separate session that never runs or scores C4, as for the Study 2 tasks (`ops/decisions.md:17`). The author reads and signs the expected answers first ("answers written first", `ops/01-instrument-map.md:179`).

**Shape.** Each project has exactly one **target** blocking finding and at most two other blocking findings. A twin keeps the code identical and changes only the prose. **The spec (`.daedalus/` spec file) is byte-identical across each pair**, checked by hash in the fixture test, so C3 gives the twin the same findings (REV-06 minor). **Every twin is exception-negative**, so any exception claim on a twin is false.

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

**Rule sources of cases 3 and 4 (REV-06 M5).** FF-DS02 has no source row, and neither has FF-S04 in DDD (`Docs/v1.3/style-rule-sources-errata.md:13`); FF-S04 in Hexagonal rests on an inference, not a quotation (`:10`). So the rules behind cases 3 and 4 are tagged **convention** in MEAN-02 part (c). This does not touch C4's bars, which measure reading the project's own docs, not style fidelity. It does mean no C4 result on cases 3 and 4 is cited as evidence that the rule matches the style's literature.

**Case 6 depends on L3.** Its A2 facts come from the L3 cassettes of case-02. Until L3 has run live, it uses the mock facts, which are illustrative (NS-02 §1.3). Cases 1 to 5 are symbolic and need no model facts. So the C4 pilot can use pairs 1 and 2, with no L3 dependency, **but only after the edge-site model exists** (§3 gap 1, §11 item 1).

### 6.1 Non-author cases (REV-05 item e)

All twelve projects above are written by one author working with Claude sessions. A 6/6 result would show that a model can label textbook cases written to be labelled (REV-05, `rev-05:104-109`). So the set gets **three more targets that neither the author nor Claude wrote**:

| # | Source | How it is chosen | Who writes the expected answer, and when |
|---|---|---|---|
| X1, X2 | **Real external findings**: blocking findings from `results/v1.3-external*/` whose repository's own README, `docs/` or ADRs mention the site file, class or folder | a zero-call script greps each project's docs for the site **names only**; it takes the first two hits in seeded order. **No keyword filter** (no "permission-like sentence" selection): the old filter used the baseline's own keyword list, which would make the baseline right on X by construction (REV-06 M6). It excludes the MEAN-01 sample and its siblings (`ops/notes/mean-01-codebook-and-sample.md:82`, `:103`) without printing their ids | **keyed twice, blind**: the author, and separately a Gemini session that sees the same developer text and not the author's key (a free rater replaces or joins it later). Both keys committed and hashed before any C4 call; disagreement reported item by item; the author's key is primary |
| X3 | **A Gemini-written pair**: one exception case and its twin, written by a Gemini session from a one-paragraph brief (style, rule, "an ADR that permits it") | the brief is fixed in the fixture README | the Gemini session writes the manifest; it is committed, hashed and read by the author **before** any C4 call |

**Provisional (coordinator, 2026-10-19, author confirms).** X1 and X2 get the second blind keying by a Gemini session (a free human rater later, if one is found), and the keyword filter is dropped rather than voiding the baseline on X.

> AUTHOR: confirm the Gemini second keying of X1/X2 and the dropped filter, or name a free rater now.

**Only the target is interpreted (REV-06 B4).** Real repositories have far more than three blocking findings: 92 (ddd-forum), 165 (bank-server), 72, 50 and 42 in `results/v1.3-external*/`. Interpreting every finding would cost 100 to 330 calls per project per vendor. So the runner takes an `--interpret <finding-id,…>` **allowlist**, and on X1 and X2 it interprets the target finding only. The allowlist is committed with the keys, before any call.

**"Non-author" is about the code, not the key.** X1 and X2 are non-author in code and in the developers' text, but the author still writes the primary key; the second keying is the guard. **X3 is Gemini-written and, in the Gemini column, Gemini-read.** It is therefore reported **per vendor**, and the Gemini cell carries the label "Gemini-written, Gemini-read" (REV-06 M6).

These are scored as a **separate row** and never pooled with the six. Real findings carry contamination risk: the repositories are public, and models may have seen them (`ops/01-instrument-map.md:216`). That is stated beside the row.

### 6.2 Baselines (REV-05 item d)

**A zero-call baseline.** A deterministic rule: "an exception is claimed if any doc or comment line names the site file or class *and* contains `allow`, `permit`, `exception`, `legacy` or `shared`". Twins 3 and 4 are built so that this baseline fails on them (a false claim). If C4 does no better than this baseline, C4 adds nothing over a text search (§10). The baseline also runs on X1 to X3; with the keyword filter gone from the X selection (§6.1), its result there is not fixed by construction.

**The C1d heuristic baseline (NS-01 falsifier 1).** Case 6 rests on C1d facts, and so does every SEM finding C4 reads. NS-01's first falsifier is "a dumb heuristic does as well" (`ops/notes/ns-01-what-rules-cannot-see.md:100`). The cheap proxies (`src/apg-enrich/cheap/`) are that heuristic. On the NS-02 cases they caught 1 of 4 new defects and flagged 0 of 17 forbidden items (`ops/notes/ns-02-facts-contract-and-cases.md:313`), and REV-05 notes that a heuristic already beats the model on pair 2 (`rev-05:112`). So the L3 run must report the heuristic and the model **side by side, on the same 12 projects, as a row of the result**, not as an aside. The same holds for the non-author rule: L3 should add 2 or 3 C1d cases that neither the author nor Claude wrote (real external code, or Gemini-written with answers committed first). That belongs to the L3 run spec (NS-02 §5), so it is recorded here and left to that note.

## 7. Bars

All **proposed**. Applied per vendor, on the six-case run, at the freeze tag. The Gemini column is exploratory until the agy pin (§3 gap 2).

**Every small-n bar is printed with its Wilson 95 % interval** (REV-06 minor), so a pass is never read as a rate. The intervals at the bar values are:

| Bar | Value | Wilson 95 % at the bar | Why this value |
|---|---|---|---|
| Correct interpretations on the six cases | **≥ 5/6 per vendor** | 5/6 → [0.44, 0.97]; 6/6 → [0.61, 1.00] | the same bar as the L3 confirmatory run (trust-01 §2 row L3) |
| False exception claims on the six twins (all findings) | **0, both vendors** | 0/6 per vendor → rate ≤ 0.39; 0/12 pooled → rate ≤ 0.24 | a false exception is the costly error: it would hide a real violation once accepted |
| Hallucinated exception citations | **reported**; any one is listed with its text | count with interval over claims made | the validator removes them, so they cannot pass, but their rate is a quality figure |
| Beats the zero-call baseline | C4 correct on **both** near-miss twins (3, 4) where the baseline fails | 2/2 → [0.34, 1.00] | otherwise C4 is text search |
| Cross-vendor agreement on the exception label and on `intentMatch` | **κ and AC1 reported, not gated** | — | n is 12 targets plus the side findings, far too few for a gate; AC1 because κ collapses when one answer dominates (N84); shared-prompt agreement is consensus, not truth (L70, §5) |
| Verdict invariance (§4.4) | **0 changed verdicts** | — (by construction, checked) | mechanical check, not a result |
| Exception path (§4.3) | proposed, accepted, verdicts changed by accepted: **reported** | — | the human's effect, made with C4's help |
| Non-author row (X1 to X3) | **≥ 2/3 correct per vendor, 0 false exception claims on the X3 twin**; reported separately, X3 per vendor with its "Gemini-written, Gemini-read" label in the Gemini cell | 2/3 → [0.21, 0.94]; 0/1 → rate ≤ 0.79 | the only row the author's framing did not shape; the intervals show it is a sign, not a measurement |

The intervals make the scope plain: at these sizes the bars are **go/no-go checks on a designed case set**, not estimates of a rate on real code.

**Pilot bar** (pairs 1 and 2, both vendors): case 1 and case 2 correct, twins clean, citations grounded. A failed pilot is reported as it came out. Then the prompt may be fixed **once**, before the six-case run, and the change is logged.

If a bar fails at the freeze, L7 is labelled "characterised" and its scope is cut in the thesis (trust-01 §3).

## 8. How C4 feeds Study 2

The judge is out of Study 2 (V7 waived). **In the first study the semantic path (C1d then C4) is scoring-only** (REV-05 item b, `rev-05:51-52`). It runs after the study, on a **stratified sample of snapshots**, with the sample size and the call count fixed before the first call. All snapshots are out of reach: the six NS-02 cases and their twins are expected to cost about 202 to 214 calls per vendor at runs = 2 (`ops/notes/ns-02-facts-contract-and-cases.md:280`; REV-05 quotes about 110, the mock-record figure in trust-01's L3 row). In-loop use is decided **after** the first study, from its numbers.

**The snapshot sample (proposed, corrected after REV-06 M1).** The first version said "24 snapshots, 4 per stratum, arm (2) × style (2) × generator (2)": that is 8 strata and 32 snapshots, not 24, and the drift record has **three cells**, not two arms (`none@L2`, `none@L3`, `mcp@L2`; `Docs/v1.4/study2-deviation-2026-10-19-drift.md:3`, `:43`), and DDD may not run (`:51`). The corrected design:

- **Strata:** cell (3) × style (1 or 2: Layered, plus DDD only if DDD passes its pilot bar) × generator (2: Claude Sonnet, Gemini). That is **6 strata** with Layered only, **12** with DDD.
- **Per stratum:** *m* snapshots, at the last step (step 5), drawn with a fixed seed. Step 1 is shared across cells (the drift record's shared start), so it is sampled once per block, not per cell.
- ***m* is set by `--estimate`, not here.** Before any call, `--estimate` prints, for *m* = 1, 2, 3, 4, the expected and upper-bound call counts: (C1d calls on the drawn snapshots) + (blocking identities on them) × 2 runs, per vendor. The author picks *m* from that table, and the chosen *m* and its upper bound become the cap. As a guide only: *m* = 2 gives 12 snapshots with Layered only and 24 with DDD.

**What it answers.** Two questions no other plan answers (REV-05):
- how often K3 and K2m facts arise on agent code at all (NS-01 falsifier 2);
- whether C4 claims an exception on agent code, and what it cites.

**C4's role in Study 2 is evasion detection, not exception discovery (REV-06 M7).** Study 2 is greenfield: the coding agent writes the code *and* any ADRs, READMEs and comments. An exception that cites agent-written prose is therefore **never legitimate**; there is no developer intent to discover. So on Study 2 snapshots, every stable exception claim is classified by the provenance of the cited line (task text and spec: legitimate source; agent-written line: **evasion candidate**). The count of evasion candidates per cell is the output. No Study 2 exception is forwarded to C2, and severity re-ranking on agent code is reported descriptively only.

For the record, the two options for the confirmatory study are:

| | **Option A: in-loop tool** | **Option B: scoring-only** |
|---|---|---|
| What | the MCP tool returns each finding with its C4 explanation to the coding agent | C4 runs after the study, on the blocking identities of each cell |
| For | tests whether an explanation helps the agent fix or avoid violations; closer to the product idea | no change to the declared arms (`arms=none,daedalus-mcp` in the drift record's protocol line); fully replayable from cassettes; can feed the evasion check (M6) by spotting exception claims that cite **agent-written** comments or docs |
| Against | changes what the `daedalus-mcp` arm is, so it is a new deviation; adds model calls inside every step (latency, D5); a Gemini generator would read Claude explanations, which mixes vendors; new code means new prompts, so cassettes can only be recorded, never prepared | does not test the in-loop value; adds nothing to the primary outcome D |
| Calls | per step, per cell: new findings × 2 runs × 1 vendor; multiplies with the grid | per cell: distinct blocking identities (L6) × 2 runs × 2 vendors, once, after the study |

**First study: B, scoring-only, on the sample above.** It keeps the protocol as declared. Its evasion use is its main value: in any cell, an agent could write a comment like "allowed here" or an ADR to excuse a violation. C4 flags a claimed exception citing a line the agent wrote. A is decided after the first study, as an exploratory arm of the confirmatory study at most.

**Provisional (coordinator, 2026-10-19, author confirms).** C4's Study 2 role is evasion detection; the sample is cell (3) × style × generator with *m* set from `--estimate`; "C4 exception claims citing agent-written lines" joins the evasion measures as an exploratory row, not a registered one.

> AUTHOR: confirm scoring-only for the first study, the evasion-detection role, and pick *m* when `--estimate` prints its table.

## 9. Call count and cap

**Method** (an `--estimate`-like upper bound, no calls). For each project, count its blocking findings from C3 (deterministic, free). Then:

```
calls per vendor  ≤  Σ_projects (interpreted findings) × runs (2) × (1 + retries (1))
expected per vendor =  Σ_projects (interpreted findings) × 2
```

"Interpreted findings" are the project's blocking findings, or only those on the `--interpret <finding-id,…>` allowlist when one is given (REV-06 B4). A runner flag `--interpret --estimate` must print both figures, plus prompt tokens, before any record run. This is new code (§11). The fixture figures below use the case design (1 target, at most 2 side findings per project), so they are bounds until the fixtures exist.

**Caps sit at the upper bound where the expected maximum would otherwise equal the cap** (REV-06 B4): the first version capped the pilot and the non-author row at 24, which is their expected maximum, so a single retry would have truncated the run.

| Run | Projects | Interpreted findings | Expected per vendor | Upper bound per vendor | **Cap per vendor (proposed)** | Both vendors |
|---|---:|---:|---:|---:|---:|---:|
| Pilot (pairs 1, 2) | 4 | 4 to 12 | 8 to 24 | 48 | **48** | ≤ 96 |
| Six cases + twins | 12 | 12 to 36 | 24 to 72 | 144 | **80** | ≤ 160 |
| Non-author row: X1, X2 (target only, allowlist) + X3 pair | 4 | 1 + 1 + (1 to 3) + (1 to 3) = 4 to 8 | 8 to 16 | 32 | **32** | ≤ 64 |
| X1/X2 second keying (§6.1) | 2 items | — | 1 Gemini session | 1 + 1 retry | **2 sessions** | — |
| First study, scoring-only (§8) | cell × style × generator × *m* | distinct identities | identities × 2 | identities × 4 | fixed from `--estimate` before the run | — |

On the six-case row the cap of 80 covers the expected maximum of 72 with 8 retries to spare (REV-06: "cap 80 fine"); a ninth retry stops the run, and the stop is reported. The cap stops the run. It is never raised mid-run without the author's OK. A cache hit is free.

## 10. Falsifiers: what would show C4 does not work

1. **Any false exception claim on a twin** (either vendor). The model reads permission into code shape or naming.
2. **C4 does no better than the keyword baseline** on twins 3 and 4. Then C4 is text search.
3. **The two vendors disagree** on the exception label for more than 2 of the 12 targets (**proposed**). Then the interpretation depends on the vendor, and it cannot be a measurement.
4. **Inconsistency:** a run says `contradicts-declared-intent` and also claims an exception for the same finding. That is a broken output and is counted.
5. **Stability:** more than 2 of 12 targets differ between the two runs of one vendor (**proposed**).

## 11. Code still needed (none of it written by this note)

| # | Item | Size |
|---|---|---|
| 1 | **Edge-site model**: generalise `buildInterpretationContext` from `SemVerdict` to any A4 finding (file-level edge, cycle, class); site resolution from file and line, not only APG class ids; `RULE_TEXT` for every blocking rule (§3 gap 1) | **medium** (REV-06 B2) |
| 2 | Schema `c4-v0.2` (§4.2), a `PROMPT_VERSION` bump, and the prompt text for intent and exception | small |
| 3 | Doc and comment citation grounding (§4.2 rule 3) | small |
| 4 | A5 writer, `proposed-exceptions.json`, the proposed/accepted/changed counts (§4.3), and the verdict-invariance test (§4.4) | small |
| 5 | Runner: `ontology-run.ts --interpret` with `--estimate`, `--replay`, record, `--budget`, and the **`--interpret <finding-id,…>` allowlist** (B4) | small to medium |
| 6 | `gemini-agy` exploratory versions in `routes.ts` (gap 2, §3), passed only with an explicit `--exploratory` flag that is written into A5 | trivial |
| 7 | C4 scorer: manifests → correct, clean, baseline comparison, κ and AC1 (`scripts/v1.3/lib/meaning/agreement.ts`), **Wilson intervals on every bar** (§7) | small |
| 8 | The 6 + 6 fixtures under `tests/fixtures/v1.4-c4/` (absent today), by a separate session; specs byte-identical per pair; manifests hashed before any call | medium |
| 9 | Evasion classifier for Study 2 snapshots: provenance of each cited line (task/spec vs agent-written) (§8) | small |

All of items 1 to 9 come with mock-route tests and make 0 calls.

**Also still to build, from NS-02 (REV-05 item c).** NS-02 lists the **Gemini ontology provider** and the **A2 writer and A2-to-graph loader** as missing (`ops/notes/ns-02-facts-contract-and-cases.md:250`, `:296`). On `main` today, `routes.ts` has a `gemini-agy` and a `gemini-api` route through `LlmOntologyProvider` (`routes.ts:27`, `:106-118`), and `src/apg-enrich/ontology/facts-loader.ts` loads A1 + A2 into a graph repository. Neither has ever run against a live model or a live Neo4j, and the agy route fails its version check (gap 2, §3). So for planning they count as **not done**: each needs a live smoke run (Gemini: one tiny call, with the author's OK; loader: the NS-02 §2 Cypher on Neo4j against the scorer's TypeScript result) before C4's case 6 or the scoring-only sample can rely on them.

**Reuse elsewhere.** The FP/FN review (FPFN, `ops/decisions.md:26`) needs "an agent explanation per item". C4's `explanation` field can serve it. This is a reuse, not a dependency.

## 12. Order

1. Items 1 to 7 and 9, with mock tests (0 calls). Item 1 first: nothing else can be exercised on cases 1 to 5 without it.
2. Fixtures (item 8), signed by the author. X1/X2 keys (author, and the blind second keying) and the allowlist committed.
3. The author decides the agy policy (§3 gap 2). Until then the Gemini column is exploratory.
4. The pilot, after the author's OK, counted by `--estimate` first, at most 48 calls per vendor (96 both).
5. The six-case run and the non-author row, counted by `--estimate` first, at most 160 + 64 calls.
6. After the first study: the scoring-only sample (§8), with *m* and its cap fixed first.
7. At the freeze, the end-to-end check replays the six-case cassettes (trust-01 §3, item 3).

## Changelog
- 2026-10-19: first version, with REV-05 items (a) to (e): F3 replacement and wording (§2.1), scoring-only semantic path in the first study (§8), the NS-02 build items (§11), the C1d heuristic baseline (§6.2) and non-author cases (§6.1).
- 2026-10-19, REV-06 (`ops/notes/rev-06-c4-mean02-fable.md`): B2 "most of C4 is built" restated as "the SEM-only prompt is built"; edge-site model added as a medium item (§3, §11). B3 agy policy: Gemini C4/L3 results exploratory until a dated pin (provisional). B4 `--interpret` allowlist, X1/X2 on the target only, caps at the upper bound (pilot 48, non-author 32). M1 scoring-only sample restated as cell (3) × style × generator, *m* from `--estimate`. M5 cases 3 and 4 tagged convention for style fidelity. M6 blind second keying of X1/X2 by a Gemini session, keyword filter dropped, X3 per vendor (provisional). M7 F3 and §1 say "by construction"; A5 gains proposed/accepted/changed; C4's Study 2 role is evasion detection (provisional). Minors: L70 moved to §5; Wilson intervals on every bar (§7); two-run agreement reported, not leaned on (§4.2); spec byte-identical per pair (§6).
