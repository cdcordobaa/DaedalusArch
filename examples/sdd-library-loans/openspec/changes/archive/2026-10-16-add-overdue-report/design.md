# Design: add-overdue-report

## Context

See proposal.md. The loans live behind `LoanRepository`, which already has six methods; the last full evaluation
flagged it under the interface-segregation proxy (FF-SO02, advisory: more than 5 methods).

## Goals / Non-Goals

**Goals:**
- One report use case, `OverdueReportUseCase`, that joins loans, books and members.

**Non-Goals:**
- Paging, export formats, notifications (next change).

## Decisions

- **Read path for the report: a read-only port `OverdueLoansQuery`** (`findOpenDueBefore(at)`), in
  `src/application/ports/`, implemented by `InMemoryLoanRepository` beside `LoanRepository`. The report use case
  depends on the port only. Rejected: (a) a seventh method on `LoanRepository`, which the evaluation already calls too
  wide (FF-SO02); (b) the first version of this design, the use case taking `InMemoryLoanRepository` directly, which
  breaks the architecture of add-book-catalog (application may import domain only; DaedalusArch check_file answered
  FF-S01, blocking). The filter (open and due before the date) moves into the adapter, where a real store would run it
  as a query.
- **Days late** are whole days between the due date and the report date (floor), computed in the use case.
- **Report date** comes from the request (`asOf`) or the `Clock` port.

## Risks / Trade-offs

- [Two ports on one adapter] → the composition root passes the same instance twice; that is the intent.
