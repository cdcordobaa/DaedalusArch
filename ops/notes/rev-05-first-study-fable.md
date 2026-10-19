# REV-05: does the first (exploratory) study fit what the thesis wants to find?

**Reviewer:** Fable, external-examiner lens, 2026-10-19. Read-only: no model calls, no sealed read, no Neo4j. Line numbers are from `origin/main`, except `trust-01`, which was read from `origin/v14/trust-path`. The review is recorded as delivered.

## 1. Verdict

- **The direction is right:** trust the instrument first, explore once, then confirm.
- **But the study on file is not the study the direction describes.**
  - The drift record is a confirmatory protocol: H1/H2, Holm, pre-registration, 32 blocks. "Exploratory" is only its fallback label (`Docs/v1.4/study2-deviation-2026-10-19-drift.md:44,53`).
  - So, as written, the first run will be a confirmatory study that misses its bar and gets relabelled.
  - That is exactly the lever-hunting the design itself fears (`ops/notes/s2d-01-study2-drift-design.md:170`).
- **SO1 and SO2** can be made very well supported with zero-call work, and so can SO3's symbolic half.
- **SO3's semantic half** (C1d, C4) cannot be "very well supported" by six author-written textbook cases.
- **SO4 through "hold-out plus study"** is defensible only if the study carries a seeded recall check on agent code, and the V4 ADR is dated before the hold-out.

## 2. What the thesis wants to find: six testable claims

| # | Claim | SO | Can the current plans test it? |
|---|---|---|---|
| T1 | A declarative spec language and 2–3 style libraries state each style's defining rules faithfully, and the libraries are derived from the style's sources, not from the data | SO1 | **Yes, at 0 calls:** signing sheet, expressiveness ratio, ADL table (`rev-04:174-177`). **Weak spot:** no independent reader of the libraries (`ops/01-instrument-map.md:174`) |
| T2 | The graph is the code: import edges match tsc, both engines agree, one violation can be followed across steps | SO2 | **Yes** for imports (1.000 on 15 repos) and for parity (72,388 statements, 81 projects).<br>**Not yet** for class facts (N38), generated-code coverage (V8, 2,135 cells) or `FLOWS_TO` (N40, 0 edges) |
| T3 | Rules over the graph find defining violations with precision ≈ 1 and per-style recall ≥ 0.90 on held-out seeds | SO3/SO4 | **Precision: yes** (283/283, clustered [0.741, 1]).<br>**Recall:** the hold-out will likely "characterise" Layered (P(point ≥ 0.90) 0.01–0.09, `v1.3-f23-and-v4-count-2026-10-18.md:113-119`) |
| T4 | A model supplies grounded K2m/K3 facts the rules consume, catching defects rules alone miss, with 0 twin false positives, on two vendors; and a model interprets findings against docs and ADRs without overturning verdicts | SO3 | **Only in the weak form "on six textbook cases".**<br>- The confirmatory bar (≥ 5/6, 0 twin FPs, two vendors) is registered (`rev-02:53`).<br>- But the Gemini ontology route does not exist (`ns-02:250`), the A2 loader does not exist (`ns-02:296`), C4 is undesigned (`trust-01:42`), and pair 2 is findable by a heuristic (`ns-02:207`).<br>- **"Neuro-symbolic beats either alone on real agent code" is not testable by any current plan.** No plan measures how often K3 defects occur in agent or human code (NS-01 falsifier 2, `ns-01:101`) |
| T5 | A correct blocking finding matters: it makes later change harder (consequence test), and practitioners would ask for it to change | SO4 | **Half.**<br>- The consequence test can test "makes change harder".<br>- Nothing agentic can test "practitioners would ask for it". That is the primary field the author chose (L4 = practitioner, `ops/decisions.md:30`; `mean-01:30`).<br>- Human labels are deferred (`drift record:98`), and there are 0 labels today (N114) |
| T6 | An instrument in the agent's loop, or one sentence per rule, cuts the propagation of inherited blocking patterns into new slices, on two generators | SO5 | **Testable by the drift study**, but:<br>- the base rate is three Opus-by-hand values (`rev-03:12`);<br>- no Sonnet or Gemini Layered step exists (`drift record:61`);<br>- the floor is the main risk (`s2d-01:165`) |

