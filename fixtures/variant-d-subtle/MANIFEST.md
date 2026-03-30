# MANIFEST — variant-d-subtle

## DaedalusArch Ground Truth
- **Spike AHS**: 0.66 | **Expected verdict**: `warning` (AHS 0.65–0.79)
- **Seeded dimensions**: pattern (DI), structural (transitive)
- **FF IDs**: FF-P02 (dependency-inversion), FF-S01 (dependency-direction transitive)

---

# Original Spike MANIFEST — Variant D: Subtle Violations

## Intentional Violations

| # | File | Lines | Violation Type | Fitness Function |
|---|------|-------|---------------|-----------------|
| 1 | src/application/use-cases/CreateTaskUseCase.ts | 6 | One DI injection is concrete (InfraLogger) — buried among otherwise-correct interface injections | dependency-inversion |
| 2 | src/domain/entities/Task.ts | 2 | Imports a utility (TaskUtils) that re-exports from infrastructure — one-level indirection | dependency-direction (transitive) |

## Why this is hard to detect:
- Violation #1: All other classes in the project inject interfaces — only 1 of 4 injections is concrete
- Violation #2: The domain entity imports from application/utils/TaskUtils.ts which looks innocent, but TaskUtils re-exports from infrastructure
- All naming conventions are followed
- No circular dependencies
- No framework imports directly in domain
