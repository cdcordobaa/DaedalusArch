# Architecture

This codebase follows the Hexagonal (ports and adapters) architecture. `src/domain` and `src/application` are the
core; `src/adapters/in` holds the driving adapters (HTTP routes, the nightly scheduler); `src/adapters/out` holds the
driven adapters, one folder each; `src/main.ts` is the composition root. Every change keeps these rules.

1. **The core never depends on adapters.** No file in `src/domain` or `src/application` imports, names or receives a
   type from `src/adapters` or `src/main.ts`. Use cases depend only on the ports in `src/application/ports`.
2. **Driving adapters go through in-ports only.** A file in `src/adapters/in` calls the application only through an
   interface in `src/application/ports/in`. It never imports, names or is handed anything from `src/adapters/out`.
   Data it shows is read by a use case through an out-port in `src/application/ports/out`.
3. **Driven adapters do not use each other.** A file in `src/adapters/out/<name>` implements out-ports and uses only
   the core and files of its own folder. It never imports, names or is handed anything from another folder of
   `src/adapters/out`, nor from `src/adapters/in` or `src/main.ts`. Data held by one driven adapter reaches another
   only through a use case and the out-ports.
4. **Only the composition root wires.** `src/main.ts` alone creates adapters and use cases and connects them.
