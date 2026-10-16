# membership Specification

## Purpose
Keeps the library's members, so that loans can be recorded against a known person with a borrowing limit.

## Requirements

### Requirement: Register a member
The system SHALL register a member with a non-empty name and a valid e-mail address, assign the member an id, and
SHALL reject an e-mail address that is already used by another member.

#### Scenario: Member is registered
- **WHEN** a librarian registers "Ada Lovelace", ada@example.org
- **THEN** the member gets an id and a borrowing limit of 3

#### Scenario: Duplicate e-mail is rejected
- **WHEN** a librarian registers a second member with ada@example.org
- **THEN** the request fails with a duplicate-member error

### Requirement: Read a member
The system SHALL return a member by id, and SHALL answer not-found for an unknown id.

#### Scenario: Unknown member
- **WHEN** member id "m-999" is requested
- **THEN** the answer is not-found
