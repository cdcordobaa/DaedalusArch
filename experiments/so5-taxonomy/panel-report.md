# SO5 taxonomy: second coder (model panel), freeze and counts

Protocol `panel/PROTOCOL.md` (committed before the first call). Runner `panel/run-panel.ts`, raw answers
`panel/answers.jsonl` (798 lines), analysis `panel/analyse.py` -> `panel/agreement.json`, `panel/agreement.md`,
`panel/labels.json`. Frozen codebook `codebook-v1.md` (v0 unchanged; sha256 of the v1 file
`0fda22eaff1eb478efa0fdb2f9005568f01ac7952a5dce7dcd6dcbdf29ac3e12`). Panel codebook text `panel/codebook-panel.txt`
(sha256 `609ff51bb9cc5c79741654a47a6f379912d47ab016a615dc2c6c477ba2328ff0`).

## Run

Three coders (`fable-1`, `fable-2` = `claude-fable-5-1`; `opus-1` = `claude-opus-5-5`) through the Claude CLI judge
route (CLI 2.1.312, the pin), one card per call, blind to the first coder, the facets and each other. 798 calls,
798 valid on the first attempt, no retries, cap (1197) not approached; the reported model matched the requested model on
every call. No deviation from the protocol.

## Agreement

| Measure | Value |
|---|---|
| Cohen's κ, first coder vs panel majority (266 labelled cards) | **0.709** |
| Raw agreement | 0.744 |
| Unresolved (no 2-of-3 majority) | **0** |
| Panel Fleiss' κ (266 cards) | 0.982 |
| Pairwise raw agreement fable-1~fable-2 / fable-1~opus-1 / fable-2~opus-1 | 0.989 / 0.985 / 0.981 |

The bar (κ ≥ 0.6) is met; the codebook is frozen unchanged. The sensitivity κ with `unresolved` as a label is the same
(0.709), since nothing is unresolved.

