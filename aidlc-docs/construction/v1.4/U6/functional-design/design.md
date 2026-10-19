# U6 functional design: detection recall fixes (C3)

**Cycle:** AI-DLC v1.4 "instrument alignment". **Map part:** C3 detect (P3). **Depth:** minimal (no NFR, infrastructure or user-story stages).
**Status:** DESIGN ONLY, 2026-10-18. Nothing here answers a construct question, edits a switch, a preset, a tier, a manifest or a result. **Not buildable** until the author has (1) written the D1 changes, (2) adjudicated the 9 rows, (3) answered the questions in §10, and (4) decided how the registered scorers learn the answers (§3.3).
**Review 2026-10-18 (adversarial design review, revised in place):** §3.3 (the figures exist only in the offline re-score), BR-U6-05 and BR-U6-06 restated to match the code as built, §4.1 fresh check (MO-H03 key and tiers), §6.2–§6.3 (N1 matching, the chosen set, the record run), §7–§9 (locations, tests, risks) and §10 items 12–14.

> **DEVELOPMENT-SET NUMBERS.** Every figure here is copied from `Docs/DiagnosticRuns/v1.3-blind-recall-gap-2026-10-18.md` (the "gap report") or `Docs/DiagnosticRuns/v1.3-blind-misses-2026-10-16.md` (the "re-score table"). They come from the 71-case v1.3 reference set, run `after-member-facts`, with the 3 FF-P06 FLOWS_TO rows N/A (Q8 B). They are fit figures, not validity estimates. No style has more than 18 expected blocking rows, so read each ratio as a count. Intervals are 95% Wilson (z = 1.959964, as in `scripts/v1.3/ue-score.ts`). Nothing was re-run for this design.

Companion files:
- `aidlc-docs/construction/v1.4/U6/functional-design/adjudication-sheet.md`: the 9 rows for the author's verdict.
- `aidlc-docs/construction/v1.4/U6/functional-design/adr-drafts.md`: ADR drafts for Q5 D, Q6 B, Q10 C (and the Q10 D fallback), and Q12 B.
- `aidlc-docs/construction/v1.4/U6/plan.md`: the code-generation plan.

---

## 1. What this unit is, and what it is not

Gate V4 needs blind blocking recall of at least 0.90 per Study 2 style (`Docs/v1.3/study2-readiness-gate.md:108-115`). The build list target for C3 is "blind recall ≥ 0.90 per Study 2 style **against the adjudicated reference**, on development material" (`ops/03-build-list.md`, row C3). The gap report split the 14 blind misses and 4 blind false alarms like this:

| Class | Misses | False alarms | What U6 does about it |
|---|---|---|---|
| (a) extractor gap | 0 | 0 | nothing (U1 owns N33 and N38; the gap report §2 predicts no blind row moves) |
| (b) the tool departs from its own construct source | 5 (#5, #9, #11, #12, #14) | 4 (#15–#18) | **four fixes**: Q5 D, Q6 B, Q10 C, Q12 B. All four are existing switches |
| (c) the blind reader applied a reading the sources don't support, or applied it to some cases only | 9 (#1–#4, #6–#8, #10, #13) | 0 | **no tool fix.** An adjudication sheet, so the author can decide each row before the freeze |

U6 **writes no new detection logic.** Every fix is already in code behind a switch (`src/shared/construct-switches.ts`, hooks in `src/construct-switches/`). It is A today, so the tool is at the status quo. What the build adds is the following:
1. the answers, applied through the existing script;
2. the signed ADR text;
3. an **adjudicated reference view** in the offline re-score, so that the C3 target can be measured;
4. the fresh checks the gap report §7 asks for;
5. its share of the one development re-run (freeze runbook step 3, `Docs/v1.3/freeze-runbook.md`), then a freeze.

**Count of fixes.** `ops/03-build-list.md` row C3 says "the 3 rule fixes"; the gap report lists four switches (Q5 D, Q6 B, Q10 C, Q12 B). The two layered switches (Q10, Q12) are counted here as two, because each needs its own ADR entry and its own deviation line. If the author meant three (for example Q6 B left out), G0.3 settles it; nothing below depends on the count.

## 2. Inputs read

- `Docs/DiagnosticRuns/v1.3-blind-recall-gap-2026-10-18.md` (the classification, per-style effects and overfitting guard).
- `Docs/DiagnosticRuns/v1.3-blind-misses-2026-10-16.md` (per-row table and the re-score table).
- `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md` (the corrected baseline: author 54/54, blind 50/64 and 50/54).
- `Docs/v1.3/construct-decisions.md`: Q4, Q5, Q6, Q7, Q10, Q12, Q13 and Q20, the principles P1 and P2, and the **source verification notes (2026-10-16)**.
- `Docs/v1.3/construct-switches.md`, `src/shared/construct-switches.ts`, `src/shared/construct-switch-catalogue.ts`, `src/construct-switches/{compile,rows,tiers,overlays}.ts`.
- `scripts/v1.3/apply-construct-answers.ts`, `scripts/v1.3/blind-misses-rescore.ts`, `scripts/v1.3/lib/freeze-check.ts`.
- `results/v1.3-reference/after-member-facts/adjudication.csv`: the committed blind reasons. This is the only route by which the blind key is read.
- `ops/decisions.md`, `ops/03-build-list.md`, `ops/04-north-star.md`, `ops/01-instrument-map.md` (C3 rows).
- Read in the review: `scripts/v1.3/lib/construct-rescore.ts`, `scripts/v1.3/lib/reference-model.ts`, `scripts/v1.3/ue-score.ts`, `scripts/v1.3/lib/holdout-score.ts`, `scripts/v1.3/operators-hexddd-run.ts`, `scripts/lib/freeze-gate-main.ts`, `src/construct-switches/{rows,layer-view}.ts`, `Docs/v1.3/freeze-runbook.md` (step 3, §C), `results/v1.3-reference/after-member-facts/{run-provenance,blind-rule-mapping}.json`.

Not read: `daedalus-sealed/`, `.env`, and any credential or config directory.

## 3. Findings that change how strong the fixes are

### 3.1 The sources are weaker than the gap report says

The gap report says Q5 D and Q6 B are "general", and it gives a source reason for each. The **source verification notes** at the end of `Docs/v1.3/construct-decisions.md` (2026-10-16) weaken both reasons. The gap report does not cite those notes:

- **Q5:** "Cockburn never says adapters must not talk to each other, and in his own sample the primary FIT adapter calls the secondary adapter factory. Blocking adapter→adapter is therefore an *inference* from the port concept, not a quotation."
- **Q6:** "the phrase 'application core' quoted as the source does not appear in Cockburn's article." The question has to rest on "Intent" and "Nature of the Solution", and neither states an explicit source-dependency rule.

The design therefore rates Q5 D and Q6 B as **medium** overfitting risk, not low (§5). The ADR drafts state each reason as an inference and quote the verification notes.

### 3.2 Q6 B finds no new edge

On the edge level, **Q6 B finds no new edge.** Every application → adapter edge it adds as FF-S04 is already reported as FF-S01, which is blocking (gap report, rows #9 and #11: "Tool on this edge: FF-S01"). Its recall gain comes only from the rule-id key. Q5 D does find something new: an edge that was advisory becomes blocking. Q10 C finds one edge (#5) under a new id. Q12 B only removes rows.

### 3.3 The "after" figures exist only in the offline re-score (review finding, needs the author)

Every "after" figure in §4 and in the gap report comes from `scripts/v1.3/lib/construct-rescore.ts` and `scripts/v1.3/blind-misses-rescore.ts`. Those two scripts change the **reference** under the answers: construct-aware tiers (`constructRuleTier`), a scope that drops a rule the answers make inapplicable and adds a rule they create (FF-S05), and a rename of key rows (FF-S03 adapter → adapter rows to FF-S01 or FF-S05; under Q5 D also the blind FF-S01 adapter → adapter rows to FF-S05).

The registered scoring path does none of this:
- `scripts/v1.3/lib/reference-model.ts` (`withTierBlocking`) takes tiers from the sealed `ruleTier`, and the scope from the committed reference descriptors. FF-S05 is in no descriptor and in no sealed tier row.
- `scripts/v1.3/ue-score.ts` and `scripts/v1.3/lib/holdout-score.ts` import nothing from the construct switches, and `blind-rule-mapping.json` maps blind rule **names** to ids, with no per-edge rename.

Consequences, if nothing changes in the scorers:
- **Q5 D:** the blind reader names #12 and #14 FF-S01. The tool reports FF-S05, which the live scorers treat as unscored. The record run and the hold-out then show **no** blind gain from Q5 D, and the advisory FF-S03 adapter rows of both keys become misses.
- **Q5 C:** the tool reports FF-S01 on #12 and #14, which is the blind reader's own id, so the blocking gain is scored natively. Only the advisory FF-S03 key rows need a rename, and they do not move blocking recall.
- **Q10 C or D:** FF-P01 stays in the layered scope of the committed descriptor, so the author-manifest FF-P01 rows in layered become misses in the author view.
- **Q5 D tier:** FF-S05 is blocking only through `constructRuleTier`. Every script that uses the sealed `ruleTier` (`reference-model.ts`, `scripts/v1.3/operators-hexddd-run.ts:336`) treats it as non-blocking.

So the claim "Q5 D scores the same as Q5 C on this set" holds **only in the offline re-score**. Two ways out, both the author's call (§10 item 12):
- **(a) Scorer alignment:** make `reference-model.ts`, `ue-score.ts` and `holdout-score.ts` read the answers (tiers, scope, renames) through the same functions the re-score uses. This is a change to the scoring procedure after the seal, before the hold-out run: a declared deviation with its own ADR entry, written before the record run. It is scoring code, not detection code, and it is **not** in this unit's scope until the author approves it.
- **(b) No scorer change:** report the registered figures as the scorers compute them, and say so. Under (b), **Q5 C is the better answer**: it gets #12 and #14 without any rename. Q5 D would give no registered gain.

Until this is decided, the recommendation in §4.1 is "Q5 C or D, depending on §3.3". Also, D needs a `blind-rule-mapping.json` row for FF-S05 under either path (`Docs/v1.3/freeze-runbook.md`, step 3).

## 4. Business rules: the four fixes

Notation: blind R and P are blind-expanded blocking recall and precision. Author R and P are author-manifest (cycle-normalised) blocking recall and precision. "Alone" means the fix is applied with every other question at A, plus Q8 B. Baseline: author 54/54 and 54/54; blind 50/64 = 0.78 [0.67, 0.86] and 50/54. The per-style baselines are in §4.5.

### 4.1 Q5 D: adapter → adapter gets its own blocking rule, FF-S05 `adapter-isolation`

**What it changes.**
- **Compile:** in `hexagonal` and `ddd`, a carrier function FF-S05 `adapter-isolation` is declared (`src/construct-switches/compile.ts:70`). Its query returns no row.
- **Rows:** every FF-S03 `layer-skip-graph` row whose source and target are both adapter layers moves to FF-S05 (`rows.ts` `q5AdapterEdges`, using `isAdapterPair`). FF-S03 stops reporting those rows (P2).
- **Tier:** FF-S05 is blocking in hexagonal and ddd (`tiers.ts:36`; it is a new tier row, and `Docs/v1.3/rule-tiers.md` is not edited).
- **Blind key:** under D, the blind FF-S01 adapter → adapter rows are renamed FF-S05. The author key's FF-S03 adapter rows get the same rename (re-score method, `v1.3-blind-misses-2026-10-16.md`).

**Rule (BR-U6-05), as built.** In hexagonal and ddd, every row that FF-S03 `layer-skip-graph` reports (an edge outside the declared allowed dependencies) whose source and target layers are both adapter layers (layer kinds `presentation` or `infrastructure`, `layerViewOf`) moves to FF-S05, which is blocking. FF-S03 no longer reports it. The switch only moves rows: an adapter → adapter edge that FF-S03 does not report (for example one the spec declares allowed) gives no FF-S05 row. Composition layers are not adapter layers (`bindHexagonalLayers`).

**Expected recall effect per style (alone, blind view):**

| Style | Blind R before → after | Blind P after | Author R/P after | Rows |
|---|---|---|---|---|
| hexagonal | 12/18 = 0.67 [0.44, 0.84] → **14/18 = 0.78 [0.55, 0.91]** | 14/14 | 14/14 (2 advisory rows become blocking) | #12, #14 |
| ddd | 9/9 → **10/10 = 1.00 [0.72, 1.00]** | 10/10 | 10/10 (ddd v10 api → infrastructure becomes blocking; both keys agree on it) | — |
| clean, layered, nestjs | unchanged | unchanged | unchanged | — |
| pooled | 50/64 → 53/65 = 0.82 [0.70, 0.89] | 53/57 | 57/57 | |

Q5 C (the same rows under FF-S01) scores the same on this set **in the offline re-score** (`construct-switches.md`). On construct grounds D is cleaner, because FF-S03 then keeps one construct with one tier logic. On measurement grounds C is cheaper: the blind reader's id for these edges is FF-S01, so C needs no blind-key rename and no new scope row in the registered scorers (§3.3). **Recommendation:** D only with scorer alignment (§3.3 (a)); otherwise C.

**Overfitting risk: medium.**
- *For:* the rule is not one row's rule. It moves every adapter → adapter row in two styles, and it was offered in `construct-decisions.md` before any score target existed.
- *Against:* the blocking reason is an inference, not a quotation (§3), and Cockburn's own sample has a primary adapter calling a secondary adapter factory. It is a new blocking id after the seal, so it is a declared deviation (G14). Its real-code precision is unknown. Every human hexagonal or DDD repo that has adapter → adapter imports gains blocking findings.
- *Fresh check (before the freeze, never the hold-out):* re-score the MO-H03 seeds (inbound → outbound adapter: 10 reference, 30 real; twins 0/6 and 0/18). Expect FF-S05 on every seed and none on the twins. Two things in `scripts/v1.3/operators-hexddd-run.ts` must change for this check to mean anything. (1) MO-H03's expected template is `layer-skip-graph` (FF-S03, `Docs/v1.3/operator-catalogue-hexddd.md`), and under Q5 D those rows leave FF-S03. So for this run only, the expected key is FF-S05 (under C, FF-S01), and the notes say so. (2) The twin false-fire test uses the sealed `ruleTier` (`:336`), so an FF-S05 row would not count as blocking. It must use `constructRuleTier` with the applied answers. Otherwise a twin that gains FF-S05 passes silently. MO-H03 is a hexagonal operator only, so ddd has no seeded check, and the run notes must say so. **Also count** the baseline FF-S03 adapter-pair rows on the unmodified real projects of `experiments/v1.3-operators-hexddd/projects.json`. Each of these rows becomes a blocking finding. List them for a correctness read (the C3 correctness procedure) before signing.

### 4.2 Q6 B: in hexagonal, FF-S04 core isolation binds domain plus application

**What it changes** (`rows.ts` `q6ApplicationCore`, hexagonal only):
- It **adds** an FF-S04 row for every edge from an application-layer file to a layer outside the core.
- It **drops** every FF-S04 row whose target is in the core. In practice that is the domain → application rows, such as hex v02's agreed FF-S04.
- FF-S01 is unchanged, so an application → adapter edge is now reported by both FF-S01 and FF-S04. The domain → adapter edges already overlap in the same way.

**Rule (BR-U6-06), as built.** In hexagonal, the core is the union of the declared `domain` layers and the `application` layers that are not composition roots (`layerViewOf`). The switch adds an FF-S04 row for every literal edge (every edge type of `literalEdges`; type-only edges are left out only under Q2 B) from an application-layer file to any layer outside the core. It drops every FF-S04 row whose target is inside the core. FF-S01 still owns direction inside the core (Q11 A). **Note:** the switch does not exempt a composition-layer *target*, so an application → composition-root import would become an FF-S04 row. The offline preview (plan Step 9) counts such rows on the reference set. Any such row is reported, and it does not prompt a code change (one loop).

**Expected recall effect per style (alone, blind view):**

| Style | Blind R before → after | Blind P after | Author R/P after | Rows |
|---|---|---|---|---|
| hexagonal | 12/18 → **13/18 = 0.72 [0.49, 0.88]** (+#9, +#11; −hex v02 FF-S04) | 13/13 | 53/54, 53/55 pooled (loses hex v02 FF-S04; adds 1 row the author does not list) | #9, #11 |
| all other styles | unchanged | unchanged | unchanged | — |
| pooled | 50/64 → 51/64 = 0.80 [0.68, 0.88] | 51/55 | 53/54, 53/55 | |

**Overfitting risk: medium.**
- *For:* the change is a rule's scope, applied to every hexagonal application file, not to one variant.
- *Against:* the quote the recommendation rests on is not in the source (§3). The change finds no new edge, only a second id on an edge FF-S01 already blocks (§3). It also costs one row that **both** keys agree on (hex v02 FF-S04). Under B that row becomes a manifest reading the new construct does not support, a tenth disagreement that the author should see (adjudication sheet, note N1).
- *P2 owner decision (author):* under B, who owns application → adapter? (i) Both FF-S01 and FF-S04, which is the switch as built and matches the existing domain → adapter overlap. (ii) FF-S04 alone, with FF-S01 dropping those rows. **(ii) is not implemented.** It would be a new switch, built after seeing the data, and it would cost blind TPs that the blind key counts under FF-S01 (`alsoMatches`). The design recommends (i), with the P2 exception written into the ADR.
- *Fresh check:* re-score the MO-H02 seeds (a use case injects a concrete outbound adapter, `Docs/v1.3/operator-catalogue-hexddd.md:16`), with FF-S04 added to the expected rules. Expect FF-S04 on every seed and no new rows on the MO-H02n twins.

### 4.3 Q12 B: FF-S03 in layered reports downward skips only

**What it changes** (`rows.ts` `q12UpwardNotSkip`, layered only): it drops each `no-layer-skip` row whose reverse transition is allowed. That is an adjacent upward edge, such as persistence → business or business → presentation. An upward edge across two layers is kept, because its reverse is not an allowed transition in strict layering. The switch only removes rows.

**Rule (BR-U6-12).** In layered, FF-S03 reports an edge that passes over at least one intermediate layer in the downward direction. An edge whose reverse is an allowed adjacent transition is an FF-S01 matter only (P2).

**Expected effect per style (alone):**

| Style | Blind R | Blind P before → after | Author R/P after | Rows |
|---|---|---|---|---|
| layered | 7/10 = 0.70 [0.40, 0.89], unchanged | 7/11 → **7/9 = 0.78 [0.45, 0.94]** | 52/54, 52/52 pooled (the author manifests list FF-S03 on the 2 upward edges) | false alarms #15, #16 |
| all other styles | unchanged (FF-S03 is advisory outside layered) | unchanged | unchanged | — |

**Overfitting risk: low.** It is a template defect fixed by a logical reading of the source's two clauses ("lower layers do not use upper ones"; "strict layering also forbids skipping a layer"). Fowler calls layering "mostly opaque", and the verification notes say that strict no-skip is only the strict variant. That bears on whether FF-S03 blocks at all, not on Q12. The switch cannot add a row.
- *Fresh check:* the 5 external layered repositories (`Docs/DiagnosticRuns/v1.3-external-set-3-2026-10-16.md:54-58`). Their FF-S03 rows include q00-api-server 8, bymi15-express-typeorm 5, pallavi-twitter-backend 13 and firmanjs-express-template 1. Count how many are adjacent-upward, which are the rows Q12 B removes. Each removed row that the external correctness labels judged correct **and** that is not also an FF-S01 row counts against the switch.

### 4.4 Q10 C: FF-P01 not applicable in layered, with packages mapped to layers for FF-S01

**What it changes:**
- **Compile:** `domain-purity` is disabled for `layered`, with the reason "not applicable to style layered (construct switch Q10 …, P1)" (`compile.ts:103`).
- **Rows:** a business-layer import of a package mapped in `CONSTRUCT_PACKAGE_LAYERS.layered` (`express`, `koa`, `fastify` → `presentation`; `src/construct-switches/overlays.ts:17`) becomes an FF-S01 `dependency-direction` row when the mapped layer is above the importer (`rows.ts` `q10PackageLayers`). Re-export package edges are skipped, and so are type-only edges under Q2 B.

**Rule (BR-U6-10).** In layered, domain purity does not apply (P1: the layered sources state no purity rule). A package import is a layer dependency only through a package-to-layer mapping declared before any re-run. Through it, FF-S01 reports a business or persistence file that imports a package mapped to a higher layer.

**Expected effect per style (alone):**

| Style | Blind R before → after | Blind P after | Author R/P after | Rows |
|---|---|---|---|---|
| layered | 7/10 → **8/10 = 0.80 [0.49, 0.94]** (+#5) | 7/11 → 8/10 | 52/52, 52/53 pooled (FF-P01 leaves the layered compared set; the new FF-S01 row is not in the author manifest) | miss #5; false alarms #17, #18 |
| all other styles | unchanged | unchanged | unchanged | — |

**Q10 D (the fallback, no mapping):** layered blind R 7/10 (unchanged), P 7/9; author 52/52 and 52/52.

**Q10 C + Q12 B together:** layered blind R 8/10, P **8/8**; author 50/52, 50/51 pooled.

**Overfitting risk: high for the mapping, low for the applicability.**
- Dropping FF-P01 in layered is grounded in the source (P1, and the same reasoning as ADR-V13-02 for FF-P06).
- The mapping is a new mechanism, and on this set only `express` is exercised. That makes it the most fit-prone item in U6 (gap report §4, §7). The list was written from the question text before any re-run (`overlays.ts` header). It must stay at the minimum and is frozen with the answers. Adding a package after seeing a result is a tweak and is excluded.
- *Fresh check:* the same 5 external layered repositories. Their FF-P01 rows disappear: q00-api-server 2, bymi15-express-typeorm 4 and firmanjs-express-template 2. If the external correctness labels judged them correct and meaningful, that counts against the switch. Under C, list every new FF-S01 package-layer row on those repositories for a correctness read.
- *Recommendation for the author:* choose **C only if** the external check shows that the new FF-S01 package rows are correct and the mapping needs no change. Otherwise choose **D**. D gives up #5 (layered blind R stays 7/10), but it needs no new mechanism.

### 4.5 All four together, and what is left

Source: the "Q5 C + Q6 B + Q10 C + Q12 B" row of the re-score table. Q5 D scores the same as Q5 C on this set **in the offline re-score only** (§3.3). The exact set with Q5 D has never been scored. Plan Step 9 scores it for the first time, against figures written down before the run.

| Style | Now (blind R) | After the four (blind R) | Blind P after | Left over (class) | After also adjudicating the 9 rows "spec right" |
|---|---|---|---|---|---|
| clean | 12/14 = 0.86 [0.60, 0.96] | 12/14 = 0.86 [0.60, 0.96] | 12/12 | #1, #2 (c) | 12/12 = 1.00 [0.76, 1.00] |
| layered (Study 2) | 7/10 = 0.70 [0.40, 0.89] | **8/10 = 0.80 [0.49, 0.94]** (7/10 with Q10 D) | 8/8 | #3, #4 (c); #5 under D | 8/8 = 1.00 [0.68, 1.00] (7/7 with D) |
| nestjs | 10/13 = 0.77 [0.50, 0.92] | 10/13 = 0.77 [0.50, 0.92] | 10/10 | #6, #7, #8 (c) | 10/10 = 1.00 [0.72, 1.00] |
| hexagonal | 12/18 = 0.67 [0.44, 0.84] | **15/18 = 0.83 [0.61, 0.94]** | 15/15 | #10, #13 (c); hex v02 FF-S04 (lost by Q6 B) | 15/16 = 0.94 [0.72, 0.99] |
| ddd (Study 2) | 9/9 = 1.00 [0.70, 1.00] | 10/10 = 1.00 [0.72, 1.00] | 10/10 | none | 10/10 |
| pooled | 50/64 = 0.78 [0.67, 0.86] | **55/65 = 0.85 [0.74, 0.91]** | 55/55 | 9 (c) + 1 | 55/56 = 0.98 [0.91, 1.00] |

The author view after all four is 52/55 and 52/55.

**Reading.**
- The four fixes do not bring Layered to 0.90 against the raw blind key.
- **Against the adjudicated reference**, which is the C3 target in the build list, every style reaches 0.90 on development material **if** the author rules "spec right" on all 9 rows. Rows ruled "blind right" stay as misses. A "blind right" verdict on a row also implies the matching construct switch, with its side effects (adjudication sheet, column "If the blind is right").
- **The adjudicator is the tool's author.** A `spec` verdict moves the reference toward the tool, and only disagreements are on the sheet (agreed rows are never re-opened, except N1). So the adjudicated figure measures whether the tool is consistent with its declared construct. It is **not** an independent recall estimate, and it can only go up. It is always reported next to the raw blind figure, and the V4 pass uses the blind figure (guard 5).
- None of this is available on the hold-out. Nobody edits a manifest after the run, and classifying a defect never changes a figure (`Docs/v1.3/holdout-prespec.md:56`, `:91`). The hold-out blind manifests were written under the same blind procedure, so similar disagreements should be expected there. The adjudication fixes the **construct**, not the hold-out figure.

## 5. Overfitting summary

| Fix | Rows it moves on dev | New edge found? | Source strength | Risk | Fresh check that could refute it |
|---|---|---|---|---|---|
| Q5 D | +2 hex, +1 ddd (advisory → blocking), in the offline re-score only (§3.3) | yes, at the blocking tier | inference from the port concept (verification note) | **medium** | MO-H03 seeds and twins (hexagonal only); a correctness read of the baseline adapter-pair rows on the real hex/ddd projects |
| Q6 B | +2, −1 hex | **no**: an id only; FF-S01 already blocks the edge | the "application core" quote is not in Cockburn (verification note) | **medium** | MO-H02 seeds with FF-S04 expected; twins |
| Q12 B | −2 layered false alarms | no (removes rows only) | logical reading of two clauses | **low** | adjacent-upward FF-S03 rows on the 5 external layered repos |
| Q10 C | +1, −2 layered | yes, one package edge under a new mechanism | applicability: P1 (strong); mapping: none (weak) | **high (mapping)** / low (D) | FF-P01 and new FF-S01 package rows on the 5 external layered repos |

Guards. These are carried from gap report §7 and are binding on the build:
1. **One loop.** Apply the answers once, preview once, do the development re-run once, then freeze. A figure may not decide a second change (`Docs/v1.3/construct-switches.md:23-24`).
2. **Excluded as tweaks:** Q4 B scoped to one style; `@nestjs/common` added to the nestjs FF-P01 list; any package beyond the mapping as it stands; Q4 B, Q7 B or Q20 B adopted only to match the blind key; "Q6 B without the drop".
3. **Never** consult the sealed hold-out or the sealed blind manifests. The development blind key is read only through committed `ue-score.ts` outputs (`adjudication.csv`, `scores.json`).
4. Each fix is a **post-seal construct change**: a declared deviation with an ADR, listed in G14's single dated list. The examiner review counts deviations as a risk in their own right. U6 adds up to 4 deviations to M3, D5 and N3.
5. Report the author view next to the blind view (52/55 after all four). The pass uses the blind manifest.
6. **Refutation criteria come before the fresh checks.** For each fresh check, the author writes down the result that withdraws the switch, before the check runs (plan G0.9), and the ADR draft quotes it. Suggested defaults: Q5 and Q6 are withdrawn if any MO-H03 or MO-H02 seed is missed or any twin gains a blocking row. For Q5, Q10 C and Q12 B, the switch is withdrawn if any listed real-code row is judged incorrect by the C3 correctness procedure **and** is not also reported by FF-S01. A failed check may only send a question back to A, or Q10 from C to D. It never adds an option or changes a list.
7. **One development re-run for the whole cycle.** The re-run under the answers is freeze runbook step 3, on the reference engine. It happens once, after **every** unit's construct answers are applied, not once per unit. If U6 ran its own re-run and another unit then answered a question, the freeze would need a second development run (`freeze-runbook.md` step 3: "This is the only development run").

## 6. Data contracts

### 6.1 Construct answers (input; already defined)

`Docs/v1.3/construct-answers.json`: the path `scripts/v1.3/lib/freeze-check.ts` reads (`DEFAULT_ANSWERS`). It is a plain map parsed by `parseAnswersDocument` (`scripts/v1.3/lib/construct-answers.ts`):

```json
{
  "Q4":  { "choice": "A", "note": "P2; blind key expected to disagree (U6 adjudication #1-#4)" },
  "Q5":  { "choice": "D", "note": "ADR-V13-03 §Q5" },
  "Q6":  { "choice": "B", "note": "ADR-V13-03 §Q6; P2 owner: both FF-S01 and FF-S04" },
  "Q7":  { "choice": "A", "note": "..." },
  "Q8":  { "choice": "B", "note": "N/A-half policy" },
  "Q10": { "choice": "C", "note": "ADR-V13-03 §Q10 (or D)" },
  "Q12": { "choice": "B", "note": "ADR-V13-03 §Q12" },
  "Q13": { "choice": "B", "note": "..." },
  "Q20": { "choice": "A", "note": "..." }
}
```

This file holds **all 25** answers and is shared with any other unit that answers questions (D1). U6 owns only the entries above, except Q8, which another unit owns. Every figure here assumes Q8 B. The values shown are the recommendations, as a format example; they are **not** the author's answers. The parser reads an unanswered question as A, but the freeze does not accept that. `freeze-check.ts` F3 needs all 25 `[Answer]:` lines of `Docs/v1.3/construct-decisions.md` filled in and equal to this file, and F4 needs an ADR-V13-03 entry for every answer that owes one. The author writes those lines; agents don't.

### 6.2 Adjudication verdicts (new)

`results/v1.3-reference/after-member-facts/adjudication-verdicts.csv` is a new file. The committed `adjudication.csv` is **not** edited, because its `adjudication` column belongs to the run. Header:

```
row_id,style,variant,rule,file,target,question,verdict,verdict_note,author,date
```

- `row_id`: the gap-report number (#1 to #4, #6 to #8, #10, #13), plus N1 for hex v02 FF-S04 if the author rules on it.
- `style, variant, rule, file, target` identify the row in the **rebuilt blind-expanded key** (`rebuildBlindKey` in `blind-misses-rescore.ts`: the blind rows of `adjudication.csv`, plus the tool rows that all three sources agree on). For cycles, `file` and `target` are the sorted file pair (`canon`), as in that sheet. The 9 rows are in `adjudication.csv`. **N1 is not:** it is an agreed row, so `ue-score.ts` never wrote it to the sheet. A checker that matched against `adjudication.csv` alone would reject N1 as unknown.
- The verdicts change only the `adjudicated` view. The author view is reported as computed. Where the adjudication sheet says that a `spec` verdict on N1 "removes it from both references", this file supersedes that: the author manifests are never edited (`Docs/v1.3/holdout-prespec.md:56`).
- `verdict` is one of `spec`, `blind` or `undecided`. `spec` means the row leaves the adjudicated reference. `blind` means it stays expected. `undecided` keeps it expected and flags it in the report.
- `question` is Q4, Q7, Q13 or Q20 (Q6 for N1).

**Consistency rule (BR-U6-C1).** The verdicts must agree with the construct answers:
- A row may be ruled `blind` only if its question is answered with the option that recovers it (Q4 B, Q7 B, Q13 C + Q25 B, or none for Q20). Otherwise the row is a known, permanent miss, and the script reports it as "blind right, construct says otherwise".
- All rows that share a question must get the same verdict (#1 to #4 for Q4; #7, #10 and #13 for Q7). A split verdict would be the inconsistent key the gap report found. The script refuses a split, unless `verdict_note` gives a construct reason that differs by row (for example the Q7 caveat on #10 and #13: the blind package had no `ports/out/`).

### 6.3 Adjudicated view (new output)

`scripts/v1.3/blind-misses-rescore.ts --verdicts <csv>` adds a third view, `adjudicated`, next to `author` and `blind`, in its table and in `--json`:

```ts
interface AdjudicatedView {
  readonly verdictsFile: string;            // repo-relative
  readonly removed: readonly string[];      // row keys ruled 'spec'
  readonly kept: readonly string[];         // 'blind' or 'undecided'
  readonly inconsistencies: readonly string[]; // BR-U6-C1 messages
  readonly perStyle: Readonly<Record<string, { recall: [number, number]; precision: [number, number] }>>;
  readonly pooled: { recall: [number, number]; precision: [number, number] };
}
```

The adjudicated key is the rebuilt blind-expanded key minus the rows ruled `spec`. Matching is unchanged: `ue-score.ts` matching, one to one, exact targets first, cycles keyed on their sorted file set. Rows are renamed under Q5 C or D exactly as the blind key already is. Without `--verdicts`, the output is byte-identical to today's.

The script needs three more things to measure the C3 target. Each is used only when its flag is passed, so the default output does not change:
- **`--answers <json>`: the chosen set.** The script's fixed `SETS` list has "Q5 C + Q6 B + Q10 C + Q12 B" but not the Q5 D form, and not the Q10 D form. `--answers` appends one more set, read with `parseAnswersDocument` and labelled "answers file". Editing `SETS` instead would change the default stdout.
- **`--as-run` and `--key-base <dir>`: the record run.** The record run (runbook step 3) already has the answers applied in its `raw/`. Re-scoring it through `rescore()` with the answers would apply the switches twice. Under `--as-run`, the tool rows are the base's `raw/` as written. The key is rebuilt from `--key-base` (default `--base`), and the renames follow the switch file's answers. For the record run, `--base` is `results/v1.3-reference/after-construct-answers`. `--key-base` is that same directory once the author's `ue-score.ts --blind` has written its `adjudication.csv` and `scores.json`, and `after-member-facts` before then.
- **Testable code.** `blind-misses-rescore.ts` is an entry file that runs `main()` on import, so jest cannot import it. Move `canon`, `match`, `rebuildBlindKey` and `scoreBlind` unchanged into `scripts/v1.3/lib/blind-key.ts`, and add the verdict filter in `scripts/v1.3/lib/adjudication-verdicts.ts`. The entry file only wires them up.

**Memory.** Each run of the script re-extracts all 71 reference graphs in process. Always pass `--graph-cache <scratch>/graphs.json`, run one instance at a time, and never run it inside jest.

## 7. Where the code goes

This follows the existing idiom. There is no new detection module. The two new files in `scripts/v1.3/lib/` are scoring helpers: one holds code moved unchanged, and one holds the verdict filter.

| Change | Path | Kind |
|---|---|---|
| The answers | `Docs/v1.3/construct-answers.json` | new data file (author-approved values) |
| The switch block | `src/shared/construct-switches.ts` (generated block only) | rewritten by `scripts/v1.3/apply-construct-answers.ts`, never by hand |
| Tier override reasons: "unsigned" → the signed ADR id, once signed | `src/construct-switches/tiers.ts` (the Q5 D line); and the `TODO(ADR-V13-03, Qn)` comments in `compile.ts` and `rows.ts` if present | small edit |
| The ADR text | `Docs/v1.3/adr-v13-03-draft.md` (draft, same idiom as `adr-v13-02-draft.md`), then `Docs/v1.3/adr-v13.md` §ADR-V13-03 when signed (`freeze-check.ts` `ADR_FILE`) | docs |
| The adjudicated view | `scripts/v1.3/blind-misses-rescore.ts` (flags `--verdicts`, `--answers`, `--as-run`, `--key-base`), with the key code moved unchanged to `scripts/v1.3/lib/blind-key.ts`, and a parser and checker in `scripts/v1.3/lib/adjudication-verdicts.ts` | script |
| The verdicts | `results/v1.3-reference/after-member-facts/adjudication-verdicts.csv` | data file, transcribed from the author's signed sheet. It is the only author-made file in a run directory, so its header comment (or the run note) says it is not a run output |
| Fresh checks: engine passthrough | `scripts/lib/freeze-gate-main.ts` `cliEvaluate`, which hard-codes `--engine neo4j`. Add an optional `engine` parameter, default `neo4j`, so every other caller stays byte-identical; under `cypher-interp`, blank `NEO4J_URI` in the child environment, as `ue-baseline-live.ts` does. `scripts/v1.3/operators-hexddd-run.ts` takes `--engine` and passes it on | script |
| Fresh checks: construct-aware tiers and the MO-H03 key | `scripts/v1.3/operators-hexddd-run.ts` (`:336` `ruleTier` → `constructRuleTier` with `CONSTRUCT_ANSWERS`; at the status quo the two are equal, so the earlier operator figures are unchanged). The FF-S03 → FF-S05 (or FF-S01) expected-key remap for MO-H03, and the extra FF-S04 key for MO-H02, are run options recorded in `run.json`. The operator catalogue is not edited | script |
| Scorer alignment (only if the author picks §3.3 (a)) | `scripts/v1.3/lib/reference-model.ts`, `scripts/v1.3/ue-score.ts`, `scripts/v1.3/lib/holdout-score.ts` | scoring code; its own ADR entry; **not built by U6** until approved |
| The run notes | `Docs/DiagnosticRuns/v1.4-u6-recall-fixes-<date>.md`; `aidlc-docs/construction/v1.4/U6/code/summary.md` | docs |

The extractor, the presets, the frozen template text, `Docs/v1.3/rule-tiers.md`, the manifests and `ops/` are not touched.

## 8. Test strategy

All jest runs use `--maxWorkers=2`, and nothing starts Neo4j.
- **Status quo byte identity (must stay green):** `tests/unit/construct-switches/rescore.test.ts`, `compile.test.ts` and `tests/unit/apg-extractor/v12e-byte-identity.test.ts`.
  - **Risk:** these tests import `CONSTRUCT_ANSWERS`, the generated default, and assume it is all A: `tests/unit/construct-switches/{pipeline,pipeline-report,compile,rescore}.test.ts`, `tests/unit/pipeline/commands.test.ts` and `tests/unit/fitness-compiler/v13-fix-round.test.ts` (checked with grep). Where a test *uses* the default, it must take `STATUS_QUO_ANSWERS` explicitly. One test *guards* it instead: `rescore.test.ts` asserts `isStatusQuo(CONSTRUCT_ANSWERS)`. That guard is not rewritten to pass. It is changed on purpose, in the apply commit, to assert that the switch block equals the rendering of `Docs/v1.3/construct-answers.json` (the F2 check of `freeze-check.ts`). Check before applying the answers, and make the fix a separate commit.
  - **Runtime consumers of the default:** `src/pipeline/pipeline-factory.ts`, `src/fitness-compiler/fitness-compiler.ts`, `src/pipeline/commands/compile-command.ts`, `src/report/architect/model.ts`, `scripts/lib/loop/evaluator.ts` and `scripts/v1.3/construct-rescore.ts` all read `CONSTRUCT_ANSWERS`. After the apply commit, every v1.3 `evaluate`, loop run and architect report runs under the answers. This is intended, but it changes other units' figures (§9).
- **Per-switch behaviour (exists):** `rows.test.ts` covers Q5 D, Q6 B, Q10 C and Q12 B, and `compile.test.ts` and `pipeline-report.test.ts` cover Q5 D. `answers-combinations.test.ts` covers only the Q13 C / Q25 B warning; it does **not** cover these switches. Add one combination case for exactly the chosen set to `interactions.test.ts`, on a hand-built fixture: rows and tiers only, which is that file's idiom. The case asserts the per-switch row moves and that the switches do not interfere with each other. It covers Q5 D with Q6 B, which touch different source layers, and Q10 C with Q12 B, which touch different rules.
- **Development-set figures are not a jest test.** Computing them re-extracts 71 graphs, which is too heavy for jest at `--maxWorkers=2`, and no existing test computes a development-set effect. The §4.5 figures are written down before the run (plan Step 9) and compared after a single scripted run.
- **Adjudicated view (new):**
  - `tests/unit/scripts/v1.3/adjudication-verdicts.test.ts`, on toy keys. It covers the parser; BR-U6-C1 (a split verdict is refused, a `blind` verdict that contradicts the answer is flagged); N1 matched against an agreed key row; a missing file meaning "no view"; and the adjudicated count on a toy key of 3 styles.
  - `tests/unit/scripts/v1.3/blind-key.test.ts`: `canon`, `match` and `scoreBlind` on toy rows, copied from the current behaviour before the move. Byte-identity of the default output is checked by a script, not by jest: save the stdout and `--json` output before the refactor (plan Step 2), then `diff` them after.
- **Live path:** the record development re-run is freeze runbook step 3. It runs on Neo4j 5.26, the reference engine (`freeze-check.ts` `ENGINE`; `freeze-runbook.md` §C), writes into `results/v1.3-reference/after-construct-answers/` (`DEV_RERUN_DIR`), and is followed by `ue-score.ts --blind <sealed>`, which reads `daedalus-sealed/`. Both are **author-run steps** that agents never run. The agent's `ue-baseline-live.ts --engine cypher-interp` run is the engine cross-check. It runs after the record run is committed, into a separate directory headed "ENGINE CROSS-CHECK (cypher-interp)", and its `raw/` is compared byte for byte with the record run's. It never writes into `DEV_RERUN_DIR`. If it ran first, an interpreter figure would exist before the record run. If it wrote into `DEV_RERUN_DIR`, the record directory would hold a cross-check engine's output.
- **Fresh checks:** §4.1 to §4.4. MO-H02 and MO-H03 need `operators-hexddd-run.ts` on cypher-interp, with construct-aware tiers, or else they are skipped and noted. The external layered check needs the pinned clones plus `npm install --ignore-scripts`. Both are network steps the author must approve; if they are not approved, skip and note. The external "status quo" run needs the switch block at A. Run it before the apply commit, or in a worktree at the commit before it, because the CLI has no answers flag.
- **Machine limits:** one evaluate or re-score process at a time, never two re-extractions in parallel, and jest at `--maxWorkers=2`.

## 9. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Q5 and Q6 rest on weaker sources than the gap report states (§3) | an examiner calls them fits | the ADRs quote the verification notes; the fresh checks come before signing; Q5 C is the fallback if a new id is unwanted |
| Q6 B is relabelling only | recall gain without detection gain | report it as such; a by-edge metric (gap report §5, item 2) would show zero gain, which is stated |
| The mapping in Q10 C is exercised by one package | fit to #5 | freeze the list as it stands; D as the fallback |
| Four more post-seal deviations | the deviation count itself is a risk | one dated G14 list with M3, D5 and N3; director sees it at design stage |
| Author-view drop to 52/55 | looks like a regression | report both views; the drop is the author manifests disagreeing with the answered construct |
| D1 changes still unwritten | answers may shift | not buildable until D1 is written; U6 re-reads `ops/decisions.md` first |
| Adjudication done after seeing development recall | a goalpost risk | the sheet presents the construct argument each way, not the recall effect; verdicts are per question and consistent (BR-U6-C1); the hold-out figure is unaffected by design |
| Tests that assume an all-A default | false red after the answers are applied | §8, fixed before applying |
| Shared answers file with other units | edit conflicts | U6 writes only its entries; the orchestrator merges |
| The live and hold-out scorers are not construct-aware (§3.3) | the registered figures differ from §4. Q5 D gives no registered gain; FF-P01 author rows in layered become misses; FF-S05 is non-blocking in sealed-tier scripts | the author decides on scorer alignment (a) or no change (b) before the apply; under (b), Q5 C; the run note gives both the offline and the registered figures |
| The apply commit changes the default of every v1.3 consumer (§8) | other units' development figures (loop runs, architect reports, drift or efficiency runs) silently change if they run after it | the orchestrator sequences the apply after the other units' development runs, or each unit's run note records the switch-block hash; v1.2E is unaffected (Step 14 byte-identity) |
| A per-unit development re-run | a second development run once another unit answers a question; F8 fails at a later X | the one re-run is runbook step 3, once, after all 25 answers (guard 7) |
| Fresh checks without pre-declared criteria | a result-driven choice after the fact (goalpost) | refutation criteria written before the checks (guard 6, plan G0.9) |
| Re-score memory (71 graph extractions per run) | machine overload | `--graph-cache`, one process at a time, never inside jest |

## 10. Author decisions needed before code

1. **D1:** write the changes to the decision sheet. Do they touch Q4 to Q7, Q10, Q12, Q13 or Q20?
2. Confirm **P1** and **P2** (`construct-decisions.md`, Principles). Q10 and Q12 depend on them.
3. **Q5:** D (new blocking FF-S05), knowing that blocking adapter → adapter is an inference, not a quotation, and that D's gain needs scorer alignment (item 12). Or C (FF-S01, scored natively), or A.
4. **Q6:** B or A, knowing that the "application core" quote is not in Cockburn and that B adds no new edge. Under B, choose the P2 owner: both rules (recommended) or FF-S04 alone (unbuilt, so a new switch).
5. **Q10:** C (mapping `express`, `koa`, `fastify` → presentation) or D (no replacement). Recommendation: C only if the external check supports it.
6. **Q12:** B.
7. Q4, Q7, Q13 and Q20 at the recommendation (A, A, B, A): needed for the class (c) verdicts to be consistent.
8. **The 9 adjudication verdicts**, plus N1 (hex v02 FF-S04 under Q6 B).
9. Approval to clone the 5 external layered repositories at their pinned SHAs for the fresh check (a network step), or accept "skipped, noted".
10. Who runs the reference-engine (Neo4j) development re-run and `ue-score.ts --blind`, which reads `daedalus-sealed/`. Agents may not.
11. Whether the four become one ADR (ADR-V13-03, with a section per question, as the code TODOs assume) or four. Whether they enter the G14 deviation list now.
12. **Scorer alignment (§3.3):** (a) make the reference, `ue-score.ts` and hold-out scorers read the answers (tiers, scope, renames). That is a declared scoring deviation, decided before the record run, and needs its own unit or approval. Or (b) no scorer change, with Q5 C instead of D. This decision comes before the Q5 answer.
13. **Refutation criteria** for every fresh check, written before the check runs (guard 6).
14. **Q8 B** confirmed by its owning unit, since every figure assumes it. Also the 25 `[Answer]:` lines in `Docs/v1.3/construct-decisions.md` (F3), and the order in which the apply commit lands relative to other units' development runs (§9).

## 11. Extension compliance

No extension is enabled for this unit at minimal depth. The design involves no secrets, no network calls and no model calls. All paths are repo-relative. It contains no billing figures. Content validation: tables only, no Mermaid and no ASCII diagrams. Code fences are closed, and the JSON example parses.
