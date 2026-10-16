# Distinction gaps: what was done, and questions for the author

**2026-10-16. Branch `v1.3-distinction-gaps`.** This file covers gaps G1 to G8 of
`Docs/v1.3/research/distinction-readiness.md` (PR #178). Items that are doc-only and need no author decision were
done on this branch. Items that need the author are asked below, one question each, in the repository's question
format. Nothing below has been decided.

## 1. Done on this branch (doc only)

| Gap | Item | File |
|---|---|---|
| G2 | A one-paragraph main-contribution statement, with at most three supporting findings, as a draft for the author's edit | `Docs/v1.3/contribution-statement.md` |
| G6 (3) | A limitations register: every null or weak result mapped to its document, with standard notes for headline tables | `Docs/v1.3/limitations-register.md` §1, §2, §4 |
| G6 (1) | A proposal-against-delivered table, listing where a deviation must be argued (the argument itself is left to the author) | `Docs/v1.3/limitations-register.md` §3 |
| G2, G6, G7 | A claims ledger: each claim, its value, evidence file, data class (registered, development, external, hold-out) and status; with a map from the five predictable attacks to the rows that answer them | `Docs/v1.3/claims-ledger.md` |

While building the ledger, three inconsistent or stale figures were found. They are listed in
`Docs/v1.3/claims-ledger.md` §5 (57/57 vs 54/54; 10 vs 11 failing external repositories; a cited file that was
moved out of the repository). They are recorded and not corrected in the source documents.

## 2. Not done, and why

| Gap | Item | Reason |
|---|---|---|
| G1 | Journal submission and oral talk | Author action (Q1). |
| G3 | Hold-out run | Needs the construct sheet answered and the freeze (Q4). |
| G4 | Study 2 framing | Needs a decision on the run rule (Q5). |
| G5 (1–3, 5) | Tag, DOI, path scrub, external-inputs statement | Depend on the visibility decision (Q6, Q7). The path scrub changes result files, so it is not doc-only. |
| G5 (4) | Table-to-command index | Needs the list of thesis tables. The chapters are in the private draft repository, which this session cannot read. |
| G6 (2) | SIGSOFT Empirical Standards appendix | Needs the chapter structure. It can be written once the chapters are fixed. |
| G7 | Defence deck and rehearsal | Author action, after G2 (Q2). |
| G8 | Judge decision and independent labelling | Author decisions (Q8, Q9). |

## 3. Questions

## Question 1
Gap G1. Which route should Paper 1 (E1) take first, given that Art. 32 needs one submitted indexed-journal article
and that one paper cannot be under review at two venues?

A) Submit to EMSE as soon as the citations are verified (the readiness note's recommendation).
B) Submit to MSR 2027 by 23 Oct 2026 (abstract 20 Oct), cut to 10 pages; go to EMSE only if it is rejected.
C) Submit Paper 1 to EMSE, and use Paper 3 at a workshop as the oral-talk route for Art. 30 c.
X) Other (please describe after [Answer]: tag below)

[Answer]:

## Question 2
Gap G2. Should the thesis adopt the contribution statement in `Docs/v1.3/contribution-statement.md`?

A) Adopt it as drafted.
B) Adopt it with edits (describe them below).
C) Use a different framing, for example a tool-first framing built on F2, with Study 1 as context.
X) Other (please describe after [Answer]: tag below)

[Answer]:

## Question 3
Gap G2 and K8. In which language will the final thesis text be written? The readiness note lists this as an open
frame decision; the contribution statement must be in that language.

A) Spanish.
B) English.
X) Other (please describe after [Answer]: tag below)

[Answer]:

## Question 4
Gap G3. When should the frozen v1.3 hold-out run? The freeze dry run (PR #164) found that the recorded sealed tree
hash could never match, so the runbook must be applied first.

A) Answer the construct sheet, apply the #164 runbook, freeze, and run the hold-out once, before writing Ch. 7 to 9.
B) Run it after Study 2, so that both use the same frozen instrument.
C) Do not run it; report v1.3 figures as development and external evidence only.
X) Other (please describe after [Answer]: tag below)

[Answer]:

## Question 5
Gap G4. What rule decides whether Study 2 runs?

A) Run only when the readiness gate (#146) is green; otherwise report the design and the readiness evidence as
   Future Work (the readiness note's recommendation).
B) Run on a fixed date whatever the gate state, and report gate failures as limitations.
C) Remove Study 2 from the thesis now and describe it as Future Work.
X) Other (please describe after [Answer]: tag below)

[Answer]:

## Question 6
Gap G5. What visibility should the reproducibility release have at the defence?

A) Public repository, with a thesis tag and an archival DOI (for example Zenodo).
B) Private repository; an archival copy with a DOI for the replication package only.
C) Private repository; access given to the jurados only, with no DOI.
X) Other (please describe after [Answer]: tag below)

[Answer]:

## Question 7
Gap G5. Should the archival copy include the generated E1 projects? The sealed set is excluded in every option.

A) Yes, all 72 E1 projects.
B) No; include only the evaluation reports and the scripts that regenerate the aggregates.
X) Other (please describe after [Answer]: tag below)

[Answer]:

## Question 8
Gap G8, SO3. Judge v2.2 was NOT CANDIDATE on CHECK-2 (PR #191). What is the judge claim in the thesis?

A) Narrow the claim now: "evidence beside the verdict", v1 at 16/21 = 0.76, with the complementarity figure (C12).
B) Build a v2.3 and test it on a new CHECK-3 set, as the v2.2 plan requires, before the claim is fixed.
X) Other (please describe after [Answer]: tag below)

[Answer]:

## Question 9
Gap G8, SO4-7. How is the independent-labelling promise of the proposal handled?

A) One person other than the author labels a 20% subset (about 8 to 10 hours, compliance register gap 5).
B) Do not label; argue the deviation in Ch. 3, 8 and 9, citing the deterministic correctness evidence (C09, C16).
X) Other (please describe after [Answer]: tag below)

[Answer]:

## Question 10
FX2, FF-CV03. Which classes does FF-CV03 select? This repeats the open question in
`Docs/v1.3/construct-question-ff-cv03.md`. A proposed diff for option B is in `Docs/v1.3/fx2-status-2026-10-16.md`
§2.3. Answer in either file.

A) Every class whose name contains the role word (status quo).
B) Classes with the role word as a camel-case token, behind a compile option (recommended there).
C) Selection by suffix.
X) Other (please describe after [Answer]: tag below)

[Answer]:

## 4. Questions for the Secretaría, not the author

The readiness note's §1.6 lists nine questions (for example: whether an oral talk at an ICSE co-located workshop
counts under Art. 30 c, how many enrolment periods have been used, and whether an EMSE submission receipt satisfies
Art. 32). Only the programme office can answer them, so they are not repeated here. Its item 7 bears on Question 3
above: Acuerdo 033/2008 Art. 18 par. 4 allows English with a Spanish summary.
