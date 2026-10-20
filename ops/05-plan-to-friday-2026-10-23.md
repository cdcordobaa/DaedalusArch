# Plan to Friday 2026-10-23: Study 2a done, Study 2b run and scored

The author's deadline, set 2026-10-20. Times are Bogotá. The author takes no more signatures: the remaining author items are delegated (see `decisions.md`, DELEG). The single touchpoint left is the **go for the 2b run after the gate**, per the run-once rule.

| Day | Work | Status |
|---|---|---|
| Tue 20 | 2a `mcp@L2`, after the Claude S4 probe with MCP | probe building |
| Tue 20 | Q10 = D re-apply and dev re-run; merge PR #305 | running |
| Tue 20 | Stage B results PR #306; exposure registration PR #307 | CI |
| Tue 20 | Build the per-rule exposure count (zero calls) | queued for a free lane |
| Tue 20 | Stage C zero-call scoring of A and B | after the freeze tag |
| Wed 21 | Delegated freeze items: ADR-V13-03 accepted under delegation; sample hash recorded; V6 pointers (not needed before the run) | after #305 |
| Wed 21 | Freeze tag; hold-out once on one capped Neo4j | |
| Wed 21 | Stage C semantic scoring (C1d, C4): Gemini API-key route, declared | |
| Wed 21 | 2a report; 2b pre-registration from 2a's variance; Fable adversarial review | |
| Thu 22 | Dress rehearsal (practice tasks only); readiness gate | |
| Thu 22 | **Author go**, then the 2b run: 4 sealed Layered tasks × 3 cells, Claude Sonnet, about 104 turns, one lane | |
| Fri 23 | Score 2b at the freeze tag; report; claims ledger | |

Declared changes, made to meet the date:
- 2b runs Claude-only. Gemini becomes a dated extension arm after its quota resets (about 2026-10-25), provided it passes S4.
- Zero-call writing goes to cloud routines.
- The machine limits stand: two lanes, one capped Neo4j.

Risks:
- **The Claude S4 with MCP fails:** about half a day to fix, and the slack is gone.
- **The hold-out is weak:** report it as a limitation; 2b still runs.
