# 6. The HTML report

`evaluate --html <file>` (PR #140, merged in `v1.3`) runs a normal evaluation, with the same console output and exit
code. It also writes one HTML page meant for someone reviewing the architecture rather than reading a terminal.

```bash
npx tsx bin/firewall.ts evaluate --project fixtures/variant-a-structural --spec specs/clean-arch.yaml \
  --engine cypher-interp --symbolic-only --html report.html
# ... usual report on stderr ...
# HTML report written to /abs/path/report.html          (exit 1)
```

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

The page does not mention rules that failed to run. If the console report has a "Failed to run" list, read it there.

## The older `report` command

`v1.3` also has `firewall report -o report.html`. It runs its own evaluation, always needs Neo4j (it has no `--engine`
option), and its page loads Tailwind and Cytoscape from public CDNs, so it needs a network connection to render. For
new use, prefer `evaluate --html`.
