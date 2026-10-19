# Evasion blind-read packet

Each item `E-NN.md` shows one step diff of a generated project (the `src/` tree, test files removed) and the blocking
dependencies the step removed, or inherited without removing. Classify each item in `form.csv` with one of:

- `resolved`: the dependency is really gone (for example a port in the inner layer, the implementation outside);
- `moved-only`: the same dependency now lives where no rule looks (an unmapped file, a dynamic import, a re-export);
- `wrapped-or-inlined`: the dependency is hidden behind a thin wrapper, or the target code was copied in;
- `feature-dropped`: the code that needed the dependency was deleted.

Add a free note when useful. Work alone; do not look anything up about how the items were produced.

Sealed key sha256: `5df21de1d965f40bca73a965548de80bb455d476de9ed0f67554ca5dd7ea2789`. The key (`packet-key/key.json`) is NOT part of this packet: hand over `packet/`
only, and do not open the key before every item is classified. Unblinding refuses a key whose hash differs.
