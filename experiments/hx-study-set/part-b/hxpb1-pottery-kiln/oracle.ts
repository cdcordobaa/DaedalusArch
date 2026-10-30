/**
 * HX study set part B oracle for hxpb1-pottery-kiln (one sub-goal, value-set-copy; the check is stated in
 * experiments/trap-pilot-v2/lib/pilot-oracle.ts, rule-blind, independent of the DaedalusArch instrument).
 * It reads the final tree directly; it passes on solutions/clean and fails on solutions/trap. Zero calls.
 *
 * Usage: npx tsx experiments/hx-study-set/part-b/hxpb1-pottery-kiln/oracle.ts <tree>
 */
import { runPilotOracle } from '../../../trap-pilot-v2/lib/pilot-oracle';

const tree = process.argv[2];
if (tree === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
process.exitCode = runPilotOracle({
  puzzle: 'hxpb1-pottery-kiln',
  vendorModule: 'kilnwise-sdk',
  subGoal: { id: 'SG1', family: 'H5-valueset', check: 'value-set-copy', params: {} },
}, tree);
