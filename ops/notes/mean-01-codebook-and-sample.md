# MEAN-01: codebook, κ definition and stratified sample for the meaning labels (C3m)

**Draft, 2026-10-18. Nothing has been labelled. Zero model calls, zero API calls, no Neo4j.** This note covers sprint lane D (`ops/03-sprint-plan.md`, row D; part C3m in `ops/01-instrument-map.md:178`). It asks one question: is a correct blocking finding architecturally meaningful? It becomes binding on the day the author signs §12, and that date must come **before the first label** (gate V6). Comments go in `> AUTHOR:` lines. `Nxx`/`Lxx` ids are from `Docs/v1.3/compendium/nulls-and-limits.md`.

**Files.**

| What | Path | Who may open it |
|---|---|---|
| This note (codebook, κ, plan) | `ops/notes/mean-01-codebook-and-sample.md` | author, director. **Not the rater** until labels are in (§5 has worked answers, §6 has strata) |
| Rater packet, 60 items | `audit/view/mean-01-rater-packet.md` | rater and author |
| Calibration sheet, 5 items | `audit/view/mean-01-calibration.md` | rater and author |
| Blank answer sheet | `audit/view/mean-01-answers.csv` | rater and author (one copy each) |
| Sample = key (rule ids, strata, weights) | `results/v1.3-meaning/mean-01-sample.csv`, `.json` | author **after** answering; never the rater |
| Draw and packet script | `scripts/v1.3/meaning/mean01.py` (+ `packet-head.md`, the rater-facing text) | anyone |

---

## 1. What this closes, and what it does not

- **C3m** has 0 labels (N114). The only real-code precision figure is 0.328 [0.132, 0.609] (N115). 51 of 60 human style-claiming repos fail (N116). Every one of the 836 external blocking findings is **correct** under its spec (1.000 [0.995, 1.000], `Docs/DiagnosticRuns/v1.3-external-set-3-2026-10-16.md` §4). Correct is not meaningful (L183). This study measures the step from one to the other.
- **The rival reading** (`ops/01-instrument-map.md:44`) is "the encoded standard isn't what practitioners mean by architecture". Only these labels can tell it apart from erosion. That is why the codebook keeps two fields: practice (A) and literature (B). The A×B table (§9.3) is the evidence.
- **V6** (one κ definition, dated before any label) is closed by §4 once it is signed and the three older documents point to it (§12).
- **V5** is closed **only in part**: V5 is written for the hold-out labelling and for a rater who meets `human-labelling-protocol.md` §5 (§10, blocker B2).

## 2. L4: the definition of "meaningful" (one-line switch)

Both fields are collected on every item, whatever L4 says. L4 only picks which field is the **primary** one: the field the κ gate (§4) and the headline "meaningful precision" (§9.2) are computed on. The other field is reported beside it, with the same statistics, and it is not gated.

```
L4_PRIMARY = A_practitioner        # L4 = A (recommended). For L4 = B, change this line to: L4_PRIMARY = B_style_fidelity
```

> AUTHOR: L4 = A or B, plus date. This line, and nothing else, changes between the two.

## 3. Codebook

The rater-facing wording is `scripts/v1.3/meaning/packet-head.md`, which is copied into the packet as §0–§4. Below is the definition as it governs the analysis. If the two ever differ, the packet text is what the raters read, so it wins for interpretation, and the difference is logged as an erratum.

**The unit.** One blocking finding from the external set: an import edge, a cycle, or a class declaration, already confirmed *correct* by the deterministic checker. Raters judge whether it matters, never whether it is true.

**Field A, practitioner.** *Would a competent developer who works in this style ask for this to be changed in a code review?* The rater pictures a pull request that adds exactly this edge to this repository and reviews it as an experienced practitioner of the claimed style. `yes` = would ask for a change. `no` = would approve it, even with a passing remark.

**Field B, style fidelity.** *Does it break a principle that the style's literature states, not only this repository's folder convention?* The sources are the style rows of `Docs/v1.3/style-rule-sources.md`, summarised in packet §4 (the same summary as `human-labelling-protocol.md` Appendix A, plus one line on the Clean `main` component and the DDD shared kernel).

**Values (both fields):** `yes`, `no`, `unsure`. Use `unsure` only when the excerpt and the linked file do not let you decide, or when the sources are genuinely split. Add a one-line note.

