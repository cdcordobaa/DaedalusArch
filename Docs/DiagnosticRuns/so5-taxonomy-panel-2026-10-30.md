# SO5 failure-pattern taxonomy: model-panel second coder (2026-10-30)

**What.** Second coding of the 266 SO5 episode cards (`experiments/so5-taxonomy/`) by a three-model panel (two
`claude-fable-5-1`, one `claude-opus-5-5`; the DEV-1 pattern), each coder given only the codebook text and one card,
blind to the first coder, the facets and each other. Panel label = 2-of-3 majority. Protocol committed before the first
call: `experiments/so5-taxonomy/panel/PROTOCOL.md`.

**Run.** 798 calls through the Claude CLI judge route (CLI 2.1.312), all valid on the first attempt; raw answers in
`experiments/so5-taxonomy/panel/answers.jsonl`.

**Result.**

| Measure | Value |
|---|---|
| Cohen's κ, first coder vs panel majority (266 cards) | 0.709 (raw 0.744) |
| Unresolved cards | 0 |
| Panel Fleiss' κ | 0.982 |
| κ hunk-read / evidence-only / oracle sub-goal cards | 0.691 / 0.479 / 0.266 |
| κ on the 146 v1.5 cards (descriptive, not declared) | 0.485; 0.761 on the 98 the panel could code |

The bar (κ ≥ 0.6) is met, and codebook v1 is frozen as v0 unchanged (`experiments/so5-taxonomy/codebook-v1.md`).
Most of the disagreement is the panel answering "none fits" on the 41 TRAPRATE-01 cards that show only an oracle
sub-goal id (A5/none 19, A3/none 14, A10/none 6). Among category-to-category confusions, A3/A7 (6, precedence) and
A3/A4 (5, PUZZLE-01 repository hunks) lead. Six codebook clarifications are proposed and not applied.

**Counts** per category and source (first coder primary, panel beside) and the full tables:
`experiments/so5-taxonomy/panel-report.md` and `experiments/so5-taxonomy/panel/agreement.md`.

**Limits.** Model-panel agreement, not human reliability. Panel, first coder and most coded agents share a vendor.
Frequencies follow the trap tasks offered.
