# Proposal: add-book-catalog

## Why

The library-loans service needs a catalogue before anything can be lent: librarians must be able to register the
books the library owns and see which copies exist. This first change also fixes the service's architecture, so every
later change has a stated structure to follow.

## What Changes

- Register a book (ISBN, title, author, number of copies); reject an invalid ISBN and a duplicate ISBN.
- List the catalogue, ordered by title.
- An HTTP-style inbound adapter for both operations and an in-memory store for books.
- The service's hexagonal architecture is stated in `design.md` (## Architecture) and becomes the DaedalusArch spec.

## Capabilities

### New Capabilities
- `book-catalog`: registering books and listing the catalogue.

### Modified Capabilities

## Impact

- New code under `src/` (domain, application, adapters, config). No external dependency.
- `.daedalus/architecture.yaml` is generated from this change's design.
