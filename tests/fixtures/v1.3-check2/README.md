# CHECK-2 bases (judge v2.2 evaluation)

Ten small TypeScript projects written on 2026-10-16 for the judge v2.2 CHECK-2 set (`Docs/v1.3/judge-v22-plan.md`). No judge has seen them: they were written after the v2.1 CHECK run and before any v2.2 call, and they are not derived from the v1.3 reference projects, the `antipattern-nest` fixture or the E1 cells.

| Base | Style | Domain |
|---|---|---|
| `layered-library` | layered | library lending |
| `layered-clinic` | layered | clinic appointments |
| `layered-fleet` | layered | fleet maintenance |
| `layered-ticketing` | layered | event ticketing |
| `layered-payroll` | layered | payroll |
| `layered-warehouse` | layered | warehouse stock |
| `clean-subscriptions` | clean-architecture | SaaS subscriptions |
| `nestjs-courses` | nestjs | course enrolment |
| `hexagonal-parking` | hexagonal | parking reservations |
| `ddd-insurance` | ddd | insurance policies and claims |

Each base holds:
- `project/`: `src/`, `types/` (ambient typings for the framework packages, so nothing is installed), `tsconfig.json` and `package.json`. Every project compiles with the repository's `tsc`. The sources carry no comment.
- `spec.yaml`: the evaluation spec. It is the style's preset verbatim, except `ddd-insurance/spec.yaml`. That file is `presets/ddd.yaml` with this project's `architecture.ddd` block and with FF-N01 and FF-N02 copied from `presets/layered.yaml`, because the DDD preset declares no judged function.
- `seed-spec.yaml` (layered bases only): used **only** to find operator sites. It splits the business layer into a domain-kind model and an application-kind service layer, because the anti-pattern operators look for service classes in application-kind layers. It is never used to evaluate or judge.

Each layered base keeps one business service that calls the persistence layer's `PrismaService` directly (history, audit, notes, mileage, gate log or cycle counts). It is the only shape on which `AP-REPO-BYPASS` places a site in closed layering without the clean base itself carrying an ORM type in the business layer.

The seeds and twins are not stored here. `scripts/v1.3/judge-v22-check2.ts seed` regenerates them deterministically. Their manifest is `results/v1.3-judge-v22/check2-seed-manifest.json`, which records the tree hash of every base.
