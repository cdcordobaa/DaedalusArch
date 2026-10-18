# Decisions

The working copy is the decision board, a private claude.ai artifact the author uses. This file is the record kept in the repo. Each settled item is also logged, with its date, in `aidlc-docs/audit.md`. The ids match the board. The context and options behind each item are in [`01-instrument-map.md`](01-instrument-map.md) (v3) and [`02-defensibility-conditions.md`](02-defensibility-conditions.md).

---

## Still open (yours)

- **L4: what counts as a meaningful finding.** Choose between the practitioner reading ("a competent developer of that style would ask for it to change in review") and the style-fidelity reading. My recommendation is the practitioner reading, with the style-fidelity question kept as a second field on each label. It blocks the codebook, and with it the rater's labels (D3).
- **D1: the changes.** You chose "confirm the decision sheet *with changes*". Write the changes below, or on the board's D1 note. Until they arrive, nothing that depends on the sheet moves.
- **NS01: read NS-01.** It blocks the 2-case pilot.

> AUTHOR: (D1 changes here)

---

## Settled on 2026-10-18 (decision board, v2)

**These differ from my recommendation**, so each one comes with the work it creates:

| Id | Decision | Work it creates |
|---|---|---|
| **M3** | **Study 2 is redesigned around drift.** Confirmed in chat, knowing that the registered simulation puts trend outcomes at power ≤ 0.08 | A design note first (working mode). Then a new primary outcome, a new power simulation, and updates to the deviation record and readiness gate before the freeze, all taken to the director at design stage |
| **M5** | The efficiency test (graph tools vs raw files) becomes a thesis result | A design note: fixed questions, repo sizes, tool sets and caps, a call count, and a falsifier |
| **D2b** | Layered keeps counting wiring-code imports; no composition slot | Keeps the base rate at 5.33 and the power. The count includes imports from correct wiring code, and this is stated as a construct limit |
| **D5** | DDD gets a declared post-seal cycle rule, with an ADR | An ADR plus the rule. It counts as a deviation and changes the tiers Study 2 is scored on |
| **N3** | Q26, application purity, is added as a declared post-seal rule, with an ADR | An ADR plus the rule. The 12 framework-leak seeds become rule hits, and the K-tally is redone |
| **D1** | Confirm the decision sheet, with changes | The changes are still to come (see above) |

**These match my recommendation:**
- **D2a:** run F23 now.
- **D3:** the free rater labels meaning on about 60 findings, plus the K3 cases. Confirmed in chat.
- **M1:** the claim is F1–F3 plus Study 2. Tacit knowledge goes in the discussion. Confirmed in chat.
- **M2:** confirmatory claims only where norms are declared (greenfield). Changed in chat from "both".
- **M4:** the model interprets before detection, as facts.
- **M6:** pre-register an evasion check.
- **N1:** the model supplies facts, not verdicts.
- **N2:** report complementarity by knowledge level.
- **N4:** the fragmentation check works within one bounded context.
- **V4:** an ADR redefines V4 per Study 2 style, if the count shows a shortfall.
- **CDX:** register Gemini as the Codex substitute, with its own S4 probe.
- **PRE:** pre-register on OSF with an embargo.
- **S2S:** keep the registered rule, and let the pilot decide DDD.
- **D6:** register Link 1 as matched to the compiler.
- **D7:** keep `ops/` in the public repo and commit it.

Settled earlier: **D4**, the thinking note first (NS-01).

**Post-seal changes now pending: M3, D5, N3 (and V4 if the count triggers it).** Each one is a declared deviation. The examiner review flags the count of deviations as a risk in its own right. I'll write them up together as one dated list, so the director sees all of them at once.

## Changelog
- 2026-10-18: all board decisions recorded except L4, plus the D1 changes. M2, M3, D3 and M1 were confirmed in chat.
- 2026-10-18: D4 settled.
- 2026-10-18: first version, D1–D7.
