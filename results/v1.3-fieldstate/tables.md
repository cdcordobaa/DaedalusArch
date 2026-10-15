### Edges per style (all variants)
| Style | Variants | FLOWS_TO | HOLDS_STATE_OF | declared-type (kept / any) | property-injection (kept / any) | initializer (kept / any) | constructor-new (kept / any) | constructor-param (kept / any) | Rest of graph unchanged |
|---|---|---|---|---|---|---|---|---|---|
| clean-architecture | 14 | 29 | 71 | 0 / 0 | 0 / 0 | 71 / 71 | 0 / 0 | 0 / 0 | 14/14 |
| layered | 13 | 13 | 13 | 0 / 0 | 0 / 0 | 13 / 13 | 0 / 0 | 0 / 0 | 13/13 |
| nestjs | 14 | 15 | 59 | 2 / 2 | 0 / 0 | 57 / 57 | 0 / 0 | 0 / 0 | 14/14 |
| hexagonal | 15 | 47 | 92 | 0 / 0 | 0 / 0 | 92 / 92 | 0 / 0 | 0 / 0 | 15/15 |
| ddd | 15 | 15 | 90 | 60 / 60 | 0 / 0 | 30 / 30 | 0 / 0 | 0 / 0 | 15/15 |

### FF-P06 field half: FLOWS_TO (frozen) vs HOLDS_STATE_OF (variant), styles where FF-P06 is enabled
| Style | Kind | Variants | Field rows FLOWS_TO | Field rows HOLDS_STATE_OF | CI rows | Expected FF-P06 variants | Caught FLOWS_TO | Caught HOLDS_STATE_OF | FP variants FLOWS_TO | FP variants HOLDS_STATE_OF |
|---|---|---|---|---|---|---|---|---|---|---|
| clean-architecture | clean | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| clean-architecture | near-miss | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| clean-architecture | violation | 10 | 1 | 1 | 0 | 1 | 1 | 1 | 0 | 0 |
| layered (v1.3 N/A style) | clean | 1 | 0 | 0 | 4 | 0 | 0 | 0 | 0 | 0 |
| layered (v1.3 N/A style) | near-miss | 3 | 0 | 0 | 13 | 0 | 0 | 0 | 0 | 0 |
| layered (v1.3 N/A style) | violation | 9 | 0 | 0 | 36 | 0 | 0 | 0 | 0 | 0 |
| nestjs | clean | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| nestjs | near-miss | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| nestjs | violation | 10 | 1 | 1 | 0 | 1 | 1 | 1 | 0 | 0 |
| hexagonal | clean | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| hexagonal | near-miss | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| hexagonal | violation | 11 | 1 | 1 | 0 | 1 | 1 | 1 | 0 | 0 |

### Every FF-P06 field row (either text)
| Variant | Kind | Expected | Class | Target | Edge | Field | Source kind(s) |
|---|---|---|---|---|---|---|---|
| clean-architecture/v08-domain-service-holds-infrastructure-clock | violation | yes | LoanPolicy | SystemClock | FLOWS_TO | clock | (FLOWS_TO) |
| clean-architecture/v08-domain-service-holds-infrastructure-clock | violation | yes | LoanPolicy | SystemClock | HOLDS_STATE_OF | clock | initializer |
| nestjs/v10-domain-policy-holds-repository | violation | yes | RegistrationPolicy | InMemoryRegistrationRepository | FLOWS_TO | history | (FLOWS_TO) |
| nestjs/v10-domain-policy-holds-repository | violation | yes | RegistrationPolicy | InMemoryRegistrationRepository | HOLDS_STATE_OF | history | initializer |
| hexagonal/v10-domain-service-holds-adapter | violation | yes | AvailabilityChecker | InMemoryBookingRepository | FLOWS_TO | history | (FLOWS_TO) |
| hexagonal/v10-domain-service-holds-adapter | violation | yes | AvailabilityChecker | InMemoryBookingRepository | HOLDS_STATE_OF | history | initializer |
