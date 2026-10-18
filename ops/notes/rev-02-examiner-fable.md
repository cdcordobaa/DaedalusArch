# REV-02: examiner's read of `ops/01-instrument-map.md` v2 and the decision board

**Reviewer:** Fable, external-examiner lens, 2026-10-18. Read-only, no model calls. `Nxx` ids are from `Docs/v1.3/compendium/nulls-and-limits.md`; `Kxxx` from `claims-ledger.md`. Does not repeat REV-01 unless v2 left it open.

## Verdict

The map is now an honest inventory, but it has quietly dropped the one link the thesis is judged on: whether a blocking finding is an architectural violation at all (track 1's Link 4). C2r is not the weakest link; Link 4 is, and the "tacit knowledge" claim in §1 is a way of not measuring it. The month should go to the hold-out, one small human label set, and a Layered-only Study 2 that is pre-registered with its null written first; everything neural is reported as design plus pilot.

## Missing entirely (severity order)

1. **The meaning construct has no part.** v1 track 1 names Link 4 ("is a correct finding architecturally meaningful?") as RED and as *the binding link* for greenfield DDD and Layered (`ops/track-1-instrument.md` §B). The v2 map has no C-part for it: C4 is about exceptions and severity by a model, not about whether a blocking edge matters to anyone. Evidence that it matters: 0 labels (N114); registered real-code precision 0.328 [0.132, 0.609] (N115); 51/60 human style-claiming repos fail (N116); three developer-behaviour criteria null (N128). §1 turns these into "humans hold the standard tacitly". The rival explanation, "the encoded standard is not what practitioners mean by architecture", predicts the same three nulls and is simpler. Nothing in the map can tell them apart. *Fix:* reinstate Link 4 as a part (C3m, "meaningful?"), give it the one free human (see Board), and state in §1 what observation would refute the tacit-knowledge reading.
2. **The hold-out cannot pass its own gate, and the gate blocks Study 2.** Gate V4 (no waiver) needs a per-style claim level; `open-items.md` item 7 says "with fewer than about 35 expected blocking findings per style its lower bound cannot pass", and `study2-outline-v2.md` §9 says a style the hold-out only "characterises" cannot use the blocking outcome. 207 cases over five styles is about 41 per style with misses expected (blind recall 0.78, N105). As written, Study 2 cannot start. No board item touches this. *Fix:* an ADR before the freeze that redefines V4 as "point recall ≥ 0.90 and Wilson lower bound ≥ 0.80 per Study 2 style, both reported", and labels any style below it "characterised".
3. **The proposal and its research questions are not in the repo.** Only SO1–SO5 appear; the compliance register is in Notion (cited from `Docs/v1.3/research/distinction-readiness.md` K7 and `Docs/v1.3/limitations-register.md` §3). I could not check the proposal's questions. What K7 does record: SO3 "Partial" (the "30+ rules over 7 symbolic dimensions" line not reached; judge κ against human labels unmeasured) and SO4-7 independent labelling "Not met". The map mentions neither, and §1's four sub-claims are not mapped to SO1–SO5. *Fix:* a one-page SO-to-part table in the map, with SO4-7 and the rule-count promise argued as declared deviations.
4. **C2r's κ 0.21 is Claude against Claude.** `Docs/DiagnosticRuns/v1.3-spec-author-reliability.md:99-100`: "Both authors are Claude sessions... an upper bound on cross-human agreement, not an estimate of it." The map calls them "two independent norm authors". *Fix:* say "two model sessions" wherever N01/N02 are quoted.
5. **Study 2 is a Layered study of folder placement.** Clean and Hexagonal are declared zeros; DDD has never been scored on agent code and two of its seven blocking rules cannot fire (deviation §4); the Layered base rate 5.33 is one Opus session before the composition-slot repair, 2.67 after it (`level-power-sim-2026-10-16.md`), and the violations are step-1 layout habits replicated later (N147). Under D2b, H3 power ≤ 0.21. So the confirmatory Study 2 is "does `which_layer` stop a Layered agent misplacing files in four steps". The map's C6 question ("does the gate lower violations?") oversells it, and the zeros on Clean and Hexagonal are direct counter-evidence to §1's "agents don't have the standard". *Fix:* state the confirmatory scope as Layered-only now; report Clean and Hexagonal zeros as a finding against §1, not a floor nuisance.
6. **No tool baseline for C6.** The v1 research question Q4 (held-out rules and dependency-cruiser) survives only as telemetry line D16. On shared rules the tool is at parity with dependency-cruiser (N61); the differentiation is the 4 blocking rules in 7 style rows that none of three tools can express (`v1.3-validity-convergent-2026-10-16.md`). That is the argument for the graph, and it is nowhere in the map. *Fix:* add it to C3's row and to §1 sub-claim 1.
7. **Threats not in the register.** `Docs/v1.3/threats-register.md` has no entry for training-data contamination (map risk 6 admits it), none for evasion or gaming beyond the D13 guard, and role overlap (V13-TV-D1: the author writes specs, rules, tasks and construct answers) is absent from map §6. *Fix:* three register rows, written before the pre-registration.
8. **Spot-checks.** 72,388 / 81 is on main at `cypher-interpreter.md:20`; ledger line 274 is stale, as the map says. 283/283 should carry its clustered bound (11/11 repos, Wilson [0.741, 1]; K174) — the map omits it. C1 GREEN rests on IMPORTS versus tsc; the DDD blocking rules use class facts tsc does not check, optional constructor parameters are invisible (MO-H06 18/28, N38), and one external verdict was computed on half its graph (N33). GREEN for imports, AMBER for the Study 2 DDD rules.

## Won't survive questioning

- **Sub-claim 1 (graph and rules correct):** "Your recall against readers who did not write the rules is 0.78, four styles under 0.90, and the sealed hold-out cannot reach its own V4 bar. On which held-out number do you call the engine correct?"
- **Sub-claim 2 (norm source limits everything):** "κ 0.21 is two Claude sessions. What is the human–human agreement on one norm, and how does one classmate on three repos give you a κ with an interval?"
- **Sub-claim 3 (facts, not verdicts):** "How many K3 or K2m cases exist today with a committed answer, and what accuracy on how many cases would make this a result rather than a design?" (Today: one planted seed, three mock cases, nothing run; N100.)
- **Sub-claim 4 (the loop changes the architecture):** "If none@L3 is already at zero, one sentence per rule did the work; what does the firewall add that a README does not, and why did Clean and Hexagonal agents need neither?"

## Board: wrong or missing decisions

- **D3, rec A is wrong.** Three or four repos cannot yield a verdict κ (15 repos gave κ 0.21 with Bland–Altman limits −28 to +33), and the route leaves SO4-7 "not met" with no human label on anything. The one free person should label *meaningfulness* on about 60 blocking findings from the external set, stratified by rule, under one κ definition dated before the first label (V6), plus the six K3 cases. That gives Link 4 its first number and part-delivers the proposal promise. Report the model–model spec κ as a limit.
- **M1, rec A is risky.** The tacit-knowledge claim is argued, unmeasured, and contradicted by Study 1 (`none` best, N141) and by the Clean and Hexagonal zeros. Keep the contribution statement's F1–F3 as the claim; use tacit knowledge as an interpretation in the discussion, with its refuter stated.
- **N1 / M4, rec A is fine but under-labelled.** Choosing facts-before-rules demotes the only SO3 evidence that exists (16/21, 22/26) and replaces it with a pilot that cannot be confirmatory in one month. The board should say SO3 will be reported as a design plus a 2-case pilot.
- **D2b, rec A is right, with a cost not stated:** H3 falls to ≤ 0.21 and is demoted, so Study 2 cannot separate "spec delivered" from "spec checked". Say so before the director sees the design.
- **Missing: the Codex contingency.** V10(a) has no waiver; Codex is "about Nov 9". If it slips, Study 2 does not run. Decide now whether a Gemini generator adapter with its own S4 probe is the registered substitute.
- **Missing: the V4 redefinition** (item 2 above).
- **Missing: pre-registration form and venue.** "None exists, by the author's decision" (`open-items.md` item 13). Hashed-in-repo or OSF, decided before the dress rehearsal.
- **Missing: the Link 4 construct decision** itself: what is a "meaningful" blocking finding, in one sentence, before anyone labels.

## Shortest path

**Keep, in order.**
1. *Week 1 (Oct 19–25), zero calls:* F23; B2 and T1 re-scores; V4 ADR; the decision sheet; the meaningfulness codebook with one κ definition; the six K3/K2m cases with answers committed; the three threat-register rows; the Codex contingency decided.
2. *Week 2 (Oct 26–Nov 1):* validation pilot (Layered and DDD base rates, 24 turns); power re-run; the rater's 2–3 hours; instrument freeze; hold-out run once on Neo4j.
3. *Week 3 (Nov 2–8):* C1d 2-case pilot (10–20 calls); evasion protocol; pre-registration hashed; dress rehearsal.
4. *Week 4 (Nov 9–17):* Codex pin and S4 probe; gate; Study 2 once (Nov 18–22). Write the limitations chapter from `nulls-and-limits.md` in parallel.

**Cut (future work):** a new C2r measurement; the drift study; the efficiency check; mined-norm recall; the review-comment count; Q26 and the DDD cycle rule; judge v2.x; NS1–NS3 at scale; the cross-family C1d arm.

**Minimal conditions for "confirmatory".**
- *Hold-out:* pooled blocking recall ≥ 0.90 with Wilson lower bound ≥ 0.80; 0 incorrect blocking findings; per-style point and interval reported; styles below 0.90 "characterised".
- *External correctness:* 283/283 quoted with the repository-level interval [0.741, 1].
- *Meaningfulness:* n ≥ 60, author–rater κ ≥ 0.60 under the dated definition; meaningful precision reported with its interval, or the construct is reported as unlabelled.
- *Study 2:* pre-registered before the first call; pilot mean Y ≥ 1.5 at step 4 in the stratum; simulated power ≥ 0.80 at RR 0.25 for H1 and H2 at 24 blocks; both generators; Holm; MCP call log shows tool use in ≥ 80 % of mcp steps, else "no mechanism"; acceptance-test pass rate in the mcp arm within 10 points of `none`; 10 sampled passing diffs read with 0 "moved-only" cases; effect reported as RR with interval. Any failure makes it descriptive.
- *C1d / SO3:* reported as design plus pilot. Confirmatory only with ≥ 6 cases and twins, ≥ 5/6 correct, 0 twin false positives, two vendors — not reachable this month; say so now.
