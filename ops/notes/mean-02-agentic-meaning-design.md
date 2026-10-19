# MEAN-02: agentic meaning design (link L8)

**2026-10-19. Design note. Zero model calls to write it.** This note designs link **L8, meaning (part C3m)** of `ops/notes/trust-01-path-to-a-trusted-instrument.md` (branch `v14/trust-path`, §2 row L8, §3 item 4, §4). It adds the conditions of the Fable review REV-05 (`ops/notes/rev-05-first-study-fable.md:125-136`, same branch). Every threshold marked **proposed** is the author's to change. Comments go in `> AUTHOR:` lines. `Nxx`, `Lxx` and `Mxx` ids are from `Docs/v1.3/compendium/nulls-and-limits.md`.

**Not opened for this note:** the MEAN-01 sample and key (`results/v1.3-meaning/mean-01-sample.*`). Every MEAN-01 figure below comes from the note `ops/notes/mean-01-codebook-and-sample.md`, which shows only stratum totals.

---

## 0. The author's position, and what it allows us to claim

**Position (author, 2026-10-19).** The usefulness of findings is shown agentically. Human labels come later, as supporting calibration, and they never gate the claim (trust-01 §2 row L8).

**What that allows, stated plainly (REV-05 item j).**
- L4 made **field A, practitioner acceptance**, the primary meaning field: "a finding is meaningful if a competent developer of that style would ask for it to change in review" (`ops/decisions.md:30`).
- No model measures field A. A model is not a practitioner of the style, and a model panel can at most measure **literature fidelity**, MEAN-01's field B (`rev-05:134`).
- So the agentic claim is **"consequential"** (part a) and **"style-fidelity meaningful"** (parts b and c). It is **never "meaningful to practitioners"**.
- **The human labels stay the only route to field A.** They cost 0 model calls and about 2.5 hours of rater time (`ops/notes/mean-01-codebook-and-sample.md:194`). The sample is drawn and frozen (`mean-01:152-156`). They come after the study (LAB, `ops/decisions.md:21`). **Proposed date: field A labels committed by 2026-11-30, before Ch. 7–9 are drafted.** If they are not in by then, the thesis says field A is unmeasured.

> AUTHOR: the date for field A labels. The thesis wording "consequential / style-fidelity meaningful" is fixed by this note, whatever the date.

## 1. Why this is needed

| Fact | Source |
|---|---|
| Every one of the 836 external blocking findings is correct under its spec | `mean-01:20`, `:101` |
| Correct is not meaningful; no meaning label exists | L183, N114 |
| Registered real-code precision 0.328 [0.132, 0.609] | N115 |
| 51 of 60 style-claiming human projects fail the verdict | N116 |
| Flagged edges survive a year about as long as unflagged ones (0.76 vs 0.75); fix commits use architecture words 5/14 vs 21/55 | N123 |
| Three criterion designs from developer behaviour (fix mining, known groups, declared refactors) are all null | N128 |
| The rival reading predicts the same nulls and is simpler: "the encoded standard isn't what practitioners mean by architecture"; only C3m can tell the readings apart | `ops/01-instrument-map.md:44` |

**Why the earlier evidence is weak.** N116, N123 and N128 are all **observational**. They ask whether humans act on findings. Humans may tolerate a cost for years. Small samples, project age and churn confound them. A null there says "humans did not act", not "nothing was at stake".

**What MEAN-02 changes.** Part (a) is an **intervention**. It holds the code fixed except for the violation, and measures what a standard change costs with and without it. That isolates the violation's effect.

**How it bears on the rival reading.**
- (a) positive, humans null: violations cost change effort, and humans tolerate the cost. That fits erosion, not the rival reading.
- (a) null as well: the encoded standard does not track change cost. The rival reading gains, and the thesis says so.
- Neither result speaks to field A. Only human labels do (§0).

## 2. Part (a): the consequence test

### 2.1 Design in one paragraph

For each sampled finding, take the project at its pinned commit. A **task bank** holds standard change tasks for that project, written before anyone knew which violation it holds. A **repair session**, blind to the task, writes a minimal **repaired twin** that removes the finding. A **placebo session** writes a **placebo twin**: a rewrite of similar size in the same files that keeps the finding. A **change agent** then performs the same task on the original, the repaired twin and the placebo twin, in fresh sessions. We compare what the change cost on each.

