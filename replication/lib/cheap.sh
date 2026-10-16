# Sourced by replication/smoke.sh (step 4). Cheap semantic proxies (pass 0.5): seeding the frozen AP operators and
# twins (type-checked copies, no model), then every proxy on every copy. No Neo4j, no LLM, no network.
# rows.csv and flags/*.json are expected byte-identical; scores.json carries generatedAt and per-project wall-clock
# timings, so it is compared after dropping exactly those fields (replication/lib/strip-timings.mjs).
run "cheap proxies: seed (judge-catch-seed.ts)" npx tsx scripts/v1.3/judge-catch-seed.ts --out "$OUT/cheap-work/seed"
run "cheap proxies: evaluate (cheap-semantics-eval.ts)" npx tsx scripts/v1.3/cheap-semantics-eval.ts --out "$OUT/cheap" --seed "$OUT/cheap-work/seed" --work "$OUT/cheap-work"
$CMP "results/v1.3-cheap-semantics" "$REPO/results/v1.3-cheap-semantics" "$OUT/cheap" --only '^(rows\.csv|flags/[^/]+\.json)$' $KNOWN || status=1
mkdir -p "$OUT/cheap-stripped/committed" "$OUT/cheap-stripped/regenerated"
node "$REPO/replication/lib/strip-timings.mjs" "$REPO/results/v1.3-cheap-semantics/scores.json" > "$OUT/cheap-stripped/committed/scores.json"
node "$REPO/replication/lib/strip-timings.mjs" "$OUT/cheap/scores.json" > "$OUT/cheap-stripped/regenerated/scores.json"
$CMP "results/v1.3-cheap-semantics/scores.json[timings stripped]" "$OUT/cheap-stripped/committed/scores.json" "$OUT/cheap-stripped/regenerated/scores.json" $KNOWN || status=1
