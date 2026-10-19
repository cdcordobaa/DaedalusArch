# Study 2 declared deviation 2: the primary outcome becomes drift D (2026-10-19)

<!-- study2-protocol: primary=D-new-blocking-identities-steps-2-to-k; k=5; arms=none,daedalus-mcp; cells=none@L2,none@L3,mcp@L2; start=shared-step-1; unit=distinct-edge; tasks=new-4-layered-2-ddd-sealed-at-freeze; fallback=run-exploratory; order=freeze,hold-out,pilot-and-rehearsal,pre-registration,gate,run; generators=claude-sonnet-5-5,gemini-pin -->

**Status: declared deviation, dated 2026-10-19. Not a pre-registration.**
- **The decisions are the author's.** The board decided M3 on 2026-10-18 (`ops/decisions.md`, "Settled on 2026-10-18"). The author confirmed it, and chose the tasks, the fallback and the generators in chat on 2026-10-19 at about 20:00 UTC. An AI session wrote them down and took none of them.
- **It changes a plan, not a registration.** Study 2 has not been pre-registered (gate D10 RED), so this changes a plan. It is still a change made after development material was seen, so it is declared, with what was seen (§3).
- **It supersedes §2 of the first deviation** ([`Docs/v1.3/study2-deviation-2026-10-16.md`](../v1.3/study2-deviation-2026-10-16.md), the level outcome Y). From today, this record is the single source of the Study 2 protocol. `scripts/v1.3/protocol-consistency-check.mjs` reads its block (§2), and every protocol document carries the line above.
- **What was read to write it.** No sealed directory, no answer key and no `.env` were read. It names no sealed task.

> **Note, 2026-10-19 (evening, decisions EXP and EXPT, `ops/decisions.md:27-28`).** A separate exploratory study runs before this one. It has its own registration: [`exploratory-study-registration.md`](exploratory-study-registration.md). This record stays the confirmatory Study 2 protocol, and its block in §2 is unchanged. The exploratory study does not use this record's tasks, contrasts, pilot bar or fallback. Any change its results cause here will be a new dated deviation.

The design is [`ops/notes/s2d-01-study2-drift-design.md`](../../ops/notes/s2d-01-study2-drift-design.md) (s2d-01), with the three changes REV-03 asked for ([`ops/notes/rev-03-study2-drift-fable.md`](../../ops/notes/rev-03-study2-drift-fable.md), "Three changes first"), written in §5 below. Where s2d-01 and this record disagree, this record wins.

## 1. What changes, in one paragraph

Study 2 no longer compares the *level* of blocking violations at step 4 (Y). It compares **drift D**: the number of **new** distinct blocking identities that appear at steps 2 to 5, counted from a **shared step-1 tree**. Each block runs step 1 once, in `none@L2`. All cells branch from that tree at step 2. An identity already present in the step-1 tree never counts as introduced. So D measures how far violations spread as the project grows from an accepted starting state, not where the agent's first layout lands. Three cells are compared over steps 2–5:
- `none@L2`, the minimal spec;
- `none@L3`, the minimal spec plus one plain sentence per blocking rule;
- `mcp@L2`, the minimal spec plus the 9 spec-only MCP tools, with `evaluate_project` denied.

The generators are Claude Sonnet and Gemini, one lane each. The tasks are new: 4 Layered and 2 DDD, sealed at the freeze. If the pilot bar fails, the main run still goes ahead, labelled exploratory.

## 2. The protocol after this deviation

```study2-protocol
primary=D-new-blocking-identities-steps-2-to-k
k=5
arms=none,daedalus-mcp
cells=none@L2,none@L3,mcp@L2
start=shared-step-1
unit=distinct-edge
tasks=new-4-layered-2-ddd-sealed-at-freeze
fallback=run-exploratory
order=freeze,hold-out,pilot-and-rehearsal,pre-registration,gate,run
generators=claude-sonnet-5-5,gemini-pin
```

