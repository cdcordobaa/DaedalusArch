# Architecture

This codebase follows the Hexagonal (ports and adapters) architecture. `src/domain` and `src/application` are the
core; `src/adapters/in` drives it, `src/adapters/out` is driven by it, and `src/main.ts` wires them. Every change keeps
these rules.

1. **The core depends on nothing outside it.** Code in `src/domain` and `src/application` never imports, calls or
   names anything from `src/adapters` or `src/main.ts`, and imports no package. It does not read the system clock,
   time-zone data or the environment itself. It reaches the outside world only through the interfaces in
   `src/application/ports/out`, which the code in `src/adapters/out` implements.
2. **Driving code goes through the in-ports.** Code in `src/adapters/in` calls the core only through the interfaces in
   `src/application/ports/in`.
3. **The core does not know how it is called.** Transport details such as HTTP status codes, headers and response
   shapes live in `src/adapters/in`. The core reports outcomes in its own results and errors.
4. **Only `src/main.ts` wires.** It is the one place that creates adapters and hands them to the core.
