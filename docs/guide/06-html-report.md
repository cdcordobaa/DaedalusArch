# 6. The HTML report (available in PR #140)

PR #140 adds `--html <file>` to `evaluate`. The run is a normal evaluation, with the same console output and exit
code. It also writes one HTML page meant for someone reviewing the architecture rather than reading a terminal.

```bash
npx tsx bin/firewall.ts evaluate --project fixtures/variant-a-structural --spec specs/clean-arch.yaml \
  --engine cypher-interp --symbolic-only --html report.html
# ... usual report on stderr ...
# HTML report written to /abs/path/report.html          (exit 1)
```

## Engine caveat

The PR branch (`v1.3-html-report`) was cut before `--engine cypher-interp` was merged into `v1.3`. On the branch
as-is, the command needs Neo4j:

- With `--engine cypher-interp`: `unknown option '--engine'`.
- Without it and with no database: `NEO4J_PASSWORD is not set`.

The run above was done on `v1.3` with the PR's commit applied on top. The only conflict was two adjacent option lines in
`src/cli/cli.ts`. Once PR #140 is merged into `v1.3`, the command works as shown.

## What is on the page

Tested on `fixtures/variant-a-structural` (43 KB, verdict FAIL, 17 findings) and `fixtures/correct-reference`
(36 KB, verdict PASS, 15 warnings):

- **Verdict**: "Fails: defining rules are broken" or "Passes: no defining rule is broken".
  - "What blocks the verdict" lists the broken defining rules in plain words. For variant-a: Dependencies point
    inward (2), No circular dependencies (2), The core does not depend outward (1).
  - "Scores": defining-rule score, overall health score, number of rules checked, and counts per tier.
- **Layer diagram**: the layers and the imports between them, as an inline SVG. Hovering an edge shows, for example,
  "domain depends on infrastructure: 1 import · 2 findings (not allowed by the spec)". A table version is under a
  disclosure.
- **Findings**: one card per finding. Each card has a plain-language rule title, the rule sentence, what was found,
  the import path, a code excerpt and a fix hint. Rule ids (`FF-S01`) are in tooltips.
- **Filters**: by tier ("defining rule (can fail)", "warning (never fails)", "not counted"), and by rule, layer and
  file.

The page is self-contained. CSS, script and SVG are inline, there are no external URLs, and a Content-Security-Policy
meta tag blocks network requests. You can attach it to a ticket or open it offline. The output has no timestamp, so
the same input gives the same file. Code excerpts skip `.env*` and secret-like files.

The page does not mention rules that failed to run. In the test runs (on `v1.3` before PR #135 was merged), FF-P05
failed under `cypher-interp` and showed only in the console's "Failed to run" list. PR #135 has since fixed that rule
on the in-process engine.

## The older `report` command

`v1.3` also has `firewall report -o report.html`. It runs its own evaluation, always needs Neo4j (it has no `--engine`
option), and its page loads Tailwind and Cytoscape from public CDNs, so it needs a network connection to render. For
new use, prefer `evaluate --html`.
