# overdue-reminders Specification

## Purpose
Reminds members by e-mail about loans past their due date, at most once a week per loan.

## Requirements

### Requirement: Send overdue reminders
The system SHALL, when the reminder job runs, send one reminder for every overdue open loan to the member's e-mail,
naming the book title and the days late, unless a reminder for that loan was sent less than 7 days earlier.

#### Scenario: First reminder
- **WHEN** the job runs on 2026-10-30 and a loan was due on 2026-10-22 with no reminder sent
- **THEN** one reminder is sent to the member, saying 8 days late

#### Scenario: No second reminder within a week
- **WHEN** the job runs again on 2026-11-02 for the same loan
- **THEN** no reminder is sent for that loan

#### Scenario: Reminder again after a week
- **WHEN** the job runs on 2026-11-06 for the same loan
- **THEN** a second reminder is sent
