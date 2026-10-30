/**
 * HX study set part B oracle for hxpb3-observatory-evenings (one sub-goal, transport; the check is stated in
 * experiments/trap-pilot-v2/lib/pilot-oracle.ts, rule-blind, independent of the DaedalusArch instrument).
 * It reads the final tree directly; it passes on solutions/clean and fails on solutions/trap. Zero calls.
 *
 * Usage: npx tsx experiments/hx-study-set/part-b/hxpb3-observatory-evenings/oracle.ts <tree>
 */
import { runPilotOracle } from '../../../trap-pilot-v2/lib/pilot-oracle';

const tree = process.argv[2];
if (tree === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
process.exitCode = runPilotOracle({
  puzzle: 'hxpb3-observatory-evenings',
  vendorModule: 'nightdome-sdk',
  subGoal: { id: 'SG1', family: 'H2-transport', check: 'transport', params: {} },
}, tree);
