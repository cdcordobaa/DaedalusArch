# MANIFEST — variant-b-pattern

## DaedalusArch Ground Truth
- **Spike AHS**: 0.58 | **Expected verdict**: `soft-block` (AHS 0.50–0.64)
- **Seeded dimensions**: pattern, solid
- **FF IDs**: FF-P01 (domain-purity), FF-P02 (dependency-inversion), FF-P03 (repository-pattern), FF-SO02 (interface-segregation-proxy)

---

# Original Spike MANIFEST — Variant B: Pattern Violations Only

## Intentional Violations

| # | File | Lines | Violation Type | Fitness Function |
|---|------|-------|---------------|-----------------|
| 1 | src/application/use-cases/CreateTaskUseCase.ts | 5 | Injects concrete InMemoryTaskRepository instead of ITaskRepository | dependency-inversion |
| 2 | src/application/use-cases/CompleteTaskUseCase.ts | 5 | Injects concrete InMemoryTaskRepository instead of ITaskRepository | dependency-inversion |
| 3 | src/infrastructure/repositories/InMemoryTaskRepository.ts | — | Does not implement ITaskRepository interface (skips interface) | repository-pattern |
| 4 | src/domain/entities/Task.ts | 1 | Domain entity imports @nestjs/common (Injectable decorator) | domain-purity |
| 5 | src/domain/repositories/ITaskRepository.ts | — | Interface has 8 methods (fat interface) | interface-segregation-proxy |

## All structural checks remain correct:
- Layer dependency direction is correct
- No circular dependencies
- Naming conventions are followed
