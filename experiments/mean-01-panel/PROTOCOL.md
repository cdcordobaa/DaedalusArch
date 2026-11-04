# MEAN-01 model panel: protocol (C3m meaning labels)

> **ABSOLUTE RULE.** Every prompt sent to agy (or to any model) in this experiment is plain labelling only: the
> rater instructions (codebook text), one item, and the answer format. Nothing else is ever sent. No prompt asks a
> model to escape a sandbox, break out, bypass permissions, tamper with files or tools, or "test whether it can" do
> any of that. The model needs no tools; the prompt tells it to answer in text only, and the labeller home keeps
> tools inert. A call that runs a tool is discarded. Any quota, policy or safety error stops the whole run.

Fixed on 2026-11-02, committed and pushed before the first agy call. Runner: `experiments/mean-01-panel/panel.ts`.

## 1. What this replaces, and the deviation

The codebook (`ops/notes/mean-01-codebook-and-sample.md`, §4, §7, §8) planned an independent human rater plus the
author on the same 60 items. No human rater is available. The 60 items are instead rated by a **model panel**.

**Deviation (stated).** The C3m labels come from a model panel, not a human rater. The panel model (Gemini, through
the Antigravity CLI `agy`) is from a different family than the generator of the agent code (Claude). The check on the
panel is the author's audit of 30 items (§6, `author-audit.md`). The panel's labels are reported as model labels with
that audit beside them, never as human-validated labels. The codebook's κ gate (§4) is computed between the panel and
the author on the 30 audit items only; the 60-item κ against a human rater does not exist.

## 2. Rater

- **Route:** the repo's agy labeller route (`src/llm-critic/agy-cli-provider.ts`, `AgyCliProvider`): home
  `~/.firewall/labeller-agy-home`, record-mode pre-flight (version, home check, MCP and plugin listings empty),
  `--output-format stream-json --json-schema <schema> --sandbox --disable-slash-commands --print-timeout 240s`, prompt
  on stdin, a fresh empty `mkdtemp` cwd per call outside any repository, `stopOnLine: isAgyResultLine` (agy 1.4.2
  prints its result and never exits). agy 1.4.2 is on the exploratory version list (`AGY_EXPLORATORY_VERSIONS`).
- **Model:** requested `gemini-4-argon-high` (`agy models`: "Gemini 4 Argon (High)"). The model id agy reports in
  its `init` event is recorded per call (`servedModel`); a different id stops the run (`LLM_CLI_ISOLATION`).
- **Panel:** 3 independent runs per item. Each run is a new agy process with a new cwd and no conversation history
  (fresh context). Order is run-major: run 1 of every item, then run 2, then run 3.
- **No temperature, seed or token flags** (agy has none; ADR-021).
- **Pace:** sequential calls, 4 s pause between calls. One retry per call for timeout, missing result event, empty or
  unparseable answer, or a tool step. Stop the run on usage limit, auth, unknown model, isolation, version drift,
  or any error text that reads as a policy or safety refusal.

## 3. Prompt template (exact)

One prompt per item. Nothing else is sent. The item heading `### Mxx` / `### Cx` is replaced by `### Item`.

```
You are one independent rater in a research labelling study. This is a plain reading-and-labelling task.
Answer in text only. Do not use any tools, do not run commands, do not read or write files, and do not open links. Judge only from the text in this message.

The rater instructions follow (sections 0 to 4 of the rater packet, unchanged). Three of them work differently for you:
- you cannot open the linked source file, so judge from the excerpt and the layer map shown with the item;
- there is no calibration discussion and no answer sheet: you give your answer in the format at the end of this message;
- you see one item only; answer it on its own.

<<<RATER INSTRUCTIONS>>>
{packet §0–§4: audit/view/mean-01-rater-packet.md up to "## 5.", verbatim}
<<<END RATER INSTRUCTIONS>>>

<<<ITEM>>>
{the item block as the packet prints it, from its heading to the "Open the full file" line; the answer box left out}

Layer map of this repository (from section L of the packet):

{the §L introduction paragraph}

{the §L table of this item's repository}
<<<END ITEM>>>

Answer format. Reply with one JSON object and nothing else:
{"A": "yes" | "no" | "unsure", "B": "yes" | "no" | "unsure", "why_not": "T" | "W" | "F" | "M" | "C" | "X" | "", "note": "<one line, may be empty>"}
- A is question A (practitioner), B is question B (style fidelity), as defined in section 2.
- why_not: one code from section 3 when A or B is "no"; otherwise "".
- note: one optional line; required when you answer "unsure" or use code X.
```

