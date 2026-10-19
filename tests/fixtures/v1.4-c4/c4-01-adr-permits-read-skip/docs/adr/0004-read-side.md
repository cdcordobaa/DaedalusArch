# ADR-0004: The read side bypasses the business layer

Status: Accepted
Date: 2026-03-02

## Context
Order listings are read-only and carry no business rule. Routing them through OrderService adds a pass-through method per query.

## Decision
Controllers may query read repositories directly.
The exception covers OrderReadRepository only; writes still go through the business layer.

## Consequences
The presentation layer imports src/persistence/order-read.repository.ts.