| Item | Value | Replaces (first deviation, §2) |
|---|---|---|
| Primary outcome | **D** per cell: distinct blocking identities present at step j (2 ≤ j ≤ 5) and absent from the shared step-1 tree and from every earlier step of that cell, summed over steps 2–5.<br><br>Identities follow the pilot memo's identity rule. The unit is the distinct edge (or a cycle as its sorted file set). Only findings that `check-correct.ts` labels `correct` count. The blocking tier is the sealed tiers plus the declared post-seal overlay (ADR-V14-01, -02). Every snapshot is scored (ITT). | Y, distinct blocking edges at step 4 |
| What D measures, stated plainly (REV-03 finding 3) | **The propagation of the inherited step-1 pattern into new slices.**<br>- Probe 1 showed every post-step-1 identity was a step-1 habit copied into a new slice (`Docs/DiagnosticRuns/v1.3-floor-probe-2026-10-16.md` §3.3).<br>- A block whose step-1 tree has Y₁ = 0 contributes 0 in every cell.<br>- So D is reported together with the step-1 level Y₁ per block, and the claim is scoped to "spread from an accepted starting state" | — |
| Secondary outcomes | Y at step 5 (the first deviation's primary); Y₁; the memo §5 slope outcomes; advisory per KLOC without FF-CV05; the evasion measures (§6) | Y moves from primary to secondary |
| Start | Shared step 1 per block, run once in `none@L2`; all cells branch at step 2 | Independent runs from step 1 |
| Cells | `none@L2`, `none@L3`, `mcp@L2`. The L4 cells are not run, and L1 stays not run (S5) | none@L2, none@L3, none@L4, mcp@L2, mcp@L4 |
| Confirmatory contrasts | **H1:** none@L2 vs none@L3 (SO5: does spec delivery in prose cut drift).<br>**H2:** none@L2 vs mcp@L2, relabelled **"delivery plus checking"**: the MCP tools both deliver the spec (`get_architecture_spec`, `which_layer`) and check it, so H2 does not isolate checking (REV-03 finding 4).<br>Paired two-sided block sign-flip, 99,999 flips, seed fixed in the pre-registration; Holm over 2. Effect: RR of ΣD, with a block-bootstrap interval | H1, H2, H3; Holm over the survivors |
| Registered equivalence (REV-03 finding 4) | none@L3 vs mcp@L2 as a **margin-bounded equivalence test**. The margin is fixed in the pre-registration, before the main run. It is the only registered way to read "the firewall adds only spec delivery" | H3 (none@L4 vs mcp@L4), dropped |
| Horizon | **k = 5.** Each of steps 2–5 adds a new vertical slice or a new outside adapter (boundary pressure) | k = 4 |
| Tasks | **New confirmatory tasks: 4 Layered plus 2 DDD on standby.**<br>- **Written by** a separate session that never runs, scores or reads any Study 2 output (V10c), to `Docs/v1.3/study2-task-design.md` T1–T10.<br>- **Before the freeze:** hint-audited, approved by the author (S13), with per-step acceptance checks (D12), then hashed at the freeze.<br>- **Domains:** checked by the author against the retired sealed list (as in F23) and against every practice domain.<br>- **The pilot tasks** are `ice-rink` (Layered) and `vineyard-harvest` (DDD), both rehearsal tasks. They are never confirmatory | The sealed Study 2 list |
| The sealed list | **Formally retired as the confirmatory task set.** It stays sealed and is never opened by an agent. Its only remaining use is the author's domain check of new tasks. Gate S14 now means "the retired list is intact and was not read" | Confirmatory tasks |
| Generators | **`claude-sonnet-5-5`** and **the Gemini pin** (CDX, `ops/decisions.md`). The exact Gemini model id and agy version are fixed in the generator adapter before the freeze, and the generator passes its own S4 confinement probe (`Docs/v1.4/gemini-s4-probe-spec.md`). One lane per generator. The Codex pin is no longer required. V10(a), "a non-Claude generator", is met by Gemini | Claude Sonnet and the Codex pin, run after about Nov 9 |
| Blocks | Task × replicate × generator: **4 tasks × 4 replicates × 2 generators = 32 blocks**. If DDD passes its pilot bar, the 4 tasks are 2 Layered + 2 DDD; otherwise 4 Layered. Block differences are pooled over generators; per-generator contrasts are descriptive, and sign agreement between generators is a registered falsifier | 24 blocks |
| Styles | **Layered is confirmatory.** **DDD is confirmatory only if** D15 (its spec mode) is decided before the freeze **and** it passes the pilot bar. Clean and Hexagonal are not run. Their existing zeros are reported as a finding: agents already follow those styles (REV-02 item 5) | Layered and DDD both confirmatory |
| Pilot bar (fixed here, before the first pilot call) | Per style, `none@L2`, k = 5, 3 replicates per task per generator:<br>1. **Escape:** mean D ≥ 1.0 over the 6 runs; ≥ 3 of 6 runs with D ≥ 1; ≥ 1 of 3 per generator.<br>2. **Starting pattern (REV-03 finding 3):** Y₁ ≥ 1 in ≥ 3 of 6 runs.<br>3. **Power** (§4).<br>4. **Validity:** unmapped files ≤ 10 %; type-check passes in ≥ 2 of 3 runs per generator; every counted finding `correct`; 0 evaluation errors; S4 passed for both CLIs | Mean Y ≥ 1.5 at step 4 |
| Fallback (author's choice, 2026-10-19) | **Run, labelled exploratory.** If no style passes the bar, or no contrast survives the power rule, or a kept no-waiver gate line is red at the go, the main run still goes ahead under this protocol, labelled **exploratory**:<br>- no Holm claims;<br>- RRs with intervals;<br>- per-generator descriptives.<br><br>The thesis claim then returns to the honest null (`Docs/v1.3/floor-escape-design-2026-10-16.md` §5 items 1–4), with D as a measured description of how violations replicate. This is stated in the pre-registration before the main run | `do-not-run` |
| Order | Freeze (with the V4 ADR) → sealed hold-out once → pilot, which doubles as the dress rehearsal (its smoke branches exercise every cell on both generators) → OSF pre-registration with embargo → gate re-verified, author's go → Study 2 once | Pilot before the freeze; separate dress rehearsal |
| Waivers | None added. Only lines marked [W] in the gate may be waived. **D12 loses its [W]** (acceptance checks are required, s2d-01 §5.1). The per-line treatment is §7 | — |

## 3. What had been seen when this was decided

1. **The outcome was proposed before the level decision.** Probe 1 proposed "the **new** blocking identities at steps ≥ 2" as the primary outcome (`Docs/DiagnosticRuns/v1.3-floor-probe-2026-10-16.md` §5 item 3), before the first deviation chose the level Y. The pilot memo already registered that outcome as a secondary (first deviation, §2, "Secondary outcomes"). So this is a promotion, not a new invention.
2. **Every observation of drift is development data.** It comes from probe 1: three Layered tasks, one Opus session by hand. In `none`, D at k = 5 was 1, 2 and 5. In the tool arm, every step-1 finding was fixed in one pass, and no blocking finding appeared again (§3.4 there). That tool arm used `check_diff` and evaluation tools that the Study 2 `mcp` arm denies. So an H2-like comparison has been glimpsed on development tasks, with different tools. The pre-registration says so.
3. **No Sonnet or Gemini step in Layered exists anywhere.** E1's Sonnet cells are Clean, single-shot and have 0 blocking findings. The base rate in s2d-01 §3 is Opus data standing in for both generators (REV-03 finding 6).
4. **Board decisions this record depends on.** The decision to measure drift (M3) was taken knowing that the registered simulation puts *trend* (slope) outcomes at power ≤ 0.08 (`ops/decisions.md`, M3). D is a sum over steps, not a slope, and leaves out step 1 (REV-03, "What survives").
5. **No sealed task was opened** for this record or for any observation above. The author alone opened the sealed list once, for F23 on 2026-10-19 (`Docs/DiagnosticRuns/v1.3-f23-and-v4-count-2026-10-18.md` Part 3), and found that it names no styles. A Claude-family examiner session also read it, without tools or a saved transcript (declared in `ops/notes/deviations-v14.md`).

## 4. Power (REV-03 finding 1)

- **The s2d-01 §3 figures are placeholders.** They are power 1.00 / 0.79 / 0.19 at RR 0.25 / 0.5 / 0.75, 32 blocks, built from three Opus trajectories. They are not the power claim.
- **The power claim is re-based after the pilot.** `scripts/v1.3/level-power-sim.ts` gains an `outcome: 'drift'` mode before the freeze, as specified in s2d-01 §3. The input is the **lower bound** of each generator's pilot mean D (two pilot tasks), over a **θ band**, not a point θ. Both correlation models are reported: independent cells and shared start.
- **Minimum detectable effect: RR ≤ 0.25 only.** The study is designed to detect an arm that cuts drift to a quarter. A halving or a 25 % cut is not claimed detectable, and the pre-registration says so.
- **Power rule:** a contrast whose re-run power is below 0.80 at RR 0.25 is demoted to secondary before registration.

## 5. REV-03's three changes, and where each is met

| REV-03 change | Met by |
|---|---|
| 1. A second dated deviation with a new `study2-protocol` block, the probe-1 §5.3 citation, the list of what had been seen, the corrected tool-arm sentence, and an explicit fallback decision | §2 (block and fallback); §3 items 1–2 (citation, what was seen, the tool-arm sentence: the probe-1 tool arm used tools the Study 2 arm denies) |
| 2. Power re-based on a two-task pilot's lower bound over a θ band; MDE "RR ≤ 0.25 only"; the Y₁ ≥ 1 bar line | §4; §2 pilot bar item 2 |
| 3. `none@L3 vs mcp@L2` registered as a margin-bounded equivalence; H2 relabelled | §2, "Confirmatory contrasts" and "Registered equivalence" |

## 6. Evasion check (M6), with REV-03 finding 5's corrections

As s2d-01 §5, with these changes:
- **§5.4, literal view:** the gap counts only above **a margin of one identity per snapshot**.
- **§5.7, concentration:** "loses the effect" means a Holm-adjusted p > 0.05, or an RR interval covering 1, after the dominant rule family is removed.
- **§5.5, moved-only read:** test files are stripped from the shown diffs, because the tool arm adds test files and that is a tell. The author reads blind. The free rater's second read is added when the rater labels (after the study, §7 V5).
- **§5.1, acceptance:** the per-step acceptance checks are written with the new tasks, before the freeze (D12, no waiver).

## 7. Readiness gate under this protocol

This is s2d-01 §6, with today's decisions applied.
- **Kept** means it must be green at the go, with no waiver.
- **Deviation** means it is restated here.

| Line | Treatment |
|---|---|
| V1, V2, V3, V9, V11 | Kept |
| V4 | Kept, under a V4 ADR dated before the hold-out. A style the hold-out only "characterises" is reported as exploratory in Study 2 |
| **V5** | **Deviation, timing (author 2026-10-19): the independent rater's labels are collected after the study.** They don't feed the run. The κ definition (V6) is still dated before the first label |
| V6 | Kept, with its trigger moved: the definition must be signed before the first label, which may come after the run |
| V7 | [W] waived: the judge is dropped from Study 2 |
| V8 | Per-snapshot coverage of generated code is kept. Adjudicating the human-code fidelity sheets is a deviation; evasion step 5.4 covers generated code |
| V10 | (a) **Deviation (CDX):** Gemini. (b) [W]. (c) Kept |
| S1–S4, S7, S8, S10–S13 | Kept. S4 is per CLI × arm; Gemini is new |
| S14 | Kept, restated: the retired sealed list is intact and was not read by an agent |
| S5 | Met: L1 declared not run |
| S6 | Deviation: the advisory outcome is secondary only; per-rule counts are still recorded |
| S9 | Kept: two lanes, two harness roots |
| S15 | Met: no model labeller |
| D1, D3, D11 | Deviation, restated as §2's pilot bar, §4's power rule and the 3-cell shared-start arm set |
| D2, D4–D10, D13, D14 | Kept. D9 needs the D analysis run on pilot data with a planted effect. D14's live resume runs in the pilot |
| D12 | Kept, waiver removed |
| D15 | Kept. If undecided at the freeze, DDD is exploratory |
| D16 | Deviation: secondary, computed after the run |

## 8. Still open (none is decided by this record)

- The equivalence margin for none@L3 vs mcp@L2. It is fixed in the pre-registration.
- D15, the DDD spec mode. If it's undecided, DDD is exploratory.
- The V4 ADR text.
- The Gemini model id and agy version pin, fixed in the adapter.
- The writer of the new tasks: which session and which model.

## Changelog
- 2026-10-19 (evening): dated note pointing to the exploratory study registration. No protocol value changed.
- 2026-10-19: first version.