The same answer shape goes to agy as the `--json-schema` (A and B in `yes|no|unsure`, `why_not` in
`T|W|F|M|C|X|""`, `note` a string; all required). The rater packet already carries no rule id, template name or tool
verdict (codebook §7).

**Hashes before any call.** Template (preface + answer format + schema) sha256 `cbbe9554e259d687660266645c85690fcd312f118bf2f21efa3977b499570b3c`;
packet §0–§4 sha256 `abefdb211033ad6a96572ba1c94c3057d7406a52c742a49eef06ab0b618c6188`; per-item prompt sha256 in
`results/prompt-sha256.json`. Inputs: `audit/view/mean-01-rater-packet.md` `1fe01131…`,
`audit/view/mean-01-calibration.md` `f0449bce…`, `results/v1.3-meaning/mean-01-sample.json` `de16d364…` (scoring only,
never in a prompt).

## 4. Order of work

1. **Pre-flight** (zero model calls): `panel.ts preflight`.
2. **Pilot:** calibration items C1, C2 × 3 runs (6 calls). Check every answer parses. If parsing fails, only the
   runner's parsing is fixed (never the prompt's meaning), and the fix is noted in the README.
3. **Calibration first:** C3–C5 × 3 runs. The 5 calibration items are the existing calibration set
   (`audit/view/mean-01-calibration.md`), separate from the 60. Their answers never count (codebook §4.3); they show
   the panel works on the format before the 60. There is no calibration discussion for a model.
4. **The 60 items × 3 runs** (180 calls, plus retries).
5. **Score:** `panel.ts score` writes `labels.json` and `result.json`.

Planned calls: 15 calibration + 180 sample = 195, plus retries. Call ledger: `results/calls.jsonl` (no prompt text).

## 5. Labels and C3m

- **Per run:** A, B, why_not, note.
- **Per item, per field:** the majority of the 3 runs (a value with ≥ 2 votes). No such value (all three differ) →
  `unsure`. Fewer than 2 valid runs → missing.
- **Missing items:** listed. More than 6 missing → "incomplete, below protocol" (codebook §4.5).
- **C3m, as the codebook defines it (§9.2):** the meaningful precision is the share of correct external blocking
  findings whose **primary field, A (practitioner; L4 = A, §2)**, is `yes`, estimated by the stratified estimator
  p̂ = Σ_h (N_h / N) · p̂_h, N = Σ N_h = 784, p̂_h the yes-share of the majority labels in stratum h. 95% interval:
  stratified cluster bootstrap resampling projects with replacement within each stratum, 10,000 resamples, seed
  20261018 (mulberry32), percentile interval. Also: the unweighted yes-share of the 60 with its Wilson interval.
  `unsure` counts as not-`yes` (§4.4).
- **Reported beside it:** field B with the same statistics (secondary, not gated); counts per label, per stratum and
  per style; the A × B table (§9.3); why-not codes (§9.4); the raw-run `unsure` rate for A (flag above 15%, §4.4);
  panel consistency (unanimous items per field, Fleiss κ over the 3 runs on yes vs not-yes, descriptive).
- **Reading guide:** the codebook's §9.5, unchanged.
- **Not done:** no re-run to change a label, no prompt change after the first call, no dropping or recoding of items
  after labels are seen (§9.6). A failed call is retried only as §2 says.

## 6. The author's audit (the check on the panel)

