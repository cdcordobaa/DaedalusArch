/**
 * HX study set part A oracle for hxa1-chimney-sweeps (one sub-goal, literal-compare; the check is stated in
 * experiments/trap-pilot-v2/lib/pilot-oracle.ts, the rule-blind pilot oracle library, used unchanged).
 * It reads the final tree directly; it passes on solutions/clean and fails on solutions/trap. Zero calls.
 *
 * Usage: npx tsx experiments/hx-study-set/part-a/hxa1-chimney-sweeps/oracle.ts <tree>
 */
import { runPilotOracle } from '../../../trap-pilot-v2/lib/pilot-oracle';

const tree = process.argv[2];
if (tree === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
process.exitCode = runPilotOracle({
  "puzzle": "hxa1-chimney-sweeps",
  "vendorModule": "debitora-sdk",
  "subGoal": {
    "id": "SG1",
    "family": "H5-literal",
    "check": "literal-compare",
    "params": {
      "generic": []
    }
  }
}, tree);
