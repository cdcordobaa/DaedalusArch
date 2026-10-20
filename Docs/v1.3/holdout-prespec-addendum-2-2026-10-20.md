# Hold-out prespec, addendum 2: patch-header deviation and the r_f fallback (2026-10-20, before attempt 2)

**Recorded 2026-10-20T10:04Z, before attempt 2, and before anything of it was done.** This is a separate addendum to the frozen `Docs/v1.3/holdout-prespec.md`, which is not edited, with its own row in `Docs/v1.3/sealed-hashes.md`. Decision: `ops/decisions.md` DELEG5, made under the author's delegation (GO-2B: "a red item is made green where realistic; otherwise register what is lost"). It follows addendum 1 (`holdout-prespec-addendum-2026-10-20.md`, DELEG4) and attempt 1 (`Docs/DiagnosticRuns/v1.4-holdout-2026-10-20.md`). Attempt 1 stopped at the structure check: 34 variant patches across the four patch-format styles target a file absent from the clean project ("patch modifies a file that does not exist").

## 1. Deviation: patch file headers (attempt 2, one try only)

**This is a content change to the hold-out, declared as one.** Prespec §6 says "no hold-out case is moved, dropped or re-labelled", and the runbook says "the hold-out is never edited". This deviation departs from both, in one narrow, mechanical respect only:

1. A fresh script-made copy of the sealed tree is checked against the sealed hash (`1379b561…`).
2. A blind session, with the same flags and allow-list as attempt 1 plus Write and Edit on `converted/` only, re-runs the path-only conversion. For every variant patch whose target file is absent from that style's clean project, it rewrites **only the patch's file-header lines** into a creation against `/dev/null`: `--- /dev/null`, `+++ b/<path>`, and `new file mode` if the format uses it. **No hunk line changes** (`@@`, `+`, `-`, space-prefixed or `\`), and no other file changes.
3. A script checks, independently, three things. For each rewritten patch, the sequence of hunk lines is byte-identical to the source patch's. Only header lines differ, and the new header lines have only the creation forms above. Every other converted file equals a source file by content hash. Only counts and booleans are printed.
4. `holdout-run.ts --dry-run` runs at the freeze tag on the four patch-format styles (`--style clean-architecture,layered,nestjs,hexagonal`).
   - **If it reports 0 problems,** the hold-out runs live **once**, under the prespec and addendum 1 (aggregates only), and the figures are reported as computed against ADR-V14-04.
   - **If any problem remains:** STOP. No further change and no live run; the redacted problem counts are reported.
5. ddd stays not scorable: the frozen loader reads ddd only in overlay format, and the sealed ddd is in patch format.

**Why this is not tuning.** No rule, tier, template, preset, spec, extractor option, matcher, scorer or threshold changes. The header rewrite is decided from the clean project's file list, not from any tool output. The tool has not run on the hold-out at all; attempt 1 stopped before the live run. What the planted change adds (the hunk) is byte-identical. Only the declaration of whether the file pre-exists changes. That declaration is what the patch's own hunks already imply, given that the file is absent from the clean project.

**What it costs.** The scored cases are no longer byte-identical to the sealed ones. Any figure from attempt 2 is reported as "hold-out, with the declared header-only repair of addendum 2", next to the count of repaired patches.

## 2. Fallback for ADR-V14-04 §4 part A: r_f without a hold-out figure (applies whatever attempt 2's outcome)

**Fallback F-RF (citable as "hold-out prespec addendum 2, §2").** If no hold-out figure exists for layered after attempt 2, ADR-V14-04 §4 part A takes the per-family recall r_f from the frozen development-set record run:

- **Source:** `results/v1.3-reference/after-construct-answers/scores.json`, as committed at the freeze commit X = `4d28d280` (sha256 `4b0c8164113322a82999b859af4070ab4589b71201489b25f26df007718e3f4b`). The F8 record run of `Docs/DiagnosticRuns/v1.4-freeze-2026-10-20.md` §2 is the run that produced it.
- **Value:** r_f = the blocking recall of rule family f in the view `blind-primary` for style `layered`, from `views[style = layered, view = blind-primary].perRule[ruleId = f].counts`, as tp / (tp + fn). A family with n = 0 in that view gets r_f = 1 − (the pooled layered blind-primary miss rate). It is reported as such.
- **Declared as** a development-set estimate, not validity evidence. The development set was used for tuning, so r_f is likely optimistic. Part A's margin (A = 0.05) and part B are unchanged, and part B (seeded recall on agent code, by arm) does not depend on the hold-out.
- **Consequence for Study 2b.** Under this fallback, **layered stays a confirmatory stratum in Study 2b**, on condition that §4 parts A and B both pass, with this limitation stated up front. The instrument's recall for layered is **"characterised on the development set, not validated on a hold-out"**. The thesis wording of ADR-V14-04 §3.3 becomes:
  > "The instrument's recall for this style is characterised on the development set at X [L, U]; it was not validated on a hold-out. Its misses are non-differential between arms by a pre-registered check (per-family recall from the development set), so the arm comparison is not biased by them. Absolute counts are under-counts."
- **If attempt 2 produces layered hold-out figures,** this fallback does not apply. r_f comes from the hold-out, as ADR-V14-04 §4 says, and the hold-out claim level is reported as computed.
- The Study 2b pre-registration (cloud draft, PR #316) cites this section for r_f.

## Changelog
- 2026-10-20: addendum 2 (DELEG5), before attempt 2.
