# COMPREHEND-01 pilot: files only vs files plus graph tools (63 of 64 calls)

**Run:** 2026-10-22 (UTC), 18:46–19:02. The file name follows the round's date. **Status:** exploratory,
**v1.5-exp**, development material. One run per cell, so nothing here has an interval.

**Design:** `ops/notes/comprehend-01-design.md`, approved by the author as written. **Build:**
`Docs/DiagnosticRuns/comprehend-01-build-2026-10-23.md`. **Revisions:** `experiments/comprehend-01/revisions.md` (R1 and
R2, both made before any question was asked).

**Records:** `experiments/comprehend-01/results/pilot/` holds the ledger, summary, analysis, plan, transcripts, graph
call logs and the neutral id map. The R1 smokes are in `results/pilot-r1-smokes/`.

**Model:** `claude-sonnet-5-5`, through `claude -p` on CLI 2.1.308. It is the only model id in any `modelUsage`.

**Not changed:** `src/`, `presets/`, `scripts/lib/`, `scripts/v1.3/`, the tag `v1.4-freeze-2026-10-20` and every
registered Study 2b artefact.

**Frozen inputs.** Bank SHA-256 `4669be26…9e33`. Its text, keys, classes and scoring are identical to the hand-checked
keys of 07ce2918. Frame SHA-256 `c0880645…bf8e`.

## 1. Result in one paragraph

On 30 questions over 10 trees, the two arms are **equally accurate** on every item the graph is not known to get
wrong: 26/27 each on non-Gw items, a mean difference of 0.00.

The graph arm is **cheaper**:
- the geometric-mean processed-token ratio FG/F is **0.835** on non-Gw items (0.838 on all items);
- wall time is about 15% lower;
- FG makes 1.5 fewer tool calls per question.

The graph's three known gaps (Gw) cost FG one answer that F got right (LH-WW1). There, the agent took `who_writes` at
its word and said so. The other two FG misses are a hop-naming slip that F makes too, and a placement item with no
graph call.

**Measured against the design's own failure criteria (§9):**
- "more accurately" **fails** (difference ≤ 0.05);
- "more cheaply" **holds** (ratio < 0.9);
- the graph is trustworthy enough to serve: 0 wrong facts used (D1), and every Gw item was predicted;
- the plumbing passed.

## 2. Accuracy

Primary score; secondary score in brackets (Jaccard or the fraction of hops).

| | F (files only) | FG (files + graph) |
|---|---|---|
| **All 30 items** | **0.933** (0.987) | **0.900** (0.945) |
| Non-Gw (27) | 0.963 | 0.963 |

**By question type:**

| Type | n | F | FG | Misses |
|---|---|---|---|---|
| W writes | 8 | **1.000** | 0.875 | FG: LH-WW1 |
| C call chain | 6 | 0.667 | **0.833** | F: LH-C1, DF-C1; FG: DF-C1 |
| R rule risked | 5 | 1.000 | 1.000 | – |
| I importers | 4 | 1.000 | 1.000 | – |
| P placement | 4 | **1.000** | 0.750 | FG: P2-P1 |
| O owner | 3 | 1.000 | 1.000 | – |

**By class:**

| Class | n | F | FG | Design prediction |
|---|---|---|---|---|
| G (a tool answers) | 16 | 0.938 | **1.000** | FG ≥ F |
| Gw (tool output wrong or incomplete) | 3 | **0.667** | 0.333 | FG no better (PR4): **holds** |
| S (spec answers) | 4 | 1.000 | 1.000 | tie: holds |
| X (no tool answers) | 7 | **1.000** | 0.857 | tie: off by one item (P2-P1) |

**By tree group:**

| Group | Items | F | FG |
|---|---|---|---|
| Human DDD repositories (payday, meetinger, ddd-forum) | 13 | 0.846 | 0.846 |
| Puzzle seeds and precision fixtures | 17 | 1.000 | 0.941 |

On the human repositories' G items (6), FG scores 1.000 and F scores 0.833; the difference is LH-C1.

