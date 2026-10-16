# overdue-report Specification

## Purpose
Shows librarians which loans are past their due date and whom to contact, oldest debt first.

## Requirements

### Requirement: Overdue loans report
The system SHALL list every open loan whose due date is before the report date, with ISBN, book title, member name,
member e-mail, due date and whole days late, sorted by days late, most first. Returned loans SHALL NOT appear.

#### Scenario: One overdue loan
- **WHEN** a loan was due on 2026-10-22 and the report is run as of 2026-10-30
- **THEN** the report lists that loan with 8 days late

#### Scenario: Returned loans are not reported
- **WHEN** a loan due on 2026-10-22 was returned on 2026-10-25 and the report is run as of 2026-10-30
- **THEN** the report does not list it

#### Scenario: Oldest debt first
- **WHEN** two loans are 3 and 10 days late
- **THEN** the 10-day loan comes first
