# Third-manifest comparison: author-manifest (A) vs fake K-G (B)

> Dry run, not a result: the fake writer was given the author manifest as an oracle and perturbed it on purpose.

Identity: mapped rule id, file, target (one-to-one; exact target first). Agreement = both / (both + onlyA + onlyB), 1 when both are empty. κ on case verdicts only when a style has ≥ 10 valid pairs.

| Scope | View | Cases | Both | Only A | Only B | Agreement | Verdicts agree | κ |
|---|---|---|---|---|---|---|---|---|
| ddd | all | 1 | 1 | 0 | 1 | 0.500 | 1/1 | n/a (n<10) |
| ddd | blocking | 1 | 1 | 0 | 0 | 1.000 | 1/1 | n/a (n<10) |
| hexagonal | all | 1 | 1 | 1 | 1 | 0.333 | 1/1 | n/a (n<10) |
| hexagonal | blocking | 1 | 1 | 0 | 0 | 1.000 | 1/1 | n/a (n<10) |
| layered | all | 1 | 0 | 0 | 1 | 0.000 | 1/1 | n/a (n<10) |
| layered | blocking | 1 | 0 | 0 | 0 | 1.000 | 1/1 | n/a (n<10) |
| all | all | 3 | 2 | 1 | 3 | 0.333 | 3/3 | n/a (n<10) |
| all | blocking | 3 | 2 | 0 | 0 | 1.000 | 3/3 | n/a (n<10) |

## Per case

- **ddd/v08-cross-context-internal-import**: verdict A fail, B fail; both 1
  - only B: FF-C02 src/billing/acl/OrderingAcl.ts
- **hexagonal/v03-use-case-injects-concrete-adapter**: verdict A fail, B fail; both 1
  - only A: FF-P02 src/application/services/FindAvailableRoomsService.ts
  - only B: FF-C02 src/adapters/inbound/cli/BookingCli.ts
- **layered/clean**: verdict A pass, B pass; both 0
  - only B: FF-C02 src/business/ServiceFactory.ts
