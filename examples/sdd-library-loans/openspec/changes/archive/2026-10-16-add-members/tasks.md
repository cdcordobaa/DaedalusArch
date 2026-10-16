# Tasks

## 1. Domain

- [x] 1.1 `Member` entity (id, name, e-mail, borrowing limit 3) and `Email` value object

## 2. Application

- [x] 2.1 `MemberRepository` port (save, findById, findByEmail, nextId)
- [x] 2.2 `RegisterMemberUseCase` and `GetMemberUseCase`

## 3. Adapters and wiring

- [x] 3.1 `InMemoryMemberRepository`
- [x] 3.2 `MemberController` (POST /members, GET /members/:id) and wiring in the container