**Not covered by any plan:**
- SO5's reproducible taxonomy and open coding (`rev-04:197`);
- SO3-5, judge κ against humans (`rev-04:188`);
- the X-1 switch from descriptive DSR to inferential tests (`rev-04:200`).

## 3. The exploratory study

**Is it the right first study?** Yes, if it is designed as one.
- The proposal needs no Study 2 at all (`rev-04:7-10`). So the first study's job is to buy the information a confirmatory design needs, not to produce a p-value.
- The drift record does the opposite. It fixes contrasts, Holm, an equivalence margin and a pre-registration, then says "if the bar fails, run anyway, labelled exploratory" (`drift record:53`).
- Gate rule 1 forbids relaxing a criterion after pilot numbers are seen (`study2-readiness-gate.md:20`). The relabel is written before the pilot, so it is legal.
- But an examiner will read a confirmatory protocol that was always expected to miss as a design built to fail safely into a softer claim. The record's own §3 says its base rate is Opus data standing in for two other models (`:61`).

**What it must measure** (estimands, stated in advance, no hypotheses):
1. **The base rate of D and Y₁** per generator and per style, with ≥ 3 tasks per style so the between-task variance is estimated.
   - REV-03 finding 1 still stands: the pilot re-bases power on two tasks (`drift record:68`), and the task-to-task spread in probe 1 was 5× (`rev-03:12`).
2. **The share of blocks with Y₁ = 0**, per generator: does the step-1 habit exist at all for Sonnet and Gemini? If it doesn't, D is zero by construction (`rev-03:18`).
3. **The mediator:** how often the `mcp` agent repairs inherited violations before adding slices. That gives D = 0 by repair, not by prevention. Register D conditioned on no inherited removal.
4. **D by edge kind:** the wiring share under D2b (`ops/notes/g12-d2b-construct-limit.md:25,31`). If most of D is wiring, the confirmatory outcome must change.
5. **Which cell matters.** If `none@L3` is already near zero, the confirmatory contrast is L2 vs L3, and the MCP arm becomes a cost question, not an effect question (REV-02 sub-claim 4, `rev-02:25`).
6. **Mechanism and evasion margins:** the tool-use rate per step, which tools, acceptance pass rates per arm, the gap between the literal and default views. The confirmatory margins are then set from data rather than guessed (REV-03 finding 5).
7. **Cost:** turns, pauses, wall time per lane, type-check failure rate per generator, so the confirmatory budget is real.
8. **Semantic facts and interpretation belong in scoring only, not in the loop.**
   - The `mcp` arm is spec-only by design (9 tools, `study2-outline-v2.md:90`). Adding neural tools would confound "delivery plus checking" further.
   - Run C1d and C4 after the fact, on a stratified sample of snapshots, with the count fixed first. Six cases cost about 110 calls per vendor at runs = 2 (`ns-02:280`), so all 160 snapshots are out of reach.
   - This answers two questions no other plan answers: how often K3/K2m facts arise on agent code (NS-01 falsifier 2), and whether C4 would have changed any severity class.
   - That is the evidence for deciding whether the confirmatory study puts them in the loop.

**What would make it wasted:**
- **The floor.** `fallback=run-exploratory` spends 416 turns (`s2d-01:140`) measuring zeros.
  - Add a staged stop: after the pilot cells, if mean D < 0.5 and Y₁ = 0 in most blocks for both generators, stop.
  - Report the floor as the finding (floor-escape §5 items 1–4), and redesign the start before the confirmatory study.
- **An unfrozen instrument.** The hold-out and the freeze come first in the record's order (`drift record:54`); keep that. An exploratory run on an unfrozen instrument still informs the design, but every number from it must carry the tag it ran at.
- **Task reuse.**
  - If the exploratory study runs on the 4 Layered + 2 DDD confirmatory tasks (`drift record:47`), they are burnt: the author sees results on them, and any design change afterwards is tuned to them.
  - Run the exploratory study on the rehearsal tasks (`ice-rink`, `vineyard-harvest`), the probe-1 tasks and, if needed, 2 new exploratory-only tasks.
  - Reserve the six confirmatory tasks for the confirmatory study.

