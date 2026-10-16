# v1.3 role-separation plan (before the hold-out run)

**2026-10-16. Status: proposal, for the author and the director.** It addresses V13-TV-D1 (role overlap) and V13-TV-I1 (same-vendor authorship) in `Docs/v1.3/threats-register.md`. It changes no protocol by itself. Each adopted item goes into the frozen hold-out prespec (`Docs/v1.3/holdout-prespec.md` §1) or into a dated protocol addendum, **before** `<FREEZE_SHA>` is filled.

## 1. The problem, in one table

Today one person, or one model family, holds every role:

| Role | Who today | Evidence |
|---|---|---|
| Rule and preset author | the author, with Claude agents | `presets/*.yaml` (commits by Claude agents); `Docs/v1.3/rule-tiers.md` |
| Rule-source writer | Claude agent (paraphrases); the author to verify | `Docs/v1.3/style-rule-sources.md:3` |
| Reference project and author-manifest writer | Claude agents | `Docs/v1.3-reference-notes.md:222` |
| Blind key writer | Claude-family agent | `Docs/v1.3/holdout-prespec.md:22` |
| Hold-out project and key writer | Fable model (Claude family) | `Docs/v1.3/sealed-hashes.md:30` |
| Judge | `claude-opus-5-5` | `Docs/v1.3/judge-catch-frozen.md:35` |
| Adjudicator (dev disagreements) | the author | `Docs/v1.3/validation-protocol.md:17` |
| Hold-out defect classifier | the author | `Docs/v1.3/holdout-prespec.md:89` |
| Rater | the author (audit; secondary rater); the director proposed as second rater | `Docs/v1.3/human-labelling-protocol.md:44-46`; `Docs/v1.3/director-email-draft.md:28` |
| Decider (construct questions, ADRs, tiers) | the author | `Docs/v1.3/construct-decisions.md:3`; `Docs/v1.3/adr-v13.md:7` |
| Examiner and supervisor | the director | |

There are two separate problems:

1. **Interest.** The person who benefits from a result writes or approves the rule, resolves the disagreement and rates the output.
2. **Vendor.** Every artefact that could disagree with the tool comes from the model family whose blind spots it would share.

Human separation fixes (1) but only partly fixes (2). A non-Claude model fixes part of (2) and none of (1).

## 2. Principles

- **P-R1. Decide before you key.** Rules, tiers and construct readings are the author's to decide. They are decided and dated *before* any new key is written. A decision dated after a key it affects is reported as post-hoc.
- **P-R2. Whoever writes a key does not adjudicate it.** No one adjudicates a disagreement that involves their own key, rule or output.
- **P-R3. The primary human reference is someone with no stake.** No authorship, no supervision, no co-authorship, and no rating of the director's own student's work.
- **P-R4. At least one key per item from outside the Claude family.** It is reported as its own manifest. It is never merged into the Claude keys.
- **P-R5. Disagreements are reported, not resolved away.** Where nobody without a stake can adjudicate, the disagreement stays a disagreement in the figures.

## 3. Proposed roles

| Role | Proposed holder | Must not also be | Inputs | Output |
|---|---|---|---|---|
| **Decider** (construct questions, tier ADRs, `style-rule-sources.md` corrections) | the author | adjudicator of any key that the decision affects | sources, construct-decisions sheet | dated ADRs, merged before X |
| **Key writer K-C** (existing) | Claude-family agents: author-manifests, blind manifests, hold-out | | as today | unchanged; sealed keys never edited |
| **Key writer K-G** (new) | Gemini via API, tools off (§4.1) | rater of the same items | comment-stripped source, opaque paths, verified `style-rule-sources.md`, tier rule names and constructs, the spec's layer declarations | a third manifest per case, hashed before the tool run |
| **Key writer K-X** (optional) | Codex CLI, a GPT model (§4.2) | | same as K-G | a fourth manifest, for K-G vs K-X agreement |
| **Primary rater R1** | an independent professional TypeScript developer (§5); **not the director** | key writer, adjudicator, decider | the union sheet of `human-labelling-protocol.md` | primary human reference |
| **Secondary rater R2** | the author | adjudicator of R1 disagreements | the same sheet | agreement pairs only (unchanged) |
| **Model rater R3** | Gemini *meaningful* labeller (existing) | K-G on the same items in the same run (use a separate session and seed; report the overlap) | `labelling.md` §5 | agreement only |
| **Adjudicator (dev set)** | R1, on a paid, bounded sheet: the 39 reference rows, the 39 E1 and 218 SO4 barrel fidelity rows, and the 100 agreement samples | author of the rule or the key | `adjudication.csv` files, comment-stripped excerpts | `human_verdict` filled; the author's own classification kept in a separate column |
| **Adjudicator (hold-out)** | nobody. Disagreements are reported (`holdout-prespec.md` §7). R1 classifies defect *classes* blind to the tool's verdict; the author's classification sits beside it. | | | the defect ADR carries both columns |
| **Unsealer and witness** | the author unseals; the director witnesses (receives the hashes, confirms the freeze diff is empty) | | the hashes, `git diff X Y` | a signed line in the run report |
| **Examiner** | the director | rater, adjudicator | the report | |

