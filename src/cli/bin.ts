#!/usr/bin/env node
/**
 * Executable entry of the packaged CLI (`daedalus`, `daedalus-arch`; v1.3 npx mode). `index.ts` is a re-export barrel
 * and runs nothing; `bin/firewall.ts` is the same entry for a repository checkout under tsx.
 */
import { main } from './cli.js';

main().catch((err: unknown) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
});
