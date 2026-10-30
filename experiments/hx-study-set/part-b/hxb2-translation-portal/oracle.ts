/**
 * HX study set part B oracle for hxb2-translation-portal (one sub-goal, value-set-copy; the check is stated in
 * experiments/trap-pilot-v2/lib/pilot-oracle.ts, rule-blind, independent of the DaedalusArch instrument).
 * It reads the final tree directly; it passes on solutions/clean and fails on solutions/trap. Zero calls.
 *
 * Usage: npx tsx experiments/hx-study-set/part-b/hxb2-translation-portal/oracle.ts <tree>
 */
import { runPilotOracle } from '../../../trap-pilot-v2/lib/pilot-oracle';

const tree = process.argv[2];
if (tree === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
process.exitCode = runPilotOracle({
  puzzle: 'hxb2-translation-portal',
  vendorModule: 'wordmarket-sdk',
  subGoal: { id: 'SG1', family: 'H5-valueset', check: 'value-set-copy', params: {} },
}, tree);
