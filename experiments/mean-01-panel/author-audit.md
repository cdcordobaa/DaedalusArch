# MEAN-01 panel: the author's 30-item audit

This is the check on the model panel (`PROTOCOL.md` §1, §6). The 30 items were drawn before any panel label:
`mulberry32(20261102).pickDistinct(M01..M60, 30)` (`scripts/lib/mutation/rng.ts`; the codebook defines no audit
draw), then sorted. Reproduce with `npx tsx experiments/mean-01-panel/panel.ts audit`.

**Items (30):** M02, M03, M05, M07, M08, M09, M10, M12, M14, M15, M16, M17, M18, M19, M21, M22, M25, M26, M30,
M31, M34, M39, M40, M41, M42, M45, M50, M55, M56, M60

## Instructions

1. Open the rater packet yourself: `audit/view/mean-01-rater-packet.md`. Read §0–§4 (the codebook as the rater reads
   it) and use §L for the layer maps. You may open the linked file on GitHub.
2. **Do not open** `experiments/mean-01-panel/labels.json`, `result.json` or `results/calls.jsonl`, or the sample
   file `results/v1.3-meaning/mean-01-sample.{csv,json}`, until your sheet is committed.
3. Label only the 30 items listed above, in the order of the sheet. For each: **A** (practitioner), **B** (style
   fidelity), each `yes` / `no` / `unsure`; a **why-not code** (`T` `W` `F` `M` `C` `X`) when A or B is `no`; an
   optional one-line note (required for `unsure` and `X`).
4. Do not change an answer after moving on.
5. Save the sheet below as `experiments/mean-01-panel/author-audit-answers.csv` (same columns), commit it, and note
   its sha256 in the commit message. Only then compare with the panel (`PROTOCOL.md` §6: Cohen's κ on A, yes vs
   not-yes; 2×2 table; observed agreement with its Wilson interval; the same for B).

## Answer sheet

```csv
itemId,A_practitioner,B_style_fidelity,why_not,note
M02,,,,
M03,,,,
M05,,,,
M07,,,,
M08,,,,
M09,,,,
M10,,,,
M12,,,,
M14,,,,
M15,,,,
M16,,,,
M17,,,,
M18,,,,
M19,,,,
M21,,,,
M22,,,,
M25,,,,
M26,,,,
M30,,,,
M31,,,,
M34,,,,
M39,,,,
M40,,,,
M41,,,,
M42,,,,
M45,,,,
M50,,,,
M55,,,,
M56,,,,
M60,,,,
```
