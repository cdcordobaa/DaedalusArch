# SO5 taxonomy, second coder = model panel (protocol)

Committed before any panel call (2026-10-29). Design: `ops/notes/so5-taxonomy-design.md` §5 step 4, which leaves the
second coder to the author; the author chose a model panel on 2026-10-29, the same pattern as registration DEV-1
(`Docs/v1.5/final-study-preregistration.md` §6). This protocol is not changed after the first call; any change is dated
below under "Deviations" before the data it affects is read.

## Coders

Three independent coders, each a fresh headless CLI session per card (no session persistence, no tools, no MCP):

| Coder | Model |
|---|---|
| `fable-1` | `claude-fable-5-1` |
| `fable-2` | `claude-fable-5-1` |
| `opus-1` | `claude-opus-5-5` |

Route: the Claude CLI judge route of `experiments/v15-n1/route.ts` (`callerOf(routeOf('judge'))`), the one the v15 N2
D_sem pilot uses; CLI version pinned to 2.1.312, checked before the run and before every call (a change stops the run).
No Gemini, no third-party model. Credentials are the route's configured login; nothing is printed or recorded about them.

## What a coder sees

- **The codebook text** (`codebook-panel.txt`, written by `run-panel.ts` from `../codebook.md` v0 and hashed): the
  primary-category rule, the failure, repair and excluded categories verbatim. Removed, because they are first-coder
  output and not definitions: the header lines about the first coder and freezing, the "Provisional counts" section, and
  the M0 sentence that says how the Study 1 cards were coded.
- **One card at a time** from `../cards.json`, as JSON, with `facets` and `source` removed (the design keeps the second
  coder blind to the facets). Kept: `id`, `kind`, `multiplicity`, `file`, `hunk`, `hunkNote`, `enclosingType`, `evidence`.
- Never: the first coder's code (`../codes-first.json`), any other coder's answer, the sub-goal family map, task names.

Answer (JSON schema enforced): `category` one of `A1`..`A12`, `R1`, `R2`, `M0`, or `none` ("none fits"), and `reason`,
one sentence.

## Calls, cache, records

- One call per coder and card: 3 x 266 = 798 planned. An invalid answer (no JSON, not in the enum, CLI error) is retried
  up to 2 more times; still invalid = that coder gives no vote. Hard cap 1197 calls (798 x 1.5) counted on the raw file.
- Cache by content hash: key = sha256 of (protocol version, coder id, model, system prompt, schema, prompt). A key with a
  valid answer in `answers.jsonl` is never called again (so a restart resumes without re-calling).
- `answers.jsonl`: one line per call attempt (key, coder, requested and reported model, card id, answer or error, time,
  duration). Committed (root `.gitignore` negation for this folder). No spend fields are written.
- Concurrency 3 calls at a time; the runner is started detached (tool commands end after 2 h).

## Labels and agreement (fixed now)

- **Panel label** per card = the category given by at least 2 of the 3 coders (`none` counts as a category). No such
  majority, or fewer than 2 valid votes agreeing = **unresolved**; counted and reported, never re-asked.
- **Cohen's κ, first coder vs panel** (primary): over the cards with a panel label. Sensitivity: over all 266 cards with
  `unresolved` as its own label. Raw agreement beside both.
- **Per category**: one-vs-rest Cohen's κ (first coder = c vs panel = c) over the labelled cards, with the counts.
- **Panel Fleiss' κ** over the cards where all three coders gave a valid answer; pairwise raw agreement per coder pair.
- **Confusion matrix** first coder x panel label (with `unresolved` and `none` columns); the most confused category
  pairs (off-diagonal cells, both directions summed).
- **By basis** (descriptive, declared now): κ and raw agreement split by the first coder's `basis` (`hunk`, `evidence`,
  `metric`). Evidence-only cards, and TRAPRATE-01 oracle sub-goal cards above all (the card shows only a sub-goal id; the
  first coder used the task's sub-goal family), are expected to agree least.
- **Bar**: κ >= 0.6 overall (primary). Below it, the codebook is **not** changed and no card is recoded to raise it: the
  value is reported, the most confused pairs are listed, and codebook clarifications are proposed, not applied.

## Freeze and counts

Codebook v1 = v0 text unchanged, with this protocol referenced, dated and sha256-hashed (`../codebook-v1.md`). Counts
per category per source study use the first coder's labels (primary); the panel label is shown beside. Descriptive only.

## Limits

The panel and the agents whose code is coded share a vendor (and for Opus, a model); the first coder is also a Claude
model and wrote the instrument. The panel reads only the card, so evidence-only cards (no hunk) give it less than the
first coder had for oracle sub-goal cards. Agreement here is model-panel agreement, not human inter-rater reliability.

## Deviations

None yet.
