# V15-U4: S3 facts and S2 confirmation, the thinking note before any call

**Status:** v1, 2026-10-22. Zero calls: written from the code and the earlier notes. **U4 is not run here.** Unit U4 of the v1.5 cycle (`aidlc-docs/inception/v1.5/unit-of-work.md`), FR-8 and FR-9, roles S3 and S2 of `ops/notes/v15-semantic-programme.md`. Exploratory, development material only: the 13 human DDD repositories of `ops/notes/detect-02-precision-note.md` §7, the DETECT-02 dev set and precision fixtures (`experiments/detect-02/`). No sealed or held-out set: the DETECT-02 held-out (`experiments/detect-02-heldout/`) stays sealed and is not opened by U4. No change to `src/`, `presets/`, `scripts/lib/`, `scripts/v1.3/` or the tag `v1.4-freeze-2026-10-20`.

**Precondition.** U3 (S1 severity, `ops/notes/v15-u3-severity-note.md`) has passed its gate, or its failure note and one fix are merged. U4 reuses C4's frozen contract (schema, grounding, two-run merge) and, for S2, C4's reading of intent. If U3 failed, U4 waits. **Met:** U3 passed on development material (24/24 targets, 52 of 60 calls, `Docs/DiagnosticRuns/v15-u3-severity-2026-10-23.md`). U4 uses the rubric variant `c4-v0.2+u3-r1` wherever it reads intent, and carries U3's caveat (a ceiling on a designed set).

## 1. What each part is for, and what is already known

| Role | Question to the model | What the rules do without it | Evidence so far |
|---|---|---|---|
| **S3, facts (C1d)** | Which classes are aggregate roots? Which context owns which store? | Declared roots from the spec; without them, root inference by structure (`experiments/detect-02/lib/facts.ts`: identity-bearing domain types loaded by a store) | Inferred roots gave **12 false R-D4 hits** (ddd-forum 9, meetinger 3), all false on reading; declared roots gave **1 true hit** (lucashang-ddd-payday, `CreateUserUseCase.execute`, R-D4 and R-XCTX). R3 then fixed the three structural causes symbolically; the full pass with R1–R3 has **not** run |
| **S2, confirmation (C4 over C3)** | Given a candidate with exact lines, is it the violation the rule names? Cite the code | Symbolic DETECT-02 rules | D5 dev: **11 TP, 0 FP, 5 FN**; all 5 FN are the **lock form** (`pilot/s1-hotel-bookings/step-02..05`, `fixture/c1-s1-d5-lock/pos`). D4 33/0/0, D9 3/0/0, H5 4/0/0. The confirmation step exists (`experiments/detect-02/semantic.ts`, `detect02-sem-v1`, its own 60-call ledger) and has **never run** |

**Two consequences shape the design.**
1. **S3 now competes with R3, not with the old inference.** The 12 false hits were removed symbolically on the first partial pass. So S3's test is three-way: inferred roots after R1–R3 (symbolic), model facts (S3), and declared roots (truth). If R3 already removes every false hit, S3's lift on the hit count is zero by construction; its value is then only in recovering the declared aggregate set itself, which is measured directly (§3).
2. **Pure confirmation cannot raise D5 recall.** The 5 misses have no symbolic candidate, and there are 0 D5 false positives to remove. Confirming the existing candidates can only keep 11/0/5 or lose TPs. So S2 needs a **relaxed proposer**: a wider, cheap, symbolic net that also yields the lock form as a candidate, with the model deciding. Its precision is then the question.

## 2. Design

### 2.1 S3: aggregate and ownership facts

