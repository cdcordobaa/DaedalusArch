# v1.3 threats-to-validity register (instrument validation)

**2026-10-16. Status: draft, for the author.** This register covers the v1.3 validation of the instrument: the reference (development) set, the sealed hold-out, the blind manifests, the graph-fidelity harness, the labelling harness and the judge catch test. It does **not** replace `Docs/threats-to-validity.md`, the registered v1.2E register. Editing that file would break the pre-registration hash gate (`Docs/v1.3/study1-addenda.md` line 3). Study 1 items found during v1.3 are cross-referenced here (V13-TV-C5) and stay in the addenda.

It was written after the adversarial review of 2026-10-15. The blocking findings of that review were fixed in PR #120: 54/54 + 3 N/A, the late hashes, the ported v1.2e-only docs, the "met" wording and the 16/21 judge qualification. Corrected numbers are in the "Correction (2026-10-16)" section of `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md`. This register re-scores nothing and changes no results document. Inconsistencies between documents are listed in Appendix A and left unfixed.

**Sealed material.** No sealed directory was opened to write this register. Statements about the hold-out and the blind manifests come from committed documents only.

## How to read an entry

- **Id**: `V13-TV-<category><n>`. Categories: **C** construct, **I** internal, **E** external, **S** conclusion (statistical), **R** reliability, **D** researcher degrees of freedom.
- **Evidence**: `file:line` in this repository, at `origin/v1.3` as of 2026-10-16.
- **Severity**, for the v1.3 validity claim:
  - **High**: it can make a headline validity figure wrong or unclaimable.
  - **Medium**: it limits how far a figure generalises, or widens it.
  - **Low**: declare it, but it does not change a reading.
- **Residual**: the risk left after both the mitigation done and the mitigation planned.
- **Thesis**: where and how the threat is declared. "Ch7" means the validation chapter and "Ch8" the discussion/limitations chapter, following `Docs/v1.3/study1-addenda.md` line 17.

## Summary

