# P4 `p4-library-holds`: the store does not call up (DEV split, positive control)

**Family:** H7 in its layered form: an upward dependency (persistence → business), a layer cycle.
**Instrument visibility:** visible (verified, `../../verification.json`): one new correct FF-S01 finding on the trap,
none on the clean tree. This is the **positive control**: if the `mcp` arm does not beat `none` here, the tool does
not help even where it sees the violation. **Rung 1** (T 1, S 3, Dst 1, Pd 0, Dx 0).

## The seed

Layered: `presentation` (controller) → `business` (services, rules) → `persistence` (gateways, records). The nightly
batch that flags overdue loans lives in `LoanGateway.markOverdue` (a bulk update, as a SQL `UPDATE` would be).
`MemberService.suspend(memberId, reason)` already does what a suspension means (flag, notice, idempotent), and staff
use it.

## The trap line (`solutions/trap/`)

1. `overdue-suspends`: inside the gateway's loop, where each loan is flagged, call
   `new MemberService(new MemberGateway(this.db)).suspend(...)`: one line, and it reuses the exact suspension
   behaviour the request asks for. The store now imports the business layer. **H7 (layered).**
2. and 3. are the same as the clean line (they land in the business layer either way).

## The winning line (order matters)

1. **First** change the store's batch to return the loans it flagged (`LoanRecord[]` instead of a count). **Then**
   `LoanService.nightly` suspends each flagged loan's member through `MemberService` and returns the count.
2. `LoanService.returnBook` reinstates when the returned loan was overdue and no overdue loan remains.
3. `LoanService.openLoans` sorts by due day.

## Oracle (`oracle.ts`)

- **SG1:** no import from a lower layer to a higher one (presentation 3, business 2, persistence 1) and no
  file-level import cycle under `src/`.