### 2.2 Sample

**Frame.** The 784 eligible external blocking findings (`mean-01:103`), **minus** the 60 MEAN-01 items and their siblings. The draw script reads the MEAN-01 sample file only to exclude ids. It prints counts, never ids, so the author's MEAN-01 blinding holds (`mean-01:199`).

**Eligibility** (zero calls, checked before the draw): the project clones at its pinned SHA; it installs; `tsc --noEmit` and its tests pass at baseline; the tests run in under 5 minutes (**proposed**). Projects that fail are counted and listed. This step is a build, so it runs only after the author's OK.

**Strata: rule family × edge kind (REV-05 item i).** Wiring is kept apart from real layering, because wiring findings are rule-correct but expected to carry no consequence (`ops/notes/g12-d2b-construct-limit.md:25`, `:31`; `rev-05:132`). A null there is informative, not a failure.

| Stratum | Rules | Edge kind | n (proposed) |
|---|---|---|---:|
| S1 direction, real | FF-S01, FF-S04, FF-P01, FF-P03, FF-DT04 | a real dependency of inner on outer code | 4 |
| S2 direction, wiring or type-only | same rules | the source is wiring code, or the import is type-only (G12; Q2) | 4 |
| S3 layer skip, real | FF-S03 | a real call that bypasses the middle layer | 4 |
| S4 layer skip, wiring | FF-S03 | composition code (G12) | 4 |
| S5 cycle | FF-S02 | crosses a named boundary vs inside one module, recorded as a covariate (MEAN-01 R4, `mean-01:51`) | 4 |
| S6 model boundary | FF-DS01, FF-DS02, FF-DT01, FF-DT02 | cross-context or into an aggregate's inside | 4 |
| **Total** | | | **24** |

Frame sizes by rule are in `mean-01:117-137` (before removing the MEAN-01 items). The edge kind is classified by a zero-call script from the spec's layer map and the G12 rule, and the classification is committed before the draw. At most 2 items per project, round-robin over projects, seed `20261019` (**proposed**). A stratum with fewer eligible items than its quota keeps what it has, and the shortfall is reported.

### 2.3 The task bank (REV-05 item f)

- **Who.** One session per project. It sees the project's code and spec. It does **not** see any finding, rule id or tool output.
- **What.** One standard change task per **family**, four per project, from fixed templates:

| Family | Template | Why it can reveal a cost |
|---|---|---|
| Swap | "Add a second implementation of `<a dependency named in the spec's outer layer>` and select it by configuration; behaviour is unchanged" | a direction violation names the concrete thing from inside |
| Rule | "Add a business rule to `<an operation>` that must hold on every entry path" | a skip path bypasses the layer where the rule belongs |
| Extract | "Move `<a module>` into its own folder with an index exporting its public API" | a cycle drags its partner along |
| Evolve | "Change the representation of `<a field of a domain concept>` in its owning module" | a cross-context or cross-aggregate import spreads the change |

- **Acceptance check.** Each task comes with a hidden behavioural test (public API or use-case output, not structure), written by the same session. It must fail on the original before the agent starts.
- **Selection.** For a sampled finding in family F, the task used is that project's F task, whatever it touches. Nobody picks a task to fit the flagged edge. Whether the task's target meets the flagged edge's components is computed afterwards, as a covariate.
- **Freeze.** The bank is committed and hashed before the draw of §2.2.

### 2.4 The twins (REV-05 item g)

