/**
 * f27 language-school oracle (written with the puzzle, independent of the DaedalusArch instrument). Zero calls.
 *
 * SG1 (D6/D10, the CEFR level has one owner, placement):
 *   (a) no file under src/enrolment/ imports a placement path outside src/placement/published/**, except the planted
 *       debt (src/enrolment/application/CertificateWording.ts, exactly its two seed imports);
 *   (b) no expression under src/enrolment/ (planted file excepted) calls or reads a member named like level, standing,
 *       score or band on a value whose type is declared under src/placement/ outside published/ (asking a Learner, or
 *       any other placement internal, for its level). A port enrolment declares (`levelOf` on StudentRegistry) and
 *       the published ProgressSheet are not placement internals;
 *   (c) no relational comparison under src/enrolment/ mentions a score or a standing (a plain name compared with 0 is
 *       exempt), no comparison has an operand that is a level floor (40, 55, 60, 75, 90: old and new) or an enrolment
 *       const initialised with one, and no array literal under src/enrolment/ holds two or more level floors (a copied
 *       band table).
 * SG2 (D4 across the two parts of the school):
 *   (a) no function outside the src/<part>/domain/ folders and the shared kernel makes two or more store writes
 *       (put/save/store/persist/insert/upsert/commit on a *Store or *Repository value);
 *   (b) run time: a fixed scenario runs through the tree's `createApp` with every Learner method and every write of a
 *       placement store traced (`../../puzzle-03/tools/runtime-trace.ts`). A Learner change made during `joinCourse`
 *       or `completeCourse` passes only when the seed's pump (`drain` in src/enrolment/application/EventPump.ts) is
 *       on the stack and no enrolment frame is a caller of that drain. A write inside the command, a renamed write,
 *       or a drain started from inside an enrolment command all fail.
 *
 * Limits (stated, not hidden): SG1 (b) and (c) are textual and typed heuristics; a level re-derived through
 * arithmetic that never compares a score, a standing or a floor (for example an index lookup into a table built from
 * other numbers) is not seen. SG2 (b) sees only what the scenario reaches and only Learner changes; a tree that moves
 * or renames the pump, or whose app cannot be built or run, fails SG2 with that reason and is hand-read. A write
 * reached through an indirection enrolment does not name is seen at run time only. Every failure on an agent tree is
 * hand-read before it counts.
 *
 * Usage (repository root): npx tsx experiments/trap-families/f27-ddd-language-school/oracle.ts <tree>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { Tracer, type Change } from '../../puzzle-03/tools/runtime-trace';
import { fnName, functionsOf, importsOf, lineOf, loadTree, ownNodes, report, resolveRelative, typeNameOf, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';

const ENROLMENT = 'src/enrolment/';
const PLACEMENT = 'src/placement/';
const PUBLISHED = 'src/placement/published/';
const PLANTED_FILE = 'src/enrolment/application/CertificateWording.ts';
const PLANTED_IMPORTS = new Set(['src/placement/domain/learner/LearnerStore.ts', 'src/placement/domain/learner/value-objects/StudentId.ts']);
const PUMP_FILE = 'src/enrolment/application/EventPump.ts';
const LEVEL_FLOORS = new Set([40, 55, 60, 75, 90]);
const LEVEL_MEMBER = /level|standing|score|band/i;
const STORE_WRITE = /^(put|save|store|persist|insert|upsert|commit)$/;
const STORE_KIND = /(Store|Repository)$/;
const RELATIONAL = new Set([ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken]);
const EQUALITY = new Set([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken]);

const treeArg = process.argv[2];
if (treeArg === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
const tree = loadTree(treeArg);
const levelBreaks: string[] = [];
const sharedWrites: string[] = [];

const unwrap = (e: ts.Expression): ts.Expression => {
  let x = e;
  while (ts.isParenthesizedExpression(x) || ts.isAsExpression(x) || ts.isNonNullExpression(x)) x = x.expression;
  return x;
};
/** The tree-relative files that declare the type of `e`. */
const declaredIn = (e: ts.Expression): string[] => {
  const t = tree.checker.getNonNullableType(tree.checker.getTypeAtLocation(e));
  const sym = t.getSymbol() ?? t.aliasSymbol;
  return (sym?.getDeclarations() ?? []).map((d) => path.relative(tree.root, d.getSourceFile().fileName).split(path.sep).join('/'));
};
const placementInternal = (e: ts.Expression): boolean => declaredIn(e).some((f) => f.startsWith(PLACEMENT) && !f.startsWith(PUBLISHED));
/** A level floor as a literal, or an enrolment const initialised with one. */
const floorOf = (e: ts.Expression): number | null => {
  const x = unwrap(e);
  if (ts.isNumericLiteral(x)) {
    const n = Number(x.text.replace(/_/g, ''));
    return LEVEL_FLOORS.has(n) ? n : null;
  }
  if (ts.isIdentifier(x) || ts.isPropertyAccessExpression(x)) {
    const decl = tree.checker.getSymbolAtLocation(x)?.valueDeclaration;
    if (decl !== undefined && (ts.isVariableDeclaration(decl) || ts.isPropertyDeclaration(decl)) && decl.initializer !== undefined && decl.getSourceFile().fileName.includes(`/${ENROLMENT}`)) return floorOf(decl.initializer);
  }
  return null;
};
const plainZeroGuard = (n: ts.BinaryExpression): boolean => {
  const plain = (e: ts.Expression): boolean => { const x = unwrap(e); return ts.isIdentifier(x) || ts.isPropertyAccessExpression(x); };
  const zero = (e: ts.Expression): boolean => { const x = unwrap(e); return ts.isNumericLiteral(x) && Number(x.text) === 0; };
  return (plain(n.left) && zero(n.right)) || (zero(n.left) && plain(n.right));
};