## 3. Cost

Means per question, from the result envelopes. Wall time is the driver's clock.

| | F | FG | FG/F |
|---|---|---|---|
| Processed tokens, mean (median) | 26,291 (22,568) | 22,347 (17,241) | geo-mean ratio **0.838** |
| Output tokens | 671 | 489 | 0.73 |
| Tool calls | 3.43 | 1.93 | −1.5 per item |
| Turns | 4.43 | 2.93 | |
| Wall time, mean (median) | 13.3 s (11.3 s) | 10.0 s (8.9 s) | geo-mean ratio 0.829 |

**Token ratio FG/F per slice** (geometric mean over paired items):

| Slice | Items | Ratio | Prediction |
|---|---|---|---|
| Non-Gw | 27 | **0.835** | "more cheaply" fails at ≥ 0.9: **holds** |
| Human repositories, non-Gw | 10 | 0.827 | PR2 < 0.8: **not met**, narrowly |
| Human repositories, G | 6 | 0.793 | |
| Seeds and fixtures, non-Gw | 17 | 0.840 | PR3 ≥ 0.8: **holds**; the graph pays a little even on small trees |
| S and X | 11 | 1.037 | the tools add schema cost where they cannot help |

**Fixed overhead.** The calibration smoke ("Reply OK") cost 4,470 processed tokens in F (R1 argv) and 5,521 in FG (R2
argv). The two smokes ran under different argv, so the difference, about 1,050 tokens, is an indication of the tool
schemas' cost and not a measurement.

**Tool use.**
- F: Read 44, Grep 42, Glob 17.
- FG: Read 19, Grep 14, Glob 6, `trace` 12, `who_writes` 4, `context_map` 3, `impact` **0**.
- FG made no graph call in 12 of 30 sessions: the 4 I items, 5 of the 7 X items, both S owner items with a declared
  spec, and P4-C1. This is under the design's revision threshold (more than half).
- `impact` was never called. Every importer question (I) was answered with Grep, in both arms, and correctly.

## 4. Every wrong graph-arm answer: which graph fact was missing or wrong