- **Input per repository:** the A1 graph (classes, their files, fields with identity, CALLS and CONSTRUCTOR_INJECTS edges), the repository and domain folders, and the docs. Batched per context: one call lists the classes of one context's domain and store folders, with their identity fields and the store methods that load them.
- **Answer (A2 shape, cited):** per class, `isAggregateRoot: true | false | abstain` and, for each store, `ownedBy: <context>`; every `true` cites the class line and a store method that loads it by identity (`path:line`), or a doc line. Grounded by the existing C1d validator pattern: a fact whose citation does not resolve is dropped (I6). **Abstain** is a first-class answer.
- **Use:** the facts replace root inference only where the spec declares no aggregates. A declared spec always wins. The DETECT-02 rules run unchanged on the new roots.
- **Prompt variant** under `experiments/v15-u4/` (read-only imports of `src/apg-enrich/ontology/`); new predicates are local to the experiment until promotion (U1).

### 2.2 S2: confirmation with a relaxed proposer

- **Proposer (zero calls, symbolic):** the current D5 rule's candidates, plus a relaxed D5 net: an application-layer method that (a) throws or returns early on a condition that reads state of a loaded aggregate, or (b) runs such a check inside a lock or transaction scope it opens, before calling a method of that aggregate. The net is written and frozen **before** any call, and its candidate counts on every tree are committed with the note revision that adds it.
- **Question:** the existing `detect02-sem-v1` form (`FAMILY_RULE.D5`): confirm | reject | abstain, every confirm citing `file:line` with a verbatim quote, checked. Cross-aggregate checks (uniqueness) and input parsing are not violations (the rule text says so).
- **Families:** D5 first (the gap). D4, D9, H5 candidates are confirmed too, as a precision check: with 0 FP on dev, a model that rejects true candidates is the risk to measure.
- **Own ledger and cassettes** under `experiments/v15-u4/`. DETECT-02's `calls.jsonl` cap (60) is not touched.

## 3. Scenarios and measures

| # | Scenario | Truth | Measure |
|---|---|---|---|
| S3-a | 12 repositories with declared aggregates; the spec's `aggregates` block hidden from the model and from the rules | the declared roots (37 aggregates, `Docs/DiagnosticRuns/v1.4-ddd-beta-capability-2026-10-19.md`) | root precision and recall per repository; abstentions; uncited facts dropped |
| S3-b | The same 12, rules run three ways: R1–R3 inferred roots, S3 roots, declared roots | hand reading of every hit (true / false / unclear, file:line), as the precision note §3 bar 2 | false hits and true hits per condition; the lucashang true hit must survive |
| S3-c | quiz4devs-backend (Hexagonal, no declared roots) and the two functional-style repos (talyssonoc, camps: roots name no class) | no class-level truth | **abstention**: the model should abstain or return no root where no class models the aggregate; any root named there is reported |
| S3-d | Ownership: which context owns each store, on the repositories with two or more contexts | `contexts[].root` of each spec | ownership accuracy; R-XCTX hits under model ownership vs declared |
| S2-a | D5 on the dev set: the 16 labelled positives (11 found, 5 lock form) and their twins and clean trees | the DETECT-01/02 hand labels | recall and precision of rules alone vs rules + confirmation (relaxed proposer); twin discrimination |
| S2-b | Precision fixtures P1–P10 (declared and fallback) and their positive twins | the precision note §2 table | 0 false confirms on the legitimate trees; twins still confirmed |
| S2-c | D4, D9, H5 dev candidates (all TP today) | hand labels | confirmations kept; any reject of a true candidate is a loss |
| S2-d | Stability and grounding on every S2 answer | label-free | run-to-run agreement; quotes found verbatim at the cited line |

