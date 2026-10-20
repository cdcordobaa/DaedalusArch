# Fable re-check 3 of the Study 2b pre-registration: D_sem per sem-01 (2026-10-20)

Scope: §4 "Semantic layer" item 1 and item 4 last bullet, changelog first entry, P8, §6 V3 row, §8 DV2, `ops/decisions.md` DELEG11, the two analysis scripts and their test, against `ops/notes/sem-01-semantic-validity-plan.md` and the hold-out note §10. Read-only. Nothing under `../daedalus-sealed/` or the MEAN-01 sample was opened.

## Required contents

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | D_sem = D minus findings with a stable, grounded exception claim; no "real violation" class | **RESOLVED** | Prereg §4 line 259: "D minus the findings that carry a stable, grounded exception claim (C4 has no 'real violation' class; sem-01 §0)". Line 258 keeps the C4-01 §4.2 class definitions and the rule that `intentMatch` and `severityClass` remove nothing. T12 wording ("if every proposed exception were accepted") present. DELEG11 row carries the same definition |
| 2 | Evasion threat: two-way D_sem, evasion candidates per cell, reading rule | **RESOLVED** (one wording gap, fix 1) | Line 260: ways (i) all claims, (ii) citations only non-agent text (task spec, preset or spec, unchanged skeleton), git-blame classifier. Line 261: candidates = claims citing agent-written text created at the same or a later step, count per cell. Line 262: P3 as in sem-01 §3. Line 263: `agentJustificationReading`, "semantic reading sensitive to agent-written justifications". Code: `study2b-analyse.ts:166-171` loads `--dsem` and `--dsem-nonagent`, sums `evasionCandidates` per cell (`:158-163`), prints them in `tables.md` (`:373-375`); `lib/study2b-analyse.ts:300-310` implements the rule; test `:105-110` covers sensitive, agree and missing-file cases |
| 3 | C4 precondition with sem-01 bars, else "not run" | **RESOLVED** | Line 264 cites sem-01 §2 rows a1 and a2 and requires the Claude configuration first; line 277 gives the call figures (8/16, 32/64, cap 80). Bars checked word by word against sem-01 §2: a1 identical in substance; a2 identical in substance (prereg omits "both" before "near-miss twins 3 and 4" and "95 %" before "Wilson"; neither changes the bar). DELEG11 row states the same precondition |
| 4 | Neutral wording, no chat quotes | **RESOLVED** | No curly quotes or "the author said/wrote" anywhere in the prereg or `ops/decisions.md`. §4 heading and line 255 state the decision as a decision. DELEG11 row is a neutral record with the sem-01 refinement appended |

## Other checks

- **Hold-out text.** §6 V3 row and §8 DV2 match the hold-out note summary and §10: three attempts, attempt 3 aborted at its first tool call, `results/v1.3-holdout/run-1-aborted/`, no figure seen, whether the one live run is spent is the author's open call. Header line 9 ("the hold-out attempts (no figure)") is consistent.
- **D, confirmatory tests, scorer unchanged.** Line 255 states it. In code, the D decision is computed before and independently of the D_sem inputs (`study2b-analyse.ts:171` reads `decision` from D), both alternatives are skipped under `--plant`, and the D_sem recompute uses `driftRun` and `STUDY2_S2D01` with the same identity rule. The change touches only `scripts/v1.4/`, outside the frozen paths.
- **`semanticReading`** unchanged from re-check 2 (sign of T compared for a rejection, so H3 included); test lines 101-107 still cover it.
- **P8 hashes.** The row lists new sha256 values for both scripts and the commit says they were updated. I cannot compute hashes with read-only tools, so this is **not verified** here. Verify at the re-dating step as usual.
- **Changelog.** The first entry is correct in content and carries the `[[REDATE]]` placeholder; the status line still says "both Fable re-checks". Both are expected to be filled at re-dating, as the brief says.

## Findings needing a fix before dating

1. **Reading rule wording vs code (line 263).** The prereg says the two D_sem versions disagree when they differ "in the Holm decision or the sign". The code (`lib/study2b-analyse.ts:306`) compares the sign only for a rejection, the same convention the file already uses for `semanticReading` (line 263, "and, for a rejection, the sign") and for D/D†. Two non-rejections with opposite T signs are "agree" in code but "sensitive" by the registered text. Add "(for a rejection)" so the registered rule and the hashed script say the same thing. No code or hash change.
2. **Classifier timing (lines 260 and 264).** The provenance classifier and the D_sem writer are registered as "built and tested before the first C4 call". sem-01 §6 and §8 item 1 place that build "before the run". The first C4 call on 2b comes after the 2b snapshots and findings exist, so the classifier's practical choices (blame across renames, skeleton boundary) would be settled with 2b output in view, which is the forking path T1 exists to close. Register "committed before the first 2b call", the discipline the file already applies to the acceptance runner (D12).

VERDICT: GO-WITH-FIXES
- Fix 1: line 263, second reading rule: "disagree in the Holm decision or (for a rejection) the sign of T", matching `agentJustificationReading`.
- Fix 2: lines 260 and 264: the provenance classifier and the D_sem writer are committed before the first 2b call, not before the first C4 call, per sem-01 §6 and §8.
