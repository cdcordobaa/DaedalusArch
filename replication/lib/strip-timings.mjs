#!/usr/bin/env node
// Prints a JSON file with the wall-clock fields removed: `generatedAt` and every key ending in `Ms` (extractMs,
// totalMs, timingsMs, ...). Everything else, key order included, is kept, so the result can be compared byte for byte.
import { readFileSync } from 'node:fs';
const strip = (v) => (Array.isArray(v) ? v.map(strip)
  : v !== null && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'generatedAt' && !/Ms$/.test(k)).map(([k, x]) => [k, strip(x)]))
    : v);
process.stdout.write(`${JSON.stringify(strip(JSON.parse(readFileSync(process.argv[2], 'utf8'))), null, 1)}\n`);
