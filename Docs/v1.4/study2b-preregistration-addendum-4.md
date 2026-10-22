# Study 2b pre-registration, addendum 4: how the registered secondaries are closed

**Dated 2026-10-22T03:58:00Z (UTC). Written before any semantic model call on Study 2b data, and before evasion items 4 and 5 were computed.** At this time:
- no C4 or C1d call had been made on any 2b snapshot;
- the C4 pilot and the six-case set (the precondition) had not run;
- no literal-view re-score of 2b and no moved-only read had been done.

Nothing in the pre-registration or in addenda 1–3 changes; their hashes are verified again before the first step below.

**What had been seen.** The registered scoring pass and its report (`Docs/DiagnosticRuns/v1.4-study2b-results-2026-10-21.md`): D, D†, H1–H3, E, the sensitivities and the post-run checks. None of these is changed by anything below. The semantic layer has, as registered, "no Holm, no confirmatory claim, and no change to D, to any verdict or to the scorer" (pre-registration §4, "Semantic layer").

**Who decided.** The author decided to close the registered secondaries now, as registered, by the least costly route. Where this addendum fixes how a step runs, it is fixed by the coordinator under the author's standing delegation for gate-level calls.

| # | Registered step | What the documents fix | Fixed now | Stricter or weaker |
|---|---|---|---|---|
| **DA13** | C4 and D_sem (pre-registration §4, "Semantic layer", items 1 and 4; sem-01 T2) | The C4 pilot (pairs 1–2), then the six-case set; caps 16, then 64, total 80. If they pass, C4 on every distinct identity D or Y₁ counts, 2 runs each, with the cap set by `--estimate` before the first call; then `dsem-provenance.ts` and `study2b-analyse.ts --dsem --dsem-nonagent` | Run exactly as registered, in that order, with the registered Claude configuration and the frozen judge pin. **If the precondition fails, C4 does not run on 2b, and D_sem is reported as "not run: precondition not met", with the pilot's outputs.** The `--estimate` cap is written into this file's changelog, with its time, before the first C4 call on 2b. Analysis scripts run from a checkout of the freeze tag, with the post-tag registered scripts copied in, as in the scoring pass | equal |
| **DA14** | C1d on a seeded sample (pre-registration §4, "Semantic layer", item 2; descriptive only) | 12 step-5 snapshots, `drawSemanticSample`, seed `20261021`, cap = the estimator's upper bound | **Not run.** Reasons: it is descriptive only and feeds no decision. Its expected cost is about 580 calls (2a: 584 expected, 1,654 at most for 12 snapshots), and in 2a the run stopped at its cap after 8 of 12 snapshots. The semantic-fact question moves into the exploratory programme toward the next instrument version. Reported as **not run**, with this reason | weaker (one descriptive secondary not reported) |
| **DA15** | Evasion item 4, literal view (pre-registration §4, "Evasion", item 4) | Re-score every step-5 snapshot at the literal view. Evasion is flagged if a treated cell's mean per-block gap (literal − default D) exceeds `none@L2`'s by more than one identity | DA11 found no literal-view re-score tool at the tag. **Computed now, post hoc, with zero model calls,** by a new driver script that calls the extractor's literal view and the frozen rules **at the freeze tag**, with the same identity rule and the same 120 blocks. The driver's sha256 is recorded in the results before it runs. The registered bar is applied unchanged. If the tag's extractor cannot produce the literal view, item 4 stays **not run**, with that reason | weaker (a post-tag driver), with the bar unchanged |
| **DA16** | Evasion item 5, moved-only read (pre-registration §4, "Evasion", item 5) | 10 `mcp@L2` and 10 `none@L2` diffs, blind. Bar: 0 moved-only cases in `mcp@L2`. Both class sets reported (moved-only; moved-only or wrapped/inlined), plus the class "renamed the entry file to an exempt name" | **Reader:** an independent AI reading session, not a human. **Blinding:** it gets the 20 diffs with cell labels removed and the order shuffled under the seed `20261022`, and it classifies each before the key is opened. **Check:** the author spot-checks two diffs, chosen by the same seed. **Draw:** the 20 diffs are drawn with mulberry32, seed `20261021`, one step-5 diff per drawn block, with blocks sampled without replacement within each cell. The key (diff → cell) is written to a file the reader cannot read until it has finished | weaker (the reader is not human; this is declared) |

## Also fixed now

- **The three zero-call analyses** (why the effect is concentrated in two tasks, how tool use relates to D, and why the effect shrinks over the run) are **exploratory**. They are reported as such in a separate report, never as registered outcomes.
- **Wording correction for null row M185.** "C4 has never run live" means "C4 has not run on 2b". C4 ran in the exploratory Study 2a (34 calls).

## Changelog
- 2026-10-22T03:58:00Z: first version, before any semantic call on 2b data and before evasion items 4 and 5 were computed.
