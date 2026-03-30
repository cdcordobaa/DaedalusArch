---
description: Run tests using the test-runner sub-agent
---

Use the test-runner agent to run: $ARGUMENTS

If no arguments are given, run all unit tests.

Examples:
- `/test` → runs all unit tests
- `/test coverage` → runs with coverage report
- `/test lint` → runs ESLint
- `/test typecheck` → runs TypeScript type checking
- `/test tests/unit/shared/types/value-objects.test.ts` → runs a single file
