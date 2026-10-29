/**
 * TRAP-PILOT-v2 oracle for p2-bookshop-metadata-L2 (one sub-goal, vendor-fields; the check is stated in ../../lib/pilot-oracle.ts).
 * It reads the final tree directly; it passes on solutions/clean and fails on solutions/trap. Zero calls.
 *
 * Usage: npx tsx experiments/trap-pilot-v2/p2-bookshop-metadata/L2/oracle.ts <tree>
 */
import { runPilotOracle } from '../../lib/pilot-oracle';

const tree = process.argv[2];
if (tree === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
process.exitCode = runPilotOracle({
  "puzzle": "p2-bookshop-metadata-L2",
  "vendorModule": "shelfdata-sdk",
  "subGoal": {
    "id": "SG1",
    "family": "H5-fields",
    "check": "vendor-fields",
    "params": {
      "generic": [
        "subtitle",
        "title",
        "author",
        "apiKey"
      ]
    }
  }
}, tree);
