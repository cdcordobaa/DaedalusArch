# ADR-0009: A Clock port for the core

Status: Accepted
Date: 2026-07-30
Supersedes: ADR-0002

## Decision
The domain core must not import SystemClock or any other adapter. It depends on a Clock port in src/domain, which the outbound adapter implements.
