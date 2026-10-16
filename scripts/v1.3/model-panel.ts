/**
 * v1.3 model panel: an independent, multi-vendor panel of model raters for the "meaningful" label
 * (Docs/v1.3/model-panel.md). Entry file: no exports. Live calls happen only with `run --mode record`.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/model-panel.ts dry-run                       # fake raters, no model called
 *   npx tsx scripts/v1.3/model-panel.ts build --out-dir <dir> --seed <n> --wild results/v1.3-wild/review-sheet.md …
 *   npx tsx scripts/v1.3/model-panel.ts estimate --set <dir>/panel-set.json
 *   npx tsx scripts/v1.3/model-panel.ts run --set <dir>/panel-set.json --key <dir>/panel-key.json --out-dir <dir>
 *     --seed <n> --mode record --gemini <model> --openai <model> --claude <model>
 * Keys come from GEMINI_API_KEY and OPENAI_API_KEY in the environment; the Claude rater uses a dedicated logged-in
 * CLAUDE_CONFIG_DIR (default ~/.firewall/panel-claude-config). No credential file is ever read.
 */
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { panelMain } from './lib/panel/main.js';

const io = { env: process.env, out: (t: string) => process.stdout.write(t), err: (t: string) => process.stderr.write(t) };
const secrets = [process.env.GEMINI_API_KEY ?? '', process.env.OPENAI_API_KEY ?? ''].filter((s) => s !== '');

Promise.resolve().then(() => panelMain(process.argv.slice(2), process.cwd(), io)).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), secrets)}\n`);
    process.exitCode = 2;
  },
);
