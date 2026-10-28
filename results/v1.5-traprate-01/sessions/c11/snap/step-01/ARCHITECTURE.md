# Architecture

This codebase follows the Hexagonal (ports and adapters) architecture. Every change keeps these rules.

1. **The core never depends on adapters.** Code in `src/domain` and `src/application` never imports, names or
   constructs anything from `src/adapters` or `src/main.ts`, not even a type.
2. **The core reaches the outside world only through out-ports.** When application code needs something from outside
   (stored data, a third-party service, the time), it declares an interface in `src/application/ports/out`, written in
   the application's own terms, and an adapter in `src/adapters/out` implements it.
3. **Driving adapters call the application only through in-ports.** Code in `src/adapters/in` (routes and other
   incoming calls) calls the interfaces in `src/application/ports/in` and never uses `src/adapters/out`, the out-ports or
   `src/main.ts`.
4. **Only the composition root wires.** `src/main.ts` creates the adapters, hands them to the application as
   implementations of its out-ports, and hands the application to the driving adapters.
