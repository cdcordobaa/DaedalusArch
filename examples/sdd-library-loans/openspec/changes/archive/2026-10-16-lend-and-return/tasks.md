# Tasks

## 1. Domain

- [x] 1.1 `Loan` aggregate (open with 21-day due date, return once) and lending errors

## 2. Application

- [x] 2.1 `LoanRepository` port (nextId, save, findById, findOpenByMember, countOpenByIsbn, countOpenByMember)
- [x] 2.2 `LendBookUseCase` (availability and borrowing limit), `ReturnBookUseCase`, `ListMemberLoansUseCase`

## 3. Adapters and wiring

- [x] 3.1 `InMemoryLoanRepository`
- [x] 3.2 `LoanController` (POST /loans, POST /loans/:id/return, GET /members/:id/loans) and container wiring
