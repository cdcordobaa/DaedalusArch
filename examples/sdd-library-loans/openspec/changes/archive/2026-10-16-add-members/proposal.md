# Proposal: add-members

## Why

Books are lent to members. Before lending exists, the library needs to register its members and know whether a
member is allowed to borrow.

## What Changes

- Register a member (name, e-mail); reject an invalid or already used e-mail.
- Look a member up by id.
- Each member has a borrowing limit of 3 concurrent loans (used by the lending change).

## Capabilities

### New Capabilities
- `membership`: registering members and reading a member.

### Modified Capabilities

## Impact

- New domain entity, port, use cases, controller and in-memory adapter. The architecture is unchanged, so this change
  has no design.md: the archived design of add-book-catalog still states it.
