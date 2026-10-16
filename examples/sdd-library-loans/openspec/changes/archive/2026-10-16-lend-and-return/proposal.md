# Proposal: lend-and-return

## Why

The service exists to lend books. With books and members in place, librarians need to record a loan, its due date,
and its return, and the system must stop a loan that would break the rules (no copy left, member at the limit).

## What Changes

- Lend a book to a member for 21 days; refuse when no copy is available or the member has reached the limit.
- Return a loan; a loan cannot be returned twice.
- List a member's open loans.

## Capabilities

### New Capabilities
- `lending`: lending, returning and listing loans.

### Modified Capabilities

## Impact

- New `Loan` aggregate, `LoanRepository` port, three use cases, `LoanController`, in-memory adapter.