**Why the director should not rate.**
- The human protocol's own qualification excludes anyone with "part in … writing the thesis" (`human-labelling-protocol.md:52`). Supervision is such a part.
- The director's ratings would also be the ones they later examine.
- The director's role is better used as witness of the freeze and the unseal, and as the decider of which option (A: 60 items, or B: 120 items) the sheet uses (`human-labelling-protocol.md:26`).
- The draft email (`director-email-draft.md:28`, `:63`) should be changed to ask for a *recommendation* of a rater, not for the director's own ratings. That edit is the author's; it is not made here.

## 4. What a non-Claude model can do

### 4.1 Gemini via API as independent key writer K-G

- **Route.** The existing `GeminiProvider` (U4), as used by `scripts/v1.3/label-meaningful.ts --provider gemini`:
  - no tools;
  - temperature 0;
  - a JSON `responseSchema`;
  - the key read from `GEMINI_API_KEY` and scrubbed from logs, errors and cassettes (`Docs/v1.3/labelling.md:126`).
- **New code needed** (not written here): a `write-keys` mode that emits the manifest schema (`expectedFindings`: rule construct name, file, target, reason, confidence).
  - It shares the cassette store and the `--estimate` dry run.
  - It is tested on the development set before use.
- **Inputs.**
  - The case's source with every comment removed (`excerpt-scrub.ts` logic applied to whole files).
  - Paths rewritten to opaque case ids, so no variant name is visible (V13-TV-I4).
  - The verified `style-rule-sources.md` rows for the style, with rule ids cut, as in `meaningful-prompt.ts`.
  - The tier table's construct names.
  - The spec's layer and context declarations.
  - Nothing from the tool: no Cypher, no preset rule list, no tool output.
- **Where it runs.**
  1. On the **48 new seed variants** of `Docs/v1.3/seed-floor-plan.md`, before the tool runs on them. This gives each new variant a non-Claude key from the start.
  2. On the **hold-out projects**, as a third manifest. The author runs it inside the unsealed temporary directory, after X is frozen and **before** the tool run. Its output is hashed and committed unread, then scored like the blind manifests (`holdout-prespec.md:56`: each manifest scored on its own). The prespec must name this before freeze, because adding a manifest after the run would be a degree of freedom.
  3. On the **development set**, once, to measure K-G against K-C and the tool. This is a calibration of the key writer, not of the tool.
- **What it gives.**
  - Recall and precision against a non-Claude key.
  - Agreement of K-G with K-C, as κ per style on case verdicts and finding-level overlap.
  - Where K-G and K-C disagree, the item goes onto R1's union sheet.
- **What it does not give.**
  - Human ground truth.
  - Independence from the public style literature, which all vendors were trained on.
  - Independence of the *projects*: they stay Claude-written.

### 4.2 Codex (GPT) as K-X, or as a second labeller

- **Route.** The existing `codex` provider (`Docs/v1.3/labelling.md:125`): read-only sandbox, web search off, user config and rules ignored, a fresh empty cwd, keys stripped from the child environment, and tool steps failing closed.
- **Uses.**
  - K-X keys on the same inputs as K-G, so K-G and K-X agreement measures cross-vendor key reliability.
  - Or a fourth *meaningful* labeller, for agreement only.
