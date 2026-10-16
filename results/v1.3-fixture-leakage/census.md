| Set | Style / split | Part | Units | Units with hits | Files with comments | Comment lines | Hit lines | violation | allowed | rule-id | rule-name | planted | seed | anti-pattern | blocking | advisory | near-miss | construct-denial |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| reference | clean-architecture | clean project | 30 | 1 | 2 | 4 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reference | clean-architecture | variant-introduced | 13 | 2 | 2 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 1 |
| reference | layered | clean project | 28 | 1 | 11 | 16 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reference | layered | variant-introduced | 12 | 0 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reference | nestjs | clean project | 30 | 1 | 3 | 5 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reference | nestjs | variant-introduced | 13 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reference | hexagonal | clean project | 31 | 1 | 12 | 14 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reference | hexagonal | variant-introduced | 14 | 1 | 3 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| reference | ddd | clean project | 31 | 0 | 19 | 19 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reference | ddd | variant-introduced | 14 | 14 | 16 | 16 | 14 | 12 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| judge-catch base | antipattern-nest | clean base | 12 | 1 | 4 | 4 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| judge-catch seeds | CHECK | added lines | 35 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| judge-catch seeds | TUNE | added lines | 65 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| judge-catch seeds | not in split | added lines | 9 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Units: files (clean project, base) or variants / seed diffs (variant-introduced, added lines).

- reference clean-architecture: n01-second-composition-root-for-tests (near-miss), n02-report-writer-named-like-repo (near-miss)
- reference hexagonal: n03-gateway-named-helper (near-miss)
- reference ddd: g01-value-object-setter-accessor (violation), g02-barrel-reexported-service (near-miss), g03-deep-import-of-reexported-file (violation), n01-acl-internal-import (near-miss), v01-aggregate-boundary (violation), v02-repository-for-inner-entity (violation), v03-mutable-value-object (violation), v04-framework-in-domain (violation), v05-event-outside-domain (violation), v06-fat-application-service (violation), v07-module-outside-context (violation), v08-cross-context-internal-import (violation), v09-domain-imports-application (violation), v10-api-imports-infrastructure (violation)
