# Legacy exceptions

Each row is an accepted, dated exception to an architecture rule. It ends on the date shown.

| File | Rule | Until | Reason |
|---|---|---|---|
| src/ordering/domain/order/Order.ts | domain purity: TypeORM decorator on Order | 2026-12-31 | the ORM mapping moves to infrastructure in the persistence split |
