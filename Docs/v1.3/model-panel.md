# v1.3 model panel: an independent multi-vendor panel for the *meaningful* label

**2026-10-16. Status: harness built and dry-run with fake raters. No real model has been called, and nothing here is a result.** The authority rule in §5 was committed before the harness produced any output. Changing it is a dated amendment in §10, never a silent edit.

## 1. Why a panel

The meaningful label asks one question of each finding: *"Would an architect following this style want this changed?"* (`Docs/v1.3/validation-protocol.md` §3, `Docs/v1.3/labelling.md`). Today the reference answer comes from two human raters, the author and the director (`Docs/v1.3/human-labelling-protocol.md`). Neither of them writes production code day to day. Their labels are valuable, but they do not carry much authority as a judgment of what a practising architect would want.

A panel of models from **three independent vendors** (Google, OpenAI, Anthropic) can replace that reference, or at least calibrate it, but only on four conditions:

1. Every vendor gets the same blind prompt.
2. Each rater's competence is measured on items whose answer is known (decoys).
3. Agreement between vendors, not the word of one model, decides a label.
4. The rule that turns votes into a label is fixed before any vote is seen.

The human labels stay. They become a calibration column (§6), not the authority.

## 2. Items

The panel labels **targets** and **decoys** mixed in one seeded order, under opaque ids (`P001`…). Raters see the content; the origin is kept in a separate key file.

