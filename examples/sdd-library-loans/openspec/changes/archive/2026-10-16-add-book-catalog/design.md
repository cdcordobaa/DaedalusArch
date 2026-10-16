# Design: add-book-catalog

## Context

First change of the service; there is no code yet. See proposal.md for the motivation. The service must run without
any external dependency, so persistence is in memory and the transport is a minimal HTTP-style request/response pair.

## Goals / Non-Goals

**Goals:**
- Fix the architecture every later change follows, in a form a tool can check.
- Keep business rules (ISBN validity, copies >= 1) in the domain, independent of transport and storage.

**Non-Goals:**
- A real HTTP server or database.

## Architecture

Style: hexagonal

### Layers

| Layer | Kind | Directories | Roles |
|---|---|---|---|
| domain | domain | `src/domain/**` | entity, value-object, domain-service |
| application | application | `src/application/**` | use-case, port |
| adapters-inbound | presentation | `src/adapters/inbound/**` | controller |
| adapters-outbound | infrastructure | `src/adapters/outbound/**` | repository, gateway |
| config | application | `src/config/**` | composition-root |

### Allowed dependencies

- application -> domain
- adapters-inbound -> application, domain
- adapters-outbound -> application, domain
- config -> domain, application, adapters-inbound, adapters-outbound

### Forbidden in domain

- `express`
- `@nestjs/*`
- `typeorm`
- `prisma`
- `@prisma/*`
- `pg`

## Decisions

- **Ports in the application layer** (`src/application/ports/`): the use cases own the interfaces they need
  (`BookRepository`); the outbound adapter implements them. Alternative: ports in the domain. Rejected because the
  ports here are use-case driven, not domain concepts.
- **Isbn value object** validates the ISBN-13 check digit in its factory, so an invalid ISBN cannot exist in the
  domain.
- **Inbound adapter without a framework**: `BookController` maps an `HttpRequest` to a use case and the result to an
  `HttpResponse` (status, body). Errors from the domain map to 400 and 409.
- **Composition root** (`src/config/container.ts`) is the only place that instantiates adapters.

## Risks / Trade-offs

- [In-memory store loses data on restart] → acceptable for the demo; the port keeps a real store a one-file change.
