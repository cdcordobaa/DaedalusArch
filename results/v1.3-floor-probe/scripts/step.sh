#!/bin/sh
# usage: step.sh <projdir> <message>  -> type-check (the frame's only check), then commit the tree. No firewall.
cd "$1" || exit 2
./node_modules/.bin/tsc -p tsconfig.json; rc=$?
if [ $rc -ne 0 ]; then echo "TYPECHECK FAILED"; exit 1; fi
git add -A src && git commit -qm "$2" && echo "committed: $2"
