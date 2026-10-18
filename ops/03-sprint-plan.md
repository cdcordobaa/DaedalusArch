# Sprint plan: results by Fri Oct 23, thesis sent by Oct 31

**Status:** v1, Sun 2026-10-18. This plan follows [`decisions.md`](decisions.md) exactly as the author chose it: Study 2 redesigned around drift (M3), the efficiency test as a thesis result (M5), the post-seal rules D5 and N3, the wiring imports kept in the Layered count (D2b), the rater labelling meaning (D3), and the claim F1–F3 plus Study 2 (M1). Two working rules change to fit the deadline; the next section lists both. Comment inline with `> AUTHOR:`.

## Working rules for this sprint

- **Slow mode, compressed.** Every run that calls a model still gets a one-page note and a **call count, shown before it runs**. Your OK moves from "after we discuss it" to "within hours, on the board or in chat". Zero-call work never waits.
- **Parallel by design.**
  - **Locally:** at most **2 build lanes and one Neo4j** (the machine limit). Lane 1 handles instrument changes and the freeze. Lane 2 handles Neo4j runs, meaning the hold-out and the scoring.
  - **Agents:** document and analysis work goes to background agents. Long jobs that don't need the local Neo4j go to cloud routines.
  - **Model-call runs** (generators, the semantic layer, the efficiency test) are counted first, and run at most two at a time.
- **Integrity rules that do not change:**
  - The single confirmatory Study 2 run happens only after a pre-registration and a passed pilot bar. If the pilot bar fails, the pre-written fallback reports the result as exploratory.
  - Nothing reads `daedalus-sealed/`, except the hold-out run itself, at the freeze.
  - Every number goes through a DiagnosticRuns report and the compendium.

## Lanes

| Lane | Delivers | Runs where | Model calls |
|---|---|---|---|
| **A. Instrument and freeze** | the D5 DDD cycle rule and the N3 application-purity rule, each with an ADR and tests; the V4 ADR if the count triggers it; then the **freeze tag** | local, lane 1 | 0 |
| **B. Hold-out (C3)** | F23; the V4 count; then the **hold-out run once** on Neo4j at the freeze commit | local, lane 2 | 0 |
| **C. Study 2, drift version (C5, C6)** | design note → adversarial review → power simulation → Gemini adapter and S4 probe (CDX) → pilot → OSF pre-registration (PRE) → **main run** → evasion check (M6) | design and simulation by agents/cloud; runs local | counted Mon |
| **D. Meaning (C3m)** | codebook (L4) → stratified sample of about 60 findings → the rater's session → κ and meaningful precision | agents; then you and the rater | 0 |
| **E. Neuro-symbolic (C1d, C4)** | A2 facts-file contract → six K3/K2m cases plus twins, answers committed → 2-case pilot → 6-case run on two vendors | agents; runs local | 10–20, then counted |
| **F. Efficiency (C1c, M5)** | design note → 10 questions × 2 repos with answers written first → graph tools vs raw files | agents; runs local | counted Mon |
| **G. Drift on human histories (C5)** | a zero-call description from the existing fix-mining snapshots | agent | 0 |
| **H. Writing** | chapter skeleton by the planes; limitations chapter drafted from `nulls-and-limits.md`; ledger line 274 refreshed; three threat-register rows; one dated deviation list | agents (private thesis repo for thesis text) | 0 |
| **I. Repo hygiene** | commit `ops/` and the audit entry (D7) | me | 0 |

## Day by day

| Day | Agents and machine | You |
|---|---|---|
| **Sun 18 (tonight)** | F23 and the V4 count (B). Draft of the Study 2 drift design (C). Contract and case set (E). Efficiency design and questions (F). Codebook draft and sample (D). Drift description (G). Commit `ops/` (I) | sleep |
| **Mon 19** | D5 and N3 rules with tests (A). Fable review of the drift design, then the power simulation (C). Gemini adapter and S4 probe (C, calls counted). **Dry runs to fix every call count.** Deviation list (H) | decide **L4**; send the **D1 changes**; read **NS-01** and the drift design; **book the rater** for Wed or Thu; create the **OSF** account; send the design and the deviation list to the **director** |
| **Tue 20** | **Freeze tag** (A). **Hold-out run** (B). 2-case NS pilot (E). Drift pilot (C) | OK the call counts; read the pilot outputs |
| **Wed 21** | OSF pre-registration, then the **Study 2 drift main run**, two generator lanes (C). 6-case NS run (E). Efficiency run (F) | rater session (D) |
| **Thu 22** | Study 2 run continues; evasion check (C). κ and precision (D) | rater session, if not Wed |
| **Fri 23** | All analyses. DiagnosticRuns reports, then the compendium. Fable review of the results. **Results frozen** | read the results summary |
| **Sat 24 – Fri 30** | the thesis sync routine; agent drafts of results sections from the compendium | **writing**; director reads about Wed 28; **send by Oct 30–31** |

## Critical path and the risks on it

1. **Freeze on Tue**, which gates the hold-out and every scored run. It depends on D5 and N3 building cleanly on Mon. *Fallback:* any rule not green by Mon night is dropped to a stated limit, so the freeze doesn't slip.
2. **Drift design to main run in three days.** *Fallback:* if the pilot fails its bar, or the power simulation can't reach 0.80 at a plausible effect, the run goes ahead as **exploratory** under the pre-written fallback, and the full Study 2 becomes future work.
3. **The rater.** *Fallback:* no rater means meaning is reported as unlabelled, as a stated limit, with the codebook published.
4. **Gemini budget.** The second generator family (CDX) and the two-vendor NS run will need more than the current Gemini cap. **You need to OK a budget on Monday**, once the counts exist.
5. **Your reading time.** Each item marked "you" above is on the critical path. The board will show them as a queue.

## Changelog
- 2026-10-18 v1: first version, after the author set the deadline (results by Oct 23, thesis by Oct 31) and confirmed proceeding per `decisions.md`.
