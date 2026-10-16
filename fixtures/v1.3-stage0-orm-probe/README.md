# v1.3 stage-0 ORM instrument probe fixtures

Inputs of the stage-0 instrument probe (Docs/v1.3/floor-escape-design-2026-10-16.md sections 3.6 and 4; results in
Docs/DiagnosticRuns/v1.3-stage0-orm-probe-2026-10-16.md). Driver: `npx tsx scripts/v1.3/stage0-orm-probe.ts`.

Each case directory holds the same small order-placing project twice:

- `clean/`: layout of specs/clean-arch.yaml (`src/domain`, `src/application`, `src/infrastructure`).
- `hexagonal/`: layout of presets/hexagonal.yaml (`src/domain`, `src/application`, `src/adapters/inbound`,
  `src/adapters/outbound`, `src/config` as the composition root).

`typeorm` is not installed. The imports are only import statements; the fixtures type-check against a stub
declaration of the TypeORM names used and otherwise fail only with TS2307 (module not found).

| Case | What differs from `control` | Planted file |
|---|---|---|
| control | nothing: domain `Order` plain class, `OrderRepository` port in the domain, `OrderRecord` (TypeORM `@Entity`) and `TypeOrmOrderRepository` in the persistence adapter, wiring in the composition root | (reference) |
| decorated-domain-class | the domain `Order` carries `@Entity`, `@PrimaryGeneratedColumn`, `@Column` (`import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'`); the separate `OrderRecord` is gone and the adapter uses `Repository<Order>` | `src/domain/entities/order.ts` |
| version-column | `OrderRecord` gains `@VersionColumn() version` (optimistic lock); the domain is unchanged | `<persistence>/order.orm-entity.ts` |
| datasource-in-use-case | `PlaceOrderUseCase` injects `DataSource` from typeorm and wraps the save in `dataSource.transaction` | `src/application/use-cases/place-order.ts` |
| repository-without-port | no `OrderRepository` port and no adapter class; `PlaceOrderUseCase` injects `Repository<Order>` from typeorm; the mapping is an `EntitySchema<Order>` in persistence | `src/application/use-cases/place-order.ts` |
| querybuilder-in-logic | a new application service `OrderReportService` runs the large-order rule (>= 100,000 cents) as `manager.createQueryBuilder()` SQL on an injected `EntityManager` (the composition root passes `dataSource.manager`) | `src/application/services/order-report.service.ts` |

`<persistence>` is `src/infrastructure/persistence` (clean) or `src/adapters/outbound/persistence` (hexagonal).
No comment in the fixtures names a rule or says what is planted.
