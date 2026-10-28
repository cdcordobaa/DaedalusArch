# CAL-03 builder brief

You build one domain of the CAL-03 calibration set: a small, clean TypeScript DDD application (the **base**) and 80
small **cases**, each a change to the base that either breaks one DDD design rule (a **positive**) or looks similar
but keeps the rule (a **twin** or a **legitimate** case). The cases test a static checker. You do not see the checker
and must not look for it.

## What you may read

- This brief.
- `experiments/cal-02/claims/base/spec.yaml`, **only as a format example** for `spec.yaml` (copy its structure, rename
  everything to your domain). One fix: a `kind: uniqueness` invariant has `enforced_by: store` and **no** `owner`.

## What you must not read

Anything under `src/`, `tests/`, `Docs/`, `ops/`, `scripts/`, `results/`, or any other `experiments/` folder (other
than the one spec file above). Do not run any checker, linter for architecture, or `npx tsx` script from the repo. You
may run `npx tsc` on your own trees to make sure they compile.

## Layout (inside `experiments/cal-03/<domain>/`)

```
base/spec.yaml
base/tsconfig.json          strict, noEmit, module NodeNext or ESNext, includes src/**
base/src/<context>/{domain,application,infrastructure,api,contracts}/...
base/src/<context>/index.ts  the context's public API
base/src/shared-kernel/...   (Money, DomainEvent, EventBus, Transaction or UnitOfWork as needed)
base/src/main.ts             composition root: wires every context
cases/<ID>/src/...           ONLY the files the case adds or changes, full file contents (an overlay on base)
labels.json
```

- Three bounded contexts, each with at least one declared aggregate root (declare them in `spec.yaml` under
  `ddd.aggregates` with `module` globs), in-memory repositories behind repository interfaces in the domain layer,
  application services that load, call one aggregate method and save, domain events between contexts through the
  event bus, contracts (DTOs) in `contracts/`, and at least one outbound port with an adapter (for example a mailer or
  a payment gateway) declared in the application layer and implemented in infrastructure.
- Declare in `spec.yaml` under `ddd.invariants`: one `set` invariant, one `single` invariant, one `uniqueness`
  invariant (`enforced_by: store`, no owner). Each has `id`, `kind`, `owner` (not for uniqueness), `over`, `terms`,
  `statement`.
- The base must itself be clean: every rule below is kept everywhere in it.

## Cases

For **each** of the 16 rows below, write 5 cases: `<ROW>-pos1`, `<ROW>-pos2`, `<ROW>-twin1`, `<ROW>-twin2`,
`<ROW>-legit`.

- **pos1, pos2:** a realistic feature change that breaks exactly this row's rule and nothing else. The two positives
  must differ in code shape: for example inline versus through a local variable, a plain number versus a value
  object, a field versus a getter, a service versus a controller, throwing versus returning an error result,
  synchronous versus async. Vary the shape in whatever way the rule allows.
- **twin1, twin2:** as close as possible to a positive in feature and code, but keeping the rule (the right way to
  build the same feature).
- **legit:** a nearby change that a careless reader might mistake for the violation but that is correct design.
- Each case changes as few files as needed, compiles on top of the base, and breaks no other row's rule.

`labels.json` maps each case id to `{ "rule": "<ROW>", "label": "violation" | "clean", "file": "<path of the file
where the violation is, relative to the domain root, e.g. src/x/application/XService.ts>" | null, "note": "<one
sentence: what the change does and why it is or is not a violation>" }`. Positives have `label: violation` and the
file; twins and legit have `label: clean` and `file: null`.

## The 16 rows (rule kept in the base; the positive breaks it)

| Row | A positive does this |
|---|---|
| K01 | code in one context imports another context's internal file (not its `index.ts` or `contracts/`) |
| K02 | domain code depends on infrastructure or a technical framework or package, or a layer is skipped |
| K03 | one command (application-service method) saves two aggregate instances |
| K04 | a repository method persists two aggregates in one call (at least one positive: a command calls it) |
| K05 | a command writes synchronously into another context's aggregate |
| K06 | the same cross-aggregate or cross-context write placed in a facade built in the composition root (`main.ts`) |
| K07 | a remote call (an outbound port to an external system) made inside a transaction or a lock |
| K08 | a rule about a single aggregate instance decided outside the aggregate (in a service or controller) |
| K09 | the same rule checked both outside the aggregate and inside it |
| K10 | a declared `set` invariant checked outside the aggregate the spec names as its owner |
| K11 | an in-process lock (a set, map or mutex in a service) standing in for an aggregate's consistency boundary |
| K12 | a business calculation over an aggregate's state done in an application service and handed back to it |
| K13 | a vendor, adapter or transaction type in a port's signature |
| K14 | a domain entity exposed in a published contract (a type in `contracts/` or a context's public API) |
| K15 | an application service constructed with, or typed against, a concrete adapter instead of its port |
| K16 | an aggregate holds another aggregate's object instead of its id |

## Done

Report the domain folder, the number of cases per row (must be 5 for each of the 16 rows), that `npx tsc -p` passes
for the base and for every case overlaid on a copy of the base, and any case you were unsure how to label.
