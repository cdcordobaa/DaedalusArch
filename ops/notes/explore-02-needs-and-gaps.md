# EXPLORE-02: needs and gaps for an instrument that agents can use

**Status:** draft v1, 2026-10-22. This is a planning register, not thesis text, and nothing was run for it. It reads `ops/notes/explore-01-research-log.md` (entries 1–7), the DETECT-02 draft (`ops/notes/detect-02-design.md`, branch `explore/detect-02`, paused) and the PUZZLE-01 baseline report.

**Status key:** GREEN = met · AMBER = partly met · RED = not met. Comment inline with `> AUTHOR:`.

## Ground rules for this phase (decided by the author, 2026-10-22)

1. **Everything is exploratory.** There is no confirmatory study and no sealing. Placebo arms, pre-registration and other confirmatory machinery wait until the behaviour is trusted, useful and solid. A new confirmatory experiment is designed at that point.
2. **We improve and interpret as we go,** but every step gets its thinking first. Before any run there is a short note covering the scenarios, edge cases, predicted results and what would count as failure. That note is discussed before the call (`feedback-slow-research-mode`).
3. **Study 2b stays untouched.** Its tag and registered artefacts are never changed. The new detectors live under `experiments/` (instrument "v1.5-exp") until they earn trust. Promotion into `src/` is a later decision.

## The goal

Agents should be able to **see and act on the property graph's information**, so that they avoid or repair the architecture violations they make today. We compare their behaviour with and without the tool, on puzzles judged by each puzzle's own answer key.

## Needs, gaps and how each closes

| # | Need | Where we are | Gap | How it closes | Done when | Status |
|---|---|---|---|---|---|---|
| **N1** | **The detector is precise on the trap families** (multi-aggregate write D4; cross-context write) | DETECT-02 dev results: D4 33/33, 0 false positives on clean puzzle solutions (tuned, dev) | Precision on correct DDD patterns is untested. These look like a second write but are legitimate: an outbox record in the same transaction, event-store appends, audit and idempotency records, one aggregate saved twice, child entities mistaken for aggregates, a declared batch command, a saga. The Study 2b guard is weak because no aggregates exist under Layered | (a) An explicit sink taxonomy in the facts: what counts as an aggregate write and what is excluded by type. (b) Fixtures for each legitimate pattern. (c) Run on real human DDD repositories. (d) The held-out negatives, as a one-time check of generalisation | 0 false positives on the legitimate-pattern fixtures and on the human DDD repos, with any hits explained | AMBER |
| **N2** | **Recall generalises beyond the shapes we tuned on** | DETECT-01 missed `saveAll([from, to])`. DETECT-02 is built by type, not by name | Not shown on unseen shapes | One zero-call run of the symbolic rules on the 34 held-out projects (`experiments/detect-02-heldout/SEAL.md`), used here as an exploratory check, not a confirmatory one | Recall, twin discrimination and negative-control false positives reported per family | RED |
| **N3** | **Rule placement (D5/D3) is detected** | Symbolic D5 11/16 on dev; the 5 misses are the lock form. The semantic step is built but has never run | This is where symbolic detection runs out | A short note on the semantic confirmation (question, grounding, abstention), then a 2-case pilot with recorded replies | The pilot discriminates both pairs, with grounded citations | RED |
| **N4** | **Findings an agent can act on** | Not built | Today's messages are rule ids | Each finding gives file:line, the rule in plain words as the spec states it, why this code breaks it (which aggregates, through which calls), and a fix hint. Symbolic only inside the tool: no model call, fast | A reviewer can fix each dev case from the message alone | RED |
| **N5** | **Delivery the agent cannot miss** | In 2b, agents called a check tool in 28 of 160 steps | Pull mode alone may show no effect | Two modes. **Pull:** an MCP tool, `check_consistency`, served with the existing tools. **Push:** the harness runs the checks after each turn and inserts the findings into the next prompt, like a CI gate | Both modes smoke-tested with zero model calls; latency measured | RED |
| **N6** | **Every arm gets a chance to repair** | 3 steps, 0 repair turns: a problem found at the last step can never be fixed | Tool and no-tool arms would differ in their chance to fix, not only in information | One final review turn in every arm, with the same wording except for the tool's findings | Written into the run plan | RED |
| **N7** | **Enough puzzles that trap** | P1 and P2 trap 5/5. P3 was dropped (restore failure). P4 is solved 5/5 | Two trapping puzzles is a thin base | Restore P3 (Hexagonal port mechanism). Add a second cross-context puzzle and a harder Layered puzzle the instrument can see (an existing upward import as house style). Each verified like PUZZLE-01 | At least 4 trapping puzzles, all VALID | AMBER |
| **N8** | **Answer keys resist gaming** | The keys check the rule, with R4 repairs | With feedback, agents may satisfy the checker without fixing the design: a rename, a "batch" wrapper, or a fake event handled synchronously | Extend the keys to catch synchronous event handlers and wrappers. Hand-read every key failure, and every pass that looks suspicious | The evasion fixtures fail the key | AMBER |
| **N9** | **The baseline's labels are confirmed** | 12 key failures are provisional | No hand read yet | A hand read of the 12, same procedure as HEXDDD-01; the author spot-checks 2 | Log committed; counts final | RED |
| **N10** | **A run protocol** | The baseline protocol worked: isolation, randomisation, pins | Not written for arms | Arms: agent alone, tool-push, tool-pull. 5 runs per puzzle per arm. Cloud. Same image and pins, a call cap, 2 interleaved agent-alone sessions as a drift check | Plan file written and discussed before any call | RED |
| **N11** | **Predictions written before the run** | — | Without them, any result reads as interesting | A prediction table per puzzle × arm, and what each result would mean | In the run note | RED |
| **N12** | **Bookkeeping** | Research log through entry 7 | The baseline result and DETECT-02 are not logged yet. Case-bank cards lack instrument verdicts | Log entries; update the cards | Up to date | AMBER |

## Scenarios and predictions (to refine together)

| Scenario | Prediction | Covered by |
|---|---|---|
| Overfitting: the rules pass dev and miss held-out shapes | Possible for D5; unlikely for D4 and cross-context writes if built on types | N2 |
| False positives on outbox, audit and child-entity writes | The largest risk to precision | N1 |
| Agents ignore the pull tool | Likely | N5 push mode |
| Agents game the checker | Plausible | N8 |
| A tool false positive makes the agent break code | Possible | functional failures and changed lines, reported in every arm |
| Push mode makes every run clean | Would still be a result; move on to harder puzzles | N7 |
| No difference between arms | Possible if the findings are not actionable | N4; read the transcripts |

## Order (each step gets its note before any call)

1. **N9** hand read and **N12** bookkeeping. Zero calls.
2. **N1** sink taxonomy, legitimate-pattern fixtures and human DDD repos; then **N2** held-out check. Zero calls.
3. **N4 + N5 + N6**: messages, both delivery modes, the review turn. Zero calls.
4. **N7 + N8**: new and restored puzzles, gaming-resistant keys. Zero calls.
5. **N3** semantic note and 2-case pilot. The first model calls; small.
6. **N10 + N11** run note, then the exploratory tool-arm run in the cloud.

## Changelog
- 2026-10-22: draft v1.
