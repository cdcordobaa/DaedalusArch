#!/usr/bin/env node
import { main } from '../src/cli/index.js';

main().catch((err: unknown) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
});
