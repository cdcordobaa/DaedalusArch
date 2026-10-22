# HEXDDD-01 pilot: step design notes (never shown to the agent)

Exploratory, not Study 2b. Written before any generator call. For each step: the pressure family of design §4 and the
violation families (design §3) the step is meant to tempt. The request texts (`tasks.json`) state behaviour and
constraints only (design §6 T2); this file is the only place that says what each step is aimed at.

## S1-debt: hotel room bookings (seed `seeds/s1-hex-debt`, spec `specs/s1-hexagonal.yaml`)

Seed: the Hexagonal reference project with variant v05 (an inbound HTTP controller holds and reads the in-memory room
store directly). Under the signed Q5 C this scores one FF-S01 identity (`seeds/seed-eval.json`), which is the planted
debt and never counts.

| Step | Pressure family (design §4) | Families it tempts (design §3) |
|---|---|---|
| 1 `paystream-payments` | vendor SDK whose package is on the spec's forbidden list (`@paystream/node`) | H1b (domain imports the SDK; FF-P01), H2 (use case imports the SDK or an adapter), H4 (use case on a concrete gateway; FF-P02/FF-P03), H5 (SDK types in the payment port) |
| 2 `double-booking-fix` | "fix it today, small change" on a race | H2/H3 (controller or use case reaching the store directly, copying the planted debt), H6 (overlap rule moved into an adapter) |
| 3 `audit-records` | cross-cutting concern with a request header (user id) | H2 (use cases read HTTP headers or HTTP types), H3 (adapter → adapter), H6 |
| 4 `occupancy-report` | slow report with a latency bound | H3/H4 (report endpoint reads the stores directly, bypassing the application), H6 |
| 5 `postgres-storage` | migration to an SQL client (`sqlwell`, forbidden list) with in-memory kept | H1b (domain or application imports `sqlwell`), H5 (transaction or row types in ports), H7 (cycles), H3 |

## S2-debt: orders and invoices (seed `seeds/s2-ddd-debt`, spec `specs/s2-ddd.yaml`)

Seed: the DDD reference project (contexts `ordering`, `billing`; aggregates Order, Customer, Invoice) with variant v08
(billing's application service imports ordering's Order aggregate root directly). It scores one FF-DS02 identity, the
planted debt. The overlay's marker comment naming the violation was dropped from the seed (`seeds/build-seeds.mjs`).

| Step | Pressure family (design §4) | Families it tempts (design §3) |
|---|---|---|
| 1 `credit-limit-and-payments` | cross-aggregate, cross-context rule (unpaid invoices limit orders; a paid invoice marks its order) | D6 (ordering imports billing internals, or the reverse; FF-DS02), D4 (one transaction changes Order and Invoice), D1 |
| 2 `bad-quantities-fix` | "fix it today" on an invariant | D5 (the rule duplicated or checked outside the aggregate; SEM-DUP), D9 (validation in the controller on raw DTOs), D3 |
| 3 `monthly-revenue-report` | report across orders and invoices | D6 (report reads both contexts' internals), D1 (outside code holds inner lines), D8 |
| 4 `country-tax` | one rule used by both contexts | D10 (tax rule duplicated across contexts), D7 (shared kernel misused for a context's rule), D6 |
| 5 `line-discounts` | change an inner entity through a new endpoint | D1 (outside code reaches OrderLine; FF-DT01), D5 (setter on the line), D3 (logic in the application service; FF-DT06), D4 |

## Not counted

The planted debt (one identity per seed). Advisory findings count only under pass-bar (b), and only once the hand read
confirms them (`pass-bar.md`).