**Readings fixed by this codebook.** R1 and R2 are the protocol's P1 and P2. R3–R5 are new, and need the author's sign-off:
- **R1:** where a style's sources are silent, the constraint does not apply in that style (B = `no`).
- **R2:** judge the claim as stated.
- **R3:** test, mock and fixture code gets B = `no`. A is answered as a reviewer would.
- **R4:** a cycle gets B = `yes` only when it crosses a boundary the style names (two layers, modules or contexts). A cycle inside one layer and one module gets B = `no`, because the acyclic-dependencies principle is stated for components. This settles open question Q3 for field B only. **It needs sign-off.** If it is rejected, C4's worked answer becomes B = `yes`.
- **R5:** read the file for its real role. If the layer map is wrong for the file, answer B for the real role and use code `M`.

**Reason codes**, one per item, given when A or B is `no`:

| Code | Meaning |
|---|---|
| `T` | test, mock or fixture code |
| `W` | wiring: composition root, DI container, module registration |
| `F` | an accepted framework idiom in the style (ORM decorators, `@Injectable`/`@Inject`, Nest modules, validation decorators) |
| `M` | mapping artefact: the file's real role does not fit its mapped layer or context |
| `C` | harmless cycle: a barrel, type-only, an ORM two-way relation, or inside one layer and one module |
| `X` | other, with a note |

## 4. The κ definition (V6)

> **Dated on sign-off: `____-__-__` (must precede the first label commit).**

1. **Statistic.** Cohen's κ, unweighted, between two raters: the independent rater (R) and the author (Au).
2. **Categories.** The primary field (§2) collapsed to **binary: `yes` vs not-`yes`**. `no` and `unsure` both count as not-`yes`.
3. **Unit.** One sampled finding (item). n = 60, from the stratified sample of §6. The 5 calibration items never count. Raters and items are not pooled across any other study.
4. **"Unsure."** It counts as not-`yes` in the gated statistic. Each rater's `unsure` rate is reported. A rate above 15% is flagged as a codebook problem, and the gate result is still reported as it is. Sensitivity analysis: κ on the items where neither rater said `unsure` (descriptive).
5. **Missing answers.** An item missing either rater's primary answer is dropped and listed. If more than 6 items are dropped (n < 54), the result is reported as "incomplete, below protocol".
6. **Gate.** **Pass if the κ point estimate ≥ 0.60.** This is the point-estimate rule of `human-labelling-protocol.md` §3, since at n = 60 the lower bound cannot clear 0.60 even at κ ≈ 0.73 (L128).
7. **Interval reported, not gated.** 95% percentile bootstrap over items: 10,000 resamples, seed 20261018. Sensitivity: a project-cluster bootstrap (resample projects within strata).
8. **Reported alongside:** the 2×2 table; observed agreement with its Wilson 95% interval; Gwet's AC1 (binary); the prevalence and bias indices; the 3×3 table with three-way κ (descriptive). If κ < 0.60 while AC1 ≥ 0.60 and prevalence is extreme, both are reported and **the gate stays failed**.
9. **The secondary field** (whichever L4 does not pick) gets the same statistics. It is not gated.
10. **No second chance.** If the gate fails, the result is reported. No resample, no re-label and no recoding after the labels are seen (as in `human-labelling-protocol.md` §6).

## 5. Calibration: 5 items with worked answers (not in the sample)

These were chosen by hand to cover both fields and three of the six codes (`M`, `C`, `F`), plus the `W` trap in C1. They and their **siblings** (any finding in the same project with the same target, or sharing a file) are removed from the sampling frame, so the calibration discussion cannot settle a sampled item (§6). The rater sees them in `audit/view/mean-01-calibration.md`.

