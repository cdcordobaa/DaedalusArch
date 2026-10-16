# v1.3 overnight PR review (2026-10-16)

Adversarial review of every PR open into `v1.3` on the morning of 2026-10-16, run before the 09:30 UTC merge train. The train's gates (tsc, jest, byte-identity of the 71 reference results) cannot catch the six things checked here:

1. numbers in the docs that don't match the PR's own committed result files (recomputed where cheap);
2. overclaiming (`validated`, `met`, `proves`, `confirms`) on development, pilot or synthetic data;
3. code paths that read a sealed directory, `.env` or credentials;
4. default behaviour changes (CLI, MCP, scripts) that are not behind an OFF-by-default option;
5. edits to Cypher template text, rule tiers or frozen v1.2E artefacts;
6. committed third-party source.

Each PR got a review comment with its verdict and per-check findings. Every HOLD PR has `[hold]` added to its title, so the train skips it. Nothing was merged or pushed to any PR branch, and no sealed directory or `.env` was read.

## Outcome

- **56 PRs reviewed** (49 open at the start, plus #195–#201 opened during the review).
- **OK to merge: 2.** #135 (opt-in `includeViolations` fix, plus a test added during review) and #138 (additive `check` subcommand and GitHub Action).
- **HOLD: 54.** Most are held because the author marked them do-not-merge-before-review. The substantive findings are below.
- **#143 was merged into v1.3 by the late train at 07:52 UTC, before its HOLD was posted** (merge `dffb1db8`). The findings now apply to v1.3 itself:
  - the MCP `check_file`, `check_diff` and `explain_violation` schemas gain an agent-settable `hints` parameter without `--hints`;
  - `schemas/report.schema.json`, which is marked FROZEN at U3-R10, gains `fixHints`.

  The author needs to decide whether to revert it or gate it.

## Substantive findings (beyond the do-not-merge mark)

| Check | PRs |
|---|---|
| (1) Wrong numbers | #133 (11 fail / 4 pass, not 10/5), #147 (2,668 vs 2,669), #165 (unanimous vs average, v2.1), #168 (8,319 / 536, not 7,904 / 526), #176 (7 spec-only rows, not 6), #186 (A fails 11/15, not 10), #188 (3 verdict flips, not 1), #190 (116/273, not 129/273), #192 (step 3.2 wrong about #191 `src/`), #201 (sweep cell 0.74 mis-cited), #193 (#131 recorded as merged) |
| (2) Overclaiming | #131, #145 ("held out" probes are in-repo transforms), #160 ("proven", "confirms" on synthetic data), #169 ("SO1 met", "no benchmark exists"), #180 (title), #186, #188 / #192 ("byte-identical"), #195 ("instrument is reliable") |
| (3) Sealed / credential access | #174 (unsealer is built to read the sealed task file; author-run only, not wired in), #156 (hard-coded local paths with the username) |
| (4) Ungated default changes | #143 (merged), #145 (`propose_rules` MCP tool), #151 (30 s interp timeout), #159 and #170 (several MCP and CLI defaults), #164 (`--expect-sha256` widened), #171, #180 (loop gate-arm stop and resume moves), #188 (accelerated engine and memory guard on by default) |
| (5) Frozen artefacts | #139, #143 and #159 (frozen report schema), #162 (hash-frozen `scripts/lib/mutation/types.ts`), #164 (hold-out prespec draft) |
| (6) Third-party source | #162 (about 318k characters of external diff hunks with no licence note) |
| Reproducibility | #154 and #156 (`*.jsonl` transcripts gitignored, not committed), #181 and #198 (depend on unmerged #133) |

## Per-PR verdicts

| PR | Verdict | Summary |
|---|---|---|
| #130 | HOLD | Docs-only; numbers check out, no code/sealed access. HOLD solely because the author marked it do-not-merge-before-review. |
| #131 | HOLD | Author do-not-merge; numbers verified. Report/guide overclaim "confirming a sample confirms the rule" for a 10% sample (anchoring risk). |
| #133 | HOLD | Author do-not-merge; report/body say 10 fail/5 pass but summary.json and report's own table give 11 fail/4 pass; barrel range misstated. |
| #135 | OK to merge | Remaining delta is a 3-line opt-in fix (includeViolations on cypher-interp path); main npx work already on v1.3 via 3292ebed. |
| #136 | HOLD | Docs-only source supplement; sealed files untouched, careful sourcing. HOLD only because author marked do-not-merge-before-review. |
| #138 | OK to merge | New additive `check` subcommand + action.yml; numbers verified, no existing defaults changed. Add in-sample caveat; stale cypher-interp note. |
| #139 | HOLD | Author do-not-merge; numbers verified, filter OFF by default. Amends the FROZEN report schema (reopens U3 per its own $comment). |
| #141 | HOLD | Author marked "Do not merge". Checks otherwise clean: judge v2.2 is opt-in, v1 stays default, hashes and counts match. |
| #143 | HOLD (merged 07:52 UTC, before the hold) | New agent-callable `hints` param on the default MCP arm tools (check_file/check_diff/explain_violation); amends FROZEN report schema |
| #144 | HOLD | Author marked "Do not merge; this is for review". Checks otherwise clean: catalogue opt-in, counts match on both engines. |
| #145 | HOLD | Author marked "Not to be merged by the agent"; propose_rules registered by default on the MCP server (10→11 tools, ungated) |
| #146 | HOLD | Docs only; author marked "Do not merge without the author's review". Gate counts, power figures and tier hashes check out. |
| #147 | HOLD | Docs only; author marked "Do not merge without the author's review". Figures match their sources; memo is still inconsistent on 2,668 vs 2,669. |
| #149 | HOLD | Author asks to read §8/§9 before merging. Checks otherwise clean: all coverage, class and crosscheck numbers recompute exactly. |
| #151 | HOLD | Author marked do-not-merge; numbers and byte-identity verified; new 30 s default interp timeout; overlaps R15/R17 with #159 |
| #154 | HOLD | transcript.jsonl is gitignored and not committed, so `npm run demo:sdd` can't reproduce; author marked do-not-merge |
| #155 | HOLD | Author marked do-not-merge; triage counts (49=29+20), SCC and self-check verified; "credibility demonstration" wording |
| #156 | HOLD | Transcripts (*.jsonl) not committed; scripts hard-code author's local machine paths; src/mcp-server change untested; do-not-merge |
| #159 | HOLD | Amends FROZEN report schema; several ungated default changes (MCP check_file/path refusal, sort order, COMPILER_005); do-not-merge |
| #160 | HOLD | Synthetic-only rehearsal; numbers check out, but doc says analysis "is proven" / "confirms" on synthetic data; do-not-merge |
| #162 | HOLD | Modifies hash-frozen scripts/lib/mutation/types.ts (judge-catch-frozen.md:20); run.json embeds ~318k chars of 3rd-party diffs |
| #164 | HOLD | Author marked do-not-merge; prespec draft edited; --expect-sha256 now accepts a 2nd hash method (ungated). Numbers check out. |
| #165 | HOLD | Author do-not-merge; numbers reproduce, but report §4 says unanimous verdicts are no more accurate than average, false for v2.1. |
| #167 | HOLD | Author do-not-merge; figures reproduce (283/283; control 500/500 incorrect). Correctness only, one spec author; no other blocker. |
| #168 | HOLD | Author "do not merge"; doc says 7,904 snapshots / 526 empty but walk.json and summary.json sum to 8,319 / 536. Otherwise numbers reproduce. |
| #169 | HOLD | Author do-not-merge; "SO1 met" and §4.2 "no public benchmark … exists" overclaim; quotes unreviewed PRs; fix-mining n=5 outdated vs #168. |
| #170 | HOLD | Author do-not-merge; conflicts with v1.3 (8 files); carries unmerged #159 src with ungated default changes; edits extension-templates.ts. |
| #171 | HOLD | Author do-not-merge; "plan without new fields runs exactly as today" is not quite true (probe moved before install, new stderr warning). |
| #172 | HOLD | Docs-only tool landscape; all six checks clear; held only because the author marked it do-not-merge-before-review |
| #173 | HOLD | Tunables manifest + R23 spec pin; opt-in and read-only hashing; held for author's do-not-merge mark; stale "neural absent" note |
| #174 | HOLD | Unsealer tool built to read the sealed task file by hand (not wired anywhere); pilot numbers verified; author do-not-merge |
| #175 | HOLD | Leakage census numbers match census.json; scrubber is off by default; refuses sealed paths; held only for author's do-not-merge mark |
| #176 | HOLD | cypher-interp MCP engine is OFF by default; 142/142 and 12/12 verified; doc says 6 explained spec-only rows, data has 7; do-not-merge |
| #177 | HOLD | Notion triage doc; 597-row status counts recomputed and match; no code; title itself says "do not merge" |
| #178 | HOLD | Docs-only distinction-readiness note; cited repo figures match; open-PR evidence flagged as open; author do-not-merge |
| #179 | HOLD | Author marked do-not-merge; numbers reconcile with rows.csv/scores.json; one "structurally cannot see" overclaim, clean units not de-duplicated |
| #180 | HOLD | Do-not-merge; F1 changes gate-arm loop behaviour (stop on unscored snapshot) and resume file moves with no flag; numbers OK |
| #181 | HOLD | Do-not-merge; pooled 35-project stats depend on wave-1 data from unmerged #133 (not in v1.3); wave-2 numbers reconcile |
| #182 | HOLD | Author marked do-not-merge; summary table matches summary.json; no code/frozen changes; stray __pycache__ .pyc committed |
| #185 | HOLD | Title says do not merge; 637/655 and MT-B1 numbers reconcile; src/ change is OFF-by-default flag; no frozen edits |
| #186 | HOLD | Do-not-merge; "both authors fail 10/15" is wrong — A fails 11/15 per agreement.json and the doc's own table |
| #187 | HOLD | Title says do not merge before review; docs-only, no code/default/frozen changes; no overclaims found |
| #188 | HOLD | Accelerated query engine + memory guard ON by default (CLI, MCP, batch); flips 3 verdicts pass->hard-block, doc names only typeorm |
| #189 | HOLD | Checks clear; HOLD only because author marked do-not-merge-before-review (sealed-list domain check also left to author) |
| #190 | HOLD | Diagnostic only, no src/template edits; HOLD for author's do-not-merge; fix unit-kill count 129/273 (JSON gives 116/273) |
| #191 | HOLD | Numbers reproduce; v2.2 opt-in (default v1). HOLD: author do-not-merge; stacked on #141/#126; unpinned agy version in Gemini rater |
| #192 | HOLD | Docs-only, citations spot-check OK; HOLD: author do-not-merge, repeats #188 "byte-identical" overclaim, step 3.2 wrong about #191 src/ |
| #193 | HOLD | Docs-only foreman log; :31 wrongly records #131 as merged by the train (it is open); fix the record first |
| #194 | HOLD | Docs-only Study 2 outline v2; spot-checked numbers match sources; HOLD only because author marked do-not-merge-before-review |
| #195 | HOLD | Author marked do-not-merge; director summary overclaims "reliable" and contradicts its own gap table; doc-only otherwise |
| #196 | HOLD | Clean: call log OFF by default, no frozen edits, no secrets; HOLD only because author marked do-not-merge-before-review |
| #197 | HOLD | Checks clear; all recomputed counts match (39/56 snapshots, 100/100 keys, 9/13 rows); HOLD only for author do-not-merge |
| #198 | HOLD | Checks clear; deltas, exact p's, Spearman rho and B=283 recompute from per-repo.csv; HOLD for author do-not-merge + #133 dependency |
| #199 | HOLD | Author marked do-not-merge-before-review; otherwise clean: 39/39 parity matches JSON, --engine is opt-in, no frozen/sealed touch |
| #200 | HOLD | Author marked do-not-merge-before-review; otherwise clean: demo table matches JSON, runner off by default, minimal env to child procs |
| #201 | HOLD | Author marked do-not-merge; sealed-list domain check still pending (author); no sealed reads; one mis-cited sweep cell |
