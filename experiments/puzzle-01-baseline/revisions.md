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

## R7, 2026-10-21: declared house rules (`seed/ARCHITECTURE.md`)

- A short, neutral `ARCHITECTURE.md` is added at the root of every puzzle seed. It is part of the seed, so a later tool
  arm starts from the same file. P1 and P2 share the DDD text (one aggregate per transaction, other aggregates through
  domain events; contexts only through their published interface; business rules in the domain model). P3 has the
  Hexagonal text (ports carry only domain types; vendor and infrastructure code stays in adapters). P4 has the Layered
  text (lower layers never depend on upper layers, with the three layers named top to bottom).
- sha256: P1 and P2 `98c9f5e2…0230`, P3 `108c68b7…07b4b`, P4 `9197ba41…90fd`.
- **Hint audit** (`hint-audit/architecture-md-audit.txt`): each file is audited as a rung-L3 frame (a frame that
  states rules) with the puzzle's spec, and with 51 puzzle, feature and harness words added as terms (transfer, limit,
  tier, discount, points, overdue, suspend, loan, freight, carrier, trap, clean, seed, step, task, feature, …).
  0 FAIL in all four. One extra-term WARN: "library" in P3's file, in "infrastructure library" (software sense). It is
  not P4's feature, and P3 is not run. Verdict: no task, step, feature or trap is mentioned. The other WARNs are the
  architecture words the file is meant to declare.
- **verify.ts re-run** (`verify/verify-r4-r7.json`): P1, P2, P4 VALID. Every solution tree's sha256 is unchanged. Each
  seed's sha256 changes only by `ARCHITECTURE.md`: with the file removed, the four seeds hash to the values recorded in
  `verification.json` (`f55cc74f…`, `6927bf75…`, `49e992ed…`, `cba63325…`). New seed hashes: P1 `2822f1bc…`,
  P2 `a7b030ec…`, P3 `c206957a…`, P4 `eb907db1…` (full values in `verify/verify-r4-r7.json`). Tests, tsc and oracle
  verdicts are equal to `verification.json` on every tree.

## R4, 2026-10-21: oracle repairs (before any generator call)

- **P1 SG1** (`p1-transfers/oracle.ts`): also fails on any method of a store or repository type (name ending in
  Repository / Store / UnitOfWork / Database / Db), whatever its name, that takes two `Account` values or two account
  ids (an `AccountId`, or a `string` parameter named like from / to / source / target / payer / payee / …Id) and is not
  a read (find / get / load / list / exists / has / count / read / by / of / take). Methods already named
  save / persist / … stay under the original rule.
- **P2 SG1** (`p2-loyalty/oracle.ts`): also fails on any comparison under `src/sales/` with an operand that is the
  numeric literal 500, 1500 or 2000, or a const under `src/sales/` initialised with one of them.
- **Checks.** Both rules fire on synthetic trees (a P1 store with `moveBetween(from: Account, to: Account)` and
  `applyTransfer(fromId: string, toId: string)`; a P2 sales file comparing `p >= GOLD` with `GOLD = 1500`, and
  `p > 2000`). On seed, clean, trap and trap-alt the verdicts equal `verification.json`. Oracle sha256: P1 `74f9637e…`,
  P2 `9722c3ca…`.
- Hand-read categories for verdicts that may be wrong are pre-registered in `oracle-hand-read-categories.md`.

## During the run, 2026-10-21 (logged; no frame, cap, outcome definition or oracle changed)

- **Driver, before the first call:** `--probes --read-only` and `--probes --skip-read`, so the brief's order of READ
  probe (1 call), smoke (1 call), then confinement probes (4 calls) could be kept.
- **CLI wrapper, before the first call:** the isolation sweep found its comment naming the experiment; reworded, sweep
  re-run (0 hits).
- **Container restart, about 02:33Z**, during session c12 step 3: the driver was killed and the in-flight call has no
  result. That call was added to `calls.jsonl` by hand and counted. c12 was recorded as an infrastructure failure and
  redrawn whole as c16 (redraw 1 of 2). The driver gained `--resume`, which rebuilds the same seeded schedule, checks it
  against the saved one, and runs the redraws, then the unfinished sessions. Isolation was re-swept after the restart
  (0 hits).
- **Scorer:** `score-baseline.ts` written during generation, inside the root-only vault, and run after it. One path fix
  (`run/turns.jsonl`).
