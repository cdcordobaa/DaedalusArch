# Signing sheet, 2026-10-19 (SIGN)

**For the author. Every box is empty.** This is the one-page sheet of decision SIGN (`ops/decisions.md:24`) and REV-05 §6 item 4 (`ops/notes/rev-05-first-study-fable.md:164`). Each default comes with its rule source and its consequence. An AI session drafted it from the files cited. It decides nothing. Zero model calls; no sealed path, manifest or MEAN-01 sample was opened.

**The principle you set (U6, `ops/decisions.md:23`):** rules are never hand-written and never tuned to the misses. Every construct answer must follow from the style's spec and rule sources, whatever the development figure does. So each row below cites a source, never a figure. Development figures appear only as consequences.

**How to sign.** Tick a box to accept the default, or write another letter in the "Your answer" column. Then copy the answers to the `[Answer]:` lines of `Docs/v1.3/construct-decisions.md` and to the verdict column of the adjudication sheet. Those two files are what the freeze check reads.

## ★ The five items that matter most

| # | Item | Why it matters |
|---|---|---|
| ★1 | **Q5** adapter → adapter, blocking under a new id | Moves blocking rows in hex and ddd. Its source is an *inference* from the port concept: Cockburn never says adapters must not talk (`construct-decisions.md:853`) |
| ★2 | **Q10** FF-P01 in Layered: not applicable (C) | Moves Layered rows, the only style that escapes the floor. Mapping risk is **high** (U6 design `:206`) |
| ★3 | **Q18** DDD anti-corruption layer may import upstream internals (A) | The default follows the sealed text, but the source argues **against** it (Evans, Reference 2015 p. 34; `construct-decisions.md:859`). Your principle says the source wins |
| ★4 | **Q-C** FF-P07 blocking in four styles | It enters the hold-out's M1–M6 if signed before the freeze (`Docs/v1.4/adr-v14.md:89`) |
| ★5 | **G0.9** refutation criteria | Must be dated **before** U6's fresh checks run, or the U6 fixes read as tuned to the misses (`rev-05:79-83`) |

Also read **Q6** before signing: the quoted phrase "application core" is not in Cockburn (`construct-decisions.md:854`).

## 1. V1: the 25 construct answers (`Docs/v1.3/construct-decisions.md`)

First confirm the two principles (U6 plan G0.2, `aidlc-docs/construction/v1.4/U6/plan.md:33`):
- [ ] **P1:** where the canonical sources are silent for a style, the rule does not apply in that style (`construct-decisions.md:23`).
- [ ] **P2:** one edge, one rule (`construct-decisions.md:24`).

"Rec." is the line of the recommendation. "Cons." is the summary row (sheet rows / other rows / styles / change).