**By basis of the first code** (declared in the protocol): hunk-read cards (100) κ 0.691, raw 0.73; evidence-only cards
(106) κ 0.479, raw 0.613; metric cards (60, all M0) raw 1.0. Oracle sub-goal cards (72, a subset across puzzles and
TRAPRATE-01) κ 0.266, raw 0.306: 41 TRAPRATE-01 cards show only a sub-goal id, and the panel answered `none` on all 41
(the first coder used the task's sub-goal family, which the card does not carry).

**Not declared in the protocol, descriptive only:** the 120 Study 1 and Study 2b cards (M0, A1, R1) agree perfectly and
lift the overall value. Over the 146 v1.5 cards (HEXDDD-01, puzzles, TRAPRATE-01) κ = 0.485 (raw 0.534); over those of
them where the panel named a category (98, panel `none` removed) κ = 0.761 (raw 0.796). Read: where the panel had code to
read it mostly agrees on the category; the disagreement is mainly cards it could not code.

**Per category** (one vs rest): A1, A8, R1, R2, M0 κ 1.0; A6 0.95; A9 0.80; A2 0.77; A11 0.67; A4 0.66; A7 0.65;
A10 0.56; A5 0.44; A3 0.36; A12 −0.01 (1 first, 2 panel, 0 both). Table in `panel/agreement.md`.

## Most confused pairs (both directions)

| Pair | Cards | What happened |
|---|---|---|
| A5 / none | 19 | oracle-only TRAPRATE-01 cards (no file, no hunk) |
| A3 / none | 14 | oracle-only TRAPRATE-01 cards |
| A3 / A7 | 6 | TRAPRATE-01 hunks with a guard and two saves: first coder A7, panel A3 (applying the A3-before-A7 precedence) |
| A10 / none | 6 | oracle-only cards |
| A3 / A4 | 5 | PUZZLE-01: the hunk shows the repository gaining `saveAll`; the first coder coded the episode's command (A3) |
| A7 / none, A2 / none | 4, 4 | A7: 4 hunks the panel found without the decisive line; A2: 2 oracle-only cards and 2 hunks of an inbound adapter that depends only on an in-port |
| A3 / A5 | 4 | PUZZLE-01: an ACL or directory call into another context read as A5 by the panel |
| A6 / A12 | 2 | facade signature exposing a core type, read as A12 |

Panel `none` overall: 48 cards (41 oracle-only; 7 with a hunk: first codes A7 x4, A2 x2, A12 x1).

## Proposed codebook clarifications (NOT applied; a v2 would need a new second-coder pass)

1. **Unit of coding.** State that the card is coded from what it shows: when the hunk shows the repository method only,
   code A4 even if the episode's rule concerns the command (A3); the rule id stays evidence only.
2. **Evidence-only cards.** Either put the oracle sub-goal family text on the card (a card-builder change), or add a
   codebook rule that a card naming only a sub-goal id is `uncodable` and reported as its own stratum.
3. **Precedence scope.** Say that the A3/A5/A6-before-A7/A9 precedence applies when both actions are visible in the
   same card, with an example of a guard plus two saves.
4. **A3 vs A5 signal.** A call through an ACL, directory or another module's API to change state owned by another
   context is A5, even when the episode's rule is the aggregate rule.
5. **A6 vs A12.** A facade method that only exposes a core type in its signature, with no visible crossing write, is
   A12; A6 needs the write.
6. **A2 exclude.** Add: an inbound adapter that depends only on an in-port and a shared helper is not A2.

## Counts per category per source (frozen v1; first coder primary, panel label in brackets)

| Category | study1 | study2b | hexddd01 | puzzle01 | puzzle03 | puzzle04 | traprate01 | Total |
|---|---|---|---|---|---|---|---|---|
| A1 wiring in presentation | – | 53 (53) | – | – | – | – | – | 53 (53) |
| A2 driving side reaches data | – | – | – | – | 5 (5) | – | 6 (2) | 11 (7) |
| A3 two aggregates, one command | – | – | – | 9 (0) | – | – | 24 (16) | 33 (16) |
| A4 repository widened | – | – | 1 (0) | 0 (5) | – | – | 6 (6) | 7 (11) |
| A5 synchronous cross-context write | – | – | 2 (2) | 0 (4) | – | 1 (1) | 29 (10) | 32 (17) |
| A6 crossing hidden in a facade | – | – | – | – | 10 (10) | – | 14 (12) | 24 (22) |
| A7 rule outside the aggregate | – | – | 3 (1) | – | – | – | 19 (10) | 22 (11) |
| A8 process-local consistency guard | – | – | – | 2 (2) | – | – | – | 2 (2) |
| A9 calculation outside the aggregate | – | – | 1 (1) | – | – | – | 1 (2) | 2 (3) |
| A10 vendor shape in the core | – | – | – | – | 2 (2) | 2 (2) | 6 (0) | 10 (4) |
| A11 mechanism in a port | – | – | 1 (2) | – | – | – | – | 1 (2) |
| A12 entity in a published shape | – | – | 1 (0) | – | – | – | 0 (2) | 1 (2) |
| R1 wiring removed (repair) | – | 7 (7) | – | – | – | – | – | 7 (7) |
| R2 concrete -> port (repair) | – | – | 1 (1) | – | – | – | – | 1 (1) |
| M0 metric only (excluded) | 60 (60) | – | – | – | – | – | – | 60 (60) |
| none (panel only) | – | – | 0 (3) | – | – | – | 0 (45) | 0 (48) |
| **cards** | 60 | 60 | 10 | 11 | 17 | 3 | 105 | 266 |

Descriptive only. Most v1.5 sources are trap tasks, so frequencies follow the traps offered; Study 1 and 2b are capped
draws (60 each) of larger episode sets (`README.md`).

## Limits

Model-panel agreement, not human inter-rater reliability. The panel, the first coder and most coded agents are Claude
models (same vendor; Opus is also one of the coded agents' models). The panel's three coders agree with each other far
more (Fleiss 0.98) than with the first coder, which reads as a shared reading of the card rather than three independent
human judgements. The panel saw less than the first coder on oracle-only cards.
