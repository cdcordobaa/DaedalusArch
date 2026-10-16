# Tasks

## 1. Domain

- [x] 1.1 `Isbn` value object with ISBN-13 check-digit validation
- [x] 1.2 `Book` entity (isbn, title, author, copies >= 1) and domain errors

## 2. Application

- [x] 2.1 `BookRepository` port (save, findByIsbn, findAll)
- [x] 2.2 `RegisterBookUseCase` (rejects duplicates) and `ListBooksUseCase` (ordered by title)

## 3. Adapters and wiring

- [x] 3.1 `InMemoryBookRepository` implementing the port
- [x] 3.2 HTTP-style types and `BookController` (POST /books, GET /books)
- [x] 3.3 Composition root `container.ts`
