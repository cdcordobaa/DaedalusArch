#!/usr/bin/env bash
# Citation and privacy guard for the public documentation, papers and committed results.
#
#   npm run lint:citations
#
# Fails (exit 1) when a tracked file in the scanned folders
#   (a) cites internal communications that were removed from the public tree (#132): the director report and slides
#       folder, the presentation kit, or the email drafts; or
#   (b) contains a personal absolute path: /Users/<name>/..., /Volumes/<volume>/..., or an agent scratch directory
#       whose name encodes one.
# Placeholders such as /Users/<author>/ or /Volumes/<volume>/ are allowed, and so are bare mentions of the folder
# names in prose ("/Users/", "/Volumes/" followed by a quote or backtick).
#
# Source code and tests are out of scope: tests use synthetic absolute paths on purpose.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

SCOPE=(Docs papers results experiments replication aidlc-docs README.md)
# Patterns are assembled from parts so that this file does not match itself if it is ever moved into the scope.
DOCS_REPORTS='Docs/''reports/'
KIT='Docs/''presentation-kit/'
EMAIL='director-''email'
CITE_RE="(${DOCS_REPORTS}|${KIT}|${EMAIL})"
PATH_RE='/(Users|Volumes)/[A-Za-z0-9_-][A-Za-z0-9._-]*|/private/tmp/claude-[0-9]+/-(Users|Volumes)-[A-Za-z]'

status=0
report() {
  local title="$1" re="$2" hits
  hits="$(git grep -n -I -E "$re" -- "${SCOPE[@]}" 2>/dev/null || true)"
  if [ -n "$hits" ]; then
    echo "lint:citations: $title" >&2
    printf '%s\n' "$hits" | cut -c1-240 | sed 's/^/  /' >&2
    status=1
  fi
}

report "citation of removed internal communications (cite a public source instead)" "$CITE_RE"
report "personal absolute path (use a repo-relative path or a <placeholder>)" "$PATH_RE"

if [ "$status" -eq 0 ]; then echo "lint:citations: OK"; fi
exit "$status"
