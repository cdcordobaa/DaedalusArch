# Design: add-overdue-reminders

## Context

See proposal.md. Reminders reuse the overdue report's read path (`OverdueReportUseCase`) and need a way to send
mail and to remember when each loan was last reminded.

## Goals / Non-Goals

**Goals:**
- A time-driven entry point that is an adapter like the HTTP controllers, not a special case in the composition root.

**Non-Goals:**
- A real scheduler or mail server: the job exposes `runOnce()`; the demo prints mails to the console.

## Architecture

The architecture of add-book-catalog stays; this change adds one inbound layer for time-driven jobs.

### Layers

| Layer | Kind | Directories | Roles |
|---|---|---|---|
| adapters-scheduled | presentation | `src/adapters/scheduled/**` | scheduled-job |

### Allowed dependencies

- adapters-scheduled -> application, domain
- config -> adapters-scheduled

## Decisions

- **`SendOverdueRemindersUseCase`** (application) calls `OverdueReportUseCase` for the overdue lines and a
  `Notifier` port to send. Alternative: re-query loans. Rejected: one definition of "overdue".
- **`ReminderLog` port** records the last reminder per loan; in memory for the demo.
- **Ports `Notifier` and `ReminderLog`** in `src/application/ports/`; adapters `ConsoleNotifier` and
  `InMemoryReminderLog` in `src/adapters/outbound/`.
- **`OverdueReminderJob`** in `src/adapters/scheduled/` calls the use case with the clock's date.

## Risks / Trade-offs

- [The overdue lines carry no loan id, but the reminder log is per loan] → add `loanId` to `OverdueLine`.