| Q | Default | Rule source (citation) | Consequence (Cons.) | Accept | Your answer |
|---|---|---|---|---|---|
| 1 | A | P1: no isolated-domain constraint for Layered (Rec. `:101`) | 0 / 53 baseline / layered / none (`:60`) | [ ] | |
| 2 | A | Martin: an inner circle must not *mention* an outer name (Rec. `:128`; `:851`) | 0 / 12 / 4 styles / none (`:61`) | [ ] | |
| 3 | C | Martin ch. 12 and ch. 14 (ADP over components, p. 112) (Rec. `:160`; `:852`) | in-layer file cycles become advisory; tier split by ADR (`:62`) | [ ] | |
| 4 | A | P2; [SRS: Clean/Layered, FF-S02] is about components (Rec. `:189`) | 4 sheet rows (#1–#4) stay out (`:63`) | [ ] | |
| ★5 | D | Cockburn 2005, by inference only (Rec. `:217`; `:853`) | 5 / 1 / hex, ddd / ADR + new rule id (`:64`) | [ ] | |
| 6 | B | Cockburn "Intent" and "Nature of the Solution"; "application core" not in the source (Rec. `:246`; `:854`) | 2 / 1 / hex; P2 owner needed (`:65`) | [ ] | |
| 7 | A | Martin ch. 11 DIP: FF-P02 owns the consumer edge (Rec. `:272`; `:855`) | 3 sheet rows (#7, #10, #13) stay out (`:66`) | [ ] | |
| 8 | B | sealed tier kept; uncovered half N/A (policy `:292`; Rec. `:306`) | FLOWS_TO half reported N/A (`:67`) | [ ] | |
| 9 | A | Martin: inversion is a source dependency impl → interface (Rec. `:334`) | 4 / 3 / clean, nestjs, hex / none (`:68`) | [ ] | |
| ★10 | C | P1; sources silent on Layered purity; Fowler "mostly opaque", POSA relaxed variant (Rec. `:363`; `:856`) | 3 / 0 / layered / disable + mapping mechanism (`:69`) | [ ] | |
| 11 | A | Evans, Martin; *DDD Reference* 2015 puts domain below application (Rec. `:396`; `:857`) | 1 / 3 / hex, ddd / none (`:70`) | [ ] | |
| 12 | B | two clauses of the source; strict no-skip is POSA's strict variant (Rec. `:421`; `:856`) | 2 / 0 / layered / template (`:71`) | [ ] | |
| 13 | B | preset order; NestJS docs constrain DI, TypeORM example (Rec. `:454`; `:861`) | 3 / 1 / nestjs; fix ADR-V13-02 text (`:72`) | [ ] | |
| 14 | A → C | N/A-half policy; Evans 2003 allows a mutable value object as a special case (Rec. `:484`; `:858`) | blocking, accessor half N/A (`:73`) | [ ] | |
| 15 | A (defer) | Evans ch. 14 Shared Kernel, not settled (Rec. `:511`) | 1 / 1 / ddd / none now (`:74`) | [ ] | |
| 16 | B | ADP is general (Martin ch. 14) (Rec. `:538`); settled in substance by ADR-V14-01 (`adr-v14.md:26`) | ddd gains FF-S02 (`:75`) | [ ] | |
| 17 | A | the barrel is the context's published interface (Rec. `:563`) | 1 / 1 / ddd / none (`:76`) | [ ] | |
| ★18 | A | sealed text grants the exemption (Rec. `:589`) **but** Evans says the ACL talks through the upstream's *existing interface* (`:859`) | 0 / 1 / ddd / none (`:77`). Under your principle, B is the source-following answer | [ ] | |
| 19 | A | stricter than Evans ch. 6 (transient references allowed) (Rec. `:614`; `:860`) | 0 / 1 / ddd; thesis says "stricter" (`:78`) | [ ] | |
| 20 | A | P2 (Rec. `:639`) | 1 sheet row (#8) stays out (`:79`) | [ ] | |
| 21 | A | no source states event placement; sealed row says guideline (Rec. `:665`) | advisory (`:80`) | [ ] | |
| 22 | B | a stated narrowing of Martin's DIP (Rec. `:691`) | 1 / 0 / nestjs advisory / template (`:81`) | [ ] | |
| 23 | B | the declarations define what an entity is (Rec. `:717`) | 2 / 0 / advisory / template (`:82`) | [ ] | |
| 24 | A | styles permit inward dependencies; sealed FF-S03 reason (Rec. `:749`) | 5 rows, advisory or unscored (`:83`) | [ ] | |
| 25 | B | presets should state what the tool does with these files (Rec. `:784`) | preset entries, one dev run (`:84`) | [ ] | |

Then record the answers in ADR-V13-03 (`construct-decisions.md:800`).

## 2. ADR-V14-01 and -02: parts Q-A to Q-E (`Docs/v1.4/adr-v14.md`)

| Part | Default | Spec evidence | Consequence | Accept |
|---|---|---|---|---|
| Q-A | FF-S02 joins DDD by a compile-time overlay, v1.3 scoring mode only; `presets/ddd.yaml` not edited (`:20-26`) | sealed FF-S02 row: "acyclic dependencies principle; a structural fact" (`:28`) | every later DDD run is scored with cycles; N17 addressed | [ ] |
| Q-B | FF-P07 forbids HTTP delivery packages only (express, fastify, koa, hapi, restify, Nest platform packages) (`:64`) | the delivery mechanism is outside the application (`:68`) | `@nestjs/common`, ORMs, DI and validation stay allowed | [ ] |
| ★Q-C | FF-P07 blocking in clean, hexagonal, nestjs, ddd (`:68`; `Docs/v1.4/rule-tiers-post-seal.md:19-22`) | a precise structural fact breaking a defining constraint (`:68`) | the 12 framework-leak seeds become rule hits; enters the hold-out if signed before the freeze | [ ] |
| Q-D | No TypeScript fast-path re-statement; MCP tools list FF-P07 as `notChecked` (`:77`) | Cypher is the only rule definition (`:77`) | the `mcp@L2` arm's tools do not check FF-P07, while D scores it | [ ] |
| Q-E | Hold-out scope: FF-P07 and ddd FF-S02 enter M1–M6 if Q-C is signed before the freeze; otherwise reported apart (`:89`) | prespec line 13 and line 59 (`:89`) | blind manifests do not expect FF-P07 rows, so M2 may drop | [ ] |

## 3. The 9 adjudication rows (`aidlc-docs/construction/v1.4/U6/functional-design/adjudication-sheet.md`)

The default verdict follows the construct answer each row shares (sheet rule BR-U6-C1, `:19-23`). A `blind` verdict implies the switch in the sheet's last column.

| Row | Question | Default verdict | Source | If `blind` | Accept |
|---|---|---|---|---|---|
| #1 clean v01 (`:49`) | Q4 | spec | Q4 A, P2 (`:36-38`) | Q4 B: +11 rows elsewhere (`:42`) | [ ] |
| #2 clean v09 (`:50`) | Q4 | spec | same | same | [ ] |
| #3 layered v01 (`:51`) | Q4 | spec | same | same | [ ] |
| #4 layered v02 (`:52`) | Q4 | spec | same | same | [ ] |
| #6 nestjs v07 (`:80`) | Q13 | spec | preset order; NestJS docs (`:82-85`) | Q13 C + Q25 B: net +1 −1 (`:90`) | [ ] |
| #7 nestjs v07 (`:70`) | Q7 | spec | Q7 A; Martin ch. 11 (`:60-63`) | Q7 B: +3 TP, +4 false alarms (`:66`) | [ ] |
| #8 nestjs v10 (`:99`) | Q20 | spec | P2 (`:101`) | no switch recovers it (`:106`) | [ ] |
| #10 hexagonal v03 (`:71`) | Q7 | spec | Q7 A; caveat: no `ports/out/` seen (`:65`) | as #7 | [ ] |
| #13 hexagonal v05 (`:72`) | Q7 | spec | same caveat | as #7 | [ ] |
| N1 hexagonal v02 (`:114`), only if Q6 = B | Q6 | spec | Q6 B moves the edge inside the core (`:114`) | keeps the miss Q6 B causes (`:116`) | [ ] |

Consequence (development figures, never a reason): all `spec` gives 55/56; all `blind` gives 55/65 (`:124-125`). The adjudicated figure is not an independent recall estimate; V4 uses the blind figure (U6 design `:196`).

## 4. MEAN-01 §12 (`ops/notes/mean-01-codebook-and-sample.md:303-309`)

| Item | Default | Source | Consequence | Accept |
|---|---|---|---|---|
| L4 | **A, practitioner** (already settled 2026-10-18) | `ops/decisions.md:35`; MEAN-01 §2 | field A is primary; κ gate on A | [ ] record it |
| R3 | test, mock, fixture code gets B = `no` | MEAN-01 §3 (`:50`) | | [ ] |
| R4 | a cycle gets B = `yes` only across a named boundary | ADP over components (`:51`) | settles Q3 for field B only; if rejected, calibration item C4 changes | [ ] |
| R5 | judge the file's real role; code `M` if the layer map is wrong | `:52` | | [ ] |
| κ definition date | dated on signing, before the first label | MEAN-01 §4 (`:67`); gate V6 | binding from that date | [ ] date: ____ |
| Sample sha256 | you record the full hash yourself (`shasum -a 256`); this sheet never opens the sample | MEAN-01 §6 (`:152-156`) | the sample freezes | [ ] hash: ____ |
| V6 pointers | one line each in three frozen documents | MEAN-01 blocker B4 (`:300`) | V6 can turn green | [ ] |
| Field A label date | **proposed** 2026-11-30, before Ch. 7–9 | MEAN-02 §0 (branch `v14/c4-mean02-design`) | if missed, the thesis says field A is unmeasured | [ ] |

## 5. U6 G0.9: refutation criteria, drafted (`aidlc-docs/construction/v1.4/U6/plan.md:47`)

From the suggested defaults in U6 design guard 6 (`design.md:214`). Each must be signed and dated **before** its fresh check runs (plan Steps 10 and 11). A met criterion may only send a question back to A, or Q10 from C to D. It never adds an option or changes a list.

| Switch | Fresh check | The result that withdraws it | Accept |
|---|---|---|---|
| Q5 (C or D) | MO-H03 seeds and twins (hexagonal); correctness read of the adapter-pair rows on the real hex/ddd projects | any MO-H03 seed missed, **or** any twin gains a blocking row, **or** any listed real-code row is judged incorrect by the C3 correctness procedure and is not also reported by FF-S01 | [ ] |
| Q6 B | MO-H02 seeds with FF-S04 expected; twins | any MO-H02 seed missed, **or** any twin gains a blocking row | [ ] |
| Q10 C | FF-P01 and new FF-S01 package rows on the 5 external Layered repos | any listed row judged incorrect by the C3 procedure and not also reported by FF-S01 → Q10 goes to D | [ ] |
| Q12 B | adjacent-upward FF-S03 rows on the 5 external Layered repos | any adjacent-upward edge that Q12 B stops reporting under FF-S03 is not reported by FF-S01 either (a real violation lost) | [ ] |

> AUTHOR: sign — G0.9 criteria as above / amended: ______. Signed: __________ Date: ____-__-__ (before plan Steps 10–11)

## Sign-off

> AUTHOR: sign — §1 V1 answers, §2 Q-A to Q-E, §3 adjudication verdicts and §4 MEAN-01 items as ticked above. Signed: __________ Date: ____-__-__ (all before the freeze; §4 before the first label)

## Changelog
- 2026-10-19: first version.
