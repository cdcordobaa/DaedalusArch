#!/usr/bin/env node
// strip-keys.mjs <json> <name>...: prints the JSON with every property named <name> removed (at any depth), and every
// array element that is an object with a direct property whose value is <name> (e.g. a per-operator row
// `{ "positive": "AP-DUP-RULE2", ... }`), so a file whose only known difference is an added operator can still be
// compared byte for byte on everything else.
import { readFileSync } from 'node:fs';
const [file, ...keys] = process.argv.slice(2);
const drop = new Set(keys);
const names = (o) => (o !== null && typeof o === 'object' && !Array.isArray(o) ? Object.values(o) : []);
const strip = (v) => (Array.isArray(v) ? v.filter((x) => !names(x).some((y) => drop.has(y))).map(strip)
  : v !== null && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).filter(([k]) => !drop.has(k)).map(([k, x]) => [k, strip(x)]))
    : v);
process.stdout.write(`${JSON.stringify(strip(JSON.parse(readFileSync(file, 'utf8'))), null, 1)}\n`);
