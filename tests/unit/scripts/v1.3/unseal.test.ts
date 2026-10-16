/**
 * Unsealer tooling (Docs/v1.3/unsealing-procedure.md §1 pass criteria), tested on the pilot tasks and on a made-up
 * fixture only. Nothing here reads, names or derives a sealed Study 2 task.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { validateTasks } from '../../../../scripts/lib/loop/plan.js';
import {
  auditText, extractSource, maskedContext, parseArgs, sha256, stepVerdict, termRegex, unseal, validateTermList,
} from '../../../../scripts/v1.3/lib/unseal.js';
import type { UnsealOptions } from '../../../../scripts/v1.3/lib/unseal.js';

const ROOT = path.resolve(__dirname, '../../../..');
const PILOT = path.join(ROOT, 'Docs/v1.3/pilot-tasks.md');
const PLANTED = path.join(ROOT, 'tests/fixtures/v1.3/unseal/planted.md');
const TERMS_FILE = path.join(ROOT, 'scripts/v1.3/schemas/unseal-terms.json');
const TERMS = validateTermList(JSON.parse(fs.readFileSync(TERMS_FILE, 'utf8')));

// Recorded in Docs/v1.3/pilot-outcome-memo.md §7 before this tool existed.
const MEMO = {
  block: '5b72d1182c5a6ededd8fcf1ce5715c960ac14e2105631ee6e67f72053fdce22f',
  tasks: [
    '009c672b4dee2a566da4fc9ad4d6d084df317763cbfce1508f53c6196d012c89',
    'acc8a145f5c884653dfec92bd98315b4cd272d24bdce3c3253d0f52e6d4ff49c',
    '0a6f2531c56e09f4bd69d739bfa16c20e058a14224f70d1263b5964fd5c52315',
  ],
};

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'unseal-'));
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

const opts = (file: string, over: Partial<UnsealOptions> = {}): UnsealOptions => ({
  file,
  expectedSha256: sha256(fs.readFileSync(file)),
  out: path.join(tmp, 'tasks.json'),
  audit: path.join(tmp, 'audit.csv'),
  termsFile: TERMS_FILE,
  repoRoot: ROOT,
  ...over,
});

/** Every id, title, the description and every run of four consecutive words of every request. */
function secretFragments(file: string): string[] {
  const src = extractSource(fs.readFileSync(file, 'utf8'), file);
  if (!src.ok) throw new Error(src.reason);
  const t = JSON.parse(src.jsonText) as { description: string; tasks: { id: string; title: string; steps: { id: string; request: string }[] }[] };
  const out = [t.description];
  for (const task of t.tasks) {
    out.push(task.id, task.title);
    for (const s of task.steps) {
      out.push(s.id);
      const w = s.request.split(/\s+/);
      for (let i = 0; i + 4 <= w.length; i++) out.push(w.slice(i, i + 4).join(' '));
    }
  }
  return out;
}

describe('term matching', () => {
  it('is whole-word, case-insensitive, separator-tolerant and plural-aware', () => {
    const m = (term: string, text: string): string[] => [...text.matchAll(termRegex(term))].map((x) => x[0]);
    expect(m('port', 'a Port, ports, report, support, portal')).toEqual(['Port', 'ports']);
    expect(m('use case', 'use case, Use-Case, usecases, use_case, misuse cases')).toEqual(['use case', 'Use-Case', 'usecases', 'use_case']);
    expect(m('entity', 'entity, entities, identity')).toEqual(['entity', 'entities']);
    expect(m('api', 'API, APIs, rapid')).toEqual(['API', 'APIs']);
    expect(m('DDD', '(DDD-style)')).toEqual(['DDD']);
  });

  it('folds contained hits and ignores allow phrases', () => {
    const hits = auditText('Use the repository pattern; register a domain name and a legal entity; call the HTTP API.', TERMS);
    expect(hits.map((h) => `${h.tier}:${h.term}`)).toEqual(['banned:repository pattern']);
    expect(stepVerdict(hits)).toBe('FAIL');
    expect(stepVerdict(auditText('The application form.', TERMS))).toBe('REVIEW');
    expect(stepVerdict(auditText('Members book lessons.', TERMS))).toBe('PASS');
  });

  it('masks context to three words either side', () => {
    const text = 'one two three four five SIX seven eight nine ten eleven';
    const s = text.indexOf('SIX');
    expect(maskedContext(text, s, s + 3)).toBe('… three four five [SIX] seven eight nine …');
    expect(maskedContext('a (port) b', 3, 7)).toBe('a ([port]) b');
  });
});

describe('source extraction', () => {
  it('needs exactly one json block in a markdown file', () => {
    expect(extractSource('no block', 'x.md')).toEqual({ ok: false, reason: 'the markdown file has 0 json blocks; exactly one is required' });
    expect(extractSource('```json\n{}\n```\n```json\n{}\n```', 'x.md').ok).toBe(false);
    expect(extractSource('{"a":1}', 'x.json')).toMatchObject({ ok: true, kind: 'json', blockSha256: null });
  });
});