**Reuse the drift record's cells, or go broader?**
- Keep the three cells as the core.
- Add one cheap probe cell only if the budget allows: `mcp@L2` with `evaluate_project` allowed (the dropped `gate` mechanism), in a few blocks, to see whether checking without repair is even the right arm.
- Do not add L4 cells. H3 was dropped for power, and an exploratory study does not need them.

**What must stay unseen:**
- **The confirmatory task texts and acceptance checks.** They are written by a session that never reads exploratory output (V10c), and ideally sealed before exploratory results are read.
- **The equivalence margin and the hold-out.**
- **The task-design guide.** Any change to it after the exploratory study must be dated and declared, because a guide tuned on exploratory results is a lever.

## 4. Does TRUST-01 make SO1–SO3 "very well supported"?

**SO1.**
- **Strongest:** five libraries sealed from their rule sources, and 283/283 correct on human code under them.
- **Weakest point an examiner hits:** "Your construct answers are 0/25 on file (`rev-04:66`). You fixed four rules after seeing the blind misses on the development set (U6). The hold-out was enlarged after those results existed (L178). Show me the rule change was derived from the source and not from the miss."
- **Cheapest fix, all 0 calls:**
  - the signing sheet with per-answer source citations (`decisions.md:23-24`);
  - G0.9 refutation criteria dated before U6 runs;
  - "expressiveness" defined as rows expressible ÷ rows (`rev-04:176`).
- Also, report C2r κ 0.21 as two Claude sessions, as the map now does (`01-instrument-map.md:176`).

**SO2.**
- **Strongest:** imports 1.000 vs tsc on 15 repos; parity 72,388 statements over 81 projects.
- **Weakest:**
  - TRUST-01 claims "the L3 semantic layer adds facts to the graph" (`trust-01:81`), but the A2-to-graph loader does not exist, and the pilot scores in TypeScript (`ns-02:158,296`);
  - V8 has 2,135 unadjudicated cells;
  - `FLOWS_TO` yields 0 edges (N40);
  - one external verdict ran on half its graph (N33).
- **Cheapest fix:**
  - build the loader (0 calls), so "in the graph" is literally true before the thesis says it;
  - restate V8 as the per-snapshot coverage check, with a dated deviation (A8);
  - report `FLOWS_TO` as a finding (`rev-04:179`).

**SO3, symbolic half.**
- **Strongest:** rules → Cypher → scores; 283/283 with the clustered bound; parity with dependency-cruiser, plus 4 rules no other tool expresses (`01-instrument-map.md:177`).
- **Weakest:** Layered recall is 0.70 on development data (N105), and the hold-out will likely only "characterise" it.
- **Cheapest fix:** the V4 ADR, dated before the hold-out, with the "characterised" route named in advance (`v1.3-f23-and-v4-count-2026-10-18.md:139`); and SO3-a adopted (7 → 5 dimensions, `rev-04:186`).

**SO3, semantic half (C1d, C4).** This is where "very well" is out of reach this cycle. TRUST-01 half-admits it: "Strong **if** L3 and L7 meet their bars" (`trust-01:82`).
- **Circularity.**
  - One author, working with Claude sessions, wrote the cases, manifests, prompts and rules (`ns-02:212`; L181). Claude then reads them.
  - Pairs 2 and 3 carry explanatory comments (`ns-02:214`).
  - A 6/6 result shows that a model can label textbook cases written to be labelled.
  - The Gemini arm helps, but BF-01 §10 shows the trap: Gemini X reproduced Claude's reference spec exactly, with no graph and no tools (`v1.3-brownfield-llm-repilot-2026-10-19.md` §10).
  - Cross-vendor agreement shows textbook consensus, not independence from the author's framing.
- **Twins and bars.**
  - The bars are good: ≥ 5/6, 0 twin false positives.
  - Missing: a dumb-heuristic baseline on the same cases (NS-01 falsifier 1, `ns-01:100`). A heuristic is already known to beat the model on pair 2. Without the baseline, the examiner says "a name heuristic does this".
