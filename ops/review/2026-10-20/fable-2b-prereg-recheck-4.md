# Fable re-check 4 of the Study 2b pre-registration: confirmation (2026-10-20)

Both fixes are in `Docs/v1.4/study2b-preregistration.md` §4 "Semantic layer", and the edit introduced nothing contradictory.

- **Fix 1 (second reading rule).** Line 263 now reads: if the two D_sem versions "disagree in the Holm decision or (for a rejection) the sign of T", report "semantic reading sensitive to agent-written justifications" (`agentJustificationReading`). This matches `scripts/v1.4/lib/study2b-analyse.ts:306`, where agreement is `a.reject === b.reject && (!a.reject || sign equal)`, and the reported string at line 307. It is also consistent with the first reading rule's "for a rejection, the sign" clause on the same line and with the D/D† rule at line 26.
- **Fix 2 (commit timing).** Line 260 commits the provenance classifier "before the first 2b call", and line 264 commits the D_sem writer "before the first 2b call", both citing sem-01 §6 and §8. That matches `ops/notes/sem-01-semantic-validity-plan.md` §6 row "Before the 2b run" and §8 item 1 "Before the run". No occurrence of "before the first C4 call" remains in the file. Line 277's "before any C4 call on 2b" refers to the pilot and six-case precondition, not to the code commit, so it does not conflict.

VERDICT: GO
