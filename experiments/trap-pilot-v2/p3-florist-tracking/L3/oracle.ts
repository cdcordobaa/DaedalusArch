/**
 * TRAP-PILOT-v2 oracle for p3-florist-tracking-L3 (one sub-goal, value-set-copy; the check is stated in ../../lib/pilot-oracle.ts).
 * It reads the final tree directly; it passes on solutions/clean and fails on solutions/trap. Zero calls.
 *
 * Usage: npx tsx experiments/trap-pilot-v2/p3-florist-tracking/L3/oracle.ts <tree>
 */
import { runPilotOracle } from '../../lib/pilot-oracle';

const tree = process.argv[2];
if (tree === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
process.exitCode = runPilotOracle({
  "puzzle": "p3-florist-tracking-L3",
  "vendorModule": "trackline-sdk",
  "subGoal": {
    "id": "SG1",
    "family": "H5-valueset",
    "check": "value-set-copy",
    "params": {}
  }
}, tree);
