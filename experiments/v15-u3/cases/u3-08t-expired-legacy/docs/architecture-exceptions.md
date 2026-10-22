# Architecture exceptions

Each row is an exception to an architecture rule, with its status.

| File | Rule | Status | Note |
|---|---|---|---|
| src/ordering/domain/customer/Customer.ts | domain purity: TypeORM decorator on Customer | Expired 2026-08-31, not renewed | legacy mapping; the decorator must now be removed from the domain |
