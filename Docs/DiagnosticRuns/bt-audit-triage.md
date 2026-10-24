
## Revision 2026-10-24

- **body-parser GHSA-27r3-jxmh-p828 (high):** fixed. The lockfile moves body-parser 2.3.0 to 2.4.0 (with qs 6.16.1) within the existing semver ranges, and no other package changes.
- **zod GHSA-mrhx-c7xc-m3w5 (high):** accepted as a residual risk, recorded in `scripts/lib/audit-allowlist.json`. The fix needs zod 4, a semver-major change to the frozen instrument's MCP server. Inputs come from the local agent over stdio, and the worst case is a local denial of service.
