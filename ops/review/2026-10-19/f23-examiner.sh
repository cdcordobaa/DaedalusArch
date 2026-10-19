#!/usr/bin/env bash
# F23 by an independent Fable examiner. RUN THIS YOURSELF in a separate terminal (not with "!" inside Claude Code,
# which would put the output in that session). Run it from the repository root:
#   bash ops/review/2026-10-19/f23-examiner.sh
# The examiner runs in a fresh empty folder, with no tools, no hooks, no memory, no project files and no saved
# transcript. It sees only the prompt plus the sealed file, and prints a verdict that names candidate domains only.
set -euo pipefail
SEALED=../daedalus-sealed/v1.3-study2-tasks.md
EXPECTED=82a2f512e50d4eafb4ce6a42335adc2b6c2f882a6238e298a747303d0090169c   # Docs/v1.3/sealed-hashes.md row 1
PROMPT="$(pwd)/ops/review/2026-10-19/f23-examiner-prompt.md"
GOT=$(shasum -a 256 "$SEALED" | cut -d' ' -f1)
if [ "$GOT" != "$EXPECTED" ]; then echo "STOP: sealed file hash mismatch (S14). Do not continue."; exit 1; fi
echo "sealed hash OK"
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT; cd "$WORK"
ARGS=(-p --model claude-fable-5-1 --no-session-persistence --tools "" --strict-mcp-config)
if ! cat "$PROMPT" "$OLDPWD/$SEALED" | claude --bare "${ARGS[@]}"; then
  echo "(--bare failed, probably auth; retrying without it: still no tools, no MCP, no transcript)"
  cat "$PROMPT" "$OLDPWD/$SEALED" | claude "${ARGS[@]}"
fi
