// Every message below is an invented string, never a commit of the study pool (plan §4).
import {
  capEvenly, classifyRefactor, decide, isControlCandidate, isRevert, loro, matchControls, matchedDiff, prOf, sizeDistance,
  statementText, summarise, withoutLargest, type MatchedObs, type SizedCommit,
} from '../../../../scripts/v1.3/lib/refactor-pr.js';

const fam = (m: string): string => classifyRefactor(m).families.join('');

describe('refactor-pr: text', () => {
  it('drops merge lines naming branches and trailers', () => {
    const t = statementText('Merge pull request #12 from acme/refactor-decouple-db\n\nAdd export button\n\nCo-authored-by: X <x@y>');
    expect(t).not.toMatch(/decouple/);
    expect(t).toMatch(/Add export button/);
    expect(statementText("Merge branch 'decouple-x' into main")).not.toMatch(/decouple/);
  });
  it('reads the PR kind', () => {
    expect(prOf('Merge pull request #7 from a/b\n\nTitle')).toEqual({ kind: 'merge', pr: 7 });
    expect(prOf('feat: thing (#88)\n\nbody')).toEqual({ kind: 'squash', pr: 88 });
    expect(prOf('fix typo')).toEqual({ kind: 'direct' });
  });
  it('spots reverts', () => {
    expect(isRevert('Revert "decouple x"')).toBe(true);
    expect(isRevert('fix: revertable flag')).toBe(false);
  });
});

describe('refactor-pr: families', () => {
  it('A: removing a circular dependency', () => {
    expect(fam('fix: remove circular dependency between user and auth')).toContain('A');
    expect(fam('Break the import cycle in the billing services')).toContain('A');
    expect(fam('chore: avoid circular imports')).toContain('A');
    expect(fam('circular dependency fix')).toContain('A');
    expect(fam('document the circular dependency')).not.toContain('A');
  });
  it('B: decoupling', () => {
    expect(fam('Decouple domain from persistence')).toBe('B');
    expect(fam('untangle the mailer and the queue')).toContain('B');
  });
  it('C: moving logic out of a controller', () => {
    expect(fam('move business logic out of controller')).toContain('C');
    expect(fam('Extract the database queries from the route handlers into a service')).toContain('C');
    expect(fam('refactor: thin controllers')).toContain('C');
    expect(fam('move button to the left')).toBe('');
  });
  it('D: boundaries and layering', () => {
    expect(fam('enforce module boundaries')).toContain('D');
    expect(fam('fix layering violations in api')).toContain('D');
    expect(fam('apply the dependency rule')).toContain('D');
    expect(fam('Port to hexagonal architecture')).toContain('D');
    expect(fam('ports and adapters for storage')).toContain('D');
  });
  it('E-G need a refactor verb outside the phrase', () => {
    expect(fam('add caching to the service layer')).toBe('');
    expect(fam('move persistence into the repository layer')).toContain('E');
    expect(fam('use the repository pattern')).toBe('');
    expect(fam('refactor: use the repository pattern for users')).toContain('F');
    expect(fam('Restructure folders')).toBe('');
    expect(fam('Restructure folders and remove dead code')).toContain('G');
    expect(fam('update architecture diagram')).toBe('');
  });
  it('ordinary messages match nothing', () => {
    for (const m of ['feat: add OAuth login', 'fix: null check in parser', 'chore(deps): bump x from 1 to 2', 'docs: README']) expect(fam(m)).toBe('');
  });
});

describe('refactor-pr: controls', () => {
  it('excludes loose architecture words and any family', () => {
    expect(isControlCandidate('feat: add OAuth login')).toBe(true);
    expect(isControlCandidate('refactor: rename variables')).toBe(false);
    expect(isControlCandidate('feat(users-module): add avatar')).toBe(false);
    expect(isControlCandidate('fix port binding')).toBe(false);
    expect(isControlCandidate('support custom domains')).toBe(false);
    expect(isControlCandidate('handle lifecycle hooks')).toBe(true);
    expect(isControlCandidate('report export')).toBe(true);
  });
});

