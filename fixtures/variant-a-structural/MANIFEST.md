# MANIFEST — variant-a-structural

## DaedalusArch Ground Truth
- **Spike AHS**: 0.54 | **Expected verdict**: `soft-block` (AHS 0.50–0.64)
- **Seeded dimensions**: structural
- **FF IDs**: FF-S01 (dependency-direction), FF-S02 (no-cyclic-deps)

---

# Original Spike MANIFEST — Variant A: Structural Violations Only

## Intentional Violations

| # | File | Line | Violation Type | Fitness Function |
|---|------|------|---------------|-----------------|
| 1 | src/infrastructure/repositories/InfraTaskService.ts | 3 | Infrastructure imports from domain AND calls domain entities directly, creating domain→infrastructure path via re-import | dependency-direction |
| 2 | src/domain/entities/Task.ts | 1 | Domain entity imports from infrastructure (InfraConfig) — wrong direction | dependency-direction |
| 3 | src/application/use-cases/CreateTaskUseCase.ts | 2 | Application also imports from infrastructure (InMemoryTaskRepository directly) | dependency-direction |
| 4 | src/infrastructure/repositories/InMemoryTaskRepository.ts | 1-4 | Creates a circular import: InMemoryTaskRepository → CircularHelper → InMemoryTaskRepository | no-circular-dependencies |

## All other patterns are correct:
- All DI uses interfaces
- Domain imports no framework packages
- Repository pattern is followed (interface in domain, impl in infra)
