# 7. Zero-config init for an existing codebase

If you have a codebase and no spec, there are three ways to get started without writing YAML. In each one, the
proposal comes from the code as it is now. If the code has always broken a rule the same way, the proposal may treat
that as the rule. Review what you get before you rely on it.

| Way | Branch | What you get |
|---|---|---|
| `init` | merged in `v1.3` (PR #150) | A spec file: style, layer globs and the preset's rules |
| `evaluate --from-inferred` | merged in `v1.3` (PR #150) | A one-off evaluation on an inferred spec, with nothing written |
| `mine-rules` | available in PR #145 | Dependency rules the code already follows, plus the files that break them |
| MCP `infer_spec`, `propose_spec` | merged in `v1.3` | The same inference, as MCP tools (chapter 4) |

## `init`

`init` needs `src/` and `tsconfig.json` at the project root. It picks one of the five styles and maps your folders
to its layers. It writes `firewall.spec.yaml` into the project. Everything except the layer globs is copied from the
style's preset.

```bash
mkdir /tmp/my-app && cp -r fixtures/variant-a-structural/src fixtures/variant-a-structural/tsconfig.json /tmp/my-app/
npx tsx bin/firewall.ts init --project /tmp/my-app
echo $?    # 0
```

```
Proposed spec (inferred spec, not author-declared)
  style: clean-architecture (confidence 0.78; runner-up layered 0.22)
  layer map:
    domain             src/domain/**          preset   0.90  canonical preset glob; name suggests domain; structure suggests application (dependency level 1); 2 files
    application        src/application/**     preset   0.90  canonical preset glob; name suggests application; structure suggests infrastructure (dependency level 3); 1 file
    infrastructure     src/infrastructure/**  preset   0.60  canonical preset glob; structure suggests domain (dependency level 0); 3 files
  questions (2):
    Q1. Is src/application/ the application layer? Its name and its imports disagree (confidence 0.90).
    Q2. Is src/domain/ the domain layer? Its name and its imports disagree (confidence 0.90).
Wrote /tmp/my-app/firewall.spec.yaml (inferred spec, not author-declared). Review the lines marked INFERRED and the questions at its end.
```

The questions are the useful part. This project's imports go the wrong way (that is the defect planted in the
fixture), so the folder names and the dependency structure disagree, and `init` asks you which is right. On
`fixtures/correct-reference` it asks no questions.

The file starts with a header saying it is inferred. Each layer glob has a comment with its source and confidence, and
the questions are repeated at the end. Once you have reviewed it, rename it or commit it as your spec, and evaluate:

```bash
npx tsx bin/firewall.ts evaluate --project /tmp/my-app --spec /tmp/my-app/firewall.spec.yaml \
  --engine cypher-interp --symbolic-only
#   v1.3 scoring: FAIL ... FF-S01 dependency-direction: 2, FF-S02 no-cyclic-deps: 2, FF-S04 no-domain-outward-dep: 1   (exit 1)
```

These are the same findings as with the hand-written `specs/clean-arch.yaml`.

Options and behaviour:

- `--print` writes the YAML to stdout and writes nothing to disk. Use it as a dry run.
- `--out <file>` writes the spec to another path.
- `--format json` gives the proposal as data: `style`, `ranking`, `mappings`, `questions`, `check`, `yaml`.
- `init` never overwrites. If the project already has `firewall.spec.yaml`, `spec.yaml`, `.firewall.yaml` or
  `architecture.yaml`, it stops with exit 1.
- Exit 2 means the project could not be read, for example because there is no `src/`.
- There is no `--style` flag. To force a style, use the MCP tool `infer_spec`, which takes `style`.

## `evaluate --from-inferred`

To evaluate without writing a spec:

```bash
npx tsx bin/firewall.ts evaluate --project /tmp/my-app --from-inferred --engine cypher-interp --symbolic-only
echo $?    # 1
```

The project's own spec file is ignored here. The report is wrapped in a banner:

```
*** INFERRED SPEC, NOT AUTHOR-DECLARED ***
Rules ran on the spec ISE inferred from this code: style clean-architecture (confidence 0.78), 3 layer mappings, 2 open question(s).
Findings are relative to the code's own majority patterns; run `firewall init` to review and declare the spec.
```

In JSON, `specSource.kind` is `"inferred"`. `--from-inferred` and `--spec` cannot be used together (exit 2).

## Rule mining (available in PR #145)

`init` takes the rules from a preset. `mine-rules` instead looks at the imports the code actually has, and proposes
the dependency rules it follows: layer direction, rarely used edges, no cycles. It lists the files that break each
rule. It uses no LLM and no database.

```bash
git checkout v1.3-rule-mining
S=$(mktemp -d)
cp -r tests/fixtures/v1.3-reference/layered/project "$S/layered-v03"
(cd "$S/layered-v03" && patch -p1 < "$OLDPWD/tests/fixtures/v1.3-reference/layered/variants/v03-controller-reads-gateway/variant.patch")
npx tsx bin/firewall.ts mine-rules --project "$S/layered-v03" --out "$S/mined.yaml"
```

```
PROPOSED rules: mined from the code (deterministic, no LLM), not a reviewed spec. Review before use; exceptions are candidate violations, not confirmed ones.
Style: layered (ISE confidence 1.00); layers: business (11 files), persistence (7 files), presentation (8 files)
Allowed layer dependencies: business -> persistence, presentation -> business
8 proposed rules (5 high, 0 medium, 3 low confidence), 1 exceptions
[high 0.80] MR-001 layer-direction: persistence must not depend on business (11 edges business -> persistence; ...)
[high 0.96] MR-005 acyclic-files: no file lies on an import cycle (27/27 files do not)
[low 0.39] MR-004 layer-rare-edge: presentation should not depend on persistence (1/8 presentation files imports it; nothing goes back)
    candidate violation: src/presentation/http/CatalogController.ts -> src/persistence/ProductGateway.ts
...
Proposed spec: valid; compiles to dependency-direction, no-cyclic-deps, no-layer-skip
```

The planted defect (a controller reading a gateway directly) is the one exception. Note that it comes with **low**
confidence: one file doing something unusual looks much the same as a rare but legitimate pattern.

The written spec enables only the rules that mining backs (each marked `# mined: MR-xxx`). It disables the rest with
the reason "not mined". Validate and evaluate it like any spec:

```bash
npx tsx bin/firewall.ts validate --spec "$S/mined.yaml" --project "$S/layered-v03"                              # exit 0
npx tsx bin/firewall.ts evaluate --project "$S/layered-v03" --spec "$S/mined.yaml" --engine cypher-interp --symbolic-only
#   v1.3 scoring: FAIL ... FF-S03 no-layer-skip: 1      (exit 1)
```

Options: `--min-confidence 0..1` drops weaker rules. `--format json` gives `rules[]` with `evidence`, `exceptions` and
`compilesTo`. `--style` and `--max-exceptions` are also accepted.

Where mining goes wrong: when most of the code breaks a rule, mining learns the violation as the rule. On
`fixtures/variant-a-structural` (6 files, several wrong-way imports) it proposed "domain -> infrastructure" as an
allowed dependency and reported no exceptions. Mining works best on a codebase that is mostly right and has a few
outliers.
