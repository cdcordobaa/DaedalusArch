# Sourced by replication/smoke.sh (step 5). Judge catch scores, replayed from the committed cassettes
# (tests/fixtures/judge-cassettes-v13/**): votes, confidences, catch / false-fail rates, Wilson intervals. The scorers
# read the committed evaluate reports and cassettes only: no Neo4j, no model, no network. They overwrite scores.json
# and rows.csv inside --results, so they run on a copy of results/v1.3-judge-catch inside the scratch tree.
J="$TREE/results/v1.3-judge-catch"
run "judge catch round 1: score from cassettes" npx tsx scripts/v1.3/judge-catch-score.ts --results "$J"
run "judge catch round 2: score from cassettes" npx tsx scripts/v1.3/judge-catch2-score.ts --results "$J/round2" --round1 "$J"
run "judge catch DUP-RULE v2: score from cassettes" npx tsx scripts/v1.3/judge-catch-v2-score.ts --results "$J/duprule-v2"
for d in "" round2 duprule-v2; do
  $CMP "results/v1.3-judge-catch${d:+/$d}" "$REPO/results/v1.3-judge-catch${d:+/$d}" "$J${d:+/$d}" --only '^(scores\.json|rows\.csv)$' $KNOWN || status=1
done
# Known divergence D-5, checked rather than waved through: without the AP-DUP-RULE2 keys the round 1 and round 2
# scores.json must be equal to the committed ones.
for d in "" round2; do
  k="$OUT/judge-stripped/${d:-round1}"; mkdir -p "$k/committed" "$k/regenerated"
  node "$REPO/replication/lib/strip-keys.mjs" "$REPO/results/v1.3-judge-catch${d:+/$d}/scores.json" AP-DUP-RULE2 > "$k/committed/scores.json"
  node "$REPO/replication/lib/strip-keys.mjs" "$J${d:+/$d}/scores.json" AP-DUP-RULE2 > "$k/regenerated/scores.json"
  $CMP "results/v1.3-judge-catch${d:+/$d}/scores.json[AP-DUP-RULE2 stripped]" "$k/committed" "$k/regenerated" || status=1
done