describe('refactor-pr: selection', () => {
  it('caps evenly', () => {
    expect(capEvenly([1, 2, 3], 10)).toEqual([1, 2, 3]);
    expect(capEvenly([...Array(19).keys()], 10)).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
  });
  const c = (sha: string, index: number, files: number, lines: number, time = index * 100): SizedCommit => ({ sha, index, time, files, lines });
  it('measures size distance on log scales', () => {
    expect(sizeDistance(c('a', 0, 0, 0), c('b', 1, 0, 0))).toBe(0);
    expect(sizeDistance(c('a', 0, 1, 10), c('b', 1, 3, 10))).toBeCloseTo(Math.log(4) - Math.log(2));
  });
  it('matches greedily, without reuse, inside the caliper, ties by date', () => {
    const refs = [c('r1', 10, 5, 100, 1000), c('r2', 20, 5, 100, 2000)];
    const pool = [c('x', 1, 5, 100, 100), c('y', 2, 5, 100, 1900), c('z', 3, 5, 100, 1100), c('w', 4, 5, 110, 1000), c('far', 5, 300, 90000)];
    const m = matchControls(refs, pool, 2);
    expect(m[0]?.controls.map((x) => x.sha)).toEqual(['z', 'x']);
    expect(m[1]?.controls.map((x) => x.sha)).toEqual(['y', 'w']);
    expect(m.flatMap((x) => x.controls.map((y) => y.sha))).not.toContain('far');
  });
  it('leaves a refactor unmatched when nothing is inside the caliper', () => {
    expect(matchControls([c('r', 1, 500, 50000)], [c('a', 2, 1, 1)])[0]?.controls).toEqual([]);
  });
});

describe('refactor-pr: statistics and decision', () => {
  const obs = (repo: string, dR: number, dC: number[], sha = `${repo}${String(dR)}`): MatchedObs => ({ repo, sha, dR, dC });
  it('computes the matched difference', () => {
    expect(matchedDiff(obs('a', -3, [0, -1, 1]))).toBe(-3);
    expect(matchedDiff(obs('a', 0, [2]))).toBe(-2);
  });
  it('declares SUPPORTED on a strong, spread effect', () => {
    const o: MatchedObs[] = [];
    for (let r = 0; r < 10; r++) for (let i = 0; i < 4; i++) o.push(obs(`r${String(r)}`, -2 - i, [0], `s${String(r)}-${String(i)}`));
    const d = decide(o, 500);
    expect(d.verdict).toBe('SUPPORTED');
    expect(d.underpowered).toBe(false);
  });
  it('declares NOT ROBUST when one repository carries it', () => {
    const o: MatchedObs[] = [];
    for (let i = 0; i < 24; i++) o.push(obs('big', -5, [0], `b${String(i)}`));
    for (let r = 0; r < 12; r++) o.push(obs(`r${String(r)}`, r % 3 === 0 ? 1 : 0, [0], `s${String(r)}`));
    const d = decide(o, 500);
    expect(d.checks.signNeg).toBe(true);
    expect(d.checks.loroHolds).toBe(false);
    expect(d.verdict).not.toBe('SUPPORTED');
  });
  it('declares NULL when all differences are zero, CONTRADICTED when they rise', () => {
    const zeros = [...Array(40).keys()].map((i) => obs(`r${String(i % 8)}`, 0, [0], `z${String(i)}`));
    expect(decide(zeros, 200).verdict).toBe('NULL');
    const up = [...Array(40).keys()].map((i) => obs(`r${String(i % 8)}`, 3, [0], `u${String(i)}`));
    expect(decide(up, 200).verdict).toBe('CONTRADICTED');
  });
  it('flags n < 30 as underpowered', () => {
    const few = [...Array(10).keys()].map((i) => obs(`r${String(i)}`, -4, [0], `f${String(i)}`));
    const d = decide(few, 200);
    expect(d.underpowered).toBe(true);
    expect(d.verdict).not.toBe('SUPPORTED');
  });
  it('summarises, leaves repositories out and drops the largest', () => {
    const o = [obs('a', -1, [0]), obs('a', -9, [0], 'big'), obs('b', 1, [0]), obs('c', 0, [0])];
    const s = summarise(o, 200);
    expect([s.n, s.repos, s.neg, s.pos, s.zero]).toEqual([4, 3, 2, 1, 1]);
    expect(loro(o).map((r) => [r.repo, r.n])).toEqual([['a', 2], ['b', 3], ['c', 3]]);
    expect(withoutLargest(o).dropped?.sha).toBe('big');
  });
});
