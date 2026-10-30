# HCAL-07 builder brief

HCAL-07 is a blind admission set for the Hexagonal vocabulary and boundary rows: H11 with its four sub-shapes (b and d
widened, a and c as regression rows), H11-SEM, H03 and H07. One blind session built all three domains while the rules
were being changed in parallel by another session. The builder did not read any rule implementation: nothing under
`src/v15-instrument/`, no `rules/*.cypher`, nothing in `experiments/hx-rules-v3-dev/`, and no scorer. No checker or
scorer was run on any tree. The cases follow the construct definitions only.

## What the builder read

`experiments/hcal-06/` (README, BRIEF, spec.yaml, case files, labels and seal files) for the format and the seal method;
the earlier HCAL labels files for the row keys in use (`H03`, `H07`, `H11`, `H11-SEM`); the folder names of every
earlier `cal-0x` and `hcal-0x` set, to pick fresh domains. The spec template is HCAL-06's `print-shop/base/spec.yaml`,
with only the header, the forbidden imports and the glossary changed.

## Domains

Three domains that no cal or HCAL set has used: `kennel-boarding` (vendor `furpay-sdk`, a card payment provider),
`greenhouse-nursery` (`palletpath-sdk`, a pallet freight carrier) and `locksmith-dispatch` (`crewclock-sdk`, a technician
scheduling service; the base also has an in-tree HTTP library `http-kit`). Layout as in HCAL-06: in-tree fake SDKs under
`base/vendor/<name>/`, resolved through tsconfig `paths` by their bare names. Each base has an HTTP driving adapter and
a second driving adapter (kiosk or webhook), and three outbound adapter packages. The vendor adapter translates the
vendor's codes and field names into the domain's own terms.

## Rows (the base keeps the rule; a positive breaks it)

| Row | A positive does this |
|---|---|
| H11-a | core code compares or stores a vendor literal code (regression row) |
| H11-b | vendor error vocabulary in the core: a core error or class named after a vendor class; vendor error or reject codes as object-literal keys in the core; vendor error codes compared as literals in the core |
| H11-c | a core field renamed to a vendor field name (regression row) |
| H11-d | vendor field names in the core: declared fields on a core type, field names held as strings in an array or tuple, a mapping table keyed by or valued with vendor field names |
| H11-SEM | the core holds a renamed one-to-one copy of a vendor value set and branches on it |
| H03 | an adapter imports another adapter package: outbound to outbound (including one outbound adapter building a second adapter of the same port), inbound to outbound, driving to driving |
| H07 | transport detail in the core: HTTP status numbers on domain errors or as use case results, an HTTP library import in the core |

Clean cases include hard twins that differ from a positive by the least possible change (a table moved into the
adapter, a name or a column list changed to core terms, a fallback taken as the port interface instead of the adapter
class, a business code in place of an HTTP status). The H03 clean cases include a shared helper folder on the driven
side (`adapters/out/shared`, two cases) and one on the driving side (`adapters/in/shared`). The H07 clean cases include a
domain field named `statusCode` that holds a business status (the plant passport), next to the aggregate's own `status`.
