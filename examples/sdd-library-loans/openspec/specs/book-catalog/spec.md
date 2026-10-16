# book-catalog Specification

## Purpose
Lets librarians register the books the library owns and list the catalogue, so copies can later be lent.

## Requirements

### Requirement: Register a book
The system SHALL register a book with an ISBN-13, a title, an author and a number of copies of at least one, and
SHALL reject an ISBN that is not a valid ISBN-13 or that is already registered.

#### Scenario: Valid book is registered
- **WHEN** a librarian registers ISBN 9780132350884, "Clean Code", "Robert C. Martin", 2 copies
- **THEN** the book is in the catalogue with 2 copies

#### Scenario: Invalid ISBN is rejected
- **WHEN** a librarian registers ISBN 9780132350880
- **THEN** the request fails with an invalid-ISBN error and the catalogue is unchanged

#### Scenario: Duplicate ISBN is rejected
- **WHEN** a librarian registers an ISBN that is already in the catalogue
- **THEN** the request fails with a duplicate-book error

### Requirement: List the catalogue
The system SHALL list every registered book with its ISBN, title, author and copies, ordered by title.

#### Scenario: Catalogue is listed by title
- **WHEN** "Refactoring" and "Clean Code" are registered and the catalogue is listed
- **THEN** "Clean Code" comes before "Refactoring"
