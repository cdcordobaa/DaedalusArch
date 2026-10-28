# N2 author audit set (v1.5 final study, registered secondary N2)

Registered in `Docs/v1.5/final-study-preregistration.md` §4, N2: D_sem on the meaning-level rows that no admitted rule
covers (H06, K11, K12). Its precondition is a pilot on TRAPRATE-01 outputs against a 30-item author audit made
**before** the pilot is run (≥ 0.80 agreement, 0 hallucinated citations). This folder holds that audit set.

Zero model calls. No rule engine. The procedure below was fixed and committed before any candidate was counted or
drawn; the items file comes in a later commit.

## Rows (construct text, used verbatim in each item question)

- **K11**: an in-process lock (a set, map, flag or mutex held in a service) standing in for an aggregate's consistency
  boundary.
- **K12**: a business calculation over an aggregate's or entity's state done in an application service (or adapter)
  and handed back to it, instead of inside the aggregate/entity.
- **H06**: an adapter decides a business rule: code in an inbound or outbound adapter that branches on domain state or
  domain values to accept, reject, price or change something (transport-shape validation is not a business rule).

Item question: `Does this code contain: <construct text>?`

## Source trees

The final snapshots (step-03) of all 50 TRAPRATE-01 sessions (`results/v1.5-traprate-01`, branch
`results/traprate-01-scores`), rebuilt with `restoreSession` of `experiments/traprate-01/score-traprate.ts` (committed
step-00 + task seed files it lacks + step diffs; every tree checked against the recorded tree sha256). Style per
session from `private-id-map.json` (DDD or Hexagonal). Only `src/**/*.ts` (not `.d.ts`) is read.

## Procedure

**File roles** come from `roleOf(path, 'hexddd')` of `src/v15-instrument/conventions.ts` (unchanged):
`application` = role `application`; `adapter` = role `adapter` (`adapters/`, `infrastructure/`, `api/`, `acl/`).
A **domain type** is a class, an interface, or a type alias of an object-literal type, declared in a file of role
`domain` or `shared-kernel`. A value is **domain-typed** when its static type (ts-morph type checker, nullability
removed, each union member checked) has a symbol or alias symbol declared as a domain type.

**Unit** (the enclosing member, also the excerpt): the nearest enclosing class member (method, constructor, accessor,
property with an initializer) or top-level function, or top-level variable statement. Nested arrows and functions
belong to their outer unit.

### 1. Candidate sites (fixed syntactic filter, ts-morph)

- **K11** (application and adapter files): a class property, or a module-level variable, whose declared or inferred
  type is `Set`, `Map`, `WeakSet`, `WeakMap`, `boolean`, or has a type name matching `/mutex|lock|semaphore/i`; the
  candidate is a unit that both **reads** and **writes** that field or variable and also calls a repository save (a
  call of a method named `save` or `saveAll`). A write is an assignment to it (`=`, compound assignment, `++`/`--`) or
  a call of `add`, `set`, `delete` or `clear` on it; any other reference is a read.
- **K12** (application and adapter files): a maximal arithmetic expression (binary `+ - * /`, compound `+= -= *= /=`,
  or a call `Math.*(...)`) inside a unit, whose result type is not string, and whose subtree contains a property
  access whose receiver is domain-typed.
- **H06** (adapter files): an `if` condition, a ternary condition, or a `switch` expression whose subtree contains a
  property access whose receiver is domain-typed.

A candidate is a (session, file, unit) pair with at least one site; several sites in one unit are one candidate.
Counts are reported per row and per style (sites and candidates).

### 2. Draw

One `mulberry32` stream (`scripts/lib/mutation/rng.ts`), seed `20261028`, used in this order:

1. Candidates are sorted by (session, file, unit start line). For each row in the order K11, K12, H06, and each style
   in the order DDD, Hexagonal, the style's candidates are shuffled with `pickDistinct(all, all.length)` and walked in
   that order.
2. Each row takes 10 items: 5 per style. If a style has fewer eligible candidates than its share, it gives all it has
   and the other style of the same row fills the gap (walking on in its shuffled order).
3. A candidate is skipped when its session already holds 2 drawn items (any row), or when its excerpt text is
   identical to an excerpt already drawn (the same seed code in two sessions of one task).
4. If a row still has fewer than 10 items, it takes all it has and the shortfall is filled from the other rows in the
   order K11, K12, H06 (walking on in their shuffled orders, same skip rules); the fill is recorded in `counts.fill`.
5. The 30 drawn items are shuffled with `pickDistinct(items, 30)` from the same stream and numbered `A01`..`A30`.

### 3. Item content

Each item: `id`, `row`, `question`, `session` (neutral session id `cNN`), `file` (path relative to the snapshot root),
`excerpt` (the unit, at most 40 lines, each line with its 1-based line number in the original file; a longer unit is cut
to the 40 lines centred on its sites), and, when present:

- `fieldDeclaration` (K11): the declaration line(s) of the field or variable, numbered;
- `domainType`: up to 10 numbered lines of the first referenced domain type's declaration, with its file.

No rule finding, oracle result, task name or id, trap description or arm is in an item.

## Files

- `build-audit-items.ts`: the procedure above (`npx tsx experiments/v15-n2/build-audit-items.ts`).
- `audit-items.json`: `{ procedure, seed, counts, items }`.