| # | Repo, style | Finding | A | B | Code | Why |
|---|---|---|---|---|---|---|
| C1 | dlydiard-ddd-cqrs-es, DDD | `iam/user/services/user.service.ts` (application) imports `event-store/publisher/dynamo-event-publisher.ts` (infrastructure), line 8 | **yes** | **yes** | – | The service names the concrete DynamoDB publisher. It does so only as the inversify token (`@inject(DynamoEventPublisher)`) and types the field against `EventPublisher`, but naming the adapter is the coupling. A reviewer would ask for a symbol token bound in the container. B: the application layer must not depend on an infrastructure implementation (Evans, layered architecture; dependency inversion). **Trap:** this is not `W`. Wiring belongs in the container, not in the service. |
| C2 | ddd-forum, DDD | `forum/domain/member.ts` imports `users/domain/userId.ts`, line 5 | **yes** | **yes** | – | The forum's Member aggregate is built from the users context's domain value objects, with no declared shared kernel. A DDD reviewer would ask for the forum's own identity type or an explicit shared kernel. B: contexts integrate through explicit relationships (shared kernel, ACL, published language; Evans part IV). **Lesson:** a famous repository, or a deliberate design, does not make it `no`. |
| C3 | pallavi-twitter-backend, Layered | `controllers/access/login.controller.ts` ("business") imports `middlewares/asyncHandler.ts` ("presentation"), line 7 | **no** | **no** | `M` | The "controllers" are Express request handlers (they take `req`, `res`), so they are presentation. The map put them in business because the README says "Router, Controller and Model". Read for its real role, this import stays inside presentation. **Lesson:** R5. 22 of this repo's 24 findings are this one mapping judgement. |
| C4 | q00-api-server, Layered | cycle `model/ExampleBoardComments.ts` → `model/ExampleBoards.ts` → back | **no** | **no** (R4) | `C` | A two-way TypeORM relation needs each entity to name the other, and reviewers accept it. Both files are in `model/`, one layer and one module, so R4 gives B = `no`. **If R4 is rejected, B = `yes`.** This item is the test of R4 in the discussion. |
| C5 | finance-project-ddd, DDD | domain service imports `Inject` from `@nestjs/common`, line 1 | **no** | **yes** | `F` (for A) | B: the domain must be free of frameworks (Evans, Vernon), so `yes`. A: decorators used only for constructor injection in a domain service are an accepted NestJS idiom, and most reviewers would not block them. **Where the line is:** decorators only means A = `no`; domain logic that calls Nest APIs means A = `yes`. A strict reviewer who answers `yes` is not wrong. Discuss it, but do not move the line afterwards. **Also:** line 4 imports an infrastructure interface. By R2 it does not count here. |

The spread is A: 2 `yes` / 3 `no`, and B: 3 `yes` / 2 `no`. **C5 is the case where A and B diverge**, and it is the one to spend time on.

**Calibration procedure** (as in `human-labelling-protocol.md` §5):
1. Each person answers alone (about 15 minutes).
2. Open this table together and discuss (about 20 minutes).
3. If the discussion exposes a codebook gap, add a dated note to §3 **before** the 60 items start, and never after.

## 6. The stratified sample

**Population.** All **836** blocking findings on the 60 human-written, pre-2023 external projects (waves 1–3). They come from the `labelling-sheet.csv` files of `results/v1.3-external{,-2,-3}/`, where `tier = blocking`, and they sit in 51 projects (9 projects pass). Every one is confirmed `correct` by the checker. The script asserts this on load, joining each finding to `results/v1.3-external-correctness/blocking` (wave 1) and `results/v1.3-external-3/correctness{-wave2,}/blocking`.

**Frame.** 836 minus the 5 calibration items and their 47 siblings = **784**.

**Strata.** Rule id, with the two rules that span styles (FF-S01 and FF-S02) split by style. That gives 18 strata.
- **Quotas** were fixed before the draw by a compromise between proportional and equal allocation: roughly √N, a floor of 1–2 for tiny strata, and the S01/S02 quotas spread over styles.
- The sum is **60**.

**Spread by repository.**
- At most **2 items per project within a stratum**, and **4 per project overall**.
- At most **one item per edge** (file, line, target). The same import can trip two rules, for example FF-S01 and FF-S03.
- Within a stratum the draw is **round-robin over projects** in seeded order: one finding from each project, then a second, until the quota is filled.
- Strata are processed from smallest to largest, so the per-project cap cannot starve a small stratum.

**Seed.** `20261018`, with one `mulberry32` stream. It is the same generator as `scripts/v1.3/lib/graph-fidelity.ts`, and its first three outputs were checked to match the TypeScript implementation exactly. The stream shuffles the projects in each stratum, then each project's findings (sorted by `findingId` first), and finally the presentation order M01–M60.

