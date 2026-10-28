# Architecture

This codebase follows the Hexagonal (ports and adapters) architecture. Every change keeps these rules.

1. **The core depends on nothing outside it.** The core is `src/domain` and `src/application`. No core file imports,
   re-exports or loads a module from `src/adapters` or `src/main.ts`, not even a type.
2. **Use cases reach the outside world only through out-ports.** Anything a use case needs from outside (storage,
   time, external services) is an interface in `src/application/ports/out`, written in the core's own types. An
   outbound adapter in `src/adapters/out` implements it.
3. **Only the composition root creates adapters.** `src/main.ts` constructs every adapter and hands it to the use
   cases through their constructors. A use case never constructs an adapter itself.
4. **Inbound adapters call the application through in-ports.** Code in `src/adapters/in` depends on the interfaces in
   `src/application/ports/in` and on core types, never on outbound adapters.
5. **The domain stands alone.** Files in `src/domain` import only other files in `src/domain`.