**Edge cases.** An identifier wrapper (`PostId`) or a record (`AuditEntry`) named as a root (R3's causes, now as a model error); an aggregate whose root lives in a file with other classes; event-sourced roots with no `save` (event-sourcing-ddd); a lock scope via a callback port (`withRoomLock(id, (repo) => …)`), which R-H5 owns as a mechanism and D5 owns as a placement; uniqueness checks in services (not D5); a model that confirms everything (precision) or abstains on everything (recall); docs that name aggregates loosely.

## 4. Predicted result

- **S3-a:** root recall ≥ 0.85 and precision ≥ 0.85 pooled over the 12 repositories; most errors on inner entities with their own `id` (P5's shape) and on base-class identity.
- **S3-b:** R1–R3 inferred roots already remove most of the 12 false hits; S3 roots give **no more** false hits than R1–R3 and keep the lucashang true hit. A lift of S3 over R1–R3 on hit counts is **not** expected; if it appears, it is on repositories R3 does not cover.
- **S3-c:** abstention or no root on talyssonoc and camps; quiz4devs gets roots that a reader accepts.
- **S2-a:** with the relaxed proposer, D5 recall rises from 11/16 to ≥ 14/16 with ≤ 1 false confirm on twins and clean trees; the lock-form step trees of the hotel pilot are the hardest (the pre-existing overlap check in `BookRoomService` makes "present" true at every step, as the DETECT-01 pilot noted).
- **S2-b, S2-c:** 0 false confirms on P1–P10; at most 1 reject of a true D4/D9/H5 candidate.

## 5. What counts as failure

- **S3 fails** if root precision < 0.7, or if S3 roots add any false hit that R1–R3 do not have, or if the lucashang true hit is lost.
- **S2 fails** if D5 recall with confirmation is not above 11/16, or if any legitimate precision-fixture tree (P1–P10) gets a confirmed violation, or if more than 1 true D4/D9/H5 candidate is rejected, or if any confirm's quote is not found at its cited line.
- **Either part** fails if more than 10 % of answers are invalid after one retry.
- A failure gets a note on why and one fix (a dated revision), re-run within the cap. No tuning after seeing the results except as such a revision.

## 6. Call cap

| Part | Items | Runs | Calls |
|---|---|---|---|
| S3-a/b/c/d | 13 repositories, about 25 context batches | 1 run; a second run on 5 repositories for stability | ~30 |
| S2-a/b/c | D5 candidates from the relaxed proposer (estimated 20–30, counted zero-call before any call), plus D4/D9/H5 candidates (~10), carried-forward duplicates cached | 1 run; 2 runs on the 16 D5 labelled trees' candidates | ~40 |
| **Hard cap** | | | **75**, never raised; planned ~70 |

- A `--plan` / `--estimate` pass counts the calls with zero calls before the first live call; if the estimate exceeds 70, the scope is cut (fewer stability runs first), never the cap raised.
- Ledger `experiments/v15-u4/ledger.jsonl`, one line per call and retry; cassettes keyed by the prompt hash; `--replay` costs zero calls.
- Model: `claude-sonnet-5-5` through `claude -p`, no tools, the configuration recorded per answer. Gemini as a swap arm after its quota resets, under the same cap per vendor.

## 7. Order of work when U4 runs

1. Clone the 13 repositories at their pinned SHAs; re-run the R1–R3 symbolic pass with every hit hand-read (the precision note's deferred Phase 2). Zero calls. This is the S3-b baseline and must be committed first.
2. Freeze the relaxed D5 proposer and commit its candidate counts. Zero calls.
3. `--estimate` for S3 and S2.
4. S3 run, then S2 run, each under its share of the cap.
5. Report in `Docs/DiagnosticRuns/v15-u4-*.md` and a research-log entry.

## 8. Revisions

### r1, 2026-10-22 (before any call): baseline, frozen proposer, batches and scope

Written after steps 1–3 of §7 (zero calls) and before the first provider call. Nothing here was chosen after seeing a model answer.

- **Step 1, S3-b baseline (committed first, `experiments/v15-u4/results/condition-{declared,inferred}.json`).** With R1–R3 in place, both conditions give exactly one hit pair on the 13 repositories: lucashang-ddd-payday `CreateUserUseCase.execute` (R-D4 and R-XCTX), hand-read **true** (`experiments/v15-u4/hand-read.json`). The 12 inferred-root false hits of the partial pass do not reappear. So §1's first consequence holds in its strong form: **S3's lift on the hit count is zero by construction**, and S3 is measured on the root set itself (S3-a), on hits under its roots (S3-b: no new false hit, the true hit kept), on abstention (S3-c) and on ownership (S3-d). The inferred roots are kept as the symbolic arm of S3-a (they include event types, views and an `IFilter` interface).
- **S3 batches.** One question per context group, with the groups of one repository packed in name order into batches of at most 700 shown lines (declaration and member lines only). Every repository fits one batch: **13 calls**, not the ~25 of §6. The model sees the context names, not their roots, so S3-d ownership is a weak test where the folders name the contexts (stated in advance). Files whose role is domain, shared kernel or published contract, and the spec's repository globs, are listed; test files are not. S3 part cap 32. Stability run on 5 repositories fixed now: ddd-forum, meetinger, lucashang-ddd-payday, ddd-libellis, talyssonoc-node-api (**5 calls**).
- **S3 truth.** A model root matches a declared root when the class name and the file are the declared ones. talyssonoc and camps declare roots that name no class, and quiz4devs declares none: these three are S3-c only. The other 10 repositories carry 23 declared roots.
- **Step 2, relaxed D5 proposer `u4-d5-relaxed-r1` (`experiments/v15-u4/proposer.ts`), frozen.** An `if` in application or adapter code that exits (throw or return) on a condition that reads the state of a root (or of a collection of roots, including a callback parameter), not a pure existence test; tagged when it sits in a lock or transaction callback. Counts on every tree are in `results/proposer-counts.json`: **49 new D5 candidates** over 111 trees (dev set and precision runs), 19 on D5-labelled trees and 30 on negatives; it proposes a candidate on all 5 lock-form trees. Its proposals on negatives are mainly the puzzle P1 cross-aggregate checks (`from.currency !== to.currency`), the HEXDDD-01 seed-era checks (`!this.availability.isAvailable(…)`, `!customer.canOrder()`), the same lock code in the two H5 fixtures, and a uniqueness check on P10 legit. These are the model's precision test.
- **Labelling caveat, stated in advance.** `fixture/c4-s1-h5-lockport/pos` and `fixture/c4v-h5-vendor-type/{pos,twin}` contain the same in-lock overlap check as `c1-s1-d5-lock/pos`, but the DETECT-01 fixtures are labelled for one family only (H5). Under the labels a D5 confirm there is a false positive. It is reported both ways, and the strict count is the one scored.
- **S2 scope (`experiments/v15-u4/scope.json`), cut for the cap.** The full set is 120 candidates. Asked: every D5 candidate on 28 trees (the 5 lock-form trees and the other D5-labelled fixtures, pilot S2 steps 2 and 4, puzzle c10 step 2 and the P1 trap; their twins, the clean fixtures and solutions, the pilot seeds, pilot S1 step 1, S2 step 0, c10 step 1, the H5 fixtures), 11 `tree#family` rule candidates of D4, D9 and H5, and 8 precision trees (the six declared positives and P10 legit in both conditions). Left out: the other puzzle agent sessions, pilot S2 steps 1, 3 and 5, the fallback precision positives, c4v and c9v rule candidates, the unlabelled RTX candidate. **47 distinct prompts**; S2 part cap 52. The second run is cut to the D5 candidates of 4 trees (c1, c6 and c7 positives, pilot S1 step 2). With S3's 18 that is **65 planned of the hard cap 75**.
- **S2 question and merge.** The `detect02-sem-v1` form, unchanged (system prompt, `FAMILY_RULE`, comments blanked), with a JSON schema for the answer; it reads intent only as far as the rule text does, so the U3 rubric (a severity rubric) has no item to apply here. Merge: one run, its answer, a confirm counting only when every quote is found at its line; two runs, confirm only when both confirm grounded, reject only when both reject, otherwise `split`, an abstention. Decision: an R-* candidate is kept unless the merged verdict is reject; a relaxed candidate is added only on a merged grounded confirm.
- **S2 measures.** D5 at tree level and at case level (a kept candidate in the case's file), over the asked trees only, rules alone against rules plus confirmation. The 5 lock-form trees are all asked, so the §5 recall test reads as **11/16 → 11 + (lock-form trees recovered)/16**. 11 of the 16 labelled trees are asked; the 5 left out (puzzle c10 step 3, c16 steps 2–3, pilot S2 steps 3 and 5) are rule-only true positives and keep that result in the 16-tree count, which the report states.

### r2, 2026-10-22 (after the r1 run, 65 of 75 calls): S2 failure note, one fix, one scoring note

**S2 failed at r1.** D5 recall with confirmation stays at 11/16 (§5's first S2 condition). The proposer covered all 5 lock-form trees, and the model declined every one: it rejected the 4 pilot S1 step trees and split on `c1-s1-d5-lock/pos` (confirm, then reject). The other S2 conditions held: 0 confirms on the P10 legit trees, 1 true D4/D9/H5 candidate rejected (pilot S1 step 3, `saveAudited`, read as "audit entries are records"), every confirm's quote found.

**Why.** Five of the six lock-form answers say the same thing: the overlap check compares a stay with *all the bookings of the room*, so it is "a cross-aggregate check, which the rule exempts". The D5 rule text (`FAMILY_RULE.D5`) does say that "cross-aggregate checks such as uniqueness are not violations". The hand label reads the same code as D5 because the invariant ("no two active bookings of a room overlap") has **no owning aggregate**, and the twin shows the fix (a `RoomSchedule` aggregate). So the rule text and the label disagree on a set invariant. That is a construct gap in the question, not a model error. In the pilot trees a second reason is given: the check sits in a domain service (`AvailabilityChecker`), so "the rule is not copied into the application layer".

**One fix (r2), stated before its calls.** A U4 variant of the D5 rule text (`detect02-sem-v1+u4-r2`). Only the exemption sentence changes:
> Pure input parsing (types, formats, required fields) is not a violation, and neither is uniqueness of a key across the whole store. A rule over a set of instances that must hold at every commit (for example: no two active bookings of one room overlap) is an invariant that needs an owning aggregate. If no aggregate owns that set and a service checks it, with or without a lock, the rule is broken, even when the service calls a domain helper to compute it.

It is asked once, on 9 candidates: the 5 lock-form trees (`c1` positive, pilot S1 steps 2–5) and 4 negatives that test whether the boundary only moved: pilot S1 step 1 (the same availability check, before the lock existed: labelled negative), pilot S2 step 0 (`!customer.canOrder()`, a rule the aggregate owns), P10 legit declared (a duplicate-order check across orders), and puzzle c10 step 1 line 15 (the currency check, already confirmed at r1). That is 9 calls, which leaves 1 of the cap for a retry. **Bias, stated now:** r2 was written after reading the r1 answers on these same trees, so its result is post-hoc development evidence. It is never reported as the S2 result. The S2 verdict stays the r1 failure.

**Scoring note (S3-a), not a model change.** r1 matched a model root to a declared root by the declared *name* and file. In finance-project-ddd the declared names (`BudgetBox`, `Transaction`, `User`) are labels: the classes in the declared root files are `BudgetBoxAggregate`, `TransactionAggregate` and `UserAggregate`, which is what the rules themselves resolve (`condition-declared.json`). Both scorings are reported: by declared name (the r1 definition) and by the resolved class.

## Changelog
- 2026-10-22: v1, before any call. U4 not run.
- 2026-10-22: r1 (§8), before any call: S3-b baseline committed; relaxed proposer frozen with its counts; S3 batches packed per repository; S2 scope cut to 47 prompts; merge and decision rules.
- 2026-10-22: r2 (§8), after the r1 run: S2 failure note; one fix (D5 rule text on set invariants), 9 calls; S3-a scoring by resolved class reported alongside.
