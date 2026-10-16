# Labeller calibration against published human labels: pre-registration (2026-10-16)

**Status: PRE-REGISTERED. No model call has been made.** This plan, the sample and the hash of every prompt were committed and pushed on branch `v1.3-labeller-calibration` (cut from `origin/v1.3`) before any rater runs. The harness lives in `scripts/v1.3/labeller-calibration/`; results go to `results/v1.3-labeller-calibration/`. Every later change is a dated amendment in §10, never a silent edit.

## 0. In one screen

- **The claim we want to support.** Our LLM labelling procedure agrees with expert human labels on established, adjacent design-quality labelling tasks about as well as the humans agree with each other. "Our procedure" means the same models, the same prompt structure and persona, the same output schema and the same decision rules.
  - This is **transfer evidence** for our AI labels: the judge verdicts, the blind manifests and the meaningful/check labels.
  - It is **not** a validation of those labels on our own tasks.
- **Why external labels.** The author and the thesis director do not code, so hand-labelling our own items is weak (`Docs/v1.3/research/external-labelled-datasets.md`, #241). Published datasets with several human raters per item give us a human reference for free.
- **Datasets.** Two were selected from eight candidates (§3):
  - **MLCQ** (primary): 26 professional developers rated code smell severity on pinned GitHub commits. The sample is 96 items (Blob, Data Class, Long Method; 32 each), with 3–5 human ratings per item.
  - **DACOS** (secondary): 86 volunteer annotators, two per snippet, with the code embedded in the dataset. The sample is 96 items (Multifaceted Abstraction, Complex Method; 48 each).
  - Both are Java. No public JS/TS dataset publishes per-rater labels (§3.3).
- **Raters.** Both run on the author's subscriptions; no API key is used:
  - Claude through the judge's own CLI route (`claude-opus-5-5`);
  - Gemini through the labeller's `agy` route (`gemini-4-argon-high`).
- **Arms.** Each rater runs two arms, and only the task text is swapped (§4):
  - **judge**: the frozen v1 template, persona, verdict schema and `voteUnit` rule;
  - **labeller**: the meaningful labeller's prompt, schema, permuted second run and reconcile rule.
- **Primary statistic.** Δ = α(model–human) − α(human–human): Krippendorff's α over every (model, human) pair against every (human, human) pair of the same items, with a seeded item-bootstrap 95 % interval. This is the replace-one-annotator view of Ahmed et al. (MSR 2025).
- **Decision rule.** **SUPPORT** iff the lower bound of the interval is ≥ −0.10 (non-inferiority). There are gates for procedure failures and abstentions (§6).
- **Human reference on the frozen samples** (computed now, no model involved):

  | Dataset | Human α | Human pairs |
  |---|---|---|
  | MLCQ | 0.422 | 371 |
  | DACOS | 0.478 | 96 |

  These are moderate, comparable to the human α of most tasks in Ahmed et al. (0.24–0.83).
- **Budget.** 1,536 calls in total (768 per dataset), worst case 4,608. Claude makes 960 and Gemini 576. Every `record` run has a hard `--budget`.

## 1. Claim, scope and what would count against it

- **Claim (to be filled from §6).** "On MLCQ and DACOS, our judge and labeller procedures agree with individual expert raters at α = X. That is within 0.10 of the agreement between the experts themselves (α = Y, same items)."
- **What it transfers.** The labellers' behaviour on *design-quality judgements of real code*: whether a unit violates a stated design principle. This is the same kind of judgement our judge (FF-N01 integrity, FF-N02 intent) and meaningful labeller make.
- **What it does not show.**
  - Agreement on our rules, our TypeScript fixtures or our blind manifests.
  - Correctness of the deterministic check labels (`check-correct.ts`), which are not model output.
  - Anything about layer-direction rules: the persona keeps its out-of-scope sentence, and no dataset covers them.
- **What would count against it.** A NOT SUPPORTED result (§6) for the Claude judge arm on MLCQ. We would then report that our judge disagrees with experts more than they disagree with each other on adjacent design-quality tasks. Our AI labels would have to be presented without the transfer argument.

## 2. Literature: LLMs as annotators of software artifacts

Every entry below was opened in a primary source on 2026-10-16. The DOI resolves through `api.crossref.org/works/<doi>`; the numbers were read in the full text (arXiv HTML or the author copy) unless marked "abstract". Preprints are labelled as such.

| Study | Venue, DOI | What was labelled | Agreement figures | Protocol advice |
|---|---|---|---|---|
| Ahmed, Devanbu, Treude, Pradel, "Can LLMs Replace Manual Annotation of Software Engineering Artifacts?" | MSR 2025, 10.1109/msr66628.2025.00086 (arXiv 2408.05534) | 10 tasks from 5 SE datasets: code-summary quality, name–value inconsistency, causality in requirements, semantic similarity, static-analysis warning actionability. 6 LLMs, including Claude 3.5 Sonnet and Gemini 1.5 Pro | Krippendorff α, human–human / human–model / model–model (Table I), e.g.: accuracy 0.38/0.48/0.76; name–value 0.52/0.49/0.66; causality 0.44/0.22/0.39; static-analysis warnings 0.80/0.15/0.12. Model–model and human–model agreement correlate (Spearman 0.65, §IV-B). One human rating could be replaced in 7 of 10 tasks | Query several strong LLMs, compute model–model α. If it is > 0.5, replace **one** human per sample; otherwise only on high-confidence samples. Never replace more than one human: model–model agreement inflates α (§V) |
| Wang et al., "Can LLMs Replace Human Evaluators? An Empirical Study of LLM-as-a-Judge in Software Engineering" | PACMSE 2 (ISSTA) 2025, 10.1145/3728963 | 450 responses on code translation, generation and summarisation, scored 1–5 by two humans | Human–human Pearson 85.9 / 79.7 / 73.7. Best judge vs human 81.3 / 68.5 / 26.2 | Do not use LLM judges alone for code summarisation |
| Crupi et al., "On the Effectiveness of LLM-as-a-Judge for Code Generation and Summarization" | TSE 51(8) 2025, 10.1109/tse.2025.3586082 | Code-summary quality (3 humans per summary); code correctness | Human α: adequacy 0.81 (Java) / 0.69 (Python), conciseness 0.58 / 0.57. GPT-4 vs median human α: adequacy 0.58 / 0.63. They dropped a dataset whose human α was ≈ 0.2 | Model–human agreement is highest where human–human agreement is highest; check the human reference first |
| Goldman et al., "What Types of Code Review Comments Do Developers Most Frequently Resolve?" | ASE 2025, 10.1109/ase63991.2025.00312 | Code-review comment categories | Human–human κ 0.80 and 0.86; LLM vs agreed human labels κ 0.42 | — |
| Sheikhaei et al., "An empirical study on the effectiveness of large language models for SATD identification and classification" | EMSE 2024, 10.1007/s10664-024-10548-3 | SATD comments (the Maldonado et al. data) | Fine-tuned Flan-T5-XL vs ground truth κ 0.89, against a reported human–human κ 0.81 | — |
| Su et al., "Evaluating Large Language Models for Detecting Architectural Decision Violations" | **preprint**, arXiv 2602.07609 | ADR compliance over 980 ADRs | Inter-LLM Fleiss κ 0.724; accuracy 0.83–0.91 against 305 expert-adjudicated cases. No human–human coefficient | LLMs work for explicit, code-inferable decisions, not implicit ones |
| Mesbah et al., "Leveraging Prompt-Based Large Language Models for Code Smell Detection: A Comparative Study on the MLCQ Dataset" | EIDWT 2025, 10.1007/978-3-031-86149-9_42 | MLCQ | GPT-4 few-shot F1: Long Method 0.717, Data Class 0.772, Feature Envy 0.051, Blob 0.015. No κ | — |
| Gilardi, Alizadeh, Kubli, "ChatGPT outperforms crowd workers for text-annotation tasks" (outside SE) | PNAS 120(30) 2023, 10.1073/pnas.2305016120 | Tweet and news annotation, n = 6,183 | About 25 points above MTurk accuracy (abstract) | — |

**Protocol adopted from this literature:**
1. Compare model–human agreement with the human–human agreement *on the same items*, not with an absolute threshold. This follows Ahmed et al. and Crupi et al.
2. Replace one rater at a time (the pairwise M–H α), never several. Ahmed et al. warn that replacing more than one inflates agreement.
3. Report model–model agreement as a predictor (Ahmed et al. RQ2), but do not let it decide.
4. Check that the human reference is not degenerate. Crupi et al. dropped a set with human α ≈ 0.2, which is why we have the weak-reference flag (§6).

**What no study gives us.**
- No paper reports a model–human agreement coefficient on MLCQ or DACOS. Mesbah et al. report F1 only, and no DACOS LLM study was found.
- Neither dataset paper reports an inter-rater coefficient. Madeyski & Lewowski say only that there was "less agreement" on classes; DACOS says nothing.
- So the human–human figures here are **computed by us** from the published per-review data (§3.2). That is also why we compute both sides on the same items.

## 3. Datasets

### 3.1 Ranking

Ranked by: closeness of the task to ours (a judgement of whether code violates a design principle); quality of the human labels (several raters, rater-level data); licence; whether the code is available at a pinned version; language; and effort. Every artifact was opened (Zenodo API with md5, or `git clone`); details are in #241 §2 and in the inspection notes summarised here.

| Rank | Dataset | Task closeness | Human labels | Licence | Code | Language | Effort | Decision |
|---|---|---|---|---|---|---|---|---|
| 1 | **MLCQ** (Madeyski & Lewowski, EASE 2020, 10.1145/3383219.3383264; Zenodo 10.5281/zenodo.3666840 v1.1) | High: Blob/God Class and Data Class are responsibility and encapsulation principles; Long Method is the method-level analogue | 14,739 reviews by 26 professional developers on a 4-level severity scale, **with reviewer ids**. 1,661 (sample, smell) pairs have ≥ 3 reviews | CC-BY-4.0 | Repository, **full commit SHA**, path and lines per row | Java | Low | **Selected (primary)** |
| 2 | **DACOS** (Nandani, Saad, Sharma, MSR 2023, 10.1109/msr59073.2023.00067; Zenodo 10.5281/zenodo.7570428) | High for Multifaceted Abstraction (single responsibility); medium for Complex Method | 10,267 binary annotations by 86 volunteers, two per snippet. **No annotator ids**, so raters are interchangeable; α handles that | CC-BY-4.0 | **Embedded** (`files.zip`, one `.code` file per unit) | Java | Medium (MySQL dump + ZIP64) | **Selected (secondary)** |
| 3 | JS smells (Sarafim, Delgado, Cordeiro, SBES 2024, 10.5753/sbes.2024.3432) | High (God Class, Long Method) | 3 trained raters per instance, but **only the post-discussion consensus is published**, so there is no human–human reference | MIT | Project + file + lines, **no version or commit** | **JavaScript** | High (versions must be recovered) | Rejected: no rater-level labels, no pinned code |
| 4 | SAEroCon JabRef / TEAMMATES (#241 §2.1) | Highest: architecture violations | Expert rules and a violation report; the violations are tool output checked by one expert, not multi-rater item labels | none stated | Java repos | Java | High (no Java extractor) | Rejected: no item-level human agreement to compare against |
| 5 | Su et al. ADR violations (arXiv 2602.07609) | High | Humans **confirmed LLM verdicts**: anchored, not independent | CC-BY-4.0 / MIT | Repos | mixed (some TS) | Low | Rejected for calibration (see #241) |
| 6 | Fontana et al. smell sets (10.1007/s10664-015-9378-4) | High | — | — | — | Java | — | Rejected: the dataset host returned HTTP 503 (#241); never cite as usable |
| 7 | SATD (Maldonado, Shihab, Tsantalis, TSE 2017, 10.1109/tse.2017.2654244) | Low: comment text, not code | One consolidated label; the paper reports κ 0.81 on a 659-comment subsample | none stated | Comment text only | Java | Low | Rejected: not a code judgement, no per-item rater labels |
| 8 | P-MARt / design-pattern ground truth | Low: pattern presence, not principle violation | Not opened in this run | — | — | Java | — | Not considered further |

### 3.2 The two samples (frozen in this commit)

| | MLCQ | DACOS |
|---|---|---|
| Pinned source | Zenodo record 3666840 v1.1, `MLCQCodeSmellSamples.csv` md5 `9019beae88089838d2d13dc12e69241b` | Zenodo record 7570428, `DACOSMain.sql` md5 `30fe42bd366da825908e86d901702b79`, `files.zip` md5 `d38d4a2526123c66f6b30e871e50cd4c` |
| Item | One (sample_id, smell) with all its reviews; latest review per reviewer | One (sample, candidate smell); a task's item exists only if the sample was shown as a candidate for it (`sample.smells`) |
| Tasks (items) | Blob 32, Data Class 32, Long Method 32 | Multifaceted Abstraction 48, Complex Method 48 |
| Eligible | ≥ 3 human ratings | ≥ 2 human ratings |
| Code | `raw.githubusercontent.com` at the row's commit, cut to `start_line..end_line` | The `.code` entry of `files.zip` |
| Units skipped while drawing | 9 (HTTP 404: repository or path gone) | 0 |
| Human ratings per item | 3–5 (mean 3.28) | 2 |
| Human-consensus fail share | 0.37 (3 ties) | 0.86 (16 ties) |
| **Human–human α on the sample** | **0.422** (371 pairs; Blob 0.276, Data Class 0.433, Long Method 0.444) | **0.478** (96 pairs; Complex Method 0.576, Multifaceted Abstraction −0.067) |
| PABAK (observed) | 0.429 (0.714) | 0.667 (0.833) |
| `sample.json` sha256 | `2110d86c939a1481e974192459a0b173c63aab28bb1156c9a1e8e840347cd8a7` | `f6a7cc5b4de9ca349da642af6c91caa5a882f60a8fc57adc3ab0f16f46ec0f80` |
| `prompts.json` sha256 / manifest | `4cba21d262c7e0d9a2f7c76284718c5ad24c8da5a0916fa99b69177d3dfeb4a6` / `6510ec46fc3ea1c5ce46ce172435cbd598a0dfebf582d213340fb9696c8e9616` | `f53a483d5af71416cb0858883488988f417217a7054b5f6fb8d61df4b086f0dd` / `5cd8c9baf074e2cb08c49e5c0d4ebe47eec4989883cf4c80cfb0f725144d3d0c` |

- **Sampling.**
  - Seed `20261016`. Each task stratum is sorted by item id, shuffled with a seed derived from (seed, dataset, task), and walked in that order (`sample.ts`).
  - An item whose code cannot be fetched is skipped and the next one is taken; skips are recorded in `sample.json`.
  - **The sample is not stratified on the human labels.** Selecting on consensus or excluding ties would select on human agreement and bias the human–human reference, which is the comparator.
  - The price is unbalanced prevalence, especially DACOS Multifaceted Abstraction (0.93 positive among ratings). So the consensus κ is reported with AC1 and PABAK, and Multifaceted Abstraction is flagged as a degenerate per-task reference (α ≈ 0 at high prevalence: the κ paradox, not disagreement).
- **Why not Feature Envy (MLCQ).** Its human agreement over all ≥ 2-review samples is at chance (Fleiss κ 0.005, ordinal α −0.02, computed from the published reviews). A comparison with a chance-level human reference cannot support anything. Excluding it was decided before any model call.
- **Why not Long Parameter List (DACOS).** It is a parameter count. It is the least judgement-like task, and keeping it out keeps the budget.
- **Selection effect, disclosed.** MLCQ's third and later reviews were requested mainly for samples whose first two reviews disagreed (the paper's cross-check phase). Items with ≥ 3 reviews are therefore enriched for hard cases, and their human α is lower than the dataset-wide one. Both sides of Δ are computed on the same items, so Δ stays fair; the absolute α values are not population figures.
- **Label mapping** (our binary scale: `fail` = the problem is present):
  - **MLCQ primary:** `none` → pass; `minor`, `major`, `critical` → fail.
  - **MLCQ sensitivity:** `none`, `minor` → pass; `major`, `critical` → fail. `score` re-maps every rating of the same items from its original severity (`remapMlcq`) and reports it as a secondary table; the sample does not change.
  - **DACOS:** the bit for the task (`isma`, `iscm`): 1 → fail, 0 → pass.
  - **Judge:** `pass: false` → fail.
  - **Labeller:** `yes` (an architect would want it changed) → fail; `no` → pass; `uncertain` → no binary label (an abstention).

### 3.3 The JavaScript/TypeScript gap

- No public TS or JS dataset with rater-level human labels for a design judgement was found. Sarafim et al. publish only consensus labels and no pinned versions (#241 found none for TS).
- This calibration is therefore **cross-language**.
- **Threat.** The models might judge Java better or worse than TypeScript.
- **Mitigation.** The prompts' content and rules are language-neutral; only the persona's language noun changes (§4). The result is stated as transfer evidence, not as TS validation.

## 4. Prompts: our procedure, with only the task swapped

`scripts/v1.3/labeller-calibration/lib/prompts.ts` imports our frozen texts; it does not copy them.

| | judge arm | labeller arm |
|---|---|---|
| Source of the procedure | Judge v1: `JUDGE_PERSONA`, `constructPrompt` (sections Rule, Rubric with the out-of-scope line, Layer model, Unit, Source fenced by `fenceFile`, Graph excerpt, Instructions = `PROMPT_INSTRUCTIONS`), `VERDICT_SCHEMA_TEXT` | Meaningful labeller: `SYSTEM_PROMPT`, its four sections, `QUESTION`, letters A–C, `optionOrder` (run 1 seeded permutation), `RESPONSE_SCHEMA_TEXT`, `parseAnswer`, `REASK_SUFFIX` (one re-ask on an unparseable answer), the comment scrubber |
| Decision rule | Claude: 3 runs (`RUNS_PER_EVALUATION`) decided by the judge's own `voteUnit`: majority of valid runs; < 2 valid → invalid; a 1–1 split → warning. Gemini: 1 run, as the v2.2 CHECK-2 Gemini rater | 2 runs; the label when both agree, else `uncertain` (`reconcile`) |
| **Swapped: task** | `## Rule` and `## Rubric` (pass / fail / evidence) from `tasks.ts` | `## Design rule` (the definition) and the finding's claim ("Class X in P is reported to show Blob (God Class).") |
| **Swapped: nouns** | "TypeScript projects" → "Java projects" in the persona | "a TypeScript code base" → "a Java code base"; "an architectural style" → "a design rule"; "the style definition" → "the rule definition"; "this style" → "this rule" in the question |
| **Swapped: context** | Layer model `(none)`, Layer `(none)`, the empty graph excerpt (the datasets give neither); Kind `class` or `method` | The whole unit, numbered from its first line, instead of ±15 lines around a finding line (the datasets label whole units) |
| Code budget | The v1 `codeSnippet` budget (8,000 tokens × 4 characters), cut with the v1 truncation marker | Same budget |

- **Frozen text.**
  - Every swap goes through `swapOnce`, which fails if a frozen text no longer contains its noun exactly once. A change to our persona therefore stops the harness instead of silently changing the calibration.
  - The task definitions paraphrase each dataset's own definition (source in each entry). Their canonical hash is `tasksSha256 = 1214417eca369fa7d8104c356a0b9e0314b246232b1c52489951796b6fa5dc60`.
- **Frozen prompts.**
  - Every prompt (item × rater × arm × run) is hashed into `prompts.json`.
  - `record` recomputes every prompt from the local data copy and **refuses** to call when any system prompt, user prompt or schema hash differs from the committed one. It also refuses when any code hash differs from `sample.json`.
- **Nothing is tuned.**
  - No few-shot examples: our procedure has none.
  - No prompt iteration on these items.
  - `dry-run` prints the exact prompts for review without calling.

## 5. Raters

| | Claude | Gemini |
|---|---|---|
| Route | `ClaudeCliProvider`, the judge's own isolated CLI route. Dedicated `CLAUDE_CONFIG_DIR` (default `~/.firewall/judge-claude-config`), pinned CLI version 2.1.294, frozen argv with `--tools ""`, allow-listed child env, neutral cwd, init-probe pre-flight | `AgyCliProvider`, the labeller route. Dedicated home `~/.firewall/labeller-agy-home`, tools inert, neutral cwd outside any repo, no rule files, the persona prepended (agy has no system channel) |
| Model | `claude-opus-5-5` (`JUDGE_MODEL`), effort `JUDGE_EFFORT` | `gemini-4-argon-high`, as the v2.2 CHECK-2 second-vendor rater |
| Version pin | The judge's `PINNED_CLI_VERSION`; another version is a stop | agy self-updates. The version found must equal `--agy-accept-version` (default 1.3.6, as in CHECK-2); the pre-flight hashes are stored in every cassette entry |
| Credentials | The CLI's subscription login only. **No API key** is read or needed | The CLI's Google OAuth login only. **No API key** |

- **Failure handling.**
  - A retryable failure is retried once, then recorded as an invalid run.
  - A stop (usage limit, auth, isolation, version drift, budget) halts the run and is never stored. A re-run resumes from the cassette.
- **Cassettes.** `results/v1.3-labeller-calibration/cassettes/<dataset>/`, keyed by sha256 of (rater, model, arm, schema, system, prompt, run index).
  - The prompts contain code from the datasets' open-source repositories: MLCQ repositories are mostly Apache-2.0, DACOS is CC-BY-4.0.
  - Commit the cassettes with the labels so `score` and `dry-run` replay offline.

## 6. Analysis and decision rule (frozen in `score.ts`, `DECISION_RULE` id `labeller-calibration-v1`)

**Statistics.** Computed per dataset and per (rater, arm), on all sampled items pooled over tasks:

1. **H–H.** Krippendorff's α (nominal, binary) over every pair of human ratings of the same item, plus the pairs' observed agreement and PABAK. Raters may differ between items (MLCQ) or be anonymous (DACOS); pairwise α needs neither.
2. **M–H.** The same α over every (model, human) pair of the same item.
3. **Δ = α(M–H) − α(H–H).**
   - Its 95 % interval is a percentile item bootstrap: 2,000 resamples, seed 20261016, items resampled with all their ratings.
   - Resamples where α is undefined are dropped and counted.
4. **Against the human consensus** (strict majority; ties excluded):
   - Cohen's κ, Gwet's AC1, PABAK;
   - observed agreement with a Wilson 95 % interval;
   - sensitivity and specificity.
5. **Model–model:** Cohen's κ, Claude vs Gemini, per arm (the Ahmed et al. predictor). Descriptive.
6. **Per task:** the same table per task. Descriptive only, because the per-task n is 32–48.

**Missing model labels.** Judge `invalid` or `warning` and labeller `uncertain` give no binary label.
- In the primary analysis they are missing, counted by cause.
- In the sensitivity analysis they are mapped to `pass` ("no problem shown").

**Gates.** Both are applied before the decision:
- **Procedure:** the procedure must not fail on more than 10 % of items. A failure is a judge `invalid` or a labeller `invalid-run`. Otherwise: NO DECISION (invalid share).
- **Abstention:** at least 70 % of items must carry a binary label. A judge 1–1 split and a labeller `uncertain` are abstentions, not failures. Otherwise: NO DECISION (abstention share).

**Decision** (margin m = 0.10):

| Outcome | Condition |
|---|---|
| **SUPPORT** | lower bound of Δ ≥ −m |
| **SUPPORT (weak reference)** | as SUPPORT, but H–H α < 0.40: the humans themselves agree only weakly, and this is stated next to the claim |
| **NOT SUPPORTED** | upper bound of Δ < −m |
| **INCONCLUSIVE** | otherwise |

**Primary and secondary results.**
- **Primary family** (no multiplicity adjustment; all four are reported): **Claude × {judge, labeller} × {MLCQ, DACOS}**. These are the raters and arms whose labels the thesis uses.
- **Headline:** the Claude judge arm on MLCQ.
- **Overall statement:**
  - "supported" if the Claude judge arm is SUPPORT, or SUPPORT (weak reference), on both datasets;
  - "partly supported" if on one;
  - otherwise "not supported" or "inconclusive", as the outcomes say.
- **Secondary:** the Gemini arms, the model–model κ, and every sensitivity analysis:
  - MLCQ's major-or-worse mapping;
  - missing labels mapped to pass.

**Precision, honestly.** A dry run with fake raters on the frozen samples gives bootstrap intervals for Δ about 0.35–0.45 wide. A SUPPORT therefore needs a point estimate of roughly Δ ≥ +0.08 to +0.12. A model as good as a typical human (Δ ≈ 0) will most likely come out INCONCLUSIVE. That is the honest consequence of 96 items per dataset; the size is fixed now and will not be extended after seeing the data.

**What gets quoted.** α(M–H), α(H–H), Δ with its interval, and κ vs consensus with its n, for every primary cell. "Kappa X" in the claim means the consensus κ, quoted next to the H–H α of the same items.

## 7. Call budget

| Dataset | Rater | Arm | Items | Runs/item | Calls | Worst case (every retry and re-ask) |
|---|---|---|---|---|---|---|
| MLCQ | Claude | judge | 96 | 3 | 288 | 576 |
| MLCQ | Claude | labeller | 96 | 2 | 192 | 768 |
| MLCQ | Gemini | judge | 96 | 1 | 96 | 192 |
| MLCQ | Gemini | labeller | 96 | 2 | 192 | 768 |
| DACOS | Claude | judge | 96 | 3 | 288 | 576 |
| DACOS | Claude | labeller | 96 | 2 | 192 | 768 |
| DACOS | Gemini | judge | 96 | 1 | 96 | 192 |
| DACOS | Gemini | labeller | 96 | 2 | 192 | 768 |
| **Total** | | | | | **1,536** (Claude 960, Gemini 576) | **4,608** |

- **Hard cap.** Each `record` invocation takes `--budget <n>`. When it is reached the run stops with nothing stored for the pending call, and a re-run with a fresh budget resumes from the cassette.
- **Recommended caps:** the expected calls × 1.25, i.e. 360 / 240 / 120 / 240 per (rater, arm) per dataset as in §8.
- **Order.** Run the primary cells first (Claude judge, then Claude labeller, MLCQ before DACOS), so that a usage limit hits secondary cells first.

## 8. Exact local run commands

Run from the repository root on the author's machine.
- `<DATA>` is any directory **outside** the repository; the harness refuses a path inside it.
- `<TMP>` is an existing empty directory outside any repository (the neutral cwd root).
- No API key is set or needed.

```bash
# 0. Install and check (no model call).
npm ci
npx jest tests/unit/scripts/v1.3/labeller-calibration.test.ts
DATA=~/daedalus-labcal-data; TMP=~/daedalus-labcal-tmp; mkdir -p "$DATA" "$TMP"

# 1. Fetch the pinned dataset files (md5-verified; about 108 MB).
npx tsx scripts/v1.3/labeller-calibration/calibrate.ts fetch --data "$DATA"

# 2. Re-create the committed sample's code locally. Writes sample.json and prompts.json; they must come out
#    byte-identical to the committed ones, and git diff must show nothing.
npx tsx scripts/v1.3/labeller-calibration/calibrate.ts sample --data "$DATA"
git diff --exit-code results/v1.3-labeller-calibration/

# 3. Review the exact prompts and the call count (no model call). --print all writes every prompt.
npx tsx scripts/v1.3/labeller-calibration/calibrate.ts dry-run --data "$DATA" --print 4
npx tsx scripts/v1.3/labeller-calibration/calibrate.ts dry-run --data "$DATA" --print all > "$TMP/all-prompts.txt"
npx tsx scripts/v1.3/labeller-calibration/calibrate.ts dry-run --data "$DATA" --print none --fake   # pipeline check with fake raters

# 4. Record: primary cells first. Each command resumes from the cassette if re-run.
for D in mlcq dacos; do
  npx tsx scripts/v1.3/labeller-calibration/calibrate.ts record --data "$DATA" --dataset $D --rater claude --arm judge    --budget 360 --tmp-root "$TMP"
  npx tsx scripts/v1.3/labeller-calibration/calibrate.ts record --data "$DATA" --dataset $D --rater claude --arm labeller --budget 240 --tmp-root "$TMP"
done
for D in mlcq dacos; do
  npx tsx scripts/v1.3/labeller-calibration/calibrate.ts record --data "$DATA" --dataset $D --rater gemini --arm judge    --budget 120 --tmp-root "$TMP" --agy-accept-version 1.3.6
  npx tsx scripts/v1.3/labeller-calibration/calibrate.ts record --data "$DATA" --dataset $D --rater gemini --arm labeller --budget 240 --tmp-root "$TMP" --agy-accept-version 1.3.6
done
#   Options: --claude-config-dir <dir> (default ~/.firewall/judge-claude-config), --agy-home <dir>
#   (default ~/.firewall/labeller-agy-home). Exit 3 = stopped (budget, usage limit, auth, isolation): re-run later.
#   If `agy --version` reports another version, pass it with --agy-accept-version and record it as an amendment (§10).

# 5. Check that everything is in the cassette, then score.
npx tsx scripts/v1.3/labeller-calibration/calibrate.ts dry-run --data "$DATA" --print none   # "To call" must be 0
npx tsx scripts/v1.3/labeller-calibration/calibrate.ts score   # writes results/v1.3-labeller-calibration/report.{md,json}

# 6. Commit the cassettes, the labels and the report.
git add results/v1.3-labeller-calibration && git commit -m "results(v1.3): labeller calibration run"
```

## 9. Threats and limitations

- **Construct distance.** Code smells are design-quality judgements adjacent to, not identical with, our rules. The transfer argument rests on "same procedure, similar judgement", and the thesis must say so.
- **Language.** The datasets are Java; we judge TypeScript (§3.3).
- **Contamination.** MLCQ and DACOS are public, and the code comes from public repositories. A model may have seen the code, or even the dataset. The labels are not in the prompt, but memorisation cannot be excluded.
- **Rater quality.**
  - MLCQ's 26 reviewers rated very unequal numbers of samples (6 to 3,784).
  - DACOS annotators were volunteers, with two per item and no ids.
  - The human reference is therefore moderate (α 0.42 and 0.48), which is common in SE annotation (Ahmed et al. Table I).
- **Prevalence.** DACOS Multifaceted Abstraction is 93 % positive, so its per-task α is uninformative. The pooled DACOS α also mixes tasks of different prevalence. That affects both sides of Δ equally, but the per-task table must be read with this in mind.
- **Precision.** See §6. INCONCLUSIVE is a likely, and reportable, outcome.
- **The procedure changed in small ways.** These are the noun swaps, the whole-unit excerpt and the empty layer and graph sections (§4). Each is a necessary adaptation, recorded here before the run.

## 10. Amendments

None yet.