| Stratum | N_h (frame) | n_h | weight N_h/n_h | projects in sample |
|---|---:|---:|---:|---:|
| `FF-S02/nestjs` | 171 | 5 | 34.2 | 5 |
| `FF-S01/ddd` | 114 | 4 | 28.5 | 4 |
| `FF-DS02` (context isolation) | 71 | 6 | 11.8 | 5 |
| `FF-S01/nestjs` | 56 | 2 | 28.0 | 2 |
| `FF-S01/clean-architecture` | 56 | 3 | 18.7 | 3 |
| `FF-P01` (domain purity) | 50 | 5 | 10.0 | 5 |
| `FF-S03` (layer skip, layered) | 50 | 6 | 8.3 | 6 |
| `FF-S01/hexagonal` | 44 | 2 | 22.0 | 2 |
| `FF-S02/layered` | 33 | 2 | 16.5 | 2 |
| `FF-P03` (repository / port-adapter) | 28 | 4 | 7.0 | 4 |
| `FF-DT01` (aggregate boundary) | 25 | 4 | 6.2 | 3 |
| `FF-S04` (domain outward / core isolation) | 22 | 4 | 5.5 | 4 |
| `FF-S02/clean-architecture` | 16 | 2 | 8.0 | 2 |
| `FF-S02/hexagonal` | 16 | 2 | 8.0 | 2 |
| `FF-DT04` (DDD domain purity) | 14 | 4 | 3.5 | 3 |
| `FF-S01/layered` | 10 | 2 | 5.0 | 2 |
| `FF-DT02` (repository per aggregate) | 6 | 2 | 3.0 | 1 |
| `FF-DS01` (bounded-context modules) | 2 | 1 | 2.0 | 1 |
| **Total** | **784** | **60** | | **38 of 51** |

**What the sample looks like by rule id:**
- FF-S01 13, FF-S02 11, FF-DS02 6, FF-S03 6, FF-P01 5;
- FF-P03, FF-DT01, FF-S04 and FF-DT04 4 each;
- FF-DT02 2, FF-DS01 1.

**By style** (the style the repository claims): DDD 21, Layered 12, NestJS 12, Hexagonal 9, Clean 6.

**By wave:** wave 1 19, wave 2 18, wave 3 23.

**By project:** 38 projects. 22 contribute 1 item, 12 contribute 2, 2 contribute 3 and 2 contribute 4.

**Flags recorded for analysis:** 4 items are in test, mock or fixture paths, and 4 are cycles through an `index.ts` barrel.

**The draw is deterministic.**
- Two runs gave a byte-identical CSV, with sha256 prefix `d4697ec5377d6fdc`.
- The script's sha256 prefix is `0486343f0feee4b0` and the packet head's is `7aa5a5cf8c5b4f68`.
- Record the full hashes at sign-off (`shasum -a 256`).
- Any change to the calibration list, the quotas or the caps changes the whole draw. **After sign-off, the sample is frozen.**

**Reproduce** (from the repo root):

```bash
python3 -I scripts/v1.3/meaning/mean01.py draw                   # sample CSV + JSON (offline)
python3 -I scripts/v1.3/meaning/mean01.py fetch --cache <dir>    # pinned source files, HTTP GET from raw.githubusercontent.com
python3 -I scripts/v1.3/meaning/mean01.py packet --cache <dir>   # packet, calibration sheet, blank answers
```

`fetch` is the only networked step, and it is a plain download of public files at the pinned SHAs (one file per sampled finding, every file of a cycle; 84 files for the current sample and calibration). Without the cache, the packet shows the checker's import evidence instead of an excerpt.

## 7. The rater packet: what the rater sees, and the time it takes

**Per item** (`audit/view/mean-01-rater-packet.md`):
- the style the repository claims;
- the repository and its pinned SHA;
- the rule in plain words, with **no rule id, template name or tool verdict** (checked: no `FF-` string in either packet file);
- the edge: source file and its mapped layer or context, then the target file or package and its layer, with the line. For a cycle, the chain of files. For a class rule, the class;
- an excerpt of the pinned file, 6 lines either side, with `>>` on the flagged line. For a cycle, each step's import with 1 line either side;
- a permalink to the full file;
- the answer box: A, B, reason code, note.

**At the end of the packet:**
- §L, the layer map of each of the 38 repositories (layer, kind, globs), so the rater can judge `M`;
- a licence line.

**At the start of the packet:** the instructions (§0–§4), a Spanish summary, the style summaries and the readings R1–R5.

**Time** (estimate; not yet measured on a person):