| Item | Class | FG answer | Graph calls | Code | The graph fact |
|---|---|---|---|---|---|
| **LH-WW1** (W, payday): "which commands save Account" | Gw | 2 of 4 commands (Create, CreateUser) | `who_writes Account` | **D2, missed fact**, used unchecked | `who_writes` lists only the two creating commands. It misses DepositUseCase.execute and WithdrawUseCase.execute, which save through `update(t: UpdatePartial<Account>)`: the mapped type is not read as an Account parameter, so neither write is in the footprint. The tool's note says that untyped or deep writes are not seen. The agent's reply says it did not open the source files. F read the code and got all four. |
| **DF-C1** (C, ddd-forum): user creation → Member persisted | Gw | 5/6 required hops in order; end file right | `trace CreateUserUseCase.execute` (full), `who_writes Member` | **D2, missed facts**, plus an agent naming slip | (a) `trace` stops at `SequelizeUserRepo.save`. The Sequelize `afterCreate` hook and the `DomainEvents.register(callback)` registry are not resolvable calls, and the full view was also cut at 60 steps. (b) `who_writes Member` names the write as `IMemberRepo.save`, the port, and not the implementing class. The agent found the event path in the code, but named the store unit `SequelizeMemberRepo.save` after its file. The class is `MemberRepo` (`sequelizeMemberRepo.ts:12`). F made the mirror slip (`UserRepo.save` for `SequelizeUserRepo.save`) and also scored 5/6. |
| **P2-P1** (P, P2 seed): where the points-on-order handler goes | X | `src/sales/application` | none | **D4 by the rule** (no graph call); no tool answers placement | No graph fact is involved. The agent placed a sales-side handler that calls membership's published `awardPoints` through a new port and ACL adapter. The key, which follows the puzzle's documented clean line, is a handler in `src/membership/application/`. **For the author:** this is the same shape as the alternative clean design PUZZLE-03 accepted on P5 (a handler on the event's side, delivered by the relay). Possible key dispute (**D5 candidate**). It is not re-scored here; with it, FG would be 28/30 and X 7/7. |

**Totals.** D1 (wrong fact used): 0. D2: 2, both on Gw items, and both gaps were predicted in the key's provenance
before any call. D3: 0. D4: 1. D5 candidates: 1, unresolved.

**The third Gw item went the other way.** On MT-WW1, `who_writes Meeting` missed the write through an untyped
`Result.unwrap()`. FG checked it with one Grep and one Read, and answered correctly. So FG checked the tool against the
code on 1 of the 2 W gaps; the condition sentence asks for that check "when it matters".

**F's misses, for comparison.**
- LH-C1 (G): F followed the chain one level past the key, to `BaseFakeRepo.addFakeItem` in
  `src/core/infra/BaseFakeRepository.ts`; the chain was right and the end file was not. `trace` gave FG the key's end
  directly.
- DF-C1 (Gw): the naming slip above.

**Graph revision list** (for DETECT-02, development material; not applied in this round):
1. Read mapped and utility types over an aggregate (`UpdatePartial<A>`, `Partial<A>`) as that aggregate in the
   write footprint.
2. Name the in-tree implementation of a port in `who_writes` write rows (as `trace` does). It would have given the
   class name `MemberRepo`.
3. Optionally, edges for an ORM hook and for a callback registered in a `DomainEvents`-style registry. This is a
   known, design-level gap, so it may be better stated by the tool than resolved.

## 5. The link to behaviour (design §8)

| Puzzle step | Items | F | FG |
|---|---|---|---|
| P1 trap steps 1 and 2 (rule risked) | P1-R1, P1-R2 | 2/2 | 2/2 |
| P2 trap step 3 (rule risked) | P2-R1 | 1/1 | 1/1 |
| P4 trap step 1 (rule risked) | P4-R1 | 1/1 | 1/1 |
| P1 clean step 1, P2 clean step 3 (placement) | P1-P1, P2-P1 | 2/2 | 1/2 |

**PR6 holds.** With files alone, the agent names the rule that each puzzle's trap step would break, on all four trap
steps. In PUZZLE-01 the same model took these trap lines (P1 0/5 clean; P2 1/5 after the hand read). Read with
design §8, the baseline failures are **not comprehension failures**: asked directly, the agent knows the rule.

So "graph at the start" cannot be what fixes them. What remains is delivery at the moment of action, the edit gate
(`ops/notes/v15-edit-gate-design.md`). This rests on one run per arm and two puzzles, and is descriptive.

## 6. Predictions and criteria (design §9)

| Id | Prediction | Result |
|---|---|---|
| PR1 | On human-repository G items, FG ≥ F, and better on C and W | **Partly.** FG 1.000 vs F 0.833. Better on C (LH-C1); W tied at 1.000. |
| PR2 | Human repositories: token ratio < 0.8 | **Not met** (0.827; 0.793 on G items) |
| PR3 | Seeds and fixtures: ratio ≥ 0.8, accuracy ties | **Holds** (0.840; 1.000 vs 0.941, the one miss being P2-P1) |
| PR4 | Gw: FG no more accurate than F | **Holds** (0.333 vs 0.667) |
| PR5 | S and X tie | S ties; X differs by P2-P1, a possible key dispute |
| PR6 | F answers the trap-step R items correctly | **Holds** (4/4) |

| Failure criterion | Value | Verdict |
|---|---|---|
| "More accurately" fails if the mean FG − F over non-Gw items ≤ 0.05 | 0.000 | **fails** |
| "More cheaply" fails if the geo-mean token ratio over non-Gw items ≥ 0.9 | 0.835 | holds |
| Not trustworthy if D1 > 2 wrong FG answers, or a Gw item was not predicted | D1 = 0; 3/3 predicted | holds |
| Plumbing: > 3 missing answer lines, a second leak, an unreported cap hit | 0, 0, 0 | passed |

## 7. Calls, isolation and revisions

| # | Session | Under | Outcome |
|---|---|---|---|
| 1 | cal-F (smoke) | R1 | passed (`mcp_servers: []`, as F should) |
| 2 | cal-FG (smoke) | R1 | **no MCP server loaded**; the run was stopped by hand before any question |
| 3 | cal-FG (smoke) | R2 | passed (`daedalus-graph` connected, four tools listed) |
| 4–63 | 60 question sessions | R2 | all valid on the first attempt; 0 re-runs, 0 cap hits, 0 missing answer lines |
| | **Total** | | **63 of the hard cap of 64**; 1 unused |

- **R1** (before any call): the cap of 64 and the isolated layout.
  - The generator runs as uid 1500, from copies of the trees under `/srv/t/tNN`.
  - The clone was closed with `chmod 700`; it was never moved or removed, and was reopened at the end.
  - FG's server starts through `sudo -n` and a root-only launcher that takes only a neutral id.
  - A failed smoke stops the pilot.
  - Checks before any call: all nine listing checks were denied. The fingerprint sweep's only hit after one wrapper
    comment was fixed was its own pattern file. A zero-call MCP handshake as the generator listed the four tools.
- **R2** (after the two smokes, before any question): EFF-01's argv emits `--safe-mode`, and on this CLI that disables
  every `--mcp-config` server.
  - This is the same cause recorded in the 2026-10-19 brownfield pilot and the 2026-10-20 S4 probe.
  - The fix: both arms drop `--safe-mode` and add `--disable-slash-commands`; `--restricted` stays.
  - Each session's init event must now list exactly the arm's servers, or the pilot stops.
  - F's smoke was not repeated; FG's was.
  - Both arms changed in the same way, and no question, key or tool changed.
- **Isolation held.**
  - 0 confinement findings: no Read, Grep or Glob outside the tree copy, and no MCP call in F.
  - The init check matched the arm in all 61 R2 sessions.
  - The generator could not read the repository, the bank, the graph check, the clones, the out root or the real
    server configs.
- **Recorded deviations.**
  - The R1 FG smoke is a spent call with no usable result.
  - The F smoke ran under the R1 argv (with `--safe-mode`).
  - Sessions ran one at a time (the design allowed 2 lanes).

## 8. What this does and does not show

- **Shows:** on this bank, the graph tools buy about **16% fewer tokens and 15% less time per question at equal
  accuracy**. They make the agent answer writes and chains in one or two calls instead of four or five reads.
- **Shows:** the graph's predicted gaps are where FG can be misled. The agent checked the code on one of the two W
  gaps and not on the other.
- **Shows:** with files alone, the agent knows the rules the puzzle traps break (PR6).
- **Does not show:** that the graph makes the agent more accurate. Both arms are near ceiling (0.963 non-Gw).
- **Does not show any variance.** One run per cell; a single item flips a type's accuracy by 0.125–0.33.
- **Limits:**
  - The bank (30 items) was written by a Claude session, as was the subject model's family.
  - The G labels were checked against the same tools, after the build's revision T1.
  - ddd-forum is a well-known repository.
  - The human repositories were analysed without installed dependencies, which causes MT-WW1's gap.

## 9. Next (for the author)

1. **Key decision on P2-P1:** accept the sales-side handler (port and ACL to the published `awardPoints`) as a
   full-credit path, or not. Whichever is decided, record it as a dated key revision and report the item both ways.
2. **Whether a variance run is worth it** (D3 in the design). The accuracy question is at ceiling on this bank. A ×3
   run would mainly firm up the cost ratio, which is already under the 0.9 criterion at n=1.
3. **Graph revisions 1 and 2** (§4), as a DETECT-02 development change, before any further FG run. Re-run the graph
   cross-check after them, at zero calls.
4. **Delivery:** PR6 points the v1.5 delivery track at the edit gate, rather than at structure given before acting.
