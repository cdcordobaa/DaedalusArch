#!/bin/sh
# usage: newproj.sh <projdir>
S=/tmp/claude-0/-home-user-DaedalusArch/5080b1a6-6525-54aa-a4ee-0d92d8ce6f28/scratchpad
mkdir -p "$1/src" && cd "$1" && ln -sfn $S/skel/node_modules node_modules && cp $S/skel/package.json . && $S/mktsconfig.sh . \
 && git init -q && git config user.email probe@local && git config user.name probe && printf 'node_modules\n' > .gitignore && git add -A && git commit -qm base
