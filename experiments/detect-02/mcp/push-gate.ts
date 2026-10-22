/**
 * DETECT-02 push mode (exploratory): the same check as `check_consistency`, run by the loop harness on the working
 * tree after each agent turn, like a CI gate. Prints the findings text to stdout (append it to the next prompt) and
 * nothing else; prints nothing when the tree is clean or not applicable, unless --always. No model call.
 *
 *   npx tsx experiments/detect-02/mcp/push-gate.ts --project <dir> --spec <spec.yaml> [--files a.ts,b.ts] [--json] [--always]
 * Exit code: 0 clean or not applicable, 1 violations, 2 error.
 */
import { checkConsistency, formatText } from './consistency.js';

const argv = process.argv.slice(2);
const arg = (k: string): string | undefined => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const project = arg('project');
if (project === undefined) { process.stderr.write('usage: push-gate.ts --project <dir> --spec <spec.yaml> [--files a,b] [--json] [--always]\n'); process.exit(2); }
const files = arg('files')?.split(',').filter((x) => x !== '');
checkConsistency({ root: project, ...(arg('spec') ? { spec: arg('spec')! } : {}), ...(files ? { files } : {}) }).then((res) => {
  if (argv.includes('--json')) process.stdout.write(`${JSON.stringify(res, null, 1)}\n`);
  else if (res.status === 'violations' || argv.includes('--always')) process.stdout.write(`${formatText(res)}\n`);
  process.exitCode = res.status === 'violations' ? 1 : 0;
}, (e: unknown) => { process.stderr.write(`push-gate failed: ${e instanceof Error ? e.message : String(e)}\n`); process.exitCode = 2; });