- **Items:** 30 of the 60, drawn by `mulberry32(20261102).pickDistinct(M01..M60, 30)` from
  `scripts/lib/mutation/rng.ts` (the codebook defines no audit draw), sorted. Listed in `author-audit.md`, drawn
  before any label.
- **How:** the author labels the 30 items from the rater packet alone, with the same codebook (A, B, why-not code),
  before opening `labels.json`. The author's sheet is committed, with its sha256, before the comparison.
- **Statistic:** Cohen's κ, unweighted, panel majority vs author, on A collapsed to yes vs not-yes (codebook §4.2);
  the 2×2 table, observed agreement with its Wilson interval, and the same for B. With n = 30 this is a check of
  the panel, not the codebook's 60-item gate; it is reported as such.

## 7. Files

| File | What |
|---|---|
| `PROTOCOL.md` | this file |
| `panel.ts` | the runner (pre-flight, run, score, audit draw) |
| `results/prompt-sha256.json` | per-item prompt hashes, before any call |
| `results/calls.jsonl` | one line per agy call: item id, run, attempt, time, prompt sha256, requested and served model, duration, ok or error code, answer |
| `labels.json` | per item: the 3 raw runs and the majority per field |
| `result.json` | counts, C3m, per stratum, call count, failures |
| `author-audit.md` | the 30 audit ids and the answer sheet |
| `README.md` | what ran, and any runner fix |

## Addendum 1 (2026-11-03, before any API call): route change from agy to the Gemini API

**Why.** The agy route never completed a labelling turn: in the pilot 2 calls timed out at 240 s, and one diagnostic
call on C1 (raw stream kept in `results/diag/`, commit `be487a956`) shows the prompt accepted and no model step, no tool
step and no answer before the print timeout. Under the stop rule recorded for that call, the agy route is stopped.

**What changes.**
- **Route:** the Gemini Developer API, the same model family (`gemini-4-argon`), `thinkingLevel: high` (the
  closest match to agy's "High" model; ADR-035). Called with `@google/generative-ai` from `panel-api.ts`.
  - The model is offered no tools and no tool config. A function call in an answer is rejected and stops the run.
  - The key comes from the environment; it is never written to a file or a log.
- **Prompt:** the user text is unchanged (`promptFor`, the same sha256 per item as `results/prompt-sha256.json`). The
  API needs a system instruction, so it gets the fixed line `You label one item for a research study. Reply with the
  requested JSON object only.` That line is recorded here before any call.
- **Schema and parser:** unchanged (`RESPONSE_SCHEMA`, `parseAnswer`).
- **Ledger:** `results/api-calls.jsonl` holds no prompt text. Each line records the served model version and the
  usage counts, prompt, thinking and output tokens, so the run's cost is measured, not estimated.
- **Order and caps:**
  1. Calibration C1–C5 × 3 runs = 15 calls, with a cap of 20 calls including retries. The calibration answers never
     count.
  2. The 60 sample items only after the author has seen the calibration record, with a cap of 80 calls per run.
- **Stop rules:** unchanged. Any quota, auth, policy or safety error stops the run, and so do 3 failed calls in a
  row.

Unchanged: the codebook, the items, the majority rule, the scoring and the author audit.

## Addendum 2 (2026-11-04, before any further sample call): larger output budget

**Why.** The first sample pass gave 74 of 180 answers and then stopped on HTTP 402 (account credit, not a model or
policy error). Two items (M21 run 1, M02 run 2) ended with `finishReason: MAX_TOKENS` on both attempts: the thinking used
the whole 16,384-token output budget and no answer was written.

**What changes.** For every sample call from now on, `maxOutputTokens` rises from 16,384 to 32,768. Nothing else
changes. Every answer already recorded finished under the old budget, so a larger budget would not have changed it. The
74 recorded answers stay as they are and are not re-asked.

**Retries.** The two `MAX_TOKENS` items count as unanswered, so they are asked again under the new budget (the runner
skips only `ok` lines). The HTTP 402 lines are not model answers and are also asked again. The stop rules are unchanged.