| Step | Minutes |
|---|---:|
| Read packet §0–§4 | 10 |
| Calibration, 5 items alone | 15 |
| Calibration discussion with the author | 20 |
| 60 items at about 90 s each (cycles and DDD longer, import-direction items shorter) | 90 |
| Break after M30 | 10 |
| **Total** | **about 2 h 25 min** (range 2–2.5 h) |

The labels can be done in **one sitting, or in two sittings on Wed and Thu**: calibration plus M01–M30, then M31–M60. Two sittings must be recorded, because they can introduce drift. This leaves at most about 30 minutes of the rater's 2–3 h for the K3 / K-level work (X2, `ops/02-defensibility-conditions.md:150`). **See blocker B3.**

**The author** labels the same 60 items from the same packet, alone, before seeing the rater's sheet.
- The author must not open the sample CSV or §6's item list. The note shows only stratum totals.
- Answers go in `results/v1.3-meaning/labels/answers-author.csv` and `answers-rater.csv`, copied from `audit/view/mean-01-answers.csv`.
- **The author's file is committed, and its sha256 noted, before the rater's file is opened.**

## 8. Who is the reference

As `human-labelling-protocol.md` §4 sets it:
- **The rater's labels are the human reference** for every precision figure.
- The author is the second rater and enters only the agreement pairs.
- Disagreements are not adjudicated, and the author never resolves one.

## 9. Analysis plan (fixed with this note)

An analysis script is still to be written. It will be tested on simulated answer sheets before any real label exists, and its hash recorded. Every figure below comes from the two answer CSVs plus `mean-01-sample.csv`.

### 9.1 Agreement

As §4, on the primary field. Then the same statistics on the secondary field, then on each field split by style (counts only).

### 9.2 Meaningful precision (headline)

**Definition.** The share of correct external blocking findings whose primary field is `yes`, from **the rater's** labels.

**Estimator.** The stratified estimate p̂ = Σ_h (N_h / 784) · p̂_h, where p̂_h is the yes-share in stratum h.
- **95% interval:** a stratified cluster bootstrap that resamples projects with replacement within each stratum, 10,000 resamples, seed 20261018, percentile interval.
- **Also given, descriptive:** the unweighted share of the 60 with its Wilson interval.
- The weights vary from 2 to 34, so the Kish effective n is about **39**. The expected half-width is about ±0.14–0.16 weighted and about ±0.12 unweighted.

**Sensitivity analyses** (each reported, none replacing the headline):
- the author's labels;
- yes by both raters;
- `unsure` items dropped;
- the 4 test, mock and fixture items dropped;
- items the rater coded `M` dropped, which shows how much of the result is the study's own mapping.

**Per rule:**
- the two rule ids with n ≥ 10 get a share with a Wilson interval: FF-S01 (13) and FF-S02 (11);
- all other rules get counts only (yes / no / unsure), as `human-labelling-protocol.md` §3 says.

Per style: counts only.

### 9.3 The A × B table

A 3×3 cross-table of the rater's A and B over the 60 items.

**Reading fixed now:**
- many items with **B = yes but A = no** means the rules encode the literature but not practice;
- many items with **A = yes but B = no** means practitioners object to more than the literature states.

This table is what tells the rival reading of N116/N128 apart from erosion.

### 9.4 Why not

The distribution of codes T/W/F/M/C/X among the `no` answers, for each rule and pooled.

### 9.5 Reading guide

Fixed before any label, for the primary field and the stratified p̂:

| Result | How it is read |
|---|---|
| p̂ ≥ 0.75 and lower bound ≥ 0.50 | blocking findings on human code mostly mark a change a practitioner would ask for |
| p̂ ≤ 0.50 | the rival reading is supported: most blocking findings are not what practitioners mean by architecture. Then N116 (51/60 fail) is read as rule strictness, not erosion, in proportion to the M/W/F/C codes |
| between the two | mixed; report it as such, per rule |

### 9.6 Not done

- no adjudication;
- no re-draw to reach a gate;
- no dropping or recoding items after the labels are seen;
- no reweighting other than §9.2.

### 9.7 If no rater shows up

- C3m is reported as **unlabelled**, as a stated limit, with this codebook and the sample published (sprint plan fallback, `ops/03-sprint-plan.md:47`).
- The author's own 60 labels may be reported as **single-rater, descriptive**, never as validated.

## 10. Pre-mortem: it is November and MEAN-01 failed. Why?

