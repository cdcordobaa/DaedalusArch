# HCAL-04 builder brief

You build one domain of the HCAL-04 calibration set: a small, clean TypeScript Hexagonal (ports and adapters)
application (the **base**) and 15 small **cases**, each a change to the base that either breaks one Hexagonal design
rule (a **positive**) or looks similar but keeps the rule (a **twin** or a **legitimate** case). The cases test a static
checker. You do not see the checker and must not look for it.

## What you may read

- This brief.
- `experiments/hcal-02/meters/base/spec.yaml`, **only as a format example** for `spec.yaml` (copy its structure,
  rename everything to your domain).

## What you must not read

Anything under `src/`, `tests/`, `Docs/`, `ops/`, `scripts/`, `results/`, or any other `experiments/` folder (other
than the one spec file above). Do not run any checker, architecture linter, or `npx tsx` script from the repo. You may
run `npx tsc` on your own trees to make sure they compile.

## Layout (inside `experiments/hcal-04/<domain>/`)

```
base/spec.yaml
base/tsconfig.json          strict, noEmit, module NodeNext or ESNext, includes src/** and vendor/**
base/vendor/<name>-sdk/     a small fake vendor SDK package: package.json, index.d.ts (exported types: request,
                            response, status/error/precision codes as string-literal unions, an error class) and
                            index.js; resolve it through tsconfig "paths" as the bare module name '<name>-sdk'
base/src/domain/...                     entities, value objects, domain services, domain errors
base/src/application/<use-case>.use-case.ts
base/src/application/ports/in/...       driving ports
base/src/application/ports/out/...      driven ports (one of them the gateway the vendor adapter implements)
base/src/adapters/in/<kind>/...         at least one inbound adapter (an HTTP controller) with its own DTOs
base/src/adapters/out/<kind>/...        at least two outbound adapter packages; one wraps the vendor SDK and translates
                                        the vendor's codes into the application's own terms
base/src/main.ts                        composition root
cases/<ID>/src/...                      ONLY the files the case adds or changes, full contents (an overlay on base)
labels.json
```

- Use cases receive every driven port through their constructor. Only `main.ts` constructs adapters.
- Domain code imports nothing outside `domain/`. Ports use domain types and plain types only. The core uses its own
  vocabulary; only the vendor adapter knows the vendor's codes and field names.
- The base must itself be clean: every rule below is kept everywhere in it.

## Cases

For **each** of the 3 rows below, write 5 cases: `<ROW>-pos1`, `<ROW>-pos2`, `<ROW>-twin1`, `<ROW>-twin2`, `<ROW>-legit`.

- **pos1, pos2:** a realistic feature change that breaks exactly this row's rule and nothing else. The two positives
  must differ in code shape (for example a string-literal union versus an enum, an inbound versus an outbound adapter,
  a direct call versus a call through a helper function, a type alias versus an interface). Vary the shape in whatever
  way the rule allows.
- **twin1, twin2:** as close as possible to a positive in feature and code, but keeping the rule.
- **legit:** a nearby change a careless reader might mistake for the violation but that is correct design.
- Each case changes as few files as needed, compiles on top of the base, and breaks no other row's rule (in
  particular: no vendor import outside the vendor adapter, no adapter constructed outside `main.ts`).

`labels.json` maps each case id to `{ "rule": "<ROW>", "label": "violation" | "clean", "file": "<path of the file where
the violation is, relative to the domain root>" | null, "note": "<one sentence>" }`.

## The 3 rows (rule kept in the base; the positive breaks it)

| Row | A positive does this |
|---|---|
| H06 | an adapter decides a business rule: code in an inbound or outbound adapter branches on domain state or domain values to accept, reject, price or change something, where that decision belongs in the domain or a use case. Checking the transport shape (a missing field, a malformed date, a wrong type) is not a business rule |
| H08 | code outside the composition root obtains a dependency from a container, registry or static provider at run time instead of receiving it through its constructor, either directly (`container.get`, `resolve`, a static `getInstance` of an adapter) or through a helper function or method that does the lookup |
| H11 | domain, application or port code re-declares the vendor's vocabulary: a string-literal union, an enum, a constant set or a field set whose values or names are copied from the vendor SDK's types (status, decline, error or precision codes; the vendor's field names), so the core speaks the vendor's language without importing the SDK |

## Done

Report the domain folder, the number of cases per row (must be 5 for each of the 3 rows), that `npx tsc -p` passes for
the base and for every case overlaid on a copy of the base, and any case you were unsure how to label. Do not describe
the cases' code shapes in your report beyond the label doubts.
