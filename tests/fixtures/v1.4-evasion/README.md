# v1.4 evasion-check fixtures (synthetic)

SYNTHETIC, HAND-WRITTEN fixtures of the Study 2 evasion check (U5, decision M6;
`aidlc-docs/construction/v1.4/U5/functional-design/design.md` §2.4, §3.6). No file here comes from a model run or a
study task. Each case directory holds two snapshots (`t0/src/**`, `t1/src/**`), the blocking findings of each snapshot
in the loop `BlockingFinding` shape (`t0.findings.json`, `t1.findings.json`), an optional `rename.json` (the rename map
t0 -> t1 a store would give), and `expected.json` (the spec used, the expected diff kind, signals and class).

Specs:
- `spec.yaml`: `presets/layered.yaml` copied verbatim (layers persistence, business, presentation; closed layering).
- `spec-hexagonal.yaml`: `presets/hexagonal.yaml` copied verbatim (the `allowedDependencies` derivation).
- `spec-ddd.yaml`: `presets/ddd.yaml` with one extra `outside_contexts` glob, `src/scripts/**`, which no layer glob
  matches (in the preset both outside globs are also layer globs, so no file would be placed `outside`).
- `stub-specifier-target` uses the repository spec `specs/clean-arch.yaml` (the dry-run stub layout).

Cases: relocated-unmapped, relocated-unguarded, wrapped, inlined, dynamic-escape, deleted, true-fix-dip (class
`none`), avoided, cycle, rename-only (no eligible diff, EV-06b), stub-specifier-target (raw specifier target), edgeless
(no target), tool-tell (EV-06 redaction), outside-context (A3 exemption), observed-pair (listed, never counted, EV-06a).