- **Cost and limits.**
  - The free plan's window moved about 5 points per E1 project in the pilot (`Docs/generator-protocol.md:206`). Estimate with `--estimate` first.
  - A usage-limit message stops the run, so plan for a partial run being reported as partial.

### 4.3 A vendor-independent arm

The keys alone leave the projects Claude-written. Two arms remove that:

1. **External projects.** One public project per style (validation protocol §1, not yet done; `holdout-prespec.md:27`).
   - Rules are written by someone outside the project, for example dependency-cruiser `forbidden` rules or Nx module boundaries.
   - The keys are written by R1 and K-G, not by the author.
   - Prefer non-NestJS stacks for layered and hexagonal (V13-TV-E2).
2. **Non-Claude-written mini references.** Codex or Gemini writes one small project per style with planted violations and near-misses. It works from the verified rule sources only, with no access to this repository. R1 keys a sample.

Both are reported as separate arms. Neither ever enters the hold-out figures.

### 4.4 Optional: cross-vendor judge sensitivity

Run the frozen judge rubric with Gemini as the judge on the FRAMEWORK-LEAK and PERSIST-IN-DOMAIN seeds and twins: the defensible set, 21 seeds. It is a sensitivity arm. It never replaces the judge (which is non-blocking in v1.3) and is not a tuning input.

## 5. Recruiting R1

- **Profile** (unchanged from `human-labelling-protocol.md:52`): a professional TypeScript developer with shipped production code in at least 2 of the 5 styles.
- **Exclusions:**
  - the director;
  - anyone supervised by the author or the director;
  - co-authors;
  - anyone who has seen this repository.
- **Where to look:**
  - a former colleague of the author's in industry;
  - a developer in another research group;
  - a paid reviewer through the university.

  The director's recommendation is welcome; the director's own rating is not.
- **Conflict-of-interest declaration** signed before calibration, and recorded in the run report.
- **Load.**
  - Calibration: about 60 minutes.
  - The labelling sheet: option A, 60 items, about 2–3 h; option B, 120 items, about 5–10 h.
  - The 20-case "anything else?" pass.
  - The dev adjudication sheet of §3: about 396 rows (39 + 39 + 218 + 100), mostly one-line barrel checks. Estimate 3–4 h, and offer a seeded subsample if that is too much.
- **Compensation.** State it in the invitation.
- **Fallback if no R1 is found in time.** Run the hold-out with K-G and K-X as the only non-author keys. Report the human reference as "not available". Do not substitute the director or the author.

## 6. Order of work (all before the hold-out run)

1. The author answers the construct questions and merges the ADRs (P-R1). Date each one.
2. The author corrects `style-rule-sources.md` from the verification. Hash the corrected file, and keep the old hash, which the hold-out keys used.
3. Build `write-keys` (K-G, optionally K-X) and the comment-stripping and opaque-path materialiser. Test them on the development set.
4. Write the 48 seed variants (`seed-floor-plan.md`), comment-free with opaque names. Keys: K-C (an agent that did not write the variant) plus K-G. Run the tool. Record the result as a **development round**, not validity.
5. Recruit R1. Calibrate on the development calibration sheet.
6. R1 fills the dev adjudication sheets (§3).
7. Freeze: fill `<FREEZE_SHA>`, `<N_PER_STYLE>`, the manifests list (K-C blind, K-G, optionally K-X), the role matrix of §3 and the κ definition (V13-TV-R2). Hash the prespec. The director witnesses.
8. Unseal. Run K-G (and K-X) on the hold-out sources; hash and commit unread. Run the tool once. Commit the outputs.
9. Labelling: R1, R2 and R3 on the union sheet. No adjudication.
10. Defect ADR with R1's and the author's classifications side by side.

## 7. What stays overlapping, and how it is declared

- The author still defines the rules, the tiers and the construct readings. That is the thesis's contribution, and it cannot be delegated. It is declared, and dated before keys (P-R1).
- The projects in the hold-out are Claude-written. Only the external and non-Claude arms escape this.
- K-G and R3 are the same vendor (Gemini). Report their agreement, and do not count it as independent confirmation.
- The Ch7 role matrix lists the holder of every role, for every artefact.
