/**
 * DEVELOPMENT SET. Unit qualification of the AP-DUP-RULE2 E1 copies under the v1.3 cheap-fix clone units. Entry file.
 *
 * The 65 E1 cells (`../daedalus-e1-outcomes`) are not in every checkout, so the seeds cannot always be re-extracted.
 * The seed diffs are (`results/v1.3-judge-catch/duprule-v2/diffs/`): each adds `validate<Method>(…)` holding a verbatim
 * copy of the first service's guard. This script parses that copy and reports whether it is a clone unit before the
 * change (a fragment unit: at least `cloneMinTokens` tokens and a value comparison or arithmetic) and after it (a
 * fragment unit, or a guard unit not excluded by the trivial-null-check rule), with its guard key. It is a necessary
 * condition for a catch, not a catch: the pair also needs the original guard, which is in the base.
 *
 * Usage (repository root): npx tsx scripts/v1.3/cheapfix-e1-qualification.ts
 */
import * as fs from 'node:fs';
import { Project, SyntaxKind } from 'ts-morph';
import { densityOf } from '../../src/apg-enrich/cheap/behaviour.js';
import { guardShape, guardKey, isTrivialParamNullCheck } from '../../src/apg-enrich/cheap/guards.js';
import { normalisedTokens } from '../../src/apg-enrich/cheap/clones.js';
const D = 'results/v1.3-judge-catch/duprule-v2/diffs';
const seeds = fs.readdirSync(D).filter((f) => f.includes('__AP-DUP-RULE2__'));
for (const f of seeds) {
  const diff = fs.readFileSync(`${D}/${f}`, 'utf8');
  // The added validate<Method>(...) block: the + lines from the method header to its closing brace.
  const plus = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
  const start = plus.findIndex((l) => /^\s*validate\w*\(/.test(l));
  const body = plus.slice(start).join('\n');
  const src = `declare const __x: any;\nclass C {\n${body}\n`;
  const sf = new Project({ useInMemoryFileSystem: true }).createSourceFile('a.ts', src.endsWith('}\n') ? src + '}\n' : src);
  const m = sf.getDescendantsOfKind(SyntaxKind.MethodDeclaration).find((x) => x.getName().startsWith('validate'));
  const st = m?.getBody()?.getDescendantsOfKind(SyntaxKind.IfStatement)[0];
  if (st === undefined) { console.log(f, 'NO IF'); continue; }
  const g = guardShape(st); const d = densityOf(st);
  const frag = normalisedTokens(st).length >= 12 && d.comparisons + d.arithmetic > 0;
  console.log([f.replace('__AP-DUP-RULE2__0.diff', ''), st.getText().split('\n')[0], `fragment=${frag}`, `guard=${g !== undefined}`, `excluded=${isTrivialParamNullCheck(st)}`, g ? guardKey(g) : ''].join(' | '));
}
