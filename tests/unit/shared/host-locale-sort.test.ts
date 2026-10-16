/**
 * R13 (Docs/v1.3/post-merge-review-2026-10-16.md): the ontology and APG v2 outputs were sorted with a bare
 * `localeCompare`, whose order follows the host locale (LANG / LC_ALL). They now sort with one fixed collation
 * (en-US, the order the committed outputs were produced in), so a Danish host gives the same bytes as an en-US one.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(__dirname, '../../..');
const SAMPLE = ['aa', 'z', 'B', 'b', 'Order', 'order', 'Ångström'];

function sortedUnder(locale: string, expr: string): string[] {
  const script = `import { hostIndependentCompare } from ${JSON.stringify(path.join(REPO, 'src/shared/collation.ts'))};\n`
    + `const xs = ${JSON.stringify(SAMPLE)};\nprocess.stdout.write(JSON.stringify(${expr}));\n`;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
    cwd: REPO, env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', LANG: locale, LC_ALL: locale }, encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout) as string[];
}

describe('R13: host-independent sort order', () => {
  it('a bare localeCompare differs between en-US and da-DK hosts (the defect), the fixed collation does not', () => {
    expect(fs.existsSync(path.join(REPO, 'src/shared/collation.ts'))).toBe(true);
    const bare = (l: string): string[] => sortedUnder(l, '[...xs].sort((a, b) => a.localeCompare(b))');
    const fixed = (l: string): string[] => sortedUnder(l, '[...xs].sort(hostIndependentCompare)');
    expect(bare('da_DK.UTF-8')).not.toEqual(bare('en_US.UTF-8'));
    expect(fixed('da_DK.UTF-8')).toEqual(fixed('en_US.UTF-8'));
    expect(fixed('da_DK.UTF-8')).toEqual(bare('en_US.UTF-8'));
  }, 60_000);

  it('no bare localeCompare is left in the ontology or APG v2 sources', () => {
    const files = ['src/apg-enrich/ontology/units.ts', 'src/apg-enrich/ontology/clustering.ts', 'src/apg-enrich/ontology/pipeline.ts', 'src/apg-extractor/apg2/async-coupling.ts'];
    for (const f of files) expect(fs.readFileSync(path.join(REPO, f), 'utf8')).not.toMatch(/\.localeCompare\(/);
  });
});
