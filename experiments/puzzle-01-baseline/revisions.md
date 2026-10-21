# PUZZLE-01 baseline: dated revisions (R1, R4, R7)

Each revision below is made on branch `claude/puzzle-01-baseline-3yjmay` (the brief's `pilot/puzzle-01-baseline`;
this cloud session may push only to its designated branch), before any generator call, and recorded here.

## R1, 2026-10-21: restore the files `.gitignore` dropped

- **Cause.** `.gitignore` line 12 (`out/`) ignores every directory named `out`, so the source folders
  `src/application/ports/out/` of the P3 trees (and of the HEXDDD-01 S1 seed) were never committed.
- **Fix.** Added `!experiments/**/ports/out/` next to the existing `!tests/fixtures/**/ports/out/` exception.
- **P3 seed** (`seed/src/application/ports/out/TrackingPort.ts`): rebuilt from the files that import it; the tree
  sha256 equals `verification.json` (`49e992ed…2dc2`). **Exact.**
- **P3 trap** (`solutions/trap/src/application/ports/out/{TrackingPort,RatesPort}.ts`): rebuilt from the importers,
  the oracle's evidence lines (both vendor symbols on line 4 of `RatesPort.ts`) and the recorded change size (5 lines);
  tree sha256 equals `verification.json` (`6aafe20d…c15b`). **Exact.**
- **P3 clean** (`solutions/clean/src/application/ports/out/{TrackingPort,CarrierRates}.ts`): the recorded change size
  shows `CarrierRates.ts` is 7 lines, so it has a doc comment whose wording is not recoverable. About 84,000 candidate
  wordings and layouts were tried against the recorded tree sha256 (`4343db65…915d`); none matched, and the file is on
  no branch of the repository. Neither builder nor copy exists. **Not exact.** The clean tree is left without
  its `ports/out/` folder rather than committing a guessed file as if it were the original.
- **Decision (brief R1).** P3 is **dropped from this baseline run**. Its seed and trap files are committed because they
  are exact.
- **HEXDDD-01 S1 seed** (on `origin/pilot/hexddd-01`, outside this branch's write scope): its builder
  `seeds/build-seeds.mjs` regenerates `s1-hex-debt` with tree sha256 `e3cfa16c…5700`, 32 files, equal to the pinned
  value, and `--check` then reports `seeds OK`. Restorable from the builder. Not committed here (the baseline does not use
  it); the new `.gitignore` exception covers it when that branch takes the same line.
- **verify.ts re-run** (`verify/verify-r1.json`; comparison by `tools/compare-verification.mjs`): P1, P2, P4 VALID,
  every tree sha256, tsc count, test count and oracle verdict equal to `verification.json`. P3 INVALID
  (`tscSolutions`: the clean tree's missing port), seed and trap hashes equal.
