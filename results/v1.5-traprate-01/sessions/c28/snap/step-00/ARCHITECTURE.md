# Architecture

This codebase follows the Hexagonal (ports and adapters) architecture. The application core is `src/domain` and
`src/application`; `src/adapters/in` holds the adapters that drive the application (HTTP handlers), `src/adapters/out`
the adapters it drives (stores, the clock); `src/main.ts` is the composition root. Every change keeps these rules.

1. **The core never depends on adapters.** No file in `src/domain` or `src/application` imports, or uses a type or value
   from, `src/adapters` or `src/main.ts`. Use cases depend only on ports: the interfaces in `src/application/ports`.
2. **Driving adapters go through the application.** An adapter in `src/adapters/in` calls the application only through
   an in-port (`src/application/ports/in`) and never imports or uses an adapter in `src/adapters/out`; the stored data
   is read by a use case through an out-port (`src/application/ports/out`), which an adapter in `src/adapters/out`
   implements.
3. **Only the composition root wires.** `src/main.ts` is the only file that creates adapters and hands them to use
   cases and handlers.
