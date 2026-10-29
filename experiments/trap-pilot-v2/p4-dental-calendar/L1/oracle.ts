/**
 * TRAP-PILOT-v2 oracle for p4-dental-calendar-L1 (one sub-goal, error-codes; the check is stated in ../../lib/pilot-oracle.ts).
 * It reads the final tree directly; it passes on solutions/clean and fails on solutions/trap. Zero calls.
 *
 * Usage: npx tsx experiments/trap-pilot-v2/p4-dental-calendar/L1/oracle.ts <tree>
 */
import { runPilotOracle } from '../../lib/pilot-oracle';

const tree = process.argv[2];
if (tree === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
process.exitCode = runPilotOracle({
  "puzzle": "p4-dental-calendar-L1",
  "vendorModule": "slotbook-sdk",
  "subGoal": {
    "id": "SG1",
    "family": "H5-codes",
    "check": "error-codes",
    "params": {}
  }
}, tree);
