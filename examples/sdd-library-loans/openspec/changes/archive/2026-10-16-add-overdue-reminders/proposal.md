# Proposal: add-overdue-reminders

## Why

The overdue report tells librarians whom to chase; most of that chasing is a routine e-mail. The service should send
the reminder itself, once a day, and not remind the same member about the same loan more than once a week.

## What Changes

- A daily job sends one reminder per overdue loan, with the book title and days late.
- A loan is reminded again only after 7 days.
- The job is a new kind of inbound adapter (time-driven, not request-driven).

## Capabilities

### New Capabilities
- `overdue-reminders`: sending reminders for overdue loans.

### Modified Capabilities

## Impact

- New use case, a `Notifier` port with a console adapter, a scheduled-job adapter, and a new layer for scheduled
  jobs in the architecture (design.md).
