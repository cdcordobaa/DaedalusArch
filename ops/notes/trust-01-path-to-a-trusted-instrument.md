# TRUST-01: the path to a trusted instrument, link by link and as a whole

**2026-10-19. Plan, zero model calls to write.** This note follows the author's direction of 2026-10-19:

1. Everything needed to *use* the tool is done now, with its models and its semantic paths (graph enrichment and interpretation). Then the first study runs.
2. **Rule inference** (C2 derived norms, BF-01) has been piloted, but it is kept for a later study. Its pilot does not show that the graph helps (row "derived norms" below), so it is not cited as instrument evidence.
3. The thesis must support **SO1, SO2 and SO3 very well**. **SO4 (validity)** is supported by the hold-out and by the study.

Sources: `ops/01-instrument-map.md` (v3), [`rev-04-gaps-and-promises-2026-10-19.md`](rev-04-gaps-and-promises-2026-10-19.md) (REV-04), `ops/decisions.md` (2026-10-19), and the drift record `Docs/v1.4/study2-deviation-2026-10-19-drift.md`. Comment with `> AUTHOR:` lines.

## 0. What "trusted" means here

A link is **trusted** when four things hold:
1. its claim is stated in one sentence;
2. it has a pre-declared pass bar;
3. evidence meets the bar on data the link was not tuned on;
4. that evidence is committed and reproducible at the freeze tag.

The **instrument as a whole** is trusted when every link on the path from code to interpreted finding is trusted at one frozen commit, *and* an end-to-end check passes on material none of the links saw.

## 1. The links, in the order data flows

```
code ─► L1 graph ─► L2 engines ─► L3 semantic facts (models) ─► L4 norms (declared spec)
     ─► L5 detection (rules + SEM rules) ─► L6 identity over time ─► L7 interpretation (models)
     ─► L8 meaning ─► L9 in-loop delivery (MCP, fast path)
```

Each link names its owner part in the map: C1a/b, C1c, C1d, C2, C3, C1e, C4, C3m, C6.

## 2. Per link: claim, state, what makes it trusted