**Repaired twin.** A session that sees the finding, the rule's plain text and its source row (§4), but **not the task bank**. It writes the smallest change that removes the finding. The twin is valid only if all of these hold (zero calls to check):
1. C3 rerun: the finding's identity (L6) is gone, and no new blocking identity appears.
2. `tsc --noEmit` and the existing tests pass, as at baseline.
3. The public API is unchanged (exported symbols of the project's entry points).
4. The diff is at most 150 changed lines (**proposed**).
5. No added comment mentions layers, rules, violations or ADRs (a scrub check).

An invalid twin gets one retry. A second failure drops the item, and the drop is counted.

**Placebo twin.** A separate session, also blind to the task, rewrites the same files by about the same diff size (± 30 %, **proposed**), behaviour-preserving, and must **keep** the finding (identity still present, no new blocking identity). This controls for "any model rewrite makes code easier for an agent".

**Presentation.** Each version is a fresh `git init` with one commit and the same repo name, so history does not reveal the repair.

### 2.5 The change agent and the vendor rule (REV-05 item h)

- The agent gets the task text and the repository. It has no DaedalusArch tool and no MCP server, and it is told nothing about architecture or twins.
- **Vendor rule.** The agent's vendor differs from the vendor that wrote that item's twins. External code is human-written, so the twin writer is the generator to avoid. Items alternate in seeded order: half get Claude-written twins and a Gemini agent, half the reverse. **Both directions are reported separately**, as well as pooled.
- When the procedure is later run on Study 2 snapshots, the rule is the generator's vendor: Gemini changes Sonnet code, and the reverse (`rev-05:130-131`).
- Models: Claude Sonnet (Study 2 generator), Gemini through the coding adapter (GEN, `ops/decisions.md:19`). If the Gemini coding adapter is not live, only the Gemini-twin → Claude-agent direction runs, and the claim is labelled one-directional.
- Two agent runs per version, so 6 agent sessions per item. Caps per session: 40 turns, 900 s (**proposed**; eff-01 used 30 turns and 600 s, `ops/notes/eff-01-efficiency-design.md:146-147`).

### 2.6 Measures

From `git diff` at session end, the stream-json transcript (the eff-01 transcript reader, `scripts/v1.3/lib/eff01/transcript.ts`), and one C3 rerun.

| # | Measure | Role |
|---|---|---|
| M1 | **Ripple:** distinct spec components (layers or contexts) touched, minus 1 | **primary (proposed)**: the rules are about component dependencies |
| M2 | Files touched (the acceptance test excluded) | secondary |
| M3 | Lines changed | secondary |
| M4 | Test breaks: existing tests failing at the end; failing test runs during the session | secondary |
| M5 | Type-check failures: failing `tsc` runs during the session, and at the end | secondary |
| M6 | Turns and processed tokens | secondary |
| M7 | Success: the acceptance test and the existing tests pass | secondary |
| M8 | New blocking identities the agent introduced | secondary; the link to Study 2's drift D |

### 2.7 Analysis

- Per item and version, average the two runs.
- **Primary test:** Wilcoxon signed-rank on the paired difference original − repaired in M1, one-sided, α = 0.05, on the **non-wiring strata (S1, S3, S5, S6; n = 16)**. Effect: Hodges–Lehmann estimate with a project-cluster bootstrap 95 % interval (10,000 resamples, seed `20261019`).
- **Placebo control:** the same test on placebo − repaired. The removal effect is claimed only if original − repaired is positive **and** placebo − repaired is positive too (the finding still costs after a rewrite).
- **Wiring strata (S2, S4):** the same statistics, reported separately. The expectation is no effect.
- **Secondary measures:** Holm-adjusted. Success (M7) by McNemar on original vs repaired.
- **Per stratum and per vendor direction:** descriptive, n = 4 per stratum.
- **Power, rough:** with 16 pairs, a sign test needs 12 of 16 in the expected direction for one-sided p < 0.05 (binomial: P(X ≥ 12) ≈ 0.038). A smaller effect will not show. This is a pilot-scale study, and it is described that way.

### 2.8 Falsifier: "violations do not make change harder"

The claim "blocking violations make change harder for a coding agent" is **refuted** on this sample if any of these holds (all **proposed**):
1. On the non-wiring strata, the Hodges–Lehmann estimate of original − repaired ripple is ≤ 0.
2. The placebo twin lowers ripple as much as the repaired twin (the effect comes from rewriting, not from the removal).
3. The wiring strata show the same effect as the real strata (then the measure tracks rewriting or size, not the construct).

A refuted claim is reported as it came out, and C3m stays "characterised".

## 3. Part (b): the cross-vendor panel

**Reuse.** The v1.3 model panel (`Docs/v1.3/model-panel.md`; `scripts/v1.3/lib/panel/`). It is built and dry-run with fake raters only (L82). Its authority rule `panel-authority-v1` (`model-panel.md:80-119`) stays as written: decoys ≥ 20, rater qualification on decoys, ≥ 2 qualified vendors, Fleiss' κ ≥ 0.60 for an authoritative verdict.

**The question is field B, not field A (§0).** "Does this break a principle that the style's literature states?" The prompt carries the style's source row (§4) as the style text. A dated amendment in `model-panel.md` §10 records the change, before any vote.

**Items.**
- the 60 MEAN-01 items, taken from the rater packet as the rater sees them (no rule id, `mean-01:173`), so human labels can calibrate the panel later (§5);
- the 24 originals of part (a);
- at least 30 decoys (≥ 15 known-correct, ≥ 15 known-wrong) from the development fixtures, never from a target case (`model-panel.md:29`; the default mix is 15 + 15, `:31`).

**Blind, with reasons.** Opaque ids, seeded order, no tool verdict. Each answer must give a one-line reason and one MEAN-01 reason code when it says `no` (`T`, `W`, `F`, `M`, `C`, `X`; `mean-01:54-63`). A schema change, recorded in the same amendment.

**Vendors.** Anthropic (`claude-cli`) and Google (`gemini-api`, or agy). OpenAI only once Codex is back, about Nov 9 (`ops/01-instrument-map.md:214`), as a registered extension. With two vendors, an authoritative label needs both to agree (R3). **Vendor different from the generator:** external items are human-written, so both vendors rate them. On part (a) twins and on Study 2 code, the rater from the other vendor leads, and the leave-one-vendor-out replay is reported (`model-panel.md` §6).

**Statistics.** Inter-model Cohen's κ and Fleiss' κ, Gwet's AC1 (κ is unstable when one answer dominates, N84), Krippendorff's α; the style-fidelity rate per stratum with Wilson intervals; reason codes by stratum.

**Withholding.** Panel labels on the 60 MEAN-01 items are written to `results/v1.4-mean02/panel-mean01/` and **withheld** from the author until the author's and the rater's answer files are committed (`mean-01:198-201`). Their sha256 is recorded when they are written.

**Bar (proposed).** The panel verdict is `authoritative` under R0–R4. The thesis then reports the style-fidelity rate per stratum. Below R4 it is `descriptive-only`, as the rule says.

**Circularity.** Models share training data. Agreement between vendors shows consensus, not truth (L82). BF-01 showed that trap: Gemini reproduced Claude's reference spec exactly (`ops/notes/ns-03-graph-complements-reading.md`, "Afternoon 2026-10-19"). The panel therefore never stands alone. Part (a) is the behavioural check on it.

## 4. Part (c): rule-source grounding, per rule

Zero calls. One table, one row per blocking rule in the external set and the Study 2 styles:

| Column | Content |
|---|---|
| Rule, style | e.g. FF-S03, Layered |
| Source row | `Docs/v1.3/style-rule-sources.md` (sealed; hash in `Docs/v1.3/sealed-hashes.md:9`), the supplement, or the errata |
| Locator | chapter, section or page |
| Read how | read directly, or *recalled* (the books by Martin, Fowler, POSA, Evans and Vernon were not accessible, `Docs/v1.3/style-rule-sources-supplement.md:15`) |
| Fit | the rule's Cypher encodes the constraint **exactly**, **narrower**, **broader**, or the rule is **repository convention** with no source |
| Note | e.g. FF-S03: strict no-skip is only POSA's strict variant (`style-rule-sources-errata.md:9`); FF-S04: Cockburn states no explicit source-dependency rule (`style-rule-sources-errata.md:10`) |

**Bar (proposed).** Every blocking rule has a row. "Recalled" rows are listed as limits. Findings of rules marked "convention" or "broader" are reported apart, and they never count toward the "style-fidelity meaningful" figure. This is the same principle as U6: construct answers follow from the style's sources (`ops/decisions.md:23`).

## 5. How human labels calibrate (b) later

When the MEAN-01 labels exist (author and rater, κ as `mean-01` §4):
- **Field B:** panel vs human on the 60 items: κ, AC1, sensitivity and specificity, by stratum and reason code. This is a direct calibration, because both answer the same question.
- **Field A:** panel field B vs human field A: the A × B table (`mean-01` §9.3). This shows how far "style-fidelity meaningful" is from "meaningful to practitioners". It is the only field A evidence in the thesis.
- **They never gate the claim** (§0). A caveat line is written now, to be used if panel–human field B agreement is below κ 0.40 (**proposed**): "the model panel's reading of style fidelity diverges from the human raters'; the panel figures are reported as model judgement only."

## 6. Call count and cap

**Method.** As `--estimate` for the ontology runner: an upper bound from the design, printed by a dry-run driver before any record run. Sessions are CLI sessions (as eff-01 counts them, `eff-01:169-175`); panel calls are single calls.

**Part (a), per item:** repair 1 (+ 1 retry), placebo 1 (+ 1 retry), agent 3 versions × 2 runs = 6. Plus one bank session per project.

| Run | Items | Projects | Expected sessions | Upper bound | **Cap (proposed)** |
|---|---:|---:|---:|---:|---:|
| Pilot (2 items, strata S1 and S3) | 2 | 2 | 2 + 2 × 8 = 18 | 2 + 2 × 10 = 22 | **22** |
| Main | 24 | ≤ 24 (≥ 12 with the 2-per-project cap) | ≤ 24 + 24 × 8 = 216 | 24 + 24 × 10 = 264 | **264**, each session capped at 40 turns |

**Part (b), per vendor:** 114 items (60 + 24 + 30 decoys) × 2 runs = **228 expected**. The panel's worst case is 8 per item (re-ask and retry per run, `model-panel.md` §8), so **912**. **Cap: 300 per vendor, 600 for both (proposed).**

**Part (c):** 0.

The pilot comes first, as a 2-case pilot. Nothing beyond it runs before the author has seen it.

## 7. Circularity, in one place

| Risk | Guard |
|---|---|
| The task is chosen to exercise the flagged edge | task bank before the violation is known (§2.3); task selected by family, not by edge |
| The twin is tailored to the task | repair and placebo sessions are blind to the bank (§2.4) |
| Any model rewrite makes code easier | the placebo twin (§2.4) |
| Same family writes the twin and changes it | the vendor rule, both directions reported (§2.5) |
| The construct counts wiring | edge-kind strata; wiring is analysed apart (§2.2) |
| The rule defines both the violation and the repair | the outcome is change cost, measured by diff and transcript, never by the rule |
| Agents are not developers | the claim is about change cost for a coding agent, which is Study 2's setting; it is not a claim about humans |
| Models agree because they share priors | the panel never stands alone; (a) is behavioural (§3) |
| Public repos, models may have seen them | stated as a threat (`ops/01-instrument-map.md:216`) |

## 8. What it gives

| Target | What MEAN-02 adds |
|---|---|
| **C3m** | The first evidence on meaning that does not wait on a human rater: consequence (a) and style fidelity (b, c). Field A stays with the human labels (§0) |
| **SO4 validity** | A new criterion design that is **interventional**, after three null observational ones (N128); plus content grounding per rule (c) |
| **SO3** | Model-judged dimensions measured as a cross-vendor panel with decoys, not by one model |
| **Study 2** | If (a) is positive in a stratum, D in that stratum can be read as change cost, not only as rule hits. If wiring shows no effect, it supports reporting D by edge kind (G12) |
| **The rival reading** | (a) is the test that can tell erosion from "the standard isn't what matters" (§1) |

## 9. Code still needed (none of it written by this note)

| # | Item | Reuse |
|---|---|---|
| 1 | Eligibility and edge-kind classifier; the draw (excludes MEAN-01 ids without printing them) | `scripts/v1.3/meaning/mean01.py` (mulberry32 stream), G12 rule |
| 2 | Task-bank, repair and placebo session drivers, with the validity checks of §2.4 | `scripts/v1.3/lib/eff01/` (sessions, caps, transcripts), `scripts/lib/generators/` (Gemini adapter, retry) |
| 3 | Change-agent driver and the measures of §2.6 | `scripts/v1.3/lib/eff01/transcript.ts`, C3 rerun, the L6 identity module |
| 4 | Panel amendment: field B prompt, reason codes, withheld output | `scripts/v1.3/lib/panel/` |
| 5 | Rule-source grounding table | the three source files (§4) |
| 6 | Analysis script, tested on simulated data, hash recorded before the pilot | `scripts/v1.3/lib/meaning/bootstrap.ts`, `agreement.ts` |

## Changelog
- 2026-10-19: first version, with REV-05 items (f) to (j).
