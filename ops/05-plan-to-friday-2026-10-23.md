# Plan to Friday 2026-10-23: Study 2a done, Study 2b run and scored

The author's deadline, set 2026-10-20. Times are Bogotá. The author takes no more signatures: the remaining author items are delegated (see `decisions.md`, DELEG). The single touchpoint left is the **go for the 2b run after the gate**, per the run-once rule.

| Day | Work | Status |
|---|---|---|
| Tue 20 | 2a `mcp@L2`, after the Claude S4 probe with MCP | **done** 2026-10-20 (`Docs/DiagnosticRuns/v1.4-claude-s4-mcp-2026-10-20.md`; `Docs/DiagnosticRuns/v1.4-exploratory-report-2026-10-20.md`) |
| Tue 20 | Q10 = D re-apply and dev re-run; merge PR #305 | **done**, #305 merged 2026-10-20 (DELEG-Q10) |
| Tue 20 | Stage B results PR #306; exposure registration PR #307 | **done**, both merged 2026-10-20 |
| Tue 20 | Build the per-rule exposure count (zero calls) | **done** (`scripts/v1.4/exposure-count.ts`, a registered 2b artefact) |
| Tue 20 | Stage C zero-call scoring of A and B | **done** (2a report) |
| Wed 21 | Delegated freeze items: ADR-V13-03 accepted under delegation; sample hash recorded; V6 pointers (not needed before the run) | **done** 2026-10-20 (DELEG2) |
| Wed 21 | Freeze tag; hold-out once on one capped Neo4j | freeze tag `v1.4-freeze-2026-10-20` **done** (`Docs/DiagnosticRuns/v1.4-freeze-2026-10-20.md`). Hold-out **not scored**: three attempts on 2026-10-20, not spent (DELEG-H4); fallback F-RF applied to 2b |
| Wed 21 | Stage C semantic scoring (C1d, C4): Gemini API-key route, declared | **done on a Claude configuration instead** (Amendment 2; `Docs/DiagnosticRuns/v1.4-exploratory-semantic-claude-2026-10-20.md`): C1d reached its cap after 8 of 12 snapshots; C4 ran on 17 identities. The Gemini arm waits for the quota |
| Wed 21 | 2a report; 2b pre-registration from 2a's variance; Fable adversarial review | **done** 2026-10-20: pre-registration registered 12:36:37Z after the Fable re-checks (`Docs/v1.4/study2b-preregistration.md:5`); OSF osf.io/wctnh |
| Thu 22 | Dress rehearsal (practice tasks only); readiness gate | **done** 2026-10-20 (`Docs/v1.4/study2b-gate-verdict.md`, GO-READY-FOR-AUTHOR) |
| Thu 22 | **Author go**, then the 2b run: 4 sealed Layered tasks × 3 cells, Claude Sonnet, about 104 turns, one lane *(as planned on 2026-10-20; superseded before the pre-registration was dated: N = 40, **520 step turns, cap 780, two lanes**, DELEG7 and DELEG9)* | **done**: go recorded 2026-10-20 (GO-2B-RUN); collected 2026-10-20T19:07Z to 2026-10-21T02:17Z, 520 turns, 0 redraws (`Docs/DiagnosticRuns/v1.4-study2b-collection-2026-10-20.md`) |
| Fri 23 | Score 2b at the freeze tag; report; claims ledger | scoring **done** 2026-10-21, one pass (`Docs/DiagnosticRuns/v1.4-study2b-results-2026-10-21.md`, PR #339); claims ledger **done** (PR #340, C8035–C8064); the full report is open |

Declared changes, made to meet the date:
- 2b runs Claude-only. Gemini becomes a dated extension arm after its quota resets (about 2026-10-25), provided it passes S4.
- Zero-call writing goes to cloud routines.
- The machine limits stand: two lanes, one capped Neo4j.

Risks:
- **The Claude S4 with MCP fails:** about half a day to fix, and the slack is gone.
- **The hold-out is weak:** report it as a limitation; 2b still runs.

## Left for Friday (added 2026-10-21)
1. **C4 pilot** (pairs 1–2: 8 calls, cap 16), then the **six-case set** (32 calls, cap 64), against the sem-01 bars. If both pass, **D_sem** on 2b, descriptive; otherwise D_sem is reported "not run" (`Docs/DiagnosticRuns/v1.4-study2b-results-2026-10-21.md` §5; DELEG11).
2. **The 2b report** and its chapter section.
3. **The director brief.**

Outcome of the risks: the Claude S4 with MCP passed on its second run (all 9 MCP-arm probes and the 5 no-MCP probes, `Docs/DiagnosticRuns/v1.4-claude-s4-mcp-2026-10-20.md:72`); the hold-out gave no figure, was reported as a limitation, and 2b ran.

## Changelog
- 2026-10-21: progress ticks for everything done; the turn budget corrected to the registered 520 step turns (cap 780, two lanes; DELEG7, DELEG9), with the 104-turn plan kept as written; the Friday remainder added. Fixes conflict 7 of `06-open-tracks-and-capabilities.md`.
