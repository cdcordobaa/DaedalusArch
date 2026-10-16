# Held-out rules for the gate arm (mechanism only)

Status: tooling. This file defines a mechanism, a pass criterion and the record fields. It does **not** say which
rules to withhold; that is the author's decision (backlog G1, author table row "Decide the held-out rule subset").
It is not a pre-registration.

## 1. Why

Study 2 outline Q4 asks whether an effect reaches rules the agent was never shown. Today the `gate` arm lists every
blocking finding in its repair turn, so no rule is unseen and Q4 cannot be answered. Outline §7 ("Scoring leakage")
names held-out rules as the mitigation. This change lets a plan declare which blocking rules the gate may show; every
other blocking rule is withheld from the repair feedback but still scored.

## 2. Design

Plan field (optional, OFF when absent):

```json
"gate": { "shownRules": ["<rule id>", "..."] }
```

- Absent: the loop behaves exactly as before; no new key is written to any record (byte-identical).
- Present: a non-empty list of distinct, non-empty rule ids. The plan must include the `gate` arm. Rule ids are not
  checked against a spec (the loop does not know the spec's rule set); a misspelt id silently withholds that rule, so
  the author should check the list against the spec's blocking rules before the run.

Filter: one point only, the call to `repairPrompt` in `LoopRun.step` (`scripts/lib/loop/loop.ts`). The findings list
given to `repairPrompt` keeps only findings whose `ruleId` is in `shownRules`, and the count it prints is the sum of
`blockingByRule` over the shown rules. The frame text (`REPAIR_TEMPLATE`) is unchanged (rule 4); only the finding
list, the plain summary built from it and the count change.

Repair trigger: with the field set, the repair turn runs only when at least one **shown** blocking finding exists. A
step whose only blocking findings are withheld gets no repair turn (a repair prompt with nothing to fix would itself
tell the agent that something unseen is wrong). Options taken under delegation, see §5.

Records (only when the field is set):

| Where | Field | Meaning |
|---|---|---|
| `run.json` (every arm) | `heldOutRules.shownRuleIds` | the plan's list, sorted; written when the run is created |
| `run.json` (every arm) | `heldOutRules.withheldRuleIds` | sorted distinct rule ids that had a blocking finding on any snapshot of the run and are not shown; written at completion |
| step record, gate arm | `turns[].snapshot.evaluation.blockingFindings[].shown` | `true` iff the finding's rule is shown (all findings kept) |
| step record, gate arm | `heldOut` | `{ shownBefore, withheldBefore, shownAfter, withheldAfter }`: blocking counts by split on the step-turn snapshot and (when a repair ran) the repair snapshot; null when the evaluation failed |
| step record, gate arm | `repairOutcome.findings[].shown` | unchanged meaning: listed in the repair prompt (shown rule and within `MAX_REPAIR_FINDINGS`) |

`repair.blockingBefore` / `blockingAfter` / `cleared` keep their meaning (all blocking rules), so a repair that
clears every shown finding but leaves a withheld one reads `cleared: false`; the shown-only figures are in `heldOut`.

A resumed run whose `run.json` records a different `shownRuleIds` than the plan fails with `LOOP_HELDOUT_MISMATCH`
(a run never mixes two splits).

`none` and `daedalus-mcp` runs carry the same `heldOutRules` block in `run.json` so the analysis can split every arm's
slope by the same rule sets; their step records are unchanged.

## 3. Analysis hook (names only; nothing computed here)

The Study 2 analysis script (`scripts/v1.3/study2-analyse.ts`, branch `v1.3-study2-analysis-rehearsal`, not merged,
not edited by this change) reads `RunRecord` and `StepRecord`. A Q4 split would read `run.heldOutRules.shownRuleIds`
and sum `evaluation.blockingByRule` over shown and over non-shown rules per step, then fit the same slope per split.
Proposed additions to that document's ambiguity list (§5), for the author:

- **A-G1a.** Withheld set: the complement of `shownRuleIds` within the spec's blocking rules (fixed before the run)
  or `withheldRuleIds` (rules observed). Proposed: the spec complement; `withheldRuleIds` is a check only.
- **A-G1b.** Whether the withheld-split outcome is confirmatory or descriptive, and whether the `none` arm's
  withheld-split slope is the comparator.
- **A-G1c.** Whether the gate repair rate (Q3) is computed over shown-only findings when the field is set.

## 4. Pass criterion (fixed before the code)

1. `validatePlan` accepts `gate: { shownRules }` and rejects: non-object `gate`, unknown keys, an empty, non-array,
   non-string or duplicated list, and a plan without the `gate` arm.
2. A test with two blocking rules, one shown and one withheld, shows that the withheld rule's id, file and message
   never appear in the rendered repair prompt, and that the printed count is the shown count.
3. A test where only withheld findings exist shows no repair turn ran.
4. The step record keeps every blocking finding with `shown`, and `run.json` carries `shownRuleIds` and
   `withheldRuleIds`.
5. With the field absent the loop's records are byte-identical to before: the existing loop tests pass unchanged, and
   a dedicated test compares the absent-field run's records with a run built without any `gate` key.
6. The 71 reference results stay byte-identical (rule 3 diff).

How criterion 5 was checked: the existing loop tests pass unchanged; a test asserts that no `shown`, `heldOut` or
`heldOutRules` key is written without the field; a test shows that listing every rule gives the same repair prompt as
no field; and the loop replay (`scripts/lib/loop/replay.ts`, Neo4j 5.26.24 + APOC) run on untouched `origin/v1.3`
and on this branch gives identical files (`compareReplays`, timing fields aside; 321 files).

## 5. Options taken under delegation

- Repair runs only on shown findings (a withheld-only step gets no repair turn).
- The printed count is the shown count, not the total.
- `shownRules` requires the `gate` arm and must be non-empty (an empty list would make the gate equal to `none`).
- `heldOutRules` is written in `run.json` for every arm; finding-level `shown` tags only on the gate arm.
- Rule ids are not validated against the spec.
- `withheldRuleIds` is observed, not declared.