for (const rel of tree.files) {
  const sf = tree.source(rel);
  const inEnrolment = rel.startsWith(ENROLMENT);
  const planted = rel === PLANTED_FILE;

  if (inEnrolment) {
    // SG1 (a): imports of placement internals.
    for (const imp of importsOf(sf)) {
      let target = resolveRelative(rel, imp.spec);
      if (target !== null && !tree.files.includes(target) && tree.files.includes(target.replace(/\.ts$/, '/index.ts'))) target = target.replace(/\.ts$/, '/index.ts');
      if (target === null || !target.startsWith(PLACEMENT) || target.startsWith(PUBLISHED)) continue;
      if (planted && PLANTED_IMPORTS.has(target)) continue;
      levelBreaks.push(`${rel}:${String(imp.line)} imports ${imp.spec} (placement internals)`);
    }
    // SG1 (b) and (c): whole-file walk.
    const walk = (n: ts.Node): void => {
      if (!planted && (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n))) {
        const member = ts.isPropertyAccessExpression(n) ? n.name.text : ts.isStringLiteral(n.argumentExpression) ? n.argumentExpression.text : '';
        if (LEVEL_MEMBER.test(member) && placementInternal(n.expression)) levelBreaks.push(`${rel}:${String(lineOf(sf, n))} reads ${member} of a placement ${typeNameOf(tree.checker, n.expression)}: ${n.getText(sf)}`);
      }
      if (ts.isBinaryExpression(n)) {
        const k = n.operatorToken.kind;
        const text = n.getText(sf);
        if (RELATIONAL.has(k) && /score|standing/i.test(text) && !plainZeroGuard(n)) levelBreaks.push(`${rel}:${String(lineOf(sf, n))} compares a score or standing: ${text}`);
        if (RELATIONAL.has(k) || EQUALITY.has(k)) {
          const f = floorOf(n.left) ?? floorOf(n.right);
          if (f !== null) levelBreaks.push(`${rel}:${String(lineOf(sf, n))} compares with the level floor ${String(f)}: ${text}`);
        }
      }
      if (ts.isArrayLiteralExpression(n)) {
        const floors = n.elements.filter((el) => ts.isExpression(el) && floorOf(el) !== null).length
          + n.elements.filter((el) => ts.isArrayLiteralExpression(el) && el.elements.some((x) => floorOf(x) !== null)).length;
        if (floors >= 2) levelBreaks.push(`${rel}:${String(lineOf(sf, n))} holds a table of level floors: ${n.getText(sf).slice(0, 80)}`);
      }
      ts.forEachChild(n, walk);
    };
    walk(sf);
  }

  // SG2 (a): two store writes in one function outside the domain folders.
  if (/^src\/[^/]+\/domain\//.test(rel) || rel.startsWith('src/shared-kernel/')) continue;
  for (const fn of functionsOf(sf)) {
    const writes: string[] = [];
    for (const n of ownNodes(fn)) {
      if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) continue;
      if (STORE_WRITE.test(n.expression.name.text) && STORE_KIND.test(typeNameOf(tree.checker, n.expression.expression))) writes.push(`${n.expression.getText(sf)}@${String(lineOf(sf, n))}`);
    }
    if (writes.length >= 2) sharedWrites.push(`${rel} ${fnName(fn, sf)} makes ${String(writes.length)} store writes (${writes.join('; ')})`);
  }
}

