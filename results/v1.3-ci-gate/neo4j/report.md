# CI gate on synthetic diffs (neo4j engine, 71 reference variants)

A case is **exact** when the gate reports precisely the manifest's blocking findings on the expected side (NEW for clean→variant, FIXED for variant→clean) and nothing blocking on the other side; a drift case (every source file shifted by two comment lines) is exact when nothing at all, in any tier, is new or fixed. TP/FN/FP count blocking findings; FP includes rows on the wrong side.

| Style | Direction | Cases | Exact | Expected | TP | FN | FP | Recall | Precision |
|---|---|---|---|---|---|---|---|---|---|
| clean-architecture | clean→variant | 13 | 12/13 (92.3 %) | 13 | 12 | 1 | 0 | 92.3 % | 100.0 % |
| clean-architecture | variant→clean | 13 | 12/13 (92.3 %) | 13 | 12 | 1 | 0 | 92.3 % | 100.0 % |
| clean-architecture | clean→drift | 1 | 1/1 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| clean-architecture | variant→drift | 13 | 13/13 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| layered | clean→variant | 12 | 12/12 (100.0 %) | 11 | 11 | 0 | 0 | 100.0 % | 100.0 % |
| layered | variant→clean | 12 | 12/12 (100.0 %) | 11 | 11 | 0 | 0 | 100.0 % | 100.0 % |
| layered | clean→drift | 1 | 1/1 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| layered | variant→drift | 12 | 12/12 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| nestjs | clean→variant | 13 | 12/13 (92.3 %) | 11 | 10 | 1 | 0 | 90.9 % | 100.0 % |
| nestjs | variant→clean | 13 | 12/13 (92.3 %) | 11 | 10 | 1 | 0 | 90.9 % | 100.0 % |
| nestjs | clean→drift | 1 | 1/1 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| nestjs | variant→drift | 13 | 13/13 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| hexagonal | clean→variant | 14 | 13/14 (92.9 %) | 13 | 12 | 1 | 0 | 92.3 % | 100.0 % |
| hexagonal | variant→clean | 14 | 13/14 (92.9 %) | 13 | 12 | 1 | 0 | 92.3 % | 100.0 % |
| hexagonal | clean→drift | 1 | 1/1 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| hexagonal | variant→drift | 14 | 14/14 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| ddd | clean→variant | 14 | 14/14 (100.0 %) | 9 | 9 | 0 | 0 | 100.0 % | 100.0 % |
| ddd | variant→clean | 14 | 14/14 (100.0 %) | 9 | 9 | 0 | 0 | 100.0 % | 100.0 % |
| ddd | clean→drift | 1 | 1/1 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| ddd | variant→drift | 14 | 14/14 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| **all** | clean→variant | 66 | 63/66 (95.5 %) | 57 | 54 | 3 | 0 | 94.7 % | 100.0 % |
| **all** | variant→clean | 66 | 63/66 (95.5 %) | 57 | 54 | 3 | 0 | 94.7 % | 100.0 % |
| **all** | clean→drift | 5 | 5/5 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| **all** | variant→drift | 66 | 66/66 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| **all** | **all** | 203 | 197/203 (97.0 %) | 114 | 108 | 6 | 0 | 94.7 % | 100.0 % |

Variants with every case exact: **68/71**.

Line drift: across the 71 drift cases, 1663 findings were matched as unchanged, 53 of them reported on a different line in head than in base.

## Inexact cases

| Style | Variant | Direction | Missed | Unexpected / wrong side |
|---|---|---|---|---|
| clean-architecture | v08-domain-service-holds-infrastructure-clock | clean→variant | FF-P06 `src/domain/services/LoanPolicy.ts` → `src/infrastructure/system/SystemClock.ts` (reported, tier not-applicable) | - |
| clean-architecture | v08-domain-service-holds-infrastructure-clock | variant→clean | FF-P06 `src/domain/services/LoanPolicy.ts` → `src/infrastructure/system/SystemClock.ts` (reported, tier not-applicable) | - |
| nestjs | v10-domain-policy-holds-repository | clean→variant | FF-P06 `src/domain/registration-policy.ts` → `src/registrations/in-memory-registration.repository.ts` (reported, tier not-applicable) | - |
| nestjs | v10-domain-policy-holds-repository | variant→clean | FF-P06 `src/domain/registration-policy.ts` → `src/registrations/in-memory-registration.repository.ts` (reported, tier not-applicable) | - |
| hexagonal | v10-domain-service-holds-adapter | clean→variant | FF-P06 `src/domain/services/AvailabilityChecker.ts` → `src/adapters/outbound/persistence/InMemoryBookingRepository.ts` (reported, tier not-applicable) | - |
| hexagonal | v10-domain-service-holds-adapter | variant→clean | FF-P06 `src/domain/services/AvailabilityChecker.ts` → `src/adapters/outbound/persistence/InMemoryBookingRepository.ts` (reported, tier not-applicable) | - |