- **C4.**
  - Judge v1 is at 0.76 and changed 0 of 65 verdicts (N63, N85).
  - TRUST-01 drops the judge and has C4 "replace its role in the thesis" (`trust-01:42`). But F3 in the contribution statement *is* the judge (`Docs/v1.3/contribution-statement.md:32`), and the map's claim is F1–F3 plus Study 2 (`01-instrument-map.md:35`).
  - Either F3 is rewritten around C4 with C4 evidence, or the thesis cites a judge it dropped.
- **Cheapest fixes:**
  - write C4-01 (0 calls);
  - add the heuristic baseline (0 calls);
  - add 2–3 C1d cases not written by the author or Claude: lift them from real findings in external repos, or have the Gemini route write them, with the answers committed first;
  - run C1d after the fact on exploratory snapshots, to measure K3 frequency.

  Then claim exactly: "designed, piloted on N cases with twins across two vendors, and measured for frequency on agent code". That is honest and defensible. "Very well supported" is not.

**The agentic meaning protocol (L8).** The consequence test is the right idea: it is behavioural, and it can be checked across vendors. Four conditions before it runs:
- **Circularity.**
  - The change task must come from a task bank written before anyone sees which violation a snapshot holds, stratified by rule. Otherwise the task is chosen to exercise the flagged edge.
  - The repaired twin must be produced by a session blind to the task. TRUST-01 says this (`trust-01:67`); keep it.
- **Vendor split.**
  - The agent that performs the change task must not be from the generator's vendor for that snapshot: Gemini changes Sonnet code, and the reverse.
  - Report both directions. With only two vendors, each generator gets one cross-vendor reading.
- **Twins.** Expect wiring findings (G12) to show no consequence. That is informative, not a failure. Stratify by edge kind, so the result does not pool wiring with real layering breaks.
- **Bars and the construct.**
  - An agentic panel can measure literature fidelity (MEAN-01 field B). It cannot measure field A, practitioner acceptance, which L4 made primary (`decisions.md:30`).
  - So the agentic claim must be "consequential" or "style-fidelity meaningful", never "meaningful to practitioners".
  - The human labels remain the only route to field A. They cost 0 model calls and about 2.5 h (`mean-01:194`), and the sample is already drawn and frozen.
  - "Later" should have a date before the chapters are written. The proposal promises the labels four times (`rev-04:12-18`).

## 5. SO4 through the hold-out plus the study

Defensible, with two conditions.

**The hold-out alone** gives per-style recall and precision on seeded, Claude-written variants (L179), partly enlarged after the development results (L178). It will probably characterise Layered.
- The V4 ADR (option c, `decisions.md:22`) must be dated before the run, and must say what "characterised" allows.
- Three different bars are on file today: the gate (`:113`, point only); the F23 note (`:135`, point and lower bound ≥ 0.80); and TRUST-01 (`:40`, "claimed where reached").

**What the study must contribute**, so that "the study supports SO4" means more than "the instrument ran":
1. **A seeded recall check on agent code** (0 model calls). Apply the mutation operators to a sample of step-5 snapshots from both generators, and measure detection. The hold-out cannot give recall on agent code or on Gemini's code shapes. This is the single biggest validity addition, and nobody has listed it.
2. **Per-snapshot coverage on generated code** (V8 restated): unmapped share, barrels, `require`, `import()`, per generator.
3. **The correctness of every counted finding** by `check-correct`, plus the blind read of sampled diffs (evasion 5.5).
4. **The per-arm non-differential miss check** that option c relies on (`decisions.md:22`).
5. **Engine parity on study snapshots** (D8).
6. **D split by edge kind**, for the construct validity of the Layered count (G12).

Without item 1, the study adds telemetry to SO4, not validity.

## 6. Seven changes before anything runs, ranked

