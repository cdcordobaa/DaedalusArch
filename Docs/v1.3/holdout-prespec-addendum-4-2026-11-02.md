# Hold-out prespec, addendum 4: attempt 4, the frozen preset in the spec role (2026-11-02, before attempt 4)

**Recorded 2026-11-02T03:05Z, before attempt 4, and before anything of it was done.** This is a separate addendum to the
frozen `Docs/v1.3/holdout-prespec.md`, which is not edited, with its own row in `Docs/v1.3/sealed-hashes.md`. Decision:
`ops/decisions.md` DELEG-H5, the content-change delegation that DELEG-H4 named as the condition for a later attempt. It
follows addenda 1–3 and the run note `Docs/DiagnosticRuns/v1.4-holdout-2026-10-20.md` (§10: attempt 3's live run
aborted at its first evaluate call, `Schema validation failed with 4 error(s)`, the required spec keys `spec_version`,
`architecture`, `scoring` and `confidence_thresholds` missing; 0 output files, 0 findings, no figure seen).

## 1. The defect and the repair

The frozen loader (`scripts/v1.3/lib/reference-model.ts` at X = `4d28d280`, header) defines the patch-format layout:
`spec.yaml` is **"the firewall spec (a verbatim preset copy)"**. The file that held the spec role in attempt 3 is not a
firewall spec the frozen tool accepts. The spec is part of the frozen tool, not of the cases: the hold-out cases are
planted variants of a clean project, scored against the style's frozen preset.

**Repair (attempt 4, one try only).** Attempt 3's steps 1, 3 and 4 unchanged (fresh copy checked against
`1379b561…`; the deterministic header-only repair of creation patches; the attempt-2 verifier). Step 2 changes in one
respect: **the attempt-1 adapter prompt was not preserved** (it lived only in the 2026-10-20 coordinator session and
its deleted work directory; a search of the repository, its history and the local transcripts on 2026-11-02 found
the flags and the allow-list but not the prompt). The blind adapter therefore runs with the same flags and allow-list
and with a **new prompt, committed verbatim before the session** (`Docs/v1.3/holdout-adapter-prompt-attempt-4.md`,
hash in `Docs/v1.3/sealed-hashes.md`). The prompt never decided validity: the adapter's output is accepted only if the
attempt-2 verifier finds it path-only (every converted file equals a source file by content hash, 0 files whose content
matches no source file, a consistent MAP). Then one added step, by a deterministic script, not a model:

- **3b.** For each patch-format style (`clean-architecture`, `layered`, `nestjs`, `hexagonal`), the file the style's
  descriptor names in its spec role is replaced by a byte copy of `presets/<style>.yaml` at X. The script prints, per
  style and as booleans or counts only: whether the replaced file's sha256 equalled the preset's (expected: false),
  whether the replaced file parsed as YAML with all four required spec keys (expected: false), and the sha256 prefix of
  the copied preset, which must equal the hash at X (clean-architecture `285447919fcedee0`, layered `f0d9045de2364b8d`,
  nestjs `0172db1cb6160d5e`, hexagonal `d085d6b9badca2e7`). No content of the replaced file is printed or kept.

**Why this is not tuning.** No rule, tier, template, preset, spec content, extractor option, matcher, scorer or
threshold changes; the spec put in place is the frozen preset itself, byte for byte, and the choice is fixed by the
loader's own layout definition, not by any tool output. No case (project, patch hunk, expected findings) changes. The
tool has produced no finding on the hold-out; nothing has been seen.

## 2. Gate and run

1. The verifier of addendum 2 runs unchanged, plus one check: for every style, the spec-role file equals the frozen
   preset by sha256, and every other converted file is accounted for as in attempt 3.
2. `holdout-run.ts --dry-run --style clean-architecture,layered,nestjs,hexagonal` at the freeze tag.
   - **0 problems:** the live run **once**, on one capped Neo4j 5.26.x with APOC (heap 512m), aggregates only
     (addendum 1). Figures are reported as computed against ADR-V14-04 option (1), layered first.
   - **Any problem, or any abort of the live run:** STOP. No further change and no further attempt: the hold-out is
     then reported as "not scored" for good, with the defect recorded.
3. **This is the first scoring run** (DELEG-H4). After a live run that produces findings, the hold-out is spent.

**Reporting.** Any figure is reported as "hold-out with the header-only repair of addenda 2–3 (34 patches) and the
frozen preset in the spec role (addendum 4); ddd not scorable". The figures describe the v1.3 instrument at the freeze
tag `v1.4-freeze-2026-10-20`; they are not figures for the v1.5 instrument. The disclosure of addendum 1's run note
(the 34 project-relative paths printed once into a coordinator transcript, 2026-10-20) stands.

**What it cannot change.** Study 2b was registered and scored under fallback F-RF (addendum 2 §2); a hold-out figure
now is reported beside it and does not re-open Study 2b.

## Changelog
- 2026-11-02: addendum 4 (DELEG-H5), before attempt 4.
