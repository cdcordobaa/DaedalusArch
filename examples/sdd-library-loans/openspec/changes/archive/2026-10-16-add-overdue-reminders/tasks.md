# Tasks

## 1. Application

- [x] 1.1 `loanId` on `OverdueLine`
- [x] 1.2 Ports `Notifier` (send) and `ReminderLog` (lastSent, record)
- [x] 1.3 `SendOverdueRemindersUseCase` (7-day rule)

## 2. Adapters and wiring

- [x] 2.1 `ConsoleNotifier`, `InMemoryReminderLog`
- [x] 2.2 `OverdueReminderJob` in `src/adapters/scheduled/`
- [x] 2.3 Wire the job in the container
