# Architecture

This codebase follows the Hexagonal (ports and adapters) architecture. Every change keeps these rules.

1. **The core stands alone.** `src/domain` and `src/application` are the core. No core file imports, names,
   constructs or loads anything from `src/adapters` or `src/main.ts`, not even a type.
2. **The core reaches the outside only through out-ports.** Storage, clocks, generators, devices and third-party
   services are reached through the interfaces in `src/application/ports/out`, written in the core's own terms. Each is
   implemented in `src/adapters/out`, and the core receives the implementation through its constructor.
3. **Driving adapters call only in-ports.** A file in `src/adapters/in` (HTTP routes, message handlers) turns a request
   into a call on an interface in `src/application/ports/in` and turns the answer back. It never uses an out-port or
   anything in `src/adapters/out` itself, and never reads or writes stored state directly.
4. **Only the composition root wires.** `src/main.ts` alone creates adapters and services and hands each its
   collaborators. A driving adapter is handed in-ports only; a service is handed out-ports only.
