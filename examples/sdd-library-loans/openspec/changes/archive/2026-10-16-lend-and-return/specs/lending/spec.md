# Spec Delta

## Purpose

Records which member holds which copy of a book, until when, and when it came back.

## ADDED Requirements

### Requirement: Lend a book
The system SHALL lend a book to a member for 21 days when at least one copy is not on loan and the member has fewer
open loans than the member's borrowing limit; otherwise it SHALL refuse the loan.

#### Scenario: Book is lent
- **WHEN** member m-1 borrows ISBN 9780132350884 on 2026-10-01 and a copy is available
- **THEN** a loan is open with due date 2026-10-22

#### Scenario: No copy available
- **WHEN** every copy of a book is on loan and a member asks to borrow it
- **THEN** the loan is refused with a no-copy-available error

#### Scenario: Member at the limit
- **WHEN** a member with 3 open loans asks to borrow a fourth book
- **THEN** the loan is refused with a borrowing-limit error

### Requirement: Return a book
The system SHALL close an open loan when the book is returned, recording the return date, and SHALL refuse to return
a loan that is already closed.

#### Scenario: Book is returned
- **WHEN** the loan is returned on 2026-10-10
- **THEN** the loan is closed with return date 2026-10-10 and the copy is available again

#### Scenario: Loan returned twice
- **WHEN** a closed loan is returned again
- **THEN** the request fails with an already-returned error

### Requirement: List a member's loans
The system SHALL list the open loans of a member with ISBN, loan date and due date.

#### Scenario: Open loans listed
- **WHEN** member m-1 has one open and one returned loan
- **THEN** only the open loan is listed
