#!/usr/bin/env bash
# REPO-SCOUT: shallow clone of one repository at a pinned commit into a scratch directory (never into this repo).
# Usage: clone.sh <clones-dir> <id> <url> <sha>
set -euo pipefail
dir="$1/$2"
if [ -d "$dir/.git" ] && [ "$(git -C "$dir" rev-parse HEAD 2>/dev/null)" = "$4" ]; then exit 0; fi
mkdir -p "$dir"
git -C "$dir" init -q
git -C "$dir" remote add origin "$3" 2>/dev/null || git -C "$dir" remote set-url origin "$3"
for i in 1 2 3 4; do git -C "$dir" fetch -q --depth 1 origin "$4" && break; sleep $((2**i)); done
git -C "$dir" -c advice.detachedHead=false checkout -q FETCH_HEAD
test "$(git -C "$dir" rev-parse HEAD)" = "$4"