| # | Change | Cost | Who decides |
|---|---|---|---|
| 1 | **Make the first study exploratory on paper.** Register it as a separate exploratory study (as map v2 had, `01-instrument-map.md:23`), not as Study 2's fallback.<br>- Estimands from §3, a staged stop rule, no Holm, no H1/H2 claims.<br>- Study 2's confirmatory protocol stays frozen for later.<br>- This also stops the deviation count on Study 2 at four (`deviations-v14.md:25`) | 0 | author |
| 2 | **Protect the confirmatory tasks.** The exploratory study runs on rehearsal, probe and exploratory-only tasks. The six confirmatory tasks are written blind, and sealed before exploratory results are read | 0 | author |
| 3 | **The V4 ADR, dated before the hold-out**, with one bar and the "characterised" route named. Plus the X-1 deviation (descriptive core, inferential additions) and SO3-a | 0 | author signs; agent drafts |
| 4 | **The signing sheet:** V1 construct answers with source citations; ADR-V14 Q-A to Q-E; the 9 adjudication rows; MEAN-01 §12 (L4, κ); G0.9 refutation criteria dated before U6 | 0 | author |
| 5 | **The C4-01 and MEAN-02 design notes**, with:<br>- a heuristic baseline for C1d;<br>- 2–3 non-author cases;<br>- a task bank and blind twins for the consequence test;<br>- the vendor-split rule;<br>- the explicit statement that the agentic claim is about consequence or style fidelity, not practitioner meaning.<br>Then the Fable review TRUST-01 promises (`trust-01:74`) | 0 to write; pilots counted (C1d 52, cap 80, `ns-02:260`) | author OKs the counts |
| 6 | **Build before claiming:**<br>- the A2 loader;<br>- the Gemini ontology provider;<br>- the `layered` loop style (`scripts/lib/loop/style.ts:20` still has three styles);<br>- the drift mode in `level-power-sim.ts` (absent on main);<br>- the L1 coverage check;<br>- the seeded-recall-on-snapshots script | 0 | agent builds, author merges |
| 7 | **Fix the semantic path's place in the study:** out of the loop, scored after the fact on a stratified snapshot sample, with the count fixed and declared in the exploratory registration | counted | author |

## 7. Contradictions with the direction or the record

1. **Exploratory vs confirmatory.** `trust-01:104` says "the first study is exploratory". But the protocol source says `fallback=run-exploratory`, with pre-registration, Holm and the gate in the order (`drift record:3,44,53-54`), and ten documents carry that line under `lint:protocol` (`deviations-v14.md:16`). The direction is not on file.
2. **Rule inference deferred vs running.** The direction defers BF-01. But `decisions.md:50` says brownfield derivation "runs in parallel now, so it produces results", and it did run (24 spawns). TRUST-01 marks it "later" (`trust-01:39`). Reconcile them, and stop citing its result as instrument evidence until it is in scope.
3. **"Works across vendors" overstates BF-01 §10.**
   - The re-pilot shows that a Gemini model with no graph reproduces the Claude reference exactly.
   - `ns-03:39` says the claim "the graph improves derivation" does not stand.
   - Quoted as support (`trust-01:39`), the result argues against the graph.
4. **"Adds facts to the graph"** (`trust-01:81`) is a design, not a build (`ns-02:296`; map `:153`, "A2: no, it is new").
5. **C4 replaces the judge** (`trust-01:42`), while F3 and GO-2 are about the judge (`contribution-statement.md:32`; `rev-04:172`). One of them must change.
6. **Three V4 bars on file** (gate `:113`, F23 note `:135`, `trust-01:40`). `rev-04:231` already flagged it.
7. **The pilot bar line was softened.**
   - REV-03 asked for Y₁ ≥ 1 in ≥ 4 of 6 trees (`rev-03:18`); the record took ≥ 3 of 6 (`drift record:52`).
   - That is declared, but the record's §5 table says the finding was "met". Note the change there.
8. **Human labels.**
   - The direction says later. The drift record and MEAN-01 keep V6 "before the first label", with the sample frozen (`mean-01:156`). There is no conflict.
   - But V5's scope deviation (MEAN-01 blocker B2, `:298`) is still unwritten, and `rev-04:12-18` calls labelling the most exposed promise at the defence.
9. **SO5's taxonomy** (open coding, FPAT as a profile) is in neither study (`rev-04:197`). The exploratory study is the natural place to collect its material. Add it to the estimands, or declare the deviation.

## What survives

- the trust-first order;
- the link-by-link bars;
- facts, not verdicts;
- the consequence test as the agentic measure of meaning;
- the three-cell shared-start design as the core of both studies;
- the evasion list;
- the proposal's contingency: the thesis stands on SO1–SO4 without a positive Study 2 (`rev-04:9`).
