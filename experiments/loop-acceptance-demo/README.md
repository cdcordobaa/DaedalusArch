# Loop acceptance-check demo tests (pilot tasks only)

Demo black-box tests for the acceptance runner (`scripts/lib/loop/acceptance.ts`, `Docs/v1.3/acceptance-checks.md`).
They exist to prove the runner. They are **not** Study 2 checks and say nothing about any sealed task.

- `<taskId>/step-0N.test.mjs`: `node:test` + `fetch` against `BASE_URL`. At step k the runner runs files 1..k.
- Each task's `step-01.test.mjs` opens with the **demo contract** (routes and payloads) the tests assume. The pilot task
  texts and the loop frames fix no routes, port or start command, so this contract was written here and never shown to
  any agent; it cannot be applied to live pilot snapshots (see the note, §4).
- Reference services implementing the contract: `tests/fixtures/loop-acceptance/<taskId>/` (`npm start`, `PORT`).
- Tests that need an external provider (TillWave, MedCert, the licence registry) start a fake one on 127.0.0.1 and
  point the service at it through a `PUT /config/...` route of the contract.