| Link (part) | Claim | State today | To be trusted (bar) | Work | Calls | Order |
|---|---|---|---|---|---|---|
| **L1 Graph** (C1a/b) | The graph is the code | **High** for imports (1.000/1.000 vs tsc, 15 repos). **Medium** for class facts and agent code: N38 fixed in #253 but not re-run; V8 never adjudicated | Imports = tsc (met). Extractor fixes re-run on msc29/felixle with no verdict regressions. **Per-snapshot coverage check** on generated code: unmapped ≤ 10 %, no unparsed file, barrel/`require`/`import()` counted (V8 restated) | Tier A2 item 7 (running); build the coverage check (C1 part of V8) | 0 | now |
| **L2 Engines** (C1c) | Cypher gives the same answer on both engines | **High**: 72,388 statements, 81 projects; 71/71 | Parity on **agent-code** snapshots (D8), all styles in the study | Tier A3 (cloud, interpreter); D8 on Neo4j (local, when memory allows) | 0 | now |
| **L3 Semantic facts** (C1d) | A model adds facts the parser can't see (K2m, K3): business-rule placement, duplicated meaning, concept fragmentation. The facts are saved with their sources and read by rules (SEM-MISPLACED, SEM-DUP, SEM-FRAG). **Facts, not verdicts** (N1) | **Built** (U3), mock-tested, **never run live**. *(Updated 2026-10-21: run live in the 2-case pilot and in the 2a semantic run, which reached its cap after 7 complete snapshots; the six cases have not run.)* | **Pilot:** 2 cases × 2 vendors.<br>**Confirmatory bar (registered, REV-02):** ≥ 6 cases with twins; ≥ 5/6 defects correct; **0 twin false positives**; both vendors; hallucinated facts rejected.<br>**NS-03 rule:** the model reads the code *and* its graph slice, and each fact cites both | (1) add agy 1.4.2 to the ontology route; (2) 2-case pilot; (3) six cases + six twins | Pilot ≈ 26 per vendor (cap 40). Six-case: about 110 per vendor in the mock record, upper bound about 1,150 per vendor by `--estimate`; the cap is set from the estimate before the run | now: pilot, then the six cases |
| **L4 Norms, declared** (C2) | The spec states the style's rules faithfully | **Medium-High**: 5 libraries sealed from their rule sources; post-seal ADRs (FF-S02 DDD, FF-P07) parts Q-A to Q-E unsigned; construct answers (V1) not on file. *(Updated 2026-10-21: Q-A to Q-E and the construct answers signed 2026-10-19; ADR-V13-03 accepted under delegation; V1 GREEN.)* | Sign the construct answers and the ADR parts. Each construct answer is **derived from the style's rule sources**, never from the dev-set figure (author principle, 2026-10-19). SO1 "expressiveness" measured (tier A2 item 10) | Signing sheet (one page) | 0 | now |
| — derived norms (C2, BF-01) | A model infers the norms | **Piloted, not evidence.** It ran as the parallel exploratory track of 2026-10-18 (`ops/decisions.md:55`): 18 valid sessions, 23 of 24 spawns (`Docs/DiagnosticRuns/v1.3-brownfield-llm-repilot-2026-10-19.md` §1). A Gemini arm with docs and no graph reproduced the reference exactly (§10), so the graph's added value is not shown (`ops/notes/ns-03-graph-complements-reading.md:39`). Not cited as support for any link (REV-05 §7 items 2–3) | **Out of scope now: a later study.** The 2026-10-19 direction pauses the track | — | — | later |
| **L5 Detection** (C3) | Rules plus SEM rules find violations, and every finding is correct | Precision **High** (283/283; 836 correct). Recall **Medium-Low** (blind 0.78; Layered 0.70). The hold-out hasn't run. *(2026-10-21: three attempts on 2026-10-20, not scored, not spent; DELEG-H4.)* | **U6 construct fixes, derived from the specs** (Layered 0.70 → 0.80 expected; 4 false alarms gone), then one dev re-run on Neo4j, then the **sealed hold-out once** under the V4 ADR (option c). Bar: the single bar of [`Docs/v1.4/adr-v4-holdout-bar.md`](../../Docs/v1.4/adr-v4-holdout-bar.md) (ADR-V14-04, proposed, unsigned; *accepted under delegation 2026-10-20, V4-ACC*), which replaces the earlier wording here; below it, "characterised", plus the per-arm non-differential check in the study. Tool-baseline row (tier A2 item 8) | U6 (rules modified; run later, before the freeze), then the freeze, then the hold-out | 0 | after L1–L4, before the study |
| **L6 Identity** (C1e) | One violation can be followed across steps and commits | **Medium**: module built | N123 re-scored with the module (tier A2 item 5); the identity rule used by drift D is the same module (one definition) | Tier A2 (running); check D uses it (tier A1) | 0 | now |
| **L7 Interpretation** (C4) | A model reads the findings **with the docs, ADRs and facts**, and explains each one, checks it against declared intent and exceptions, and classes its severity. It **never overturns a blocking verdict** (M4, N1) | **Low**: judge v1 at 0.76, changed 0/65 verdicts. The new interpretation route is not designed. *(Updated 2026-10-21: designed in C4-01 and built in PR #282 (unit U9). It ran once, exploratory, in the 2a semantic run: 17 blocking identities, 0 exception claims, no key (`Docs/DiagnosticRuns/v1.4-exploratory-semantic-claude-2026-10-20.md:127`). The C4 pilot and six-case set have not run against a seeded key, so L7 stays Low until they pass.)* | **Design note C4-01** first (§4; written, branch `v14/c4-mean02-design`). Bar (proposed): on seeded exception and intent cases with twins, ≥ 5/6 correct interpretations, 0 twin false "exception" claims, cross-vendor agreement reported as κ. The judge (V7) is dropped from Study 2. C4 + C1d replace the judge in F3 (decision F3, `ops/decisions.md:30`); the rewording is a proposed change in `Docs/v1.3/contribution-statement.md`, unsigned, so until it is signed F3 still names the judge. *(Signed 2026-10-19, D8: F3 no longer names the judge.)* | Design note, then a costed pilot | Counted in the note | design now, pilot after L3 |
| **L8 Meaning** (C3m) | A correct finding matters architecturally | **Low**: 0 labels; human-behaviour evidence is weak or null (N116, N123, N128) | **Agentic meaning protocol (MEAN-02):**<br>(a) **consequence test:** a standard change task on the code with the violation vs a minimally repaired twin; measure files touched, ripple, test breaks;<br>(b) **cross-vendor panel**, blind, with reasons and inter-model κ;<br>(c) **rule-source grounding.**<br>Human labels later calibrate (b) and support it. They never gate the claim (author, 2026-10-19). Bar fixed in the note before any call | Design note with C4-01; pilot costed | Counted in the note | design now, run before or with the study |
| **L9 In-loop delivery** (C6, instrument side) | What the agent sees through MCP equals the full evaluation, safely | Fast path parity 71/71, off by default; S4 never run with MCP attached; Gemini coding route not live | V9 per style (tier A3); fast-path default decided; **S4 confinement probes**: Claude + MCP, and Gemini (24 calls, cap 30); latency (D5); telemetry checker (D6) | Tier A3; the Gemini adapter goes live; probes | S4 Gemini 24; Claude S4 counted first | before the study |

## 3. The whole instrument: one end-to-end check

After L1–L9 meet their bars, at the **freeze tag**:
1. **Symbolic path:** the sealed hold-out once (L1, L2, L4, L5): 207 cases, the per-style table, the FR-V11 report.
2. **Semantic path:** the six cases + twins (L3 → L5 SEM rules), both vendors, at the same tag.
3. **Interpretation path:** the C4 seeded intent and exception cases (L7), both vendors.
4. **Meaning:** the consequence test on a stratified sample of the external blocking findings (L8).
5. **Delivery:** the S4 probes and V9 on study-style snapshots (L9).
6. **Reproducibility:** every model call is cassetted, so the whole check replays with 0 calls. Pins are recorded: the Claude CLI and model, the agy version and Gemini model, Neo4j.

**The instrument is "trusted" when 1–6 pass.** Any failed bar is reported as it came out, and the link is labelled "characterised", with its scope cut in the thesis.

## 4. Two design notes to write now (zero calls)

- **C4-01, interpretation.**
  - Inputs: the finding, its subgraph, the A2 facts, the docs and ADRs.
  - Outputs: explanation, intent match, exception claim with citation, severity.
  - The case set: seeded intent and exception cases plus twins, built like NS-02.
  - Vendors: Claude and Gemini. Each call cites its sources. Facts, not verdicts.
  - The bar, the call count and the cap.
- **MEAN-02, agentic meaning.** The consequence-test design:
  - the change tasks, and repaired twins written by a separate session;
  - the measures: files touched, ripple, test breaks, turns;
  - the sample: stratified by rule from the external set;
  - the panel design and the vendor split relative to the generator.

  Also covered: the call count, how human labels calibrate it later, and the falsifier ("violations don't make change harder").

Both notes go to a **Fable adversarial review** before the author reads them.

## 5. What this gives each objective

| Objective | Supported by | After this plan |
|---|---|---|
| **SO1** spec language and style libraries | L4; expressiveness (A2); spec lengths; the ADL comparison table (writing) | Strong. Remaining writing: the ADL table, SO3-a for dimensions |
| **SO2** architectural graph | L1, L2, L6; type-resolution rate and `FLOWS_TO` finding (A2); **L3 semantic layer, designed to add facts to the graph**: the loader (`src/apg-enrich/ontology/facts-loader.ts`) exists but has never run on a live Neo4j, and the pilot scores in TypeScript (`ops/notes/ns-02-facts-contract-and-cases.md:158`). "Adds facts to the graph" is claimed only after the loader's smoke run (NS-02 §2 Cypher against the TypeScript scorer) | Strong for L1, L2, L6. The semantic layer is the neuro-symbolic part of SO2/SO3 once the smoke run passes |
| **SO3** scoring engine plus model-judged dimensions | L5 (rules → Cypher → scores); **L3 + L7** (models for Semantic/Integrity, now as facts and interpretation, cross-vendor); complementarity by knowledge level (N2) | Symbolic half strong. Semantic half: claimed as "designed, piloted on N cases with twins across two vendors, and measured for frequency on agent code" (`rev-05-first-study-fable.md:123`), not "very well supported". F3 follows the same wording once signed. Human κ (SO3-5) comes later as support |
| **SO4** validity | Hold-out (L5) + the end-to-end check (§3) + the study's per-arm and evasion checks | Supported by the hold-out and the study, as the author directs |
| **SO5** models × spec levels in practice | The first study (exploratory), then the confirmatory one | Designed after the instrument pass |

## 6. Sequence and what waits on the author

1. **Now, 0 calls (running or next):**
   - tier A1, A2, A3;
   - the signing sheet;
   - the V4 ADR draft (option c);
   - the C4-01 and MEAN-02 design notes, then the Fable review;
   - the L1 coverage check;
   - the ontology route pin.
2. **Small calls, with the author's OK:**
   - the C1d 2-case pilot (≤ 40 per vendor);
   - the Gemini S4 probe (≤ 30);
   - the Claude S4 with MCP (count first).
3. **Medium calls, counted first:**
   - the C1d six cases + twins;
   - the C4 pilot;
   - the MEAN-02 pilot.
4. **0 calls:** U6 construct fixes, then the dev re-run on Neo4j, then the **freeze**, then the **hold-out once**, then the **end-to-end check** (§3).
5. **Then the study pass.** The first study is exploratory, registered on its own in [`Docs/v1.4/exploratory-study-registration.md`](../../Docs/v1.4/exploratory-study-registration.md) (decisions EXP, EXPT). The drift record stays the confirmatory protocol. The confirmatory study is designed from the exploratory results.

## Changelog
- 2026-10-21: status lines of L3, L4, L5 and L7 updated (C1d run live, C4 built in PR #282, the signatures, the V4 ADR accepted; the hold-out not scored, `Docs/DiagnosticRuns/v1.4-holdout-2026-10-20.md`). Fixes the L7 line of conflict 8 in `ops/06-open-tracks-and-capabilities.md`.
- 2026-10-19 (evening): REV-05 §7 items 2–5 applied: BF-01 no longer cited as support; "adds facts to the graph" qualified until the loader's smoke run; C4/F3 made consistent with the proposed F3 rewording; the L5 bar points to ADR-V14-04; the first study points to its registration.
- 2026-10-19: first version.
