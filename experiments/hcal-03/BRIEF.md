# HCAL-03 builder brief

You build one domain of the HCAL-03 calibration set: a small, clean TypeScript Hexagonal (ports and adapters)
application (the **base**) and 50 small **cases**, each a change to the base that either breaks one Hexagonal design
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

## Layout (inside `experiments/hcal-03/<domain>/`)

```
base/spec.yaml
base/tsconfig.json          strict, noEmit, module NodeNext or ESNext, includes src/**
base/src/domain/...                     entities, value objects, domain services, domain errors
base/src/application/<use-case>.use-case.ts
base/src/application/ports/in/...       driving ports (use-case interfaces)
base/src/application/ports/out/...      driven ports (repositories, gateways, notifiers, clock)
base/src/adapters/in/<kind>/...         at least one inbound adapter (an HTTP controller), with its own DTOs
base/src/adapters/out/<kind>/...        at least two outbound adapter packages (e.g. persistence and a gateway)
base/src/main.ts                        composition root: builds every adapter and use case and wires them
cases/<ID>/src/...                      ONLY the files the case adds or changes, full file contents (an overlay on base)
labels.json
```

- Use cases receive every driven port through their constructor, typed by the port. Only `main.ts` constructs
  adapters.
- Domain code imports nothing outside `domain/`. Ports use domain types and plain types only.
- The base must itself be clean: every rule below is kept everywhere in it.

## Cases

For **each** of the 10 rows below, write 5 cases: `<ROW>-pos1`, `<ROW>-pos2`, `<ROW>-twin1`, `<ROW>-twin2`,
`<ROW>-legit`.

- **pos1, pos2:** a realistic feature change that breaks exactly this row's rule and nothing else. The two positives
  must differ in code shape: for example a value import versus a type-only import, a field versus a constructor
  parameter, a use case versus a domain service, a module import versus a global call, synchronous versus async, a
  return type versus a parameter type. Vary the shape in whatever way the rule allows.
- **twin1, twin2:** as close as possible to a positive in feature and code, but keeping the rule (the right way to
  build the same feature).
- **legit:** a nearby change that a careless reader might mistake for the violation but that is correct design.
- Each case changes as few files as needed, compiles on top of the base, and breaks no other row's rule.

`labels.json` maps each case id to `{ "rule": "<ROW>", "label": "violation" | "clean", "file": "<path of the file
where the violation is, relative to the domain root, e.g. src/application/x.use-case.ts>" | null, "note": "<one
sentence: what the change does and why it is or is not a violation>" }`. Positives have `label: violation` and the
file; twins and legit have `label: clean` and `file: null`.

## The 10 rows (rule kept in the base; the positive breaks it)

| Row | A positive does this |
|---|---|
| H01 | domain code depends on the application layer, an adapter, or a framework or technical package |
| H02 | a use case (application code) imports an adapter |
| H03 | an adapter imports another adapter package (in to out, or one out-adapter into another) |
| H04 | a vendor type, adapter type or persistence handle (transaction, connection, session) appears in an out-port's signature |
| H05 | a use case constructs a concrete adapter itself (`new`), instead of receiving the port |
| H06 | a business rule (a decision about domain state) is implemented in an adapter instead of the domain or use case |
| H07 | a transport concept appears in the core (domain, application or a port): HTTP status codes, HTTP or SQL error types, request or response objects |
| H08 | code outside the composition root obtains a dependency from a container, registry or static provider at run time (`container.get`, `resolve`, a static `getInstance` of an adapter) instead of receiving it through its constructor |
| H09 | domain or application code performs I/O without a port: network, file system, environment variables, a database or cache client, or a child process, by a global call or an I/O module |
| H10 | an inbound adapter uses a domain entity or aggregate as its transport shape: the response body or the request type is the domain type, not a DTO |

## Done

Report the domain folder, the number of cases per row (must be 5 for each of the 10 rows), that `npx tsc -p` passes
for the base and for every case overlaid on a copy of the base, and any case you were unsure how to label.