| Id | Threat | Severity | Residual |
|---|---|---|---|
| V13-TV-I1 | All references, blind keys, hold-out and judge are Claude-family | High | High until a non-Claude arm exists |
| V13-TV-I2 | Hold-out enlarged after tuning; hashes recorded late | High | Medium |
| V13-TV-I3 | Development-set tuning loops on the same 71 cases | High (if dev figures are quoted as validity) | Low if the labelling holds |
| V13-TV-I4 | Label leakage through fixture comments and variant names | High | Medium |
| V13-TV-I5 | Sealed blind summary read during construct drafting; Study 2 tasks known to the coordinator | Medium | Medium |
| V13-TV-I6 | Negative controls and near-misses are in-sample | Medium | Medium |
| V13-TV-I7 | SO4 73/73 is in-sample | Medium | Low if labelled |
| V13-TV-C1 | Rule sources are unverified paraphrases | High | Medium |
| V13-TV-C2 | FLOWS_TO gap: FF-P06 has no estimable half on the dev set | High (for FF-P06) | High |
| V13-TV-C3 | DUP-RULE seeds confounded with the twin's cue | Medium | Medium |
| V13-TV-C4 | DDD style not judged in the catch rounds; first judged in CHECK-2 (#191, open, dev) | Medium | Medium (DDD n = 4 seeds, 6 clean units; not in the 16/21 claim) |
| V13-TV-C5 | Study 1 `none` arm had a folder-layout hint | Medium (Study 1) | Declared |
| V13-TV-C6 | Graph fidelity is unadjudicated agreement, not precision | High (for M7) | Medium |
| V13-TV-C7 | Rules stricter than, or different from, their sources | Medium | Medium |
| V13-TV-C8 | 25 construct decisions open; FF-DS01 tier deferred | Medium | Medium |
| V13-TV-E1 | Single language (TypeScript) | Medium | High (scope limit) |
| V13-TV-E2 | NestJS dominates the brownfield bases and the judge fixture | Medium | Medium |
| V13-TV-E3 | Small, AI-written greenfield references; no external project per style | High | Medium |
| V13-TV-E4 | E1 corpus: one style, two tasks, Claude-family generators | Medium | Declared |
| V13-TV-S1 | Small cells: no per-style lower bound can reach 0.90 | High | High (structural) |
| V13-TV-S2 | Seed counts below the protocol floor of 20 per style | High | Medium after `seed-floor-plan.md` |
| V13-TV-S3 | Non-independent seeds (one fixture, re-judged identical code) | Medium | Medium |
| V13-TV-S4 | Pooled figures hide per-style and per-rule weakness | Medium | Low |
| V13-TV-R1 | No human labels; "meaningful" unmeasured; adjudication sheets empty | High | High until labelling runs |
| V13-TV-R2 | κ gate defined three ways; the gate cannot be passed on its lower bound | Medium | Medium |
| V13-TV-R3 | Judge stochasticity and a single judge model | Medium | Medium |
| V13-TV-R4 | Symbolic determinism (mitigated) | Low | Low |
| V13-TV-D1 | Role overlap: author is preset author, adjudicator, rater and ADR approver; independent second rater not yet named | High | Medium after `role-separation-plan.md` |
| V13-TV-D2 | Four scoring views; the headline view differs between documents | Medium | Low if the prespec rule is applied |
| V13-TV-D3 | Construct decisions taken with their row impacts visible | Medium | Medium |
| V13-TV-D4 | No pre-registration of v1.3; prespec still a draft with placeholders | Medium | Low once frozen |

---

## C. Construct validity

### V13-TV-C1: Rule sources are unverified paraphrases

- **Description.** `style-rule-sources.md` paraphrases the canonical sources. It is the only rule input for:
  - the blind-manifest writer;
  - the hold-out author;
  - the Gemini *meaningful* prompt;
  - the human codebook.

  The verification found:
  - rows 3, 5, 6, 7 and 12 only partly supported;
  - one quotation that is not Cockburn's wording ("application core");
  - several wrong or missing chapter locators;
  - eight rules with no source row at all: FF-P02, FF-P04, FF-P05, FF-P06, FF-DT05, FF-DS01, FF-DS02, and FF-S04 in DDD.

  The book texts (Martin 2017, Fowler 2002, POSA 1996, Evans 2003, Vernon 2013) were not accessible. Several statuses rest on wording recalled from the books.
- **Evidence.**
  - `Docs/v1.3/style-rule-sources.md:3`
  - `Docs/v1.3/rule-source-verification.md:13`, `:21-37`, `:39-51`, `:123`
  - `Docs/v1.3/style-rule-sources-errata.md`
  - `Docs/v1.3/holdout-prespec.md:24`
  - `Docs/v1.3/labelling.md:117`
  - `Docs/v1.3/human-labelling-protocol.md:75`
- **Severity.** High. A paraphrase error spreads to every key written from it. Tool and keys can then agree on a wrong reading, and no figure would show it.
- **Mitigation done.**
  - The verification pass and the errata.
  - Status labels per row.
  - The *(recalled)* flag on wording that was not checked.
- **Mitigation planned.**
  1. The author checks every *(recalled)* wording and every PARTIALLY SUPPORTED row in print before thesis use.
  2. The author adds source rows for the eight unsourced rules, or makes them advisory.
  3. If the corrected wording changes a blocking constraint, record that the hold-out keys were written from the unverified version (do not re-key the sealed hold-out).
- **Residual.** Medium. The hold-out keys stay derived from the pre-verification text.
- **Thesis.** Ch7, threats: name the input document, its verification status per row, and the rows the hold-out keys rest on. Ch8: present each partially supported constraint as the thesis's reading, not the source's definition (for example strict layering as POSA's strict variant).

### V13-TV-C2: FLOWS_TO gap: FF-P06 has no estimable half on the development set

- **Description.** FF-P06 has two halves:
  - the **field half**, which needs FLOWS_TO edges. These are near-empty, so this half is reported N/A.
  - the **constructor-injection half**, the only half declared valid.

  All three FF-P06 plants on the development set are field-half plants: clean v08, nestjs v10 and hexagonal v10. **No reference variant plants the constructor-injection half.** So FF-P06 has no recall estimate for either half. The 53 constructor-injection rows of the layered baseline were false positives, removed by fix 3 (FF-P06 made not applicable in layered).
- **Evidence.**
  - `Docs/v1.3/rule-tiers.md:30`
  - `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md:5`, `:9`, `:41`
  - `Docs/v1.3/labelling.md:92`, `:106`
  - `Docs/DiagnosticRuns/v1.3-reference-after-fixes-2026-10-15.md:137`
  - `tests/fixtures/v1.3-reference/{clean-architecture/variants/v08-*,nestjs/variants/v10-*,hexagonal/variants/v10-*}/expected-findings.json`
- **Severity.** High for any FF-P06 claim. Low for the pooled figures, since the 3 rows are already N/A.
- **Mitigation done.** The 3 rows are moved to an N/A bucket (`scripts/v1.3/ffp06-na-recount.mjs`). "Recall unestimated" is stated next to 54/54.
- **Mitigation planned.**
  - Plant the constructor-injection half: `Docs/v1.3/seed-floor-plan.md` (clean c-v11 and c-v12, nestjs n-v11 and n-v12, hexagonal h-v12).
  - Answer Q8 + Q14 by ADR.
- **Residual.** High until constructor-half seeds exist. It stays high on the hold-out if the hold-out has none: unknown, because the hold-out is sealed.
- **Thesis.** Ch7: FF-P06 is reported as "blocking, partial". The field half is N/A with its denominator. The constructor half gets "no development-set seed" until the new variants exist. FLOWS_TO is listed as an extractor limitation in Ch8.

### V13-TV-C3: The DUP-RULE seeds are confounded

- **Description.** The DUP-RULE positive differs from its twin in two ways: the duplicated rule, and a "foreign method" cue. The judge's own reasons cite the cue. The v1 twin was itself failed 5/5 in round 2, so it is not a neutral control. The v2 seeds are byte-identical edits re-judged with fresh calls. The pooled 30/35 includes 9 DUP-RULE seeds.
- **Evidence.**
  - `Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md:54`, `:140`, `:175`
  - `Docs/v1.3/judge-catch-frozen.md:49`
- **Severity.** Medium. It inflates the pooled judge figure, and it is construct-invalid for DUP-RULE.
- **Mitigation done.** The judge claim is qualified to 13/16 (round 2) and 16/21 (both rounds), on FRAMEWORK-LEAK and PERSIST-IN-DOMAIN only (PR #120).
- **Mitigation planned.**
  - Design a DUP-RULE v3 whose twin carries the same foreign-method cue without the duplicated rule.
  - Until then, keep DUP-RULE out of every pooled judge figure.
- **Residual.** Medium. The judge's sensitivity to duplication is unmeasured.
- **Thesis.** Ch7: report DUP-RULE separately as "confounded, not interpretable". The pooled judge figure is 16/21, with the qualification. Note that 16/21 = 0.76 is below the requirements' ≥ 0.80 judge target (`aidlc-docs/inception/requirements/v1.3-validity-requirements.md:47`).

### V13-TV-C4: The DDD style was not judged in the catch rounds (first judged in CHECK-2, #191)

> **Update (2026-10-16).** DDD has now been judged once. PR #191 (judge v2.2 vs v1 on CHECK-2, still open, development set) ran a DDD base: v1 catches 4/4 DDD seeds, with a clean false fail of 1/6 = 0.17 [0.03, 0.56] (`src/claims/application/FileClaim.ts`); v2.2 catches 4/4 with 0/6 (`v1.3-judge-v22-run:Docs/DiagnosticRuns/v1.3-judge-v22-check2-2026-10-16.md:122-125`). The description below is kept as written: it is still true of judge-catch rounds 1 and 2 and of the defensible 16/21, which contain no DDD seed. Cite the DDD figures only once #191 is merged, and as n = 4, not as coverage of the style.

- **Description.** `presets/ddd.yaml` declares neither FF-N01 nor FF-N02. The 9 DDD twin copies were seeded but not judged. The hexagonal layer globs do not cover the DDD layout, so a borrowed config would give DDD files no layer kind. Every judge figure covers four styles, and in practice mostly one NestJS fixture plus E1.
- **Evidence.**
  - `Docs/DiagnosticRuns/v1.3-judge-catch-2026-10-15.md:47`
  - `Docs/DiagnosticRuns/v1.3-judge-catch-round2-2026-10-15.md:96-97`
- **Severity.** Medium. The judge is non-blocking in v1.3 (`rule-tiers.md:13`), so no verdict depends on it.
- **Mitigation done.** Stated in the qualified judge row.
- **Mitigation planned.** Either add FF-N01/FF-N02 to a DDD judging config and run the frozen operators on the DDD project (a new development round), or scope the judge claim to "not evaluated on DDD".
- **Mitigation done (2026-10-16, open PR #191).** The first DDD judged run, on CHECK-2 (see the update above).
- **Residual.** Medium: DDD rests on 4 seeds and 6 clean units, from one development run on an unmerged PR. High for any claim that the 16/21 judge figure covers five styles.
- **Thesis.** Ch7: the judge table has a DDD row reading "not in the catch rounds; CHECK-2 (#191): v1 4/4, clean false fail 1/6, development set".

### V13-TV-C5: The Study 1 `none` arm had a folder-layout hint (cross-reference)

- **Description.** Every E1 prompt, including `none`, contains the three-folder layout sentence. Every E1 cell is classified clean-architecture, and the E1 spec-level contrast is "hint vs hint + prose vs hint + spec". This is a Study 1 threat. It matters for v1.3 because E1 is development data (graph fidelity, labelling, judge round 2), and all of it shares one layout.
- **Evidence.**
  - `Docs/v1.3/study1-addenda.md:5-17`
  - `Docs/generator-protocol.md:75`
  - `Docs/DiagnosticRuns/ise-e1-ics-2026-10-15.md`
- **Severity.** Medium for Study 1 claims (thesis §16.1). Low for v1.3 figures.
- **Mitigation done.** Recorded in the addenda.
- **Mitigation planned.** Add a no-hint arm to Study 2 and to the spec-influence pilot (addenda A1, "Action"). Move A1 into the registered register at the next registration.
- **Residual.** Declared. §16.1 is not tested by E1.
- **Thesis.** Ch7/Ch8, as addenda A1 says.

### V13-TV-C6: Graph fidelity is unadjudicated agreement, not precision

- **Description.** The validation protocol (§2) says only the adjudicated figure is precision. Every `human_verdict` in the fidelity sheets is empty:
  - 89 E1 rows: 39 disagreements and 50 agreement samples;
  - 2046 SO4 rows: 1996 disagreements and 50 agreement samples.

  The "suggested verdicts" are machine suggestions. File-to-layer accuracy has no expected layer map on E1 or SO4. The dev-set "269/269 edges, 115/115 layers" compares the tool with author-written expected graphs, which are Claude-written (V13-TV-I1).
- **Evidence.**
  - `Docs/v1.3/validation-protocol.md:24`
  - `Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md:19`, `:85-91`, `:115`, `:127`
  - `results/v1.3-fidelity/e1/adjudication.csv` (`human_verdict` column empty, 89/89)
  - `results/v1.3-fidelity/so4/adjudication.csv` (empty, 2046/2046)
- **Severity.** High for M7 (`holdout-prespec.md:48`). Agreement figures are fine as agreement.
- **Mitigation done.** Every disagreement is classified by reason. "Agreement, not precision" is stated in the fidelity doc.
- **Mitigation planned.** The independent rater adjudicates the 39 E1 rows, the 218 SO4 barrel rows and the 100 agreement samples (`role-separation-plan.md`, §3). Only then quote a precision.
- **Residual.** Medium. Most SO4 disagreements are by-design classes.
- **Thesis.** Ch7: report "agreement with tsc/dependency-cruiser" and keep "precision" for the adjudicated figure. If adjudication is not done, say so.

### V13-TV-C7: Rules stricter than, or different from, their sources

- **Description.** Several rules encode a reading that is stricter than the cited source:
  - FF-DT01 forbids the transient inner-entity references that Evans allows.
  - FF-P01 is absolute, while Martin's ch. 32 accepts "marrying" some frameworks.
  - Strict layering is POSA's strict variant; POSA also offers a relaxed form, and Fowler calls layering "mostly opaque".
  - FF-DS02's ACL exemption sits against Evans's ACL wording.
  - The NestJS constraint concerns DI injection, not file imports.
- **Evidence.** `Docs/v1.3/rule-source-verification.md:26`, `:29`, `:32`, `:36`, `:37`, `:73`, `:108`
- **Severity.** Medium. Recall against a stricter key overstates "style conformance".
- **Mitigation done.** Each nuance is recorded and linked to its construct question.
- **Mitigation planned.** Settle the readings in the construct decisions and their ADRs before the freeze. State each as a declared choice in the spec.
- **Residual.** Medium.
- **Thesis.** Ch7: a table of "rule vs source reading", with the declared choice.

### V13-TV-C8: 25 construct decisions open; the FF-DS01 tier is deferred

- **Description.** `construct-decisions.md` lists 25 questions; Q1–Q13 move blocking rows. None is answered. Q3 (is an in-layer file cycle blocking?) decides every FF-S02 seed on the development set: all 5 planted cycles are 2-file cycles inside one layer (`seed-floor-plan.md` §2, gap 5). The hold-out prespec keeps deferred-tier rules (FF-DS01 under Q15) out of M1/M2. The development DDD figure of 9/9 counts FF-DS01 as a blocking TP; without it, DDD is 8/8.
- **Evidence.**
  - `Docs/v1.3/construct-decisions.md:3`, `:15`, `:42`, `:501`
  - `Docs/v1.3/holdout-prespec.md:18`, `:57`
  - `results/v1.3-reference/after-member-facts/scores.json` (ddd, `author-cycle-normalised`, FF-DS01 tp 1)
- **Severity.** Medium.
- **Mitigation done.** Every option is pre-implemented as a switch, with the status quo as default (`Docs/v1.3/construct-switches.md`).
- **Mitigation planned.** The author answers the questions and writes the ADRs before X (the freeze commit). The answers are recorded with the date and before any new key is written (`role-separation-plan.md` §2).
- **Residual.** Medium. The answers are made with development-set impacts visible (V13-TV-D3).
- **Thesis.** Ch7: list the decisions with their date relative to each measurement.

---

## I. Internal validity

### V13-TV-I1: Same-vendor authorship of everything that is not code

- **Description.** All of these come from Claude-family models:
  - the reference projects, variants and author-manifests;
  - the blind manifests;
  - the hold-out (written by a Fable model);
  - the judge (`claude-opus-5-5`);
  - the coordinating agent;
  - the E1 generators.

  The hold-out is independent of tuning, not of the vendor. A shared blind spot in how this model family reads a style would appear consistently in code, keys and tool. Agreement would then look like validity. The coordinator session also wrote the sealed Study 2 tasks.
- **Evidence.**
  - `Docs/v1.3/holdout-prespec.md:22`
  - `Docs/v1.3/sealed-hashes.md:30`
  - `Docs/v1.3-reference-notes.md:222`
  - `Docs/v1.3/judge-catch-frozen.md:35`
  - `aidlc-docs/audit.md:1483` (Study 2 tasks known to the coordinator)
- **Severity.** High.
- **Mitigation done.**
  - Blind re-derivation, with inputs limited to sources, tiers and code.
  - The hold-out was written without the tool's code.
  - The vendor overlap is declared in the prespec.
- **Mitigation planned.** `role-separation-plan.md` §4:
  - a non-Claude key writer (Gemini API and/or Codex) for the new seeds and as a third manifest on the hold-out;
  - a non-Claude-authored arm, plus one external public project per style;
  - the independent human rater as primary reference.
- **Residual.** High until at least one non-Claude arm exists. Medium after: the projects stay Claude-written.
- **Thesis.** Ch7, first threat: a vendor table of who or what wrote each artefact, and the arms that are vendor-independent.

### V13-TV-I2: Hold-out enlarged after tuning; hashes recorded late

- **Description.** The 62-case hold-out was enlarged to 207 cases on 2026-10-15. That was after the after-fixes development measurement and after `construct-decisions.md` listed the contested constructs. The enlarging agent had access to the development results. The enlargement was done under the AI's standing delegation of 2026-10-14, without an explicit author decision. Directory hashes were recorded at 20:38Z, after the re-seal. Only `out.sha256` matches a logged value. The original 62 cases cannot be re-verified without opening the directory.
- **Evidence.**
  - `Docs/v1.3/sealed-hashes.md:11-32`
  - `Docs/v1.3/holdout-prespec.md:23`
  - `Docs/v1.3/validation-protocol.md:61`
- **Severity.** High. The case mix may track the contested constructs, which would be construct-aware sampling.
- **Mitigation done.** An honest note. Both hashes recorded. Known limitations listed in the prespec.
- **Mitigation planned.**
  1. Report the original 62 and the added 145 as two strata, *if* the cases carry a marker that separates them (to be checked at unseal by the person who unseals, not now).
  2. Report the per-stratum figures side by side.
  3. Have the independent rater (not the author) check the 207 cases' construct distribution against the contested list after the run (`role-separation-plan.md` §3).
- **Residual.** Medium.
- **Thesis.** Ch7: a timeline figure of seal, tuning, enlargement and hash recording, with the honest note quoted.

### V13-TV-I3: Development-set tuning loops on the same 71 cases

- **Description.** Six fixes plus member facts were made and measured on the same 71 cases. Fix 3 (FF-P06 not applicable in layered) and fix 4 (role tokens) target exactly the false positives the set exposed. The DDD probes g01–g03 were added after the first tool run. The development figures (54/54 etc.) are therefore fit figures.
- **Evidence.**
  - `Docs/DiagnosticRuns/v1.3-reference-after-fixes-2026-10-15.md:110-151`
  - `tests/fixtures/v1.3-reference/ddd/README.md:38-44` ("Probes added after the first tool run")
  - `Docs/v1.3/validation-protocol.md:60`
  - `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md:43`
- **Severity.** High if a development figure is quoted as validity. Otherwise low.
- **Mitigation done.**
  - Every development page carries the "DEVELOPMENT-SET NUMBERS" banner.
  - The prespec forbids citing development figures as validity (`holdout-prespec.md:102`).
- **Mitigation planned.** Hold the rule in the thesis text: no development figure without "Dev".
- **Residual.** Low, if the labelling holds.
- **Thesis.** Ch7: development figures appear only as "what the fixes did". Validity comes from the hold-out.

### V13-TV-I4: Label leakage through fixture comments and variant names

- **Description.** The plant is visible in the source text in three ways:
  - **DDD overlays.** All 14 DDD variant overlays carry a comment that names the construct: 12 read `// VIOLATION (<construct>): …` and 2 read `// Allowed …`, as in `v01-aggregate-boundary/overlay/src/ordering/application/GetOrderSummary.ts:17`.
  - **Near-miss patches.** Six near-miss patches and two violation patches add explanatory comments, for example "Not a repository: it stores nothing" (clean n02) and "Not an adapter; it implements no port" (hexagonal n03).
  - **Directory names.** Every variant directory is named after its plant, for example `v05-use-case-injects-concrete-repository`.

  Who sees this:
  - The blind-manifest writer received "the project source" (`validation-protocol.md:9`). No document records whether comments were stripped, so the blind DDD keys may have been written with the answer in the file.
  - The cheap proxies and any future judge run on DDD would see the same text.
  - Human and Gemini sheets strip comments (`excerpt-scrub.ts`), and the ISE has an anti-leakage test.
  - The hold-out authoring conventions are unknown (sealed).
- **Evidence.**
  - `tests/fixtures/v1.3-reference/ddd/variants/*/overlay/**` (14 files)
  - `tests/fixtures/v1.3-reference/{clean-architecture,hexagonal,layered,nestjs}/variants/*/variant.patch` (8 patches with added comments)
  - `Docs/v1.3/validation-protocol.md:8-13`
  - `Docs/v1.3/human-labelling-protocol.md:15`
  - `Docs/DiagnosticRuns/ise-prototype-2026-10-15.md:20-24`
- **Severity.** High for the blind-manifest agreement on DDD, and for any model reading DDD files. Low for the symbolic tool, which ignores comments.
- **Mitigation done.** Comment scrubbing for the human and Gemini sheets. ISE anti-leakage.
- **Mitigation planned.**
  1. Record whether the blind writer's input was scrubbed. If unknown, report the DDD blind agreement as "possibly leaked".
  2. Every new seed variant (`seed-floor-plan.md`) is comment-free, in a neutrally named directory, with the plant description kept in `variant.json` only.
  3. Before any model reads a variant (key writer, judge or proxy), materialise it with comments stripped and the path renamed to an opaque id.
  4. At unseal, the unsealer checks the hold-out for the same pattern and reports it. The check does not change the hold-out.
- **Residual.** Medium. The existing blind DDD keys cannot be un-leaked.
- **Thesis.** Ch7: name the channel and the affected agreement figure (DDD blind 9/9).

### V13-TV-I5: Sealed blind summary read during construct drafting; Study 2 tasks known to the coordinator

- **Description.** `construct-decisions.md` turns "the 13 ambiguities in the blind summary (`daedalus-sealed/v1.3-blind/blind-out/summary.md`)" into rule-definition questions. The run pages say that nothing under `daedalus-sealed/` other than `ue-score --blind` was opened (Appendix A, A5). The blind directory is a development reference, not the hold-out. Even so, its content now feeds the rule definitions it is meant to test independently. Separately, the coordinator session that wrote the sealed Study 2 tasks knows them.
- **Evidence.**
  - `Docs/v1.3/construct-decisions.md:12`
  - `Docs/DiagnosticRuns/v1.3-reference-after-fixes-2026-10-15.md:30`
  - `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md:101`
  - `aidlc-docs/audit.md:1483`
- **Severity.** Medium.
- **Mitigation done.** None specific.
- **Mitigation planned.**
  - Correct the access statements in a dated addendum (author's call; not done here).
  - Treat the blind manifests as development keys from now on.
  - Study 2 generation agents never receive the task path (already the rule). The coordinator does not run Study 2 generation.
- **Residual.** Medium.
- **Thesis.** Ch7: one sentence saying that the blind manifests informed the construct questions, so the blind agreement is not independent of the rule definitions.

### V13-TV-I6: Negative controls and near-misses are in-sample

- **Description.** The 5 clean variants and 14 near-misses are the cases that fixes 3 and 4 were tuned against: 5/14 → 0/14 near-misses with a blocking false positive, and 4/5 → 5/5 clean passes. They no longer estimate a false-alarm rate. The judge negative control (twins) was also revised after seeing failures (DUP-RULE v2).
- **Evidence.**
  - `Docs/DiagnosticRuns/v1.3-reference-after-fixes-2026-10-15.md:69-80`, `:116-118`
  - `Docs/v1.3/judge-catch-frozen.md:49`
- **Severity.** Medium.
- **Mitigation done.** Labelled Dev.
- **Mitigation planned.**
  - M5 and M6 on the hold-out are the only false-alarm figures.
  - Add out-of-sample negatives: clean public projects in the external arm, and non-Claude-written near-misses (`role-separation-plan.md` §4).
- **Residual.** Medium. The hold-out's own negative mix is unknown.
- **Thesis.** Ch7: development negatives are reported as "after tuning". False-alarm rates come only from the hold-out and external arms.

### V13-TV-I7: SO4 73/73 is in-sample

- **Description.** The v1.3 SO4 recall of 73/73 = 1.000 (from 67/73) comes from 6 MO-X01 seeds. MO-X01 motivated `dynamicImports`. The bases and operators were known while v1.3 was built. Twin specificity fell from 68/73 to 67/73. The match uses the v1.2E keys.
- **Evidence.**
  - `Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md:136-141`, `:166-167`
- **Severity.** Medium.
- **Mitigation done.** The rerun page says it is "not a held-out estimate".
- **Mitigation planned.** In the thesis, quote SO4 under v1.3 only as S1→v1.3 (descriptive). Do not put it on a slide next to validity figures.
- **Residual.** Low if labelled.
- **Thesis.** Ch7: "a development reading; MO-X01 motivated the change it measures".

---

## E. External validity

### V13-TV-E1: Single language (TypeScript)

- **Description.** The extractor, the checker, every corpus and every reference project are TypeScript. The `LanguageExtractor` interface exists, but no second extractor does.
- **Evidence.**
  - `aidlc-docs/inception/plans/v1.2-pending-units-plan.md:45`
- **Severity.** Medium.
- **Mitigation done.** The scope is stated in the thesis core.
- **Mitigation planned.** None for v1.3.
- **Residual.** High as a scope limit, which is acceptable if declared.
- **Thesis.** Title/abstract scope, and Ch8 limitations.

### V13-TV-E2: NestJS dominates the brownfield bases and the judge fixture

- **Description.** Of the 7 SO4 bases:
  - 5 are evaluated with the NestJS spec;
  - nestjslatam__ddd is NestJS code under the clean spec;
  - only v-aguiar__valex is layered.

  All 6 MO-X01 seeds sit on NestJS-built bases. 10 of the 11 round-1 judge seeds sit on one 8-file NestJS fixture (`fixtures/unit/antipattern-nest`). No hexagonal or DDD brownfield base is scored.
- **Evidence.**
  - `Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md:141`, `:152-160`
  - `Docs/DiagnosticRuns/v1.3-judge-catch-2026-10-15.md:9`, `:117`
  - `Docs/v1.3/validation-protocol.md:18`
- **Severity.** Medium.
- **Mitigation done.** Per-base figures are reported.
- **Mitigation planned.** The external arm adds one public project per style, chosen for non-NestJS stacks where possible (Express or Fastify for layered and hexagonal; a DDD sample outside NestJS).
- **Residual.** Medium.
- **Thesis.** Ch8: say that the brownfield and judge evidence is mostly NestJS.

### V13-TV-E3: Small, AI-written greenfield references; no external project per style

- **Description.** The five reference projects have 146 files in all (about 27–31 each). They are written by one model family, each in one domain. The validation protocol §1 requires "one public project per style … as a sanity check". That has not been done, and the prespec recommends it as a separate arm.
- **Evidence.**
  - `Docs/v1.3/validation-protocol.md:18`
  - `Docs/v1.3/holdout-prespec.md:27`
  - `aidlc-docs/inception/requirements/v1.3-validity-requirements.md:27`
- **Severity.** High. Real codebases have barrels, path aliases, monorepos and generated code at scales the references lack (compare SO4's `${configDir}` and out-of-root findings, `v1.3-graph-fidelity-2026-10-14.md:107`, `:124`).
- **Mitigation done.** SO4 and E1 graph agreement as partial brownfield evidence.
- **Mitigation planned.** The external arm (`role-separation-plan.md` §4.3), with rules written by someone outside the project, reported separately.
- **Residual.** Medium.
- **Thesis.** Ch7: the external arm is its own table. If it is not done, Ch8 says that validity is shown on small greenfield code only.

### V13-TV-E4: The E1 corpus: one style, two tasks, Claude-family generators

- **Description.** E1 has 65 accepted cells (72 measured by graph fidelity). All are clean-architecture, from two tasks, generated by Claude-family models, with a shared layout hint (V13-TV-C5). E1 serves as development data for graph fidelity, labelling and judge round 2. It has no blocking violation under v1.3 tiers.
- **Evidence.**
  - `Docs/v1.3/labelling.md:57`
  - `Docs/v1.3/study1-addenda.md:9-11`
- **Severity.** Medium.
- **Mitigation done.** Declared as development data.
- **Mitigation planned.** None for v1.3.
- **Residual.** Declared.
- **Thesis.** Ch7: E1 figures carry "one style, two tasks".

---

## S. Conclusion (statistical) validity

### V13-TV-S1: Small cells: no per-style lower bound can reach 0.90

- **Description.** On the development set, the author-view expected blocking findings per style are 12, 11, 10, 12 and 9. The largest blind cell is 18. Per-rule n is 0–5. A 95% Wilson lower bound reaches 0.90 with no miss only at n ≥ 35 (n ≥ 53 with one miss, n ≥ 69 with two; checked). Even a perfect 20/20 gives a lower bound of 0.84. The hold-out per-style n is unknown (sealed, `<N_PER_STYLE>`).
- **Evidence.**
  - `Docs/v1.3/holdout-prespec.md:73`
  - `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md:15-20`, `:185`
  - `Docs/v1.3/human-labelling-protocol.md:36`
- **Severity.** High. A "validated" claim (both checks) is likely impossible per style.
- **Mitigation done.** The prespec defines three claim levels and states the limit in advance.
- **Mitigation planned.**
  - Fill `<N_PER_STYLE>` at freeze, and state which styles can reach "validated".
  - Raising the seeds to ≥ 35 per style is the only way to make the lower-bound check passable. It needs new data, not the sealed hold-out.
- **Residual.** High (structural).
- **Thesis.** Ch7: report the claim level per style, and say beforehand that the lower bound cannot pass at this n.

### V13-TV-S2: Seed counts below the protocol floor of 20 per style

- **Description.** Validation protocol §7 sets "at least 20 planted violations per style". The development set, counted from the reference manifests, falls short in every style:

  | Style | Planted variants | Of which plant a blocking rule (primary) | Expected blocking findings (author view, corrected) | Gap to 20 (variants) |
  |---|---|---|---|---|
  | clean-architecture | 10 | 7 | 12 | 10 |
  | layered | 9 | 9 | 11 | 11 |
  | nestjs | 10 | 7 | 10 | 10 |
  | hexagonal | 11 | 7 | 12 | 9 |
  | ddd | 12 (v01–v10, g01, g03) | 8 (+ FF-DS01, tier deferred) | 9 (8 without FF-DS01) | 8 |
  | **total** | **52** | **38** | **54** | **48** |

  The protocol's "plus the existing mutation operators" does not close the gap:
  - the SO4 MO-* operators run on Study 1 bases, which are in-sample (V13-TV-I7) and mostly NestJS;
  - the #79 anti-pattern operators probe the judge only.
- **Evidence.**
  - `Docs/v1.3/validation-protocol.md:51`
  - `tests/fixtures/v1.3-reference/*/variants/*/expected-findings.json` (the `plants` and `expectedFindings` fields)
  - `tests/fixtures/v1.3-reference/ddd/variants/*/variant.json` (`rule`)
  - `results/v1.3-reference/after-member-facts/scores.json` (per-rule TP counts)
- **Severity.** High against the registered protocol.
- **Mitigation done.** None.
- **Mitigation planned.** `Docs/v1.3/seed-floor-plan.md` names 48 variants. They are a new development round and must be keyed under the role-separation plan. The hold-out's own counts are checked at freeze.
- **Residual.** Medium. Even at 20, see V13-TV-S1.
- **Thesis.** Ch7: report the count per style next to the floor, and say whether it was met.

### V13-TV-S3: Non-independent seeds

- **Description.**
  - 10 of the 11 round-1 judge seeds sit on one 8-file fixture.
  - The DUP-RULE v2 seeds are byte-identical to round 2's 8 E1 seeds.
  - Reference variants of one style share one base project. A defect in the base, or in the author's reading of the style, affects every variant together.
- **Evidence.**
  - `Docs/DiagnosticRuns/v1.3-judge-catch-2026-10-15.md:117`
  - `Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md:54`
- **Severity.** Medium. Wilson intervals assume independence, so they are too narrow.
- **Mitigation done.** Stated.
- **Mitigation planned.**
  - Report per-base counts.
  - Present the judge figures as counts with the fixture named.
  - For the hold-out, report figures per project as well as pooled.
- **Residual.** Medium.
- **Thesis.** Ch7: one sentence under each interval table.

### V13-TV-S4: Pooled figures hide per-style and per-rule weakness

- **Description.** Pooled 54/54 and 50/64 are the headline numbers. Underneath them:
  - layered blind precision is 7/11;
  - hexagonal blind recall is 12/18;
  - no blocking rule has more than 5 expected findings in any one style.
- **Evidence.**
  - `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md:15-20`
  - `results/v1.3-reference/after-member-facts/scores.json`
- **Severity.** Medium.
- **Mitigation done.** Per-style tables everywhere.
- **Mitigation planned.** The thesis shows the per-style table before the pooled figure, matching the prespec's per-style target for M1.
- **Residual.** Low.
- **Thesis.** Ch7 table order.

---

## R. Reliability

### V13-TV-R1: No human labels; "meaningful" unmeasured; adjudication sheets empty

- **Description.**
  - "Correct" is only the deterministic checker (2,668/2,668).
  - "Meaningful" was not measured: the model labeller hit its usage limit.
  - The two-human protocol is defined, but nothing is labelled.
  - The reference adjudication sheet (39 rows) and the fidelity sheets are empty.
- **Evidence.**
  - `results/v1.3-reference/after-member-facts/adjudication.csv` (`adjudication` empty, 39/39)
  - `Docs/v1.3/human-labelling-protocol.md:3`
- **Severity.** High. M3 and the human reference do not exist yet.
- **Mitigation done.** The harness is built and tested. The protocol is defined.
- **Mitigation planned.** `role-separation-plan.md` §3 and §5.
- **Residual.** High until the labelling runs.
- **Thesis.** Ch7: if the labelling has not run, say so. Do not use "correct" as a stand-in for "meaningful".

### V13-TV-R2: κ gate defined three ways; it cannot pass on its lower bound

- **Description.** The gate is "κ ≥ 0.60" in three documents with three definitions (Appendix A, A3). With the expected κ ≈ 0.73 and 60 or 120 items, the lower bound is about 0.53 or 0.59, so the gate is judged on the point estimate.
- **Evidence.**
  - `Docs/v1.3/validation-protocol.md:32`
  - `Docs/v1.3/labelling.md:142`
  - `Docs/v1.3/human-labelling-protocol.md:33`, `:38`, `:61`
- **Severity.** Medium.
- **Mitigation done.** The human protocol states the point-estimate rule.
- **Mitigation planned.** Fix one definition in the frozen prespec (binary, with AC1 alongside, as the human protocol says), dated, before any label is drawn.
- **Residual.** Medium.
- **Thesis.** Ch7: report κ with its interval and AC1, and name the definition.

### V13-TV-R3: Judge stochasticity and a single judge model

- **Description.** The judge is `claude-opus-5-5` at effort high, with 3 runs and a majority vote. Fresh calls on identical code (DUP-RULE v2) can differ. No other judge model was run on the seeds.
- **Evidence.**
  - `Docs/v1.3/judge-catch-frozen.md:35`, `:76`
  - `Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md:54`
- **Severity.** Medium. The judge is non-blocking in v1.3.
- **Mitigation done.** Cassettes, a pinned CLI and an isolated config.
- **Mitigation planned.** Optional: a cross-vendor replication of the judge catch with Gemini as the judge, using the same rubric and seeds, as a sensitivity arm (`role-separation-plan.md` §4.4).
- **Residual.** Medium.
- **Thesis.** Ch7: report run-to-run agreement next to the catch.

### V13-TV-R4: Symbolic determinism (mitigated)

- **Description.** The symbolic pipeline could in principle vary between runs. It was checked: two live runs gave byte-identical outputs, and the v1.2E extraction was byte-identical on 21/21 fixtures.
- **Evidence.** `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md:86`, `:94-99`
- **Severity.** Low.
- **Mitigation done.** The checks above.
- **Mitigation planned.** The prespec allows one repeat, to check determinism only.
- **Residual.** Low.
- **Thesis.** Ch7, one line.

---

## D. Researcher degrees of freedom

### V13-TV-D1: Role overlap

- **Description.** One person holds roles that should be separate:
  - **Rule and preset author** (with AI agents);
  - **Adjudicator** of every author/blind/tool disagreement (`validation-protocol.md:17`);
  - **Rater**: the author audit, and secondary rater in the human protocol;
  - **Decider**: answers the 25 construct questions and approves the ADRs (ADR-V13-01 accepted by the author, option A; ADR-V13-02 "Draft, for the author");
  - **Classifier** of hold-out defects (`holdout-prespec.md:89`).

  The independent second rater, the primary human reference, is not yet named. Whoever it is must meet the protocol's own qualification ("no part in … writing the thesis", `human-labelling-protocol.md:52`).
- **Evidence.**
  - `Docs/v1.3/validation-protocol.md:17`, `:32-33`
  - `Docs/v1.3/human-labelling-protocol.md:44-48`, `:52`
  - `Docs/v1.3/labelling.md:142`
  - `Docs/v1.3/adr-v13.md:7`
  - `Docs/v1.3/adr-v13-02-draft.md:3`
  - `Docs/v1.3/construct-decisions.md:3`
  - `Docs/v1.3/holdout-prespec.md:89`
- **Severity.** High. The person who benefits from a result defines the rule, writes or approves the key, resolves the disagreement and rates the output.
- **Mitigation done.**
  - The author never adjudicates hold-out disagreements.
  - The second rater is primary (`human-labelling-protocol.md:44-48`).
- **Mitigation planned.** `Docs/v1.3/role-separation-plan.md`.
- **Residual.** Medium after the plan: the author still defines the rules and decides the constructs, which is legitimate if dated before the keys.
- **Thesis.** Ch7: a role matrix (who wrote, keyed, adjudicated, rated and decided each artefact).

### V13-TV-D2: Four scoring views; the headline view differs between documents

- **Description.** The development set is scored four ways: author literal, author cycle-normalised, blind expanded and blind primary. Summaries headline the author cycle-normalised view (54/54; for example `papers/STATUS.md`). The prespec says the literal figures are primary, and that the pass decision uses the blind manifest. Choosing the view after seeing all four is a forking path.
- **Evidence.**
  - `Docs/v1.3/holdout-prespec.md:55-56`
  - `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md:22`
- **Severity.** Medium.
- **Mitigation done.** All views are reported.
- **Mitigation planned.** The frozen prespec names the primary view for each metric. The thesis follows it for hold-out and development figures alike.
- **Residual.** Low.
- **Thesis.** Ch7: the primary view first, the others as sensitivity.

### V13-TV-D3: Construct decisions taken with their row impacts visible

- **Description.** `construct-decisions.md` and `construct-decisions-impact.csv` give, for every option, the development-set rows it moves. `rule-tiers.md` says observed precision is "not an accepted reason on its own". But an answer chosen with the impact table open can follow the numbers.
- **Evidence.**
  - `Docs/v1.3/construct-decisions.md:48`
  - `Docs/v1.3/construct-decisions-impact.csv`
  - `Docs/v1.3/rule-tiers.md:3`
- **Severity.** Medium.
- **Mitigation done.**
  - Option A is always the status quo.
  - A source-based recommendation is given per question.
  - "Decide these yourself" is flagged.
- **Mitigation planned.** Each ADR states its source-based reason first and the row impact second. Any answer that departs from the source-based recommendation is listed in Ch7.
- **Residual.** Medium.
- **Thesis.** Ch7: a table of the decisions, their recommendation and the answer given.

### V13-TV-D4: No pre-registration of v1.3; the prespec is a draft

- **Description.** The author decided "no pre-registration until the tool is shown fit". The hold-out prespec is a draft with placeholders (`<FREEZE_SHA>`, `<HOLDOUT_PATH>`, `<N_PER_STYLE>`).
- **Evidence.**
  - `Docs/v1.3/judge-catch-frozen.md:3`
  - `Docs/v1.3/holdout-prespec.md:3`, `:11-12`, `:73`
- **Severity.** Medium.
- **Mitigation done.** Hashed tiers and rule sources. A hashed operator registry.
- **Mitigation planned.** Freeze and hash the prespec before the hold-out run (prespec §1).
- **Residual.** Low once frozen.
- **Thesis.** Ch7: state the freeze date relative to the run.

---

## Appendix A. Inconsistencies between documents

Found while writing this register. **None is fixed here.** Each needs a dated correction or addendum by the author.

| # | What disagrees | Where | Note |
|---|---|---|---|
| A1 | "No style has more than 15 expected blocking findings" / "the largest blocking cell is 15 expected findings", against blind (expanded) hexagonal n = 18 (corrected) or 19 (uncorrected), and nestjs 13/14 | `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md:43`; `Docs/DiagnosticRuns/v1.3-reference-baseline-2026-10-15.md:57` vs `:33`, and after-member-facts `:18`, `:154` | True only in the author view (max 13 uncorrected, 12 corrected). The conclusion (no lower bound reaches 0.90) still holds. |
| A2 | §5 "Against the exit targets" quotes blind recall clean 0.87, nestjs 0.79, hexagonal 0.68, against the corrected table's 0.86, 0.77, 0.67 | `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md:181` vs `:15-18` | The correction says the tables below were left as written, but §5 is prose and carries no marker. |
| A3 | κ gate definition: unspecified κ, author vs Gemini / "κ (three-way) ≥ 0.60 with n ≥ 30" / "κ ≥ 0.60 on the binary split" | `Docs/v1.3/validation-protocol.md:32`; `Docs/v1.3/labelling.md:142`; `Docs/v1.3/human-labelling-protocol.md:61` | Three gates on the same name. |
| A4 | Second-rater load and role: "30 items rated independently" (an audit), against "an independent rater" who is "the primary human reference" with 60 or 120 items plus 20 cases | `Docs/v1.3/validation-protocol.md:33`; `Docs/v1.3/labelling.md:142` vs `Docs/v1.3/human-labelling-protocol.md:28-31`, `:44` | Also conflicts with the qualification at `human-labelling-protocol.md:52` (V13-TV-D1). |
| A5 | "Nothing else under `daedalus-sealed/` was opened", against construct-decisions citing `daedalus-sealed/v1.3-blind/blind-out/summary.md` | `Docs/DiagnosticRuns/v1.3-reference-after-fixes-2026-10-15.md:30`; `…after-member-facts-2026-10-15.md:101` vs `Docs/v1.3/construct-decisions.md:12` | Not a number, but a factual statement that disagrees. Different agents, so both may be true of their own unit; the register cannot tell. |
| A6 | DDD README: "the blind re-derivation is still to be done", against blind DDD scores of 9/9 | `tests/fixtures/v1.3-reference/ddd/README.md:51-52` vs `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md:19` | Stale README. |
| A7 | DDD blocking n: development 9/9 counts FF-DS01 (deferred tier, Q15) as a blocking TP; the prespec rule would exclude it (8/8) | `results/v1.3-reference/after-member-facts/scores.json` (ddd FF-DS01 tp 1); `Docs/v1.3/holdout-prespec.md:57` | The pooled 54/54 becomes 53/53 under the hold-out rule. |
| A8 | Headline view: summaries headline the author cycle-normalised 54/54 (`papers/STATUS.md`); the prespec makes literal figures primary (author literal 49/54) and the blind manifest the pass reference (50/64 recall) | `papers/STATUS.md` vs `Docs/v1.3/holdout-prespec.md:55-56`; after-member-facts `:22` | V13-TV-D2. |
| A9 | Seed floor: the protocol requires ≥ 20 planted violations per style; the counts are 10, 9, 10, 11, 12 (expected blocking findings 12, 11, 10, 12, 9). No document reports the floor as met or missed. | `Docs/v1.3/validation-protocol.md:51`; manifests (V13-TV-S2) | |
| A10 | Judge target: requirements set catch ≥ 0.80 per operator; the qualified defensible figure is 16/21 = 0.76, and FRAMEWORK-LEAK pooled is 12/17 = 0.71. No document reads these against the target. | `aidlc-docs/inception/requirements/v1.3-validity-requirements.md:47`; `Docs/DiagnosticRuns/v1.3-judge-catch-round2-2026-10-15.md` header note (16/21 = 0.76); `Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md:129` (FRAMEWORK-LEAK 12/17) | Development, construct sensitivity. A reading, not a recount. |

Checked and consistent: the corrected pooled sums (54 = 12+11+10+12+9; 50/64 and 50/54 per style); 71 = 5 + 14 + 52 variants; the judge sums (9/11 + 21/24 = 30/35; 13/16 + 3/5 = 16/21; 2/4 + 10/13 = 12/17; 3/33 + 5/14 = 8/47); the SO4 per-operator sums (73, 67/73); the fidelity row counts (39 + 50 = 89; 1996 + 50 = 2046; 218+202+329+2 = 751; 218+308+639+2+829 = 1996); and the Wilson thresholds in `holdout-prespec.md:73` (35, 53, 69).
