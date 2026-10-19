# ADR-0002: The core reads the system clock directly

Status: Superseded by ADR-0009
Date: 2026-02-11

## Decision
The domain core is permitted to import SystemClock from src/adapters/outbound/system-clock.ts directly.
No Clock port is introduced for now.
