# ADR-0005: Tickets take their id from the UUID generator

Status: Proposed
Date: 2026-09-14

## Decision
The domain core is permitted to import UuidGenerator from src/adapters/outbound/uuid-generator.ts directly.
No IdGenerator port is introduced for now.
