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

## Changelog
- 2026-10-22: v1, before any call. U4 not run.
