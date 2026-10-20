# Hold-out prespec, addendum 1: dated deviation (2026-10-20, before the run)

**Recorded 2026-10-20T08:53Z, before the hold-out run.** This is a separate addendum to the frozen `Docs/v1.3/holdout-prespec.md`. The prespec is not edited: its status line and runbook §B.12 rule 7 say a later note goes into a dated addendum with its own hash in `Docs/v1.3/sealed-hashes.md`. Decision: `ops/decisions.md` DELEG4, delegated by the author.

## Deviation

**What the prespec says.** §2.1–2.2: the author unseals the hold-out into a temporary directory, and `holdout-run.ts` runs on it. Freeze runbook step 5 adds: "Any other structure problem stops the freeze: the hold-out is never edited."

**What happened.** The freeze run (`Docs/DiagnosticRuns/v1.4-freeze-2026-10-20.md` §4) found the sealed tree at its sealed hash (`1379b561…`). Its layout is not the one the frozen loader reads (`scripts/v1.3/lib/reference-model.ts`, `holdout-run-main.ts`). The top level has `input/` and `out/` and no style directory. Under `out/`, four styles have no `expected-findings.json` where the loader looks, and the ddd overlay has no clean variant where the loader looks.

**What changes.** The hold-out is **not edited**: no file's content changes, and nothing is written from scratch.
1. A script copies the sealed tree to a work directory outside the repository and checks the copy against the sealed hash.
2. A separate blind session copies files from that copy into a second tree, in the layout the frozen loader reads. Only paths change. It writes a map from each content hash to its new path. It does not fabricate a file the loader needs that does not exist: a style that lacks one is incomplete and is not scored.
3. A script checks that the multiset of content sha256 over the converted files equals that over the source files (or is a declared subset of it), and that no converted file differs from its source.
4. `holdout-run.ts` at X (tag `v1.4-freeze-2026-10-20`) scores the converted tree **once**, on one capped Neo4j 5.26.x with APOC, with no code change. `--expect-sealed-sha256` is not passed, because the converted tree has new paths. Steps 1 and 3 carry the link to the seal instead.
5. The coordinator sees only aggregate figures: recall and precision per style and per rule, with 95% Wilson intervals, and the claim levels. The run directory with per-finding rows stays in the work directory and is deleted with it. `results/v1.3-holdout/run-1/` keeps aggregates only, with no reference content and no paths.

**What does not change.** X, every rule, tier, preset, spec, template, matcher and scorer; the metrics (§3), the scoring (§4), the thresholds (§5) and the V4 bar (`Docs/v1.4/adr-v4-holdout-bar.md`); "run once" (§2.3); no tuning (§6).

**Consequences, declared now.**
- Prespec §2.4 ("the outputs are committed unchanged") is replaced by aggregate-only outputs, because the per-finding outputs contain reference content. The defect ADR of §6 therefore cannot be written from the repository. It needs the author to re-derive the miss list from the sealed original; a `--from-raw` re-score is impossible once the work directory is deleted.
- Labelling after the run (§7) has no committed run outputs to start from.
- A style the session marks incomplete is reported as **not scorable**, with the reason. That is a loss: the style gets no hold-out figure and stays "characterised" under ADR-V14-04.
- The M7 graph adjudication (runbook §B.11) cannot be done after the work directory is deleted. M7 is reported literal, and adjudicated only where nothing is left to adjudicate.

## Changelog
- 2026-10-20: addendum 1 (DELEG4), before the run.