| # | How it failed | Likelihood | Guard now |
|---|---|---|---|
| 1 | **No rater, or a rater who stops partway.** | med | Book the rater Mon (sprint plan). Two sittings allowed. Fallback §9.7. M01–M30 alone still gives n = 30, reported as incomplete |
| 2 | **The rater does not meet V5's qualification** (professional TS developer with production code in 2 of 5 styles; signed conflict declaration). | high for "a classmate" | Decide now: either the classmate qualifies, or a written deviation names the profile. The declaration's sha256 goes in the repo and the document stays out of it (V5 Verify). Blocker B2 |
| 3 | **L4 or R3–R5 decided after a peek at the labels.** | low, fatal | §12 sign-off with date before the first label commit. The packet is regenerated only before sign-off |
| 4 | **κ fails from prevalence, not disagreement.** For example, both raters say `no` to 85% of items, so κ collapses while agreement is 0.9. | med | AC1 and the prevalence index are reported (§4.8). The gate stays on κ, as written |
| 5 | **The author is not blind.** The author built the rules and has seen many of these findings in the run reports, so the author's labels lean towards "yes". | high | The author never adjudicates, and the rater is the reference (§8). The author's labels are committed before the rater's are opened. Report the author–rater **bias index** |
| 6 | **The rater finds the key.** The repo is public, and `results/v1.3-meaning/mean-01-sample.csv` names the rules. | low | Send the packet as standalone files, not a repo link. The instruction not to look things up is in packet §0. Ask in the debrief whether the rater looked |
| 7 | **Excerpts are too short to judge, so `unsure` inflates.** | med | Permalinks to the full file; layer maps in §L. The 15% flag (§4.4) is diagnostic. The calibration discussion checks that the format works |
| 8 | **The plain-words rule ("must…") primes `yes`.** | med | The rule is stated as the style's principle, not as a verdict. Field A asks about review behaviour. The A×B table shows priming as many B = yes. Accepted as a residual |
| 9 | **Asking A before B anchors B on A** (or the reverse). | med | The order is fixed (A, then B) and recorded. Not randomised, to keep the sheet simple. Reported as a limit |
| 10 | **Clustering hides in the pooled figure.** bank-server and ddd-forum dominate some strata. | med | Per-project caps (2 per stratum, 4 overall). A cluster bootstrap for both p̂ and κ. Per-project counts published |
| 11 | **The calibration discussion settles sampled items.** | low | Calibration siblings are removed from the frame (§5). The rule "the discussion settles the codebook, not answers" is stated in both files |
| 12 | **The spec-mapping effect is mistaken for a meaning result.** For example, the 22 pallavi rows of one mapping judgement. | med | Code `M`, plus the sensitivity analysis without `M` items (§9.2). The specs' single-author limit (κ 0.21 between two spec-writing sessions, N02) is reported beside the result |
| 13 | **The rater's time is eaten by the K3 / K-level jobs, so labels are rushed.** | med | MEAN-01 first, K-levels after (X2 order). The time per item is recorded if the rater agrees |
| 14 | **R4 (cycles) is contested afterwards.** | med | Signed with the codebook. C4 tests it in calibration. The S02 items' B answers can be reported with and without R4, because the rater's note on each cycle is kept |

## 11. Blockers

- **B1. L4 is open.** Without it, §2's line has no value. The sample, the packet and the calibration do not depend on L4. The κ gate and the headline do.
- **B2. The rater's qualification and V5's scope.** V5 asks for hold-out labelling by a qualified rater. These are external-set meaning labels, possibly by a classmate. A written deviation (or V5 amendment) is needed to say what these labels close.
- **B3. Rater time.** About 2 h 25 min for MEAN-01 leaves at most about 30 minutes of a 2–3 h budget for the K3 cases and the 26 K-level assignments. Either book more time, or cut K-levels.
- **B4. V6 pointers.** For V6 to turn green, `Docs/v1.3/validation-protocol.md` §3, `Docs/v1.3/labelling.md` §6 and `Docs/v1.3/human-labelling-protocol.md` §6 each need one line pointing to §4 here for the C3m labels. Not done here: those are frozen documents, and the pointers are the author's edit.
- **B5. The analysis script** (§9) must exist and be tested on simulated sheets before the labels arrive.

## 12. Sign-off

```
L4 = __        R3 accepted __   R4 accepted __   R5 accepted __
κ definition (§4) dated: ____-__-__     sample sha256: ________________
signed: ______________________ (author)   before first label: yes / no
```
