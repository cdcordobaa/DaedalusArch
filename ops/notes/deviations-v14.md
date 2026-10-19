# Deviations after the seal: the v1.4 list

**Dated 2026-10-18.** This is the single dated list of the post-seal changes made or pending in v1.4, so the director sees all of them at once ([`../decisions.md`](../decisions.md), "Post-seal changes now pending"). Each row is a **declared deviation**: it changes something that was sealed or registered, after material was seen. The examiner review counts deviations as a risk in its own right ([`../01-instrument-map.md`](../01-instrument-map.md) risk 7), so nothing here is added silently.

This list records; it does not decide. The full text of each deviation lives in the linked record. Where this list and a record disagree, the record wins.

**Earlier deviation, for the count.** Study 2's primary outcome was switched to the level outcome Y on 2026-10-16 ([`Docs/v1.3/study2-deviation-2026-10-16.md`](../../Docs/v1.3/study2-deviation-2026-10-16.md)). It is deviation 0 below the line, and the rows here come after it.

## The list

| # | Id | Date | What changes | Decision | Record | Status |
|---|---|---|---|---|---|---|
| 1 | **ADR-V14-01** | 2026-10-18 | The DDD rule set gains FF-S02 (acyclic dependencies) as a post-seal rule. It changes the tiers Study 2 is scored on (N17; the blind key's ddd FF-S02 row) | D5 | [`Docs/v1.4/adr-v14.md`](../../Docs/v1.4/adr-v14.md#adr-v14-01-the-ddd-rule-set-gains-ff-s02-acyclic-dependencies-post-seal-d5), built in U2 ([summary](../../aidlc-docs/construction/v1.4/U2/code/summary.md)) | **Declared.** On main. The mechanism (Q-A) is Proposed |
| 2 | **ADR-V14-02** | 2026-10-18 | Application purity, FF-P07, is added as a post-seal rule for clean-architecture, hexagonal, nestjs and ddd (Q26). The 12 framework-leak seeds become rule hits, and the K-tally is redone | N3 | [`Docs/v1.4/adr-v14.md`](../../Docs/v1.4/adr-v14.md#adr-v14-02-application-purity-ff-p07-post-seal-n3-q26), tiers in [`Docs/v1.4/rule-tiers-post-seal.md`](../../Docs/v1.4/rule-tiers-post-seal.md), built in U2 | **Declared.** On main. The forbidden list (Q-B), the tiers (Q-C), the MCP fast path (Q-D) and the hold-out scope (Q-E) are author defaults, Proposed |
| 3 | **ADR-V14-03** | 2026-10-18 | The frozen report schema (`schemas/report.schema.json`) is amended, additively: `tierSource` gains `post-seal`, and the report gains optional `postSealRules` and `postSealAdded`. A report built with `--post-seal off` is byte-identical | follows from D5 and N3 (U2 verification) | [`Docs/v1.4/adr-v14.md`](../../Docs/v1.4/adr-v14.md#adr-v14-03-report-schema-amendment-for-the-post-seal-rules-v14-u2) | **Declared.** On main |
| 4 | **M3** | 2026-10-18 (decided); recorded 2026-10-19 | Study 2 is redesigned around drift. The primary becomes D, the new blocking identities at steps 2 to 5 from a shared step-1 tree; k = 5; three cells; new tasks; Claude Sonnet + Gemini; exploratory fallback | M3, plus the author's choices of 2026-10-19 | [`Docs/v1.4/study2-deviation-2026-10-19-drift.md`](../../Docs/v1.4/study2-deviation-2026-10-19-drift.md) (with REV-03's three changes); design [`s2d-01`](s2d-01-study2-drift-design.md) | **Declared.** It is the protocol's single source (`npm run lint:protocol`, 10 documents) |
| 5 | **D5** | 2026-10-18 | The DDD cycle rule, as decided on the board | D5 | Recorded as row 1 (ADR-V14-01) | **Declared** through row 1. Listed here so the board entry has its pointer |
| 6 | **N3** | 2026-10-18 | Application purity, as decided on the board | N3 | Recorded as row 2 (ADR-V14-02) | **Declared** through row 2. Listed here so the board entry has its pointer |
| 7 | V4 (conditional) | not triggered | An ADR redefines V4 per Study 2 style, only if the count shows a shortfall | V4 | [`../decisions.md`](../decisions.md) | **Not a deviation yet.** It becomes row 8 if the count triggers it |
| 8 | **CDX** | 2026-10-19 | Gemini replaces the Codex pin as Study 2's non-Claude generator (V10a) | CDX | The drift record §2 "Generators" | **Declared** |
| 9 | **Sealed list retired** | 2026-10-19 | The sealed Study 2 list is no longer the confirmatory task set. New tasks (4 Layered + 2 DDD) are written by a separate session and sealed at the freeze. S14 is restated | author, 2026-10-19 | The drift record §2 "Tasks" and "The sealed list" | **Declared** |
| 10 | **V5 timing** | 2026-10-19 | The independent rater's labels are collected after Study 2; they never feed the run. V6's definition is still dated before the first label | author, 2026-10-19 | The drift record §7 | **Declared** |
| 11 | **Sealed list read by an examiner model** | 2026-10-19 | For F23, a Claude-family examiner session read the sealed list (no tools, no saved transcript, verdict block only) | author, 2026-10-19 | `Docs/DiagnosticRuns/v1.3-f23-and-v4-count-2026-10-18.md` Part 3 | **Declared.** With row 9 the list is retired, so the read touches no confirmatory task |

**Count.** Three post-seal changes are declared (rows 1 to 3; rows 5 and 6 are the board ids of rows 1 and 2, not extra changes). One is decided but has no record yet (row 4). One is conditional (row 7). With the 2026-10-16 switch, Study 2 carries four deviations once M3 is written up.

## What each row still needs
- **Rows 1 and 2:** the author signs the Proposed parts (Q-A to Q-E). N17 can then be marked addressed by ADR-V14-01.
- **Row 3:** nothing beyond the ADR. Any further schema change reopens it.
- **Row 4:** the dated deviation record and its protocol block, taken to the director at design stage, before the freeze.

## Changelog
- 2026-10-18: first version. ADR-V14-01, ADR-V14-02 and ADR-V14-03 from `Docs/v1.4/adr-v14.md`; M3, D5 and N3 from the decision board.
