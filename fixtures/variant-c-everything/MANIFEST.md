# MANIFEST — variant-c-everything

## DaedalusArch Ground Truth
- **Spike AHS**: 0.33 | **Expected verdict**: `hard-block` (AHS < 0.50)
- **Seeded dimensions**: structural, pattern, solid, convention
- **FF IDs**: FF-S01, FF-S02, FF-P01, FF-P02, FF-P03, FF-SO01, FF-SO02, FF-CV01

---

# Original Spike MANIFEST — Variant C: Everything Broken

## Intentional Violations

| # | File | Violation Type | Fitness Function |
|---|------|---------------|-----------------|
| 1 | src/domain/entities/Task.ts | Domain imports @nestjs/common AND express | domain-purity |
| 2 | src/domain/entities/GodTask.ts | God class: 15+ public methods | single-responsibility-proxy |
| 3 | src/application/use-cases/CreateTaskUseCase.ts | Injects concrete repository | dependency-inversion |
| 4 | src/infrastructure/repositories/InMemoryTaskRepository.ts | Domain imports infra (Task → InfraConfig) | dependency-direction |
| 5 | src/infrastructure/repositories/CircularA.ts | Circular: A→B→A | no-circular-dependencies |
| 6 | src/domain/repositories/ITaskRepository.ts | Fat interface (9 methods) | interface-segregation-proxy |
| 7 | src/infrastructure/controllers/BadController.ts | Named "TaskHandler" — breaks naming convention | naming-conventions |
| 8 | src/infrastructure/repositories/InMemoryTaskRepository.ts | Does not implement ITaskRepository | repository-pattern |