describe('unseal on the pilot tasks', () => {
  it('reproduces the memo hashes, converts losslessly and prints no task text', () => {
    const r = unseal(opts(PILOT));
    const out = r.lines.join('\n');
    expect(out).toContain(`block sha256 ${MEMO.block}`);
    MEMO.tasks.forEach((h, i) => expect(out).toContain(`task ${i + 1} sha256 ${h}`));
    expect(out).toContain('same tasks as the source: yes');
    for (const frag of secretFragments(PILOT)) expect(out).not.toContain(frag);

    const written = JSON.parse(fs.readFileSync(path.join(tmp, 'tasks.json'), 'utf8')) as unknown;
    const v = validateTasks(written);
    expect(v.success).toBe(true);
    const src = extractSource(fs.readFileSync(PILOT, 'utf8'), PILOT);
    if (!src.ok) throw new Error('unreachable');
    expect(written).toEqual(JSON.parse(src.jsonText));
    expect(out).toContain(`audit sheet written, sha256 ${sha256(fs.readFileSync(path.join(tmp, 'audit.csv')))}`);
    expect(fs.statSync(path.join(tmp, 'audit.csv')).mode & 0o777).toBe(0o600);
    // Exit code follows the verdict (reported in the PR, not asserted as a pass of the pilot tasks).
    expect(r.exitCode === 3).toBe(out.includes('VERDICT: FAIL'));
  });

  it('refuses on a hash mismatch and writes nothing', () => {
    const r = unseal(opts(PILOT, { expectedSha256: '0'.repeat(64) }));
    expect(r.exitCode).toBe(2);
    expect(r.lines.at(-1)).toMatch(/^REFUSED: sha256 mismatch/);
    expect(fs.existsSync(path.join(tmp, 'tasks.json'))).toBe(false);
    expect(fs.existsSync(path.join(tmp, 'audit.csv'))).toBe(false);
  });

  it('refuses outputs inside the repository', () => {
    const r = unseal(opts(PILOT, { out: path.join(ROOT, 'tasks.json') }));
    expect(r.exitCode).toBe(2);
    expect(r.lines.at(-1)).toMatch(/inside the repository/);
    expect(fs.existsSync(path.join(ROOT, 'tasks.json'))).toBe(false);
  });

  it('withholds parser and validation messages', () => {
    const bad = path.join(tmp, 'bad.json');
    fs.writeFileSync(bad, '{"description": "secret words here", "tasks": [{"id": "Secret Id", "title": "t", "steps": []}]}');
    const r = unseal(opts(bad));
    expect(r.exitCode).toBe(2);
    expect(r.lines.join('\n')).not.toMatch(/Secret Id|secret words/);
    const broken = path.join(tmp, 'broken.json');
    fs.writeFileSync(broken, '{"description": "secret words here", oops');
    const r2 = unseal(opts(broken));
    expect(r2.lines.at(-1)).toBe('REFUSED: the task list is not valid JSON');
  });
});

describe('unseal on the planted fixture', () => {
  it('finds every planted term with the expected verdicts', () => {
    const r = unseal(opts(PLANTED));
    const out = r.lines.join('\n');
    expect(r.exitCode).toBe(3);
    expect(out).toContain('audit steps PASS 2, REVIEW 1, FAIL 2; hits banned 12, review 2; title or id hits 1');
    expect(out).toContain('  task 1 step 2: FAIL (banned 6, review 0)');
    expect(out).toContain('  task 1 step 3: REVIEW (banned 0, review 2)');
    expect(out).toContain('  task 2 step 2: FAIL (banned 6, review 0)');
    expect(out).toContain('VERDICT: FAIL');
    for (const frag of secretFragments(PLANTED)) expect(out).not.toContain(frag);

    const sheet = fs.readFileSync(path.join(tmp, 'audit.csv'), 'utf8');
    const hitTerms = sheet.split('\n').filter((l) => l.startsWith('"hit"')).map((l) => l.split('","')[7]);
    expect(hitTerms).toEqual([
      'use case', 'entity', 'port', 'adapter', 'hexagonal', 'repository pattern',
      'application', 'config',
      'entity', 'port', 'use case', 'DDD', 'presentation', 'layer',
    ]);
    expect(sheet).toContain('"title-hit","2","","","","","banned","clean architecture"');
    expect(sheet).toContain('"… rules in a [Use-Case] and keep each …"');
    expect(sheet.trimEnd().split('\n').at(-1)).toMatch(/^"signature"/);
  });
});

describe('arguments', () => {
  it('requires every flag and a hex sha', () => {
    const d = { termsFile: TERMS_FILE, repoRoot: ROOT };
    expect(parseArgs(['--file', 'a'], d)).toBe('missing --expected-sha256');
    expect(parseArgs(['--file', 'a', '--expected-sha256', 'xyz', '--out', 'o', '--audit', 'a'], d)).toBe('--expected-sha256 must be 64 hex characters');
    expect(parseArgs(['--file', 'a', '--expected-sha256', 'A'.repeat(64), '--out', 'o', '--audit', 'b'], d)).toMatchObject({ expectedSha256: 'a'.repeat(64), termsFile: TERMS_FILE });
  });
});
