# SO5 taxonomy, cross-vendor coder (Gemini): protocol

Committed before any call (2026-11-04). Exploratory addition to the model-panel second coding of 2026-10-30
(`../panel/PROTOCOL.md`, result `Docs/DiagnosticRuns/so5-taxonomy-panel-2026-10-30.md`: κ 0.709 against the first
coder). That panel shares a vendor with the first coder and with most coded agents (its stated limit). This run adds one
coder from another vendor. It changes nothing in the earlier panel, its labels or the frozen codebook v1.

## Coder

One coder, `gemini-1`: model `gemini-4-argon` through the Gemini Developer API (`@google/generative-ai`),
`thinkingLevel: high`, `maxOutputTokens` 32,768, no tools and no tool config. The route is the one MEAN-01 uses
(`experiments/mean-01-panel/PROTOCOL.md`, addendum 1). The key comes from the environment and is never written to a file
or a log.

## What the coder sees

Exactly what the Claude panel saw: the same system text, the same codebook text (`../panel/codebook-panel.txt`; its
sha256 is checked before the first call), one card at a time with the same fields (`id`, `kind`, `multiplicity`, `file`,
`hunk`, `hunkNote`, `enclosingType`, `evidence`), the same task text and the same answer schema (without `additionalProperties`, which the Gemini schema format does not take) (`category` one of
`A1`..`A12`, `R1`, `R2`, `M0`, `none`; `reason`, one sentence). Never: the first coder's codes, the panel's answers,
facets, sources or task names.

## Calls and records

- One call per card: 266 planned. An invalid answer (no JSON, not in the enum, error) is retried up to 2 more times;
  still invalid = no label for that card (counted, never re-asked later). Hard cap 400 calls.
- Stop rules: HTTP 401, 403 or 429, a policy or safety block, a function call in an answer, or 5 failed calls in a row.
  HTTP 402 (account credit) pauses the run; it resumes from the ledger after the credit is restored.
- `answers.jsonl`: one line per attempt (card id, attempt, served model, finish reason, usage counts, answer or error
  code, time, duration). No prompt text, no spend fields.
- Cost control: after the first 10 cards the measured usage is read; if the projected total for 266 cards is above the
  limit the author set, the run pauses for the author.

## Agreement (fixed now)

- **Primary:** Cohen's κ, first coder vs `gemini-1`, over the cards with a valid Gemini answer (`none` is a category).
  Raw agreement beside it.
- **Secondary:** Cohen's κ, Claude panel majority vs `gemini-1`, over the cards with both labels; and Fleiss' κ over
  the four coders (three Claude, one Gemini) on the cards where all four answered.
- **Descriptive:** the same split by the first coder's `basis` (`hunk`, `evidence`, `metric`) as in the panel report;
  the most confused category pairs.
- **Bar:** κ ≥ 0.6 for the primary measure, the same bar as the Claude panel. Below it, nothing is recoded and the
  codebook is not changed; the value is reported.

## Limits

One cross-vendor coder, not a panel; model agreement, not human inter-rater reliability. The codebook was written by a
Claude model. The coded agents are almost all Claude.

## Deviations

1. **2026-11-04, after card 168 and before any further call: spend guard.** The run paused twice on HTTP 402 (account
   credit). The runner now adds up the measured usage of each invocation's calls (input × $2 and thinking plus output
   × $10 per million tokens, the listed price) and makes no new call once that passes $1.50. It changes which cards
   are asked only if the guard trips; if it does, the cards left unasked are listed and the agreement is reported as
   partial. Nothing else changes. The 168 answers already recorded are not re-asked.