| Source | Loader (`scripts/v1.3/lib/panel/items.ts`) | Role |
|---|---|---|
| Blind union sheet + key from `audit-sheet.ts union` (PR #119) | `unionItems` | targets; union decoys become known-wrong decoys |
| External set labelling sheet (`results/v1.3-external/labelling-sheet.csv`, branch `v1.3-external-set`) | `externalItems` | targets (excerpt cut from the pinned checkout) |
| Wild review sheet (`results/v1.3-wild/review-sheet.md`) | `wildItems` | targets (no declared style: a neutral style text is used) |
| Reference manifests (`tests/fixtures/v1.3-reference`) | `referenceDecoys` | **known-correct** decoys: manifest findings of violation variants (truth `yes`). **Known-wrong** decoys: the union builder's false perturbations (target swap, direction flip, graph flip or swap; truth `no`), with falsity checked on the materialised source. |

**Decoys never come from a case that is already a target.** `build` drops every reference variant the union key uses. When the union sheet is drawn from the hold-out set, the decoys come from the development set.

Default mix: **15 known-correct and 15 known-wrong** decoys per run (`--decoys-correct`, `--decoys-wrong`). That is above the rule's floor of 20 (≥ 10 per class) in §5.

## 3. One prompt, one schema, blinding

Every vendor receives the meaningful labeller's prompt: the same system prompt, question, three options, seeded option permutation, JSON answer schema `{"choice": "A|B|C", "reason": "…"}` and parser (`meaningful-prompt.ts`). The single-model labeller and the panel therefore ask exactly the same question. `scripts/v1.3/lib/panel/prompt.ts` renders an already-blind item:

- style definition (`style-rule-sources.md`, with rule ids and template names removed);
- file;
- numbered, comment-free excerpt (`excerpt-scrub.ts`);
- the claim.

**Blinding check.** `blindingProblems` runs on every rendered prompt before any call. An item that fails it is withheld from every rater and listed in the report.

- Outside the code block, the check forbids:
  - rule ids (`FF-…`);
  - template names (`dependency-direction`, …);
  - verdict wording: *violation*, *severity*, *blocking*, *advisory*, *tier*, TP/FP;
  - source wording: *decoy*, *manifest*, *planted*, *near-miss*.
- Inside the code block, it forbids rule ids and any fixture comment the scrubber should have removed.

In the dry run, all 40 items passed the check.

**Two runs per rater and item.** Run 0 shows the options in canonical order; run 1 in a seeded permutation. An unparsable answer is asked again once. The item label is the two runs' label when they agree, otherwise `uncertain`. This is the labeller's `reconcile`, unchanged.

## 4. Adapters, isolation, cassettes

`scripts/v1.3/lib/panel/adapters.ts`. All adapters sit behind the labeller's `MeaningfulProvider` port, so the cassette store, retry rule and answer parser are shared with the labeller.

| Vendor | Adapter | Credentials | Tools | Schema |
|---|---|---|---|---|
| Google | `gemini-api`: the labeller's `geminiProvider` | `GEMINI_API_KEY` (env only) | none sent | `responseSchema` |
| OpenAI | `openai-api`: Chat Completions via `fetch` | `OPENAI_API_KEY` (env only) | no `tools` field; a tool call in the answer is a failure | strict `json_schema` |
| OpenAI (alt.) | `codex-cli`: the labeller's `codexProvider` | dedicated `CODEX_HOME` login | read-only sandbox, web search and shell off | in prompt |
| Anthropic | `claude-cli`: the judge's `ClaudeCliProvider`, unchanged | dedicated logged-in `CLAUDE_CONFIG_DIR` (default `~/.firewall/panel-claude-config`) | `--tools ""` | `--json-schema`; answer from `structured_output` |

**Claude isolation.** The Claude rater uses the judge's isolation pattern (ADR-018) as it stands:

- a pinned CLI version (`PINNED_CLI_VERSION`);
- the config dir checked against the allow-list and kept outside the project;
- an allow-listed child environment;
- a neutral cwd with no `CLAUDE.md` above it;
- an init-probe pre-flight.

A failed pre-flight stops the run before any call. Another model carrying the output is refused (VRD-07). Use a separate config dir from the judge's, so that panel use never touches the judge's state.

**Credentials and stops.** No adapter reads a credential file. Keys are scrubbed from every error and cassette. Usage limits, authentication errors and isolation failures are *stops*: nothing is stored for that call, and the same command resumes from the cassettes.

**Cassettes.** There is one store per rater (`<cassettes>/<vendor>-<provider>-<model>/`), with one JSON file per call. The key is the sha256 of the canonical request (provider, model, system, prompt, temperature, run index). `--mode replay` never calls a provider and fails on a cassette miss, so a committed run can be re-scored offline.

## 5. The authority rule (`panel-authority-v1`, fixed 2026-10-16, before any data)

The constants live in `AUTHORITY_RULE` (`scripts/v1.3/lib/panel/stats.ts`). A unit test checks that they equal the values below.

**R0. Design.** A run must hold **≥ 20 decoys, with ≥ 10 known-correct and ≥ 10 known-wrong**. If it does not, no rater qualifies and the verdict is `no-panel`.

**R1. Rater qualification.** A rater qualifies when, on the decoys of the run, **all** of the following hold:

- (a) overall accuracy **≥ 0.85**;
- (b) accuracy on each class (known-correct, known-wrong) **≥ 0.70**;
- (c) a valid label (not an invalid run) on **≥ 0.90** of all items.

How this is scored:

- `uncertain` and an invalid run count as wrong.
- The thresholds apply to point estimates; Wilson intervals are reported beside them.
- (b) stops a rater that answers `yes` to everything from qualifying through an unbalanced decoy mix.

**R2. One vote per vendor.** If a vendor has several raters, only the first qualified one listed counts. The panel needs **≥ 2 qualified vendors**; otherwise the verdict is `no-panel`.

**R3. Item authority.** A target's panel label is **authoritative** when:

- **≥ 2 qualified vendors** give the same **definite** label (`yes` or `no`); and
- that label is a **strict majority** of the qualified vendors.

Any other target is **unresolved**. That covers a split, an `uncertain` majority, or too few votes. Unresolved targets are listed and left out of every panel-labelled figure; they are never imputed.

**R4. Panel reliability.** Fleiss' κ on the binary label (`yes` vs not `yes`), among the qualified vendors, on target items, must be **≥ 0.60**. This is the same gate value as the human protocol. Below it, the verdict is `descriptive-only`: the tables are reported, but no figure uses the panel as its reference.

**R5. Confidence.** Every item reports:

- the majority over all model raters, with its share;
- the qualified majority, with how many vendors agree out of how many voted;
- whether the qualified vendors are unanimous.

A figure that uses panel labels is reported twice: on all authoritative items, and on unanimous items only.

**R6. Decoys are only a check.** Decoys measure the raters. They never enter a target figure.

**Verdicts.** `authoritative` (R0–R4 hold), `descriptive-only` (R4 fails), `no-panel` (R0 or R2 fails).

## 6. Statistics and tables

`panelReport` / `renderPanelReport` write `report.json` and `report.md` with these tables:

1. **Rater accuracy on decoys.** Overall, known-correct and known-wrong accuracy with Wilson 95% intervals; decoys answered `uncertain`; share of valid items; share of items whose two runs disagree; qualified or not, with the reason.
2. **Pairwise agreement**, for every pair of raters, separately on targets and on decoys. Uses the labeller's `agreement`: the 3×3 table, Cohen's κ, Gwet's AC1, and observed agreement with its Wilson interval, on the three-way and the binary label.
3. **Multi-rater agreement** on targets, for all model raters and for the qualified vendors: Fleiss' κ (items every rater answered) and Krippendorff's α, nominal metric (missing labels allowed), each on the binary and the three-way label.
4. **Panel labels on targets**, by origin: authoritative `yes`, authoritative `no`, unresolved, unanimous. When human answers are given (`--human name=answers.csv`; ids may be panel ids or the sheet's own ids `U012`/`W07`; wild verdicts are mapped TP → yes, FP and TRUE-BENIGN → no, ? → uncertain), a further table compares each human with the authoritative panel label. That table is the **calibration** of the human reference.
5. **Per item:** every rater's label, the majority and its confidence, the qualified majority, authority, and the truth for decoys.
6. **Calls and tokens** per rater (from the cassettes).

**Leave-one-vendor-out.** `run --mode replay --exclude-vendor anthropic` re-scores the same cassettes without one vendor. This answers the question "does the result depend on the model family that also wrote the tool and the judge?"

## 7. Running it

**Dry run** (no key, no network; reproduces `results/v1.3-panel/dry-run/`):

```bash
npx tsx scripts/v1.3/model-panel.ts dry-run
```

The dry run uses 40 items: 20 wild targets, 10 known-correct and 10 known-wrong reference decoys. It has three **fake** raters, deterministic stubs with a fixed accuracy (0.96, 0.94, 0.70) that are given the truth as an oracle. It records, then replays, and checks that the replay matches. The numbers say nothing about any real model; they only show that every table and every branch of the rule works (in the dry run, one fake rater fails R1).

**Local run (the author's machine).** The keys go in the shell environment only; never put them in a file under the repository.

```bash
# 0. inputs
git fetch origin v1.3-external-set
git show origin/v1.3-external-set:results/v1.3-external/labelling-sheet.csv > /tmp/panel/external-sheet.csv
#    each external project's analysis root under one directory, named by project id (as in selection.json):
#    ln -s <clones>/<dir>/<root> /tmp/panel/external/<project-id>
#    union sheet + key, if the union is in scope:
#    npx tsx scripts/v1.3/audit-sheet.ts union … --sheet-out /tmp/panel/union.md --key-out /tmp/panel/union-key.json

# 1. build the item set (targets + 15/15 decoys)
npx tsx scripts/v1.3/model-panel.ts build --out-dir results/v1.3-panel/run-1 --seed 20261017 \
  --wild results/v1.3-wild/review-sheet.md --wild-key results/v1.3-wild/review-key.json \
  --external /tmp/panel/external-sheet.csv --external-root /tmp/panel/external \
  --union-sheet /tmp/panel/union.md --union-key /tmp/panel/union-key.json \
  --decoys-correct 15 --decoys-wrong 15

# 2. count calls before spending anything
npx tsx scripts/v1.3/model-panel.ts estimate --set results/v1.3-panel/run-1/panel-set.json --raters 3

# 3. record (GEMINI_API_KEY and OPENAI_API_KEY exported in this shell; Claude logged in once with
#    CLAUDE_CONFIG_DIR=~/.firewall/panel-claude-config claude /login)
npx tsx scripts/v1.3/model-panel.ts run --set results/v1.3-panel/run-1/panel-set.json \
  --key results/v1.3-panel/run-1/panel-key.json --out-dir results/v1.3-panel/run-1 --seed 20261017 --mode record \
  --gemini <gemini-model-id> --openai <openai-model-id> --claude <claude-model-id> \
  --claude-config-dir ~/.firewall/panel-claude-config \
  --human author=<author-answers.csv> --human director=<director-answers.csv>

# 4. re-score offline, and the leave-one-vendor-out reading
npx tsx scripts/v1.3/model-panel.ts run --set results/v1.3-panel/run-1/panel-set.json \
  --key results/v1.3-panel/run-1/panel-key.json --out-dir results/v1.3-panel/run-1 --seed 20261017 --mode replay
npx tsx scripts/v1.3/model-panel.ts run --set results/v1.3-panel/run-1/panel-set.json \
  --key results/v1.3-panel/run-1/panel-key.json --out-dir results/v1.3-panel/run-1/without-anthropic --seed 20261017 \
  --mode replay --labels results/v1.3-panel/run-1/labels.json --cassettes results/v1.3-panel/run-1/cassettes \
  --exclude-vendor anthropic
```

Notes on the run:

- Pin the model ids in the command and record them in the run's README. Each cassette also records the served model.
- `--codex <model> --codex-home <abs> --codex-user-home <abs>` replaces `--openai` if the OpenAI rater should run on the Codex subscription instead of the API.
- The Claude CLI must be the pinned version (`src/llm-critic/frozen.ts`), or the pre-flight stops the run.
- A stop (usage limit, authentication) exits with code 3. Re-running the same command resumes from the cassettes.
- Commit the cassettes with the results, as for the labeller.

## 8. Cost per 100 items per vendor

The size comes from the dry run's rendered prompts (characters ÷ 4).

**Calls.** 100 items × 2 runs = 200 calls, plus at most one re-ask and one retry per run. The worst case is 800; expect about 210.

**Input tokens per call.** About 65 system tokens plus 350–500 prompt tokens: wild items average about 355, reference decoys about 490, and the largest item about 725. Plan on **≈ 600 input tokens per call**, so **≈ 0.13 M input tokens** per 100 items per vendor.

**Output tokens per call.** The visible answer is about 40 tokens. Reasoning models add hidden reasoning tokens, billed as output, typically 200–2,000 per call. That gives **≈ 0.05–0.43 M output tokens** per 100 items per vendor.

**Formula.** cost = 0.13 × P_in + (0.05 … 0.43) × P_out, with P in US$ per million tokens from the vendor's price page **on the run date**. The prices below are assumptions for illustration, not quotes. The run's actual tokens are in table 6 of the report.

| Assumed list price (in / out, $/M) | Per 100 items per vendor |
|---|---|
| 1.25 / 10 (mid tier) | ≈ $0.7 – $4.5 |
| 2.50 / 15 | ≈ $1.1 – $6.8 |
| 15 / 75 (premium tier) | ≈ $5.7 – $34 |

**Subscription routes.** Claude via the CLI and Codex via a ChatGPT login have no marginal cost, but they count against plan usage limits. The CLIs also add their own harness prompt per call, which is larger for Codex than for Claude with `--tools ""`. A run of 300 targets plus 30 decoys is 660 calls per vendor at minimum.

## 9. How the panel fits with the developer-fix and predictive-validity evidence

The panel is one of three independent lines of evidence about whether the tool's findings matter. Each line covers a gap in the others.

| Evidence | What it measures | Strength | Weakness |
|---|---|---|---|
| **Model panel** (this doc) | *Judgment*: would an expert want this changed, from the style text and the code | Cheap, large n, blind, repeatable from cassettes, competence measured on decoys | Models share training data and may share blind spots, so agreement between vendors is not truth. Decoys are fixture-like and easier than wild code. One vendor's family also wrote the tool and the judge (hence the leave-one-out reading and R2). |
| **Developer-fix** evidence (real fix-commit pairs, ADR-030, and any later before/after mining) | *Behaviour*: developers changed the flagged code to remove the problem | Revealed preference by the people who own the code | Small n, mined from commit messages, fixes can be churn, and the absence of a fix is not evidence of a non-problem |
| **Predictive validity** (findings against later change, defects or co-change history) | *Consequence*: flagged code costs more later | Ties findings to outcomes | Confounded by size and age, needs long histories, and is correlational |

**Reading them together:**

- A finding class that the panel calls meaningful **and** that developers fix **and** that predicts later cost is well supported.
- Where the panel says `yes` but developers never fix and the finding predicts nothing, the panel's notion of what an architect wants is suspect for that class. That is the panel's main known failure mode, and only the behavioural lines can expose it.
- Where developers fix but the panel says `no`, the claim's wording or the style text is probably at fault.

So the panel replaces the *authority* of the author and director labels. It does not replace the behavioural and outcome evidence.

## 10. Amendments

None.

## Files

- `scripts/v1.3/model-panel.ts`: entry (`build`, `estimate`, `run`, `dry-run`).
- `scripts/v1.3/lib/panel/{items,prompt,adapters,run,stats,main}.ts`.
- `tests/unit/scripts/v1.3/panel/model-panel.test.ts`.
- `results/v1.3-panel/dry-run/`: the fake-rater dry run (`panel-set.json`, `panel-key.json`, `labels.json`, `report.json`, `report.md`, `cassettes/`). **Not a result.**
