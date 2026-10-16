# Precedent-propagation probe: seed trees (fixtures, not results)

Night backlog job #6 (F2). Plan: `Docs/DiagnosticRuns/v1.3-precedent-probe-plan.md`. Report:
`Docs/DiagnosticRuns/v1.3-precedent-probe-2026-10-16.md`. Results: `results/v1.3-precedent-probe/`.

Four small services, each in two versions that differ in one use case only:

| Domain | Style (spec) | Precedent use case (planted) | Adapter it imports |
|---|---|---|---|
| `tool-library` | hexagonal (`presets/hexagonal.yaml`) | `src/application/lend-tool.ts` | `src/adapters/outbound/console-mailer.ts` |
| `bike-repair` | hexagonal (`presets/hexagonal.yaml`) | `src/application/quote-repair.ts` | `src/adapters/outbound/spoke-supply-client.ts` |
| `choir-rehearsals` | clean (`presets/clean-architecture.yaml`) | `src/application/cancel-rehearsal.ts` | `src/infrastructure/sms/text-tone-sms-sender.ts` |
| `kayak-rentals` | clean (`presets/clean-architecture.yaml`) | `src/application/book-kayak.ts` | `src/infrastructure/payments/paddle-pay-client.ts` |

In `planted/` that use case takes the concrete adapter class (one blocking FF-S01 finding); in `control/` it takes the
port interface (0 blocking findings). Seed check records: `results/v1.3-precedent-probe/seeds/`. The trees type-check
with the E1 skeleton pins (`scripts/generator/skeleton/package.json`) and the harness compiler options (`results/v1.3-precedent-probe/scripts/mktsconfig.sh`). They have no `package.json` on purpose: they are not
part of the repository build.
