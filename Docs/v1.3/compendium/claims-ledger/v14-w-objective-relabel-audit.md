# Claims ledger, part: 2026-10-25 sync: the synthesis objective relabel and the bt audit triage

Part of [the claims ledger](../claims-ledger.md); the legend and the conflicts are there. Added 2026-10-25 by the daily thesis sync, from `origin/main` at `07da8fdb` (PR #378). Rows are sorted by source line within each document. 3 claims (C10207–C10209).

Primaries: `Docs/DiagnosticRuns/v1.5-exploratory-synthesis-2026-10-23.md` §4 as revised on 2026-10-24 (objective numbering now follows the thesis objectives table; the first version of the table, which put Study 2b under SO1 and SO2, is superseded by the page itself and was never a ledger row), and `Docs/DiagnosticRuns/bt-audit-triage.md` (revision 2026-10-24), checked against the `package-lock.json` diff and `scripts/lib/audit-allowlist.json`. No new measurement; PR #378 made zero model calls.

### `Docs/DiagnosticRuns/v1.5-exploratory-synthesis-2026-10-23.md`

| id | statement | numbers | source | type | set | status | replication | quantity | verified against | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| C10207 | / SO5 spec information changes agent-built architecture / Study 2b results, scoped to FF-S03, Layered, 4 tasks (with Study 1) / | `4 tasks` | `Docs/DiagnosticRuns/v1.5-exploratory-synthesis-2026-10-23.md:62` | descriptive | sealed-2b | established | — | objective that Study 2b's confirmatory result supports | Docs/DiagnosticRuns/v1.4-study2b-results-2026-10-21.md (4 sealed Layered tasks, FF-S03; via C9235) | relabel of 2026-10-24: the first version of this table put Study 2b under SO1 and SO2; the thesis objective it bears on is SO5 |

### `Docs/DiagnosticRuns/bt-audit-triage.md`

| id | statement | numbers | source | type | set | status | replication | quantity | verified against | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| C10208 | body-parser GHSA-27r3-jxmh-p828 (high): fixed. The lockfile moves body-parser 2.3.0 to 2.4.0 (with qs 6.16.1) | `2.3.0 to 2.4.0` ; `qs 6.16.1` | `Docs/DiagnosticRuns/bt-audit-triage.md:4` | descriptive | none | established | — | body-parser and qs versions after the fix | package-lock.json diff 71d2cecd..07da8fdb (body-parser 2.3.0 → 2.4.0, qs 6.16.0 → 6.16.1) | tooling hygiene; not evidence for any objective |
| C10209 | zod GHSA-mrhx-c7xc-m3w5 (high): accepted as a residual risk ... The fix needs zod 4, a semver-major change to the frozen instrument's MCP server. | `zod 4` | `Docs/DiagnosticRuns/bt-audit-triage.md:5` | descriptive | none | established | — | zod advisory disposition | scripts/lib/audit-allowlist.json (GHSA-mrhx-c7xc-m3w5, accepted-residual, triaged 2026-10-24) | worst case a local denial of service of the stdio MCP server; see M257 |
