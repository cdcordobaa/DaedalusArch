#!/bin/sh
# HX study set seal check (zero calls). From the repository root:
#   sh experiments/hx-study-set/verify-seal.sh
# 1. every file in SEAL.sha256 has its recorded sha256 (paths relative to experiments/);
# 2. the root (first 16 hex of the sha256 of SEAL.sha256) equals the `root` line of SEAL.root;
# 3. the sealed file list equals the tracked files of the 11 task folders plus study-set.json (no file added or left out).
set -eu
cd "$(dirname "$0")/.."
shasum -a 256 -c --quiet hx-study-set/SEAL.sha256
root=$(shasum -a 256 hx-study-set/SEAL.sha256 | cut -c1-16)
want=$(sed -n 's/^root \([0-9a-f]\{16\}\) .*/\1/p' hx-study-set/SEAL.root)
[ "$root" = "$want" ] || { echo "root $root differs from SEAL.root $want"; exit 1; }
dirs=$(node -e 'const s=require("./hx-study-set/study-set.json");for(const t of s.confirmatory.hexagonal)console.log(s.taskDirs[t].replace(/^experiments\//,""))')
# shellcheck disable=SC2086
listed=$( (git ls-files -- $dirs; echo hx-study-set/study-set.json) | sort)
sealed=$(sed 's/^[0-9a-f]\{64\}  //' hx-study-set/SEAL.sha256 | sort)
[ "$listed" = "$sealed" ] || { echo "sealed file list differs from the tracked files of the 11 task folders"; exit 1; }
echo "seal ok: root $root, $(echo "$sealed" | wc -l | tr -d ' ') files"
