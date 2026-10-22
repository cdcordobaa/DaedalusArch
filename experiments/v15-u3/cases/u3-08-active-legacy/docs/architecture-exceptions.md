# Architecture exceptions

Each row is an exception to an architecture rule, with its status.

| File | Rule | Status | Note |
|---|---|---|---|
| src/ordering/domain/customer/Customer.ts | domain purity: TypeORM decorator on Customer | Active until 2027-03-31 | legacy mapping, accepted until the persistence split moves it to infrastructure |