interface School {
  registerStudent(name: string): string;
  recordPlacementTest(studentId: string, score: number): void;
  openCourse(courseCode: string, minimumLevel: string, capacity: number): string;
  joinCourse(runId: string, studentId: string): unknown;
  completeCourse(runId: string, studentId: string): void;
}

/** SG2 (b): judges each Learner change made during an enrolment command by the stack it was made on. */
function judge(changes: readonly Change[]): string[] {
  const out = new Set<string>();
  for (const c of changes) {
    if (c.context !== 'placement' || (c.call !== 'joinCourse' && c.call !== 'completeCourse')) continue;
    const at = c.frames.findIndex((f) => f.file === PUMP_FILE && /drain/.test(f.fn));
    const callers = c.frames.slice(at + 1).filter((f) => f.file.startsWith(ENROLMENT));
    const site = c.frames.find((f) => f.file.startsWith(ENROLMENT));
    if (at < 0) out.add(`${c.call}: ${c.what} changed inside the command, no pump drain on the stack${site === undefined ? '' : ` (at ${site.file}:${String(site.line)} ${site.fn})`}`);
    else if (callers.length > 0) {
      const outer = callers[callers.length - 1]!;
      out.add(`${c.call}: ${c.what} changed in a drain started from ${outer.file}:${String(outer.line)} ${outer.fn}`);
    }
  }
  return [...out];
}

async function runtime(): Promise<string[]> {
  // Real path: stack frames carry physical paths, so a symlinked tree argument would otherwise hide every frame.
  const tracer = new Tracer(fs.realpathSync(path.resolve(treeArg as string)));
  try {
    await tracer.hook([{ context: 'placement', file: 'src/placement/domain/learner/Learner.ts', className: 'Learner' }]);
    const entry = await tracer.load('src/main.ts');
    if (typeof entry.createApp !== 'function') return ['src/main.ts exports no createApp (not checkable; hand read)'];
    const s = (entry.createApp as () => School)();
    const una = tracer.run('setup', () => s.registerStudent('Una'));
    const vic = tracer.run('setup', () => s.registerStudent('Vic'));
    if (una === undefined || vic === undefined) return ['students could not be registered (not checkable; hand read)'];
    tracer.run('setup', () => s.recordPlacementTest(una, 58));
    const starter = tracer.run('setup', () => s.openCourse('RU-A1', 'A1', 4));
    const middle = tracer.run('setup', () => s.openCourse('RU-B1', 'B1', 4));
    if (starter === undefined || middle === undefined) return ['course runs could not be opened (not checkable; hand read)'];
    tracer.run('joinCourse', () => s.joinCourse(starter, una));
    tracer.run('joinCourse', () => s.joinCourse(starter, vic));
    tracer.run('completeCourse', () => s.completeCourse(starter, una));
    tracer.run('completeCourse', () => s.completeCourse(starter, vic));
    tracer.run('joinCourse', () => s.joinCourse(middle, una));
    tracer.run('completeCourse', () => s.completeCourse(middle, una));
  } catch (e) {
    return [`the scenario could not run (${e instanceof Error ? e.message : String(e)}; not checkable, hand read)`];
  }
  return [...tracer.missing, ...judge(tracer.changes)];
}

runtime().then((late) => {
  const verdicts: SubGoalVerdict[] = [
    { id: 'SG1', family: 'D6/D10', pass: levelBreaks.length === 0, evidence: levelBreaks },
    { id: 'SG2', family: 'D4', pass: sharedWrites.length === 0 && late.length === 0, evidence: [...sharedWrites, ...late] },
  ];
  process.exitCode = report('f27-ddd-language-school', treeArg, verdicts);
}, (e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
});
