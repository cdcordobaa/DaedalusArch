// Docs/v1.3/rule-tiers.md and Docs/v1.3/sealed-hashes.md: sha256 of the committed sealed docs (recomputed from the
// files at HEAD) and the FF-P02 threshold in src/spec-parser/template-registry.ts. Sealed inputs outside the repo
// (../daedalus-sealed/**) and the v1.2e audit-log commits (not in this repository) are needs-external.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const T = 'Docs/v1.3/rule-tiers.md';
const S = 'Docs/v1.3/sealed-hashes.md';
const SEALED = 'The input is under ../daedalus-sealed/ (outside the repository, sealed by design); its hash cannot be recomputed here.';
const V12E = 'The value is said to be logged in aidlc-docs/audit.md on the v1.2e line (commits 3e69928f / 3837943f); those commits are not in this repository.';
const sha = (ctx, rel) => createHash('sha256').update(readFileSync(ctx.p(rel))).digest('hex');

export default [
  {
    id: 'a-tiers-hashes',
    title: 'Sealed-hash rows for committed docs; FF-P02 threshold',
    needs: 'offline',
    basis: 're-derived',
    slow: false,
    how: 'sha256 of Docs/v1.3/rule-tiers.md and Docs/v1.3/style-rule-sources.md at HEAD; FF-P02 threshold in src/spec-parser/template-registry.ts',
    numbers: [
      { id: 'a-th-ffp02-threshold', doc: T, line: 26, what: 'FF-P02 dependency-inversion ratio threshold (template registry)', stated: 'A ratio with a threshold (0.85)' },
      { id: 'a-th-sha-tiers', doc: S, line: 8, what: 'sha256 of Docs/v1.3/rule-tiers.md', stated: '290794e0bf8edc0d02b631b576b1181cb3e9fb603af3b4fd110a61b60543f27a' },
      { id: 'a-th-sha-sources', doc: S, line: 9, what: 'sha256 of Docs/v1.3/style-rule-sources.md', stated: '7ce49c630178bad9effd27ae4acce6286effcffd2099b6d353023fca23715c28' },
      { id: 'a-th-sha-study2', doc: S, line: 7, what: 'sha256 of ../daedalus-sealed/v1.3-study2-tasks.md', stated: '82a2f512e50d4eafb4ce6a42335adc2b6c2f882a6238e298a747303d0090169c', needs: 'needs-external', note: SEALED },
      { id: 'a-th-study2-tasks', doc: S, line: 7, what: 'Study 2 task count', stated: '6 multi-step greenfield tasks', needs: 'needs-external', note: SEALED },
      { id: 'a-th-sha-holdout', doc: S, line: 25, what: 'directory manifest hash of ../daedalus-sealed/v1.3-holdout', stated: '1379b561789b18133e0ca76eb8bcbba470543dcc1455d0260e54532a40f5fa8f', needs: 'needs-external', note: SEALED },
      { id: 'a-th-holdout-cases', doc: S, line: 25, what: 'hold-out cases', stated: '207 cases', needs: 'needs-external', note: SEALED },
      { id: 'a-th-sha-outsha', doc: S, line: 26, what: 'value inside v1.3-holdout/out.sha256', stated: 'cddec14a2863168af95c6254e93b1235e3a2ba631fe937599479688d3bb1fcc4', needs: 'needs-external', note: SEALED },
      { id: 'a-th-outsha-cases', doc: S, line: 26, what: 'hold-out cases covered by out.sha256', stated: '207-case set', needs: 'needs-external', note: SEALED },
      { id: 'a-th-outsha-logged', doc: S, line: 26, what: 'out.sha256 value equals the one logged in aidlc-docs/audit.md at 3e69928f', stated: 'Matches the value logged', needs: 'needs-external', note: V12E },
      { id: 'a-th-sha-62', doc: S, line: 27, what: 'content hash of the original 62-case hold-out (logged at 3837943f)', stated: 'a94360e1278208fd8391056873e0fa01c71fd14aad8da68dfcf74b669cb41feb', needs: 'needs-external', note: V12E },
      { id: 'a-th-62-cases', doc: S, line: 27, what: 'original hold-out size', stated: '62-case hold-out', needs: 'needs-external', note: V12E },
      { id: 'a-th-62-in-207', doc: S, line: 27, what: 'the original 62 cases are unchanged inside the 207-case set', stated: 'the original 62 cases are unchanged inside the 207-case set', needs: 'needs-external', note: `${V12E} ${SEALED}` },
      { id: 'a-th-sha-blind', doc: S, line: 28, what: 'directory manifest hash of ../daedalus-sealed/v1.3-blind', stated: '82209b390a6f79e5091e8db1420f07b12c34ab38966d2e999e8835ada9942987', needs: 'needs-external', note: SEALED },
      { id: 'a-th-62-207', doc: S, line: 30, what: 'hold-out enlargement', stated: 'enlarged from 62 to 207 cases', needs: 'needs-external', note: SEALED },
    ],
    async run(ctx) {
      const reg = ctx.read('src/spec-parser/template-registry.ts').match(/ff\('FF-P02'[^\n]*threshold: ([\d.]+)/);
      return {
        'a-th-ffp02-threshold': `A ratio with a threshold (${reg ? reg[1] : 'none'})`,
        'a-th-sha-tiers': sha(ctx, T),
        'a-th-sha-sources': sha(ctx, 'Docs/v1.3/style-rule-sources.md'),
      };
    },
  },
];
