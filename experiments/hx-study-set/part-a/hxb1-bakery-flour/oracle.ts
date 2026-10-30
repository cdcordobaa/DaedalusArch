/**
 * HX study set part A oracle for hxb1-bakery-flour (one sub-goal, error-codes; the check is stated in
 * experiments/trap-pilot-v2/lib/pilot-oracle.ts, the rule-blind pilot oracle library, used unchanged).
 * It reads the final tree directly; it passes on solutions/clean and fails on solutions/trap. Zero calls.
 *
 * Usage: npx tsx experiments/hx-study-set/part-a/hxb1-bakery-flour/oracle.ts <tree>
 */
import { runPilotOracle } from '../../../trap-pilot-v2/lib/pilot-oracle';

const tree = process.argv[2];
if (tree === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
process.exitCode = runPilotOracle({
  "puzzle": "hxb1-bakery-flour",
  "vendorModule": "sackline-sdk",
  "subGoal": {
    "id": "SG1",
    "family": "H5-codes",
    "check": "error-codes",
    "params": {}
  }
}, tree);
