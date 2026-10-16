# Design: lend-and-return

## Context

See proposal.md. The architecture of add-book-catalog applies unchanged (this design has no Architecture section).

## Goals / Non-Goals

**Goals:**
- The lending rules (availability, borrowing limit, return once) are checked in one place.

**Non-Goals:**
- Reservations, renewals, fines.

## Decisions

- **`Loan` is its own aggregate** (id, isbn, memberId, loanedAt, dueAt, returnedAt). `Loan.open` computes the due date
  (21 days) and `loan.return(at)` refuses a second return. Alternative: loans inside `Member`. Rejected: it would load
  a member's whole history to lend one book.
- **Availability is counted, not stored**: copies minus open loans for the ISBN, read through the `LoanRepository`
  port (`countOpenByIsbn`, `countOpenByMember`). No copy counter to keep in sync.
- Dates are passed as `Date` values; the domain does not read the system clock.

## Risks / Trade-offs

- [Two concurrent lends of the last copy] → acceptable for the in-memory demo; a real store needs a transaction.
