# FF-CV03 naming-repos: construct question (for the author)

**2026-10-16. Status: open, for the author.** Found by the agent-proof run (`Docs/v1.3/agent-proof-2026-10-16.md`, defect 1, PR #156). No code is changed for it. The fix is in frozen template text, so it is the author's call.

## The defect

FF-CV03 flags `DoctorUtilizationReportUseCase` (`src/application/doctor-utilization-report.ts`) with
`class DoctorUtilizationReportUseCase does not match the naming pattern "*Repository|*Repo"`. The class is not a repository. "Report" contains "Repo".

## Where the pattern is built

FF-CV03 has two parts:

1. **Selection: which classes the rule checks.** This is template text, in `src/fitness-compiler/cypher-templates.ts` (`naming-repos`):
   ```cypher
   MATCH (c:Class)
   WHERE (c.name CONTAINS 'Repository' OR c.name CONTAINS 'Repo')
     AND NOT c.name =~ $pattern /*EXCLUDE:c*/
   ```
   The MCP fast path copies the same selection in `src/mcp-server/file-check.ts` (`selectedByNaming`: `cls.name.includes('Repository') || cls.name.includes('Repo')`).
2. **Conformance: the name the selected class must have.** This is the `$pattern` binding. The spec's `pattern: "*Repository|*Repo"` goes through `compilePattern` (`src/fitness-compiler/pattern-compiler.ts`) and becomes `^(?:.*Repository|.*Repo)$`.

The binding is already anchored to the suffix. The false positive comes from the selection (`CONTAINS 'Repo'`), not from the regex. A word-boundary or suffix-anchored `$pattern` does not help: the class is still selected, and it still does not end in `Repo`.

## Why the binding is not changed here

The only change that stays in the binding is to OR an exemption into `$pattern`, for example
`^(?:.*Repository|.*Repo)$|^(?!.*Repo(?:sitory)?(?![a-z])).*$` ("follows the suffix, or has no `Repo` token").
After that change, `$pattern` would no longer be the spec's naming pattern. It would also carry a second selection rule. That changes the construct while keeping the template text the same, which is the change the frozen-template rule exists to stop. It is not done.

`src/fitness-compiler/v13-role-names.ts` makes the same call on purpose. The v1.3 role-token rewrite (a role matches only at a camel-case token boundary) is applied to FF-P03 and others. It is **not** applied to FF-CV02 or FF-CV03, because "their construct is the name itself". This defect is a cost of that decision.

## Evidence on the 71-case development set

The default results already contain this false positive twice (`results/v1.3-reference/after-member-facts/raw/`):

| Variant | Kind | Expected findings | FF-CV03 emitted on |
|---|---|---|---|
| clean-architecture `n02-report-writer-named-like-repo` | near-miss | none | `infrastructure/http/CsvReportWriter.ts` |
| layered `n02-reporting-service-reads-database` | near-miss | none | `business/services/SalesReportService.ts` |

The clean-architecture near-miss was built to test exactly this ("its name contains "Repo" (Report) but it is not a repository", `Docs/v1.3-reference-notes.md` §4). FF-CV03 is advisory (`src/scoring-engine/rule-tiers.ts`), so it does not change a verdict. It does add noise to the findings. Any fix removes these two rows, so the default results would change. **A fix therefore has to be behind a compile option** (like `V13_COMPILE_OPTIONS.roleTokens`), or the author has to accept that the reference results change.

## Question

**Which classes does FF-CV03 (and, in the same way, FF-CV02 naming-services) check?**

**Options.**
- **A: every class whose name contains the role word (status quo).** *Reason:* the template is frozen as written, and the rule is advisory. False positives: `…Report…`, `…Reporter`, `…Repos`.
- **B: classes whose name has the role word as a camel-case token,** `Repo(sitory)?` followed by an upper-case letter, a digit or the end of the name. The selection is still not by suffix, so `OrderRepoImpl2` and `UserRepositoryHelper` are still selected and checked. `CsvReportWriter`, `SalesReportService` and `DoctorUtilizationReportUseCase` are no longer selected. *Implementation:* a v1.3 compile-time rewrite of the selection text (the same mechanism as `V13_ROLE_NAME_REWRITES`; the template text is not edited, and v1.2E compiles it unchanged), plus the same predicate in `file-check.ts` `selectedByNaming`. This is gated behind a compile option, so the default stays byte-identical until the author enables it.
- **C: selection by suffix.** Rejected in `v13-role-names.ts`, because a suffix selection makes a suffix check vacuous.

**Recommendation: B**, behind a compile option. It keeps what the rule is for (a class that says it is a repository has to say so in the conventional form). It also drops the case the reference set itself marks as a near-miss.

**Effect on the development set.**
- A: no change.
- B: two FF-CV03 rows fewer (the two variants above); no verdict changes (advisory).

[Answer]:
