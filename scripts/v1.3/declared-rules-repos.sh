#!/usr/bin/env bash
# The eleven repositories of the team-declared-rules study and how their team runs its own tool.
# Source this file with WORK (scratch) set; then `declared_case <key> <tree> <rule> <id-suffix> [reason]` runs one case
# (declared-rules-case.sh). Clones live in $WORK/repos/<owner>__<name> (blobless, never committed); tool versions are
# the ones the team pins (lockfile) at HEAD, installed in $WORK/tools (dependency-cruiser) or in the clone (ESLint).
# `Docs/DiagnosticRuns/v1.3-declared-rules-2026-10-16.md`.
: "${WORK:?}"
DECLARED_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
declared_env() {
  unset SPARSE HARNESS_BASE ESLINTRC PROBE PRINTFLAT RUNFLAT PLUGIN PLUGINKEY PARSER RULEIDS TSCONFIG
  case "$1" in
    himenon) ID=himenon-openapi-tcg; REPO=Himenon/openapi-typescript-code-generator; FAMILY=depcruise; SCOPE=.; CFG=.dependency-cruiser.cjs
      TOOLNM=$WORK/tools/dc-18.2.0/node_modules; ARGS=src; TOOLVER="dependency-cruiser 18.2.0 (depcruise src)";;
    manjericao) ID=manjericao-clean-arch; REPO=manjericao/TypeScript-Clean-Architecture-Blueprint; FAMILY=depcruise; SCOPE=.; CFG=.dependency-cruiser.js
      TOOLNM=$WORK/tools/dc-16.10.2/node_modules; ARGS=src; TOOLVER="dependency-cruiser 16.10.2 (depcruise src)";;
    bookadesk) ID=talanlabs-bookadesk; REPO=TalanLabs/bookadesk; FAMILY=depcruise; SCOPE=back; CFG=.dependency-cruiser.js
      TOOLNM=$WORK/tools/dc-9.24.0/node_modules; ARGS=src; TOOLVER="dependency-cruiser 9.24.0 (dependency-cruiser src)";;
    liveblocks) ID=liveblocks-core; REPO=liveblocks/liveblocks; FAMILY=depcruise; SCOPE=packages/liveblocks-core; CFG=.dependency-cruiser.js
      TOOLNM=$WORK/tools/dc-18.2.0/node_modules; ARGS="src --exclude __tests__"; TOOLVER="dependency-cruiser 18.2.0 (depcruise src --exclude __tests__)"
      SPARSE="/packages/liveblocks-core/ /shared/ /package.json /tsconfig*.json";;
    multiscrobbler) ID=foxxmd-multi-scrobbler; REPO=FoxxMD/multi-scrobbler; FAMILY=boundaries; SCOPE=.; CFG=eslint.config.js
      ARGS=src; PROBE=src/core/Api.ts; PRINTFLAT=true; RUNFLAT=true; PLUGIN=eslint-plugin-boundaries; PLUGINKEY=boundaries; PARSER=typescript-eslint
      RULEIDS=boundaries/element-types; TOOLVER="eslint 10 + eslint-plugin-boundaries 7.0.2 (boundaries/element-types, minimal config)";;
    artem) ID=artem-malko-react-ssr; REPO=artem-malko/react-ssr-template; FAMILY=boundaries; SCOPE=.; CFG=.eslintrc.js
      ARGS=src; PROBE=src/application/entry/index.tsx; PRINTFLAT=false; RUNFLAT=false; PLUGIN=eslint-plugin-boundaries; PLUGINKEY=boundaries
      PARSER=@typescript-eslint/parser; RULEIDS=boundaries/element-types; ESLINTRC=.eslintrc.js
      TOOLVER="eslint 8.56.0 + eslint-plugin-boundaries 4.2.0 (boundaries/element-types, minimal config)";;
    deneb) ID=deneb-app-core; REPO=deneb-viz/deneb; FAMILY=boundaries; SCOPE=packages/app-core; CFG=eslint.config.js
      ARGS=src; PROBE=src/index.ts; PRINTFLAT=true; RUNFLAT=true; PLUGIN=eslint-plugin-boundaries; PLUGINKEY=boundaries; PARSER=typescript-eslint
      RULEIDS=boundaries/element-types; TOOLVER="eslint 9 + eslint-plugin-boundaries 7.1.0 (boundaries/element-types from @deneb-viz/eslint-config, minimal config)";;
    polychrom) ID=evilmartians-figma-polychrom; REPO=evilmartians/figma-polychrom; FAMILY=boundaries; SCOPE=.; CFG=.eslintrc.cjs
      ARGS=src; PROBE=src/constants.ts; PRINTFLAT=false; RUNFLAT=false; PLUGIN=eslint-plugin-boundaries; PLUGINKEY=boundaries
      PARSER=@typescript-eslint/parser; RULEIDS=boundaries/element-types
      TOOLVER="eslint 8 + eslint-plugin-boundaries 3.4.1 (boundaries/element-types, minimal config)";;
    jstolua) ID=roblox-js-to-lua; REPO=Roblox/js-to-lua; FAMILY=nx; SCOPE=.; CFG=.eslintrc.json; ARGS="apps libs"; PROBE=libs/convert/src/index.ts
      PRINTFLAT=false; RUNFLAT=false; PLUGIN=@nrwl/eslint-plugin-nx; PLUGINKEY=@nrwl/nx; PARSER=@typescript-eslint/parser
      RULEIDS=@nrwl/nx/enforce-module-boundaries; HARNESS_BASE=tsconfig.base.json
      TOOLVER="eslint 8.15.0 + @nrwl/eslint-plugin-nx 15.0.0 (enforce-module-boundaries, minimal config; nx 15.0.0 project graph)";;
    gamify) ID=dutchhackers-gamify; REPO=dutchhackers/gamify; FAMILY=nx; SCOPE=.; CFG=.eslintrc.json; ARGS="apps libs"; PROBE=apps/gamify/api/src/main.ts
      PRINTFLAT=false; RUNFLAT=false; PLUGIN=@nrwl/eslint-plugin-nx; PLUGINKEY=@nrwl/nx; PARSER=@typescript-eslint/parser
      RULEIDS=@nrwl/nx/enforce-module-boundaries; HARNESS_BASE=tsconfig.base.json
      TOOLVER="eslint 8.23.1 + @nrwl/eslint-plugin-nx 14.7.5 (enforce-module-boundaries, minimal config; nx 14.7.5 project graph)";;
    plastikspace) ID=plastikaweb-plastikspace; REPO=plastikaweb/plastikspace; FAMILY=nx; SCOPE=.; CFG=.eslintrc.json; ARGS="apps libs"
      PROBE=apps/plastikaweb/src/main.ts; PRINTFLAT=false; RUNFLAT=false; PLUGIN=@nx/eslint-plugin; PLUGINKEY=@nx; PARSER=@typescript-eslint/parser
      RULEIDS=@nx/enforce-module-boundaries; HARNESS_BASE=tsconfig.base.json
      TOOLVER="eslint 8.57 + @nx/eslint-plugin 22.7.1 (enforce-module-boundaries, minimal config; nx 22.7.1 project graph)";;
    *) echo "unknown repo key $1" >&2; return 1;;
  esac
  CLONE=$WORK/repos/${REPO//\//__}
  [ -n "${TOOLNM:-}" ] && [ "$FAMILY" = depcruise ] || TOOLNM=$CLONE/node_modules
  export ID REPO FAMILY SCOPE CFG TOOLNM ARGS TOOLVER CLONE SPARSE HARNESS_BASE ESLINTRC PROBE PRINTFLAT RUNFLAT PLUGIN PLUGINKEY PARSER RULEIDS
}
declared_case() { # key tree rule suffix [reason]
  ( declared_env "$1" || exit 1
    ID="$ID/$4" TREE="$2" RULE="$3" REASON="${5:-}" KEEP="${KEEP:-0}" "$DECLARED_REPO_ROOT/scripts/v1.3/declared-rules-case.sh" )
}
