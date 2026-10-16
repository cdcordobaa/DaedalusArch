# Proposal: add-overdue-report

## Why

Librarians chase late books by hand. They need a report of every loan past its due date, with the member to contact
and how many days late it is, sorted so the oldest debts come first.

## What Changes

- A report of overdue loans as of a date (default: today): ISBN, title, member name and e-mail, due date, days late.
- An HTTP endpoint `GET /reports/overdue?asOf=YYYY-MM-DD`.

## Capabilities

### New Capabilities
- `overdue-report`: the list of loans past their due date.

### Modified Capabilities

## Impact

- New report use case and controller. Reads loans, books and members.
