/**
 * TRAP-PILOT-v2 oracle for p5-allotment-letters-L2 (one sub-goal, structural; the check is stated in ../../lib/pilot-oracle.ts).
 * It reads the final tree directly; it passes on solutions/clean and fails on solutions/trap. Zero calls.
 *
 * Usage: npx tsx experiments/trap-pilot-v2/p5-allotment-letters/L2/oracle.ts <tree>
 */
import { runPilotOracle } from '../../lib/pilot-oracle';

const tree = process.argv[2];
if (tree === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
process.exitCode = runPilotOracle({
  "puzzle": "p5-allotment-letters-L2",
  "vendorModule": "postbird-sdk",
  "subGoal": {
    "id": "SG1",
    "family": "H2/H1b",
    "check": "structural",
    "params": {}
  }
}, tree);
