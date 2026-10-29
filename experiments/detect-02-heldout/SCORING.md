# DETECT-02 held-out set: scoring note

Written and committed **before** the set is scored. This is the **one and only scoring** of the sealed DETECT-02
held-out set (`SEAL.md`). It is the SO4 hold-out of the v1.5 final study
(`Docs/v1.5/final-study-preregistration.md` §4, "SO4 hold-out (separate, zero calls)"): scored once inside the study
window, at the study rule hash, under its own bars, reported beside the study and not an outcome of H1 or H2. Zero
model calls. No rule, fact, spec or scorer changes after the output is seen, and the scorer refuses to run if a
`result.json` already exists.

## Set, seal and rules

- **Set:** the sealed folder `daedalus-heldout/detect-02/` next to the repository (named in `ops/now.md` at
  `7ff498c45`): `cases/<id>/` (34 projects), `KEY.json`, `README.md`, `MANIFEST.sha256`.
- **Seal (checked 2026-10-29, before scoring):** `shasum -a 256 MANIFEST.sha256` =
  `afacdd86003b74a7b3e03557ca948db7aedfc75f4801cd2b3f1a40418a66f7ab`, equal to `SEAL.md`; `shasum -a 256 -c
  MANIFEST.sha256` passes on all 433 lines (431 case files, `KEY.json`, `README.md`); no case file outside the
  manifest. The scorer repeats both checks and stops on a mismatch. Before scoring, only the field names and value
  counts of `KEY.json` were read (to write the adapter below), not its rationales or locations, and no case file.
- **Commit:** `main` `951537f54`; `src/v15-instrument` is identical to `a228c3f94` and `ea0da2b61` (no diff).
- **Rule hash:** `experiments/hcal-05/RULES-FROZEN.sha256` has sha256 `761f37d9e5586371…` (the study rule hash);
  `cd src/v15-instrument && shasum -a 256 -c ../../experiments/hcal-05/RULES-FROZEN.sha256` passes on all 39 files.

## Scorer

The design names a scorer (`ops/notes/detect-02-design.md` §7: one command in `experiments/detect-02/EVALUATE-HELDOUT.md`),
but that file was never committed. The closest existing scorer is the DETECT-02 development scorer,
`experiments/detect-02/evaluate.ts` (`score()` and the case match in `runAll()`). It reads the rules of
`experiments/detect-02/lib`, not the study's. The pre-registration asks for the study rule hash, so the adapter
`experiments/detect-02-heldout/score.ts` keeps that scoring logic and calls the study instrument
(`src/v15-instrument`, all 20 rules) exactly as the study scorer does
(`experiments/v15-study/score-study.ts`: `runTree(tree, rules, { spec, scratch })`, the case's `spec.yaml`, the
default harness tsconfig). Command:

```
npx tsx experiments/detect-02-heldout/score.ts --root ../daedalus-heldout/detect-02
```

Output: `results/detect-02-heldout/result.json`.

**Fixed before scoring:**
- KEY family to rule family: `D4` → D4 (R-D4); `cross-context-write` → D4 (R-XCTX; D4 = R-D4 or R-XCTX in the
  DETECT-02 scorer); `D5/D3` → D5; `D9` → D9; `H5` → H5; `concrete-injection` → H4 (R-INJ);
  `vendor-call-in-transaction` → RTX (R-RTX). Each rule's family is its `// family:` header.
- Only findings with status `violation` count (`allowed` and `info` are listed, not counted).
- **Detected (primary):** a positive is a TP when any violation of its family fires on the tree, as in `score()`.
  Also reported: **located** (a violation of that family names the labelled file, or the file is on its path, as in
  `runAll()`), the same file and line, and whether the rule the family was built for fired.
- **False positives:** for each family, every tree not labelled with it on which it fires, split into twins, negative
  controls and positives of another family. Every violation on a twin or a negative control is listed.
- **Twin discrimination:** per pair, positive flagged and its twin not flagged for that family.

## Bars (copied; no numeric threshold is registered)

`ops/notes/detect-02-precision-note.md` §3, bar 3:

> **Held-out (one time, after 1 and 2 are committed):** reported per family (TP / FP / FN), twin discrimination and
> negative-control false positives, **whatever they are**. No rule or fact changes after the held-out outputs are
> seen. The sealed manifest hash is checked before the run; a mismatch stops it.

`ops/notes/explore-02-needs-and-gaps.md`, N2 (bar column): "Recall, twin discrimination and negative-control false
positives reported per family". `ops/notes/detect-02-design.md` §7 adds a symbolic+semantic reading under a separate
40-call cap; the pre-registration makes this scoring zero-call, so that reading is not run.
