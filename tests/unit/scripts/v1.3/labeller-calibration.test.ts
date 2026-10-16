import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { JUDGE_PERSONA } from '../../../../src/llm-critic/frozen.js';
import { SYSTEM_PROMPT } from '../../../../scripts/v1.3/lib/labelling/meaningful-prompt.js';
import { parseDelimited, parseRecords } from '../../../../scripts/v1.3/labeller-calibration/lib/csv.js';
import { bit, dacosUnitName, parseDacos, readZipEntries, sqlInsertRows } from '../../../../scripts/v1.3/labeller-calibration/lib/dacos.js';
import { mapMlcq, normaliseRepository, parseMlcq, shortUnitName } from '../../../../scripts/v1.3/labeller-calibration/lib/datasets.js';
import { archiveDisplayPath, codeResolver, fetchSource, md5, rawUrl, sliceLines } from '../../../../scripts/v1.3/labeller-calibration/lib/fetch.js';
import type { Fetcher } from '../../../../scripts/v1.3/labeller-calibration/lib/fetch.js';
import { calibrationMain, dataDirOf, parseArgs, remapMlcq } from '../../../../scripts/v1.3/labeller-calibration/lib/main.js';
import {
  callsFor, judgeMajority, judgePersona, judgePrompt, labellerPrompt, labellerSystem, parseJudgeVerdict, runsFor, swapOnce,
} from '../../../../scripts/v1.3/labeller-calibration/lib/prompts.js';
import { BudgetExhaustedError, CLAUDE_MODEL, Cassette, CassetteMissError, RaterError, cassetteCall, fakeRater } from '../../../../scripts/v1.3/labeller-calibration/lib/raters.js';
import type { Rater } from '../../../../scripts/v1.3/labeller-calibration/lib/raters.js';
import { callEstimate, labelSample } from '../../../../scripts/v1.3/labeller-calibration/lib/run.js';
import { orderedStrata, resolveSample } from '../../../../scripts/v1.3/labeller-calibration/lib/sample.js';
import { DECISION_RULE, consensus, decide, hhPairs, pairStats, scoreRaterArm } from '../../../../scripts/v1.3/labeller-calibration/lib/score.js';
import { TASKS, tasksSha256 } from '../../../../scripts/v1.3/labeller-calibration/lib/tasks.js';
import type { Binary, CalibrationItem, RaterLabel, ResolvedItem } from '../../../../scripts/v1.3/labeller-calibration/lib/types.js';

const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'labcal-test-'));

const MLCQ_HEADER = 'id;reviewer_id;sample_id;smell;severity;review_timestamp;type;code_name;repository;commit_hash;path;start_line;end_line;link;is_from_industry_relevant_project';
const SHA = 'a'.repeat(40);
function mlcqRow(id: number, reviewer: number, sample: number, smell: string, severity: string, ts = '2019-01-01 00:00:00', type = 'class', code = 'org.x.Foo', lines = '1;3'): string {
  return `${String(id)};${String(reviewer)};${String(sample)};${smell};${severity};${ts};${type};${code};git@github.com:own/repo.git;${SHA};/src/Foo.java;${lines};https://x;true`;
}

function item(id: string, task: string, ratings: Binary[], extra: Partial<ResolvedItem> = {}): ResolvedItem {
  return {
    id, dataset: 'mlcq', task, unitKind: TASKS[task]?.unitKind ?? 'class', unitName: 'Foo', language: 'java',
    location: { repository: 'https://github.com/own/repo', commit: SHA, path: 'src/Foo.java', startLine: 1, endLine: 3 },
    ratings: ratings.map((b, i) => ({ rater: String(i), original: b === 'fail' ? 'major' : 'none', binary: b })),
    code: 'class Foo {\n  // a comment\n  int x;\n}', codeSha256: 'h', displayPath: 'src/Foo.java', ...extra,
  };
}

describe('labeller calibration: csv', () => {
  it('reads quoted fields, doubled quotes, embedded delimiters and newlines', () => {
    expect(parseDelimited('a,b\n"x,1","he said ""hi""\nthere"\r\n')).toEqual([['a', 'b'], ['x,1', 'he said "hi"\nthere']]);
    expect(parseDelimited('a;b\n"x;1";"y"', ';')).toEqual([['a', 'b'], ['x;1', 'y']]);
    expect(parseRecords('\uFEFFh1,h2\n1,2\n3')).toEqual([{ h1: '1', h2: '2' }, { h1: '3', h2: '' }]);
  });
});

describe('labeller calibration: MLCQ', () => {
  it('maps severities on both pre-registered scales', () => {
    expect(['none', 'minor', 'major', 'critical'].map((s) => mapMlcq(s, 'primary'))).toEqual(['pass', 'fail', 'fail', 'fail']);
    expect(['none', 'minor', 'major', 'critical'].map((s) => mapMlcq(s, 'major-or-worse'))).toEqual(['pass', 'pass', 'fail', 'fail']);
    expect(mapMlcq('huge', 'primary')).toBeNull();
  });

  it('normalises repositories and unit names', () => {
    expect(normaliseRepository('git@github.com:apache/syncope.git')).toBe('https://github.com/apache/syncope');
    expect(normaliseRepository('https://github.com/a/b/')).toBe('https://github.com/a/b');
    expect(normaliseRepository('svn://x')).toBeNull();
    expect(shortUnitName('org.a.Outer.Inner#run(int, String)')).toBe('Inner#run');
    expect(shortUnitName('org.a.Clazz')).toBe('Clazz');
  });

  it('groups one item per (sample, smell), keeps the latest review per reviewer, drops unknown smells', () => {
    const text = [
      MLCQ_HEADER,
      mlcqRow(1, 7, 100, 'blob', 'none', '2019-01-01 00:00:00'),
      mlcqRow(2, 7, 100, 'blob', 'major', '2019-02-01 00:00:00'),
      mlcqRow(3, 9, 100, 'blob', 'minor'),
      mlcqRow(4, 9, 100, 'data class', 'none'),
      mlcqRow(5, 9, 100, 'mystery', 'none'),
      mlcqRow(6, 1, 200, 'long method', 'critical', '2019-01-01 00:00:00', 'function', 'org.a.Foo#bar()', '10;20'),
    ].join('\n');
    const items = parseMlcq(text);
    expect(items.map((i) => i.id)).toEqual(['mlcq:100:blob', 'mlcq:100:data-class', 'mlcq:200:long-method']);
    const blob = items[0] as CalibrationItem;
    expect(blob.ratings.map((r) => [r.rater, r.original, r.binary])).toEqual([['7', 'major', 'fail'], ['9', 'minor', 'fail']]);
    expect(blob.location).toEqual({ repository: 'https://github.com/own/repo', commit: SHA, path: 'src/Foo.java', startLine: 1, endLine: 3 });
    const lm = items[2] as CalibrationItem;
    expect([lm.unitKind, lm.unitName, lm.location?.startLine, lm.location?.endLine]).toEqual(['method', 'Foo#bar', 10, 20]);
    expect(parseMlcq(text, 'major-or-worse')[0]?.ratings.map((r) => r.binary)).toEqual(['fail', 'pass']);
    expect(remapMlcq(items, 'major-or-worse')[0]?.ratings.map((r) => r.binary)).toEqual(['fail', 'pass']);
  });
});

/** A zip with stored and deflated entries; `zip64` adds the ZIP64 end records the DACOS archive carries. */
function makeZip(files: Record<string, string>, zip64 = false): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  Object.entries(files).forEach(([name, text], i) => {
    const raw = Buffer.from(text, 'utf8');
    const method = i % 2 === 0 ? 8 : 0;
    const data = method === 8 ? zlib.deflateRawSync(raw) : raw;
    const n = Buffer.from(name, 'utf8');
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(method, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(n.length, 26);
    locals.push(lh, n, data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(method, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, n);
    offset += 30 + n.length + data.length;
  });
  const cd = Buffer.concat(centrals);
  const count = Object.keys(files).length;
  const tail: Buffer[] = [];
  if (zip64) {
    const z = Buffer.alloc(56);
    z.writeUInt32LE(0x06064b50, 0); z.writeBigUInt64LE(BigInt(count), 32); z.writeBigUInt64LE(BigInt(offset), 48);
    const loc = Buffer.alloc(20);
    loc.writeUInt32LE(0x07064b50, 0); loc.writeBigUInt64LE(BigInt(offset + cd.length), 8);
    tail.push(z, loc);
  }
  const e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0);
  e.writeUInt16LE(zip64 ? 0xffff : count, 10);
  e.writeUInt32LE(zip64 ? 0xffffffff : offset, 16);
  tail.push(e);
  return Buffer.concat([...locals, cd, ...tail]);
}

const DACOS_SQL = [
  'INSERT INTO `sample` VALUES (1,370,_binary \'\\0\',_binary \'\x01\',\'/codesplit_java_class/p/p/com.a.b/Big.code\',\'p\',0,\'3\'),'
    + '(2,371,_binary \'\x01\',_binary \'\\0\',\'/codesplit_java_method/p/p/com.a.b/Big/run.code\',\'p\',0,\'1,2\'),'
    + '(3,372,_binary \'\\0\',_binary \'\\0\',\'/codesplit_java_method/p/p/com.a.b/Big/it\\\'s.code\',\'p\',0,\'\');',
  'INSERT INTO `annotation` VALUES (10,_binary \'\\0\',_binary \'\\0\',_binary \'\\0\',_binary \'\x01\',_binary \'\x01\',1),'
    + '(11,_binary \'\\0\',_binary \'\\0\',_binary \'\\0\',_binary \'\\0\',_binary \'\\0\',1),'
    + '(12,_binary \'\x01\',_binary \'\\0\',_binary \'\\0\',_binary \'\\0\',_binary \'\x01\',2),'
    + '(13,_binary \'\x01\',_binary \'\\0\',_binary \'\x01\',_binary \'\\0\',_binary \'\x01\',2),'
    + '(14,_binary \'\x01\',_binary \'\\0\',_binary \'\\0\',_binary \'\\0\',_binary \'\x01\',NULL);',
].join('\n');

describe('labeller calibration: DACOS', () => {
  it('reads INSERT tuples with BIT(1) bytes, escapes and NULL', () => {
    const rows = sqlInsertRows(DACOS_SQL, 'sample');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual([1, 370, false, true, '/codesplit_java_class/p/p/com.a.b/Big.code', 'p', 0, '3']);
    expect(rows[2]?.[4]).toBe("/codesplit_java_method/p/p/com.a.b/Big/it's.code");
    expect(sqlInsertRows(DACOS_SQL, 'annotation')[4]?.[6]).toBeNull();
    expect([bit(true), bit(false), bit(1), bit('x')]).toEqual([true, false, true, false]);
  });

  it('makes one item per candidate smell with interchangeable raters', () => {
    const items = parseDacos(DACOS_SQL);
    expect(items.map((i) => i.id)).toEqual(['dacos:1:multifaceted-abstraction', 'dacos:2:complex-method', 'dacos:2:long-parameter-list']);
    expect(items[0]?.ratings.map((r) => r.binary)).toEqual(['fail', 'pass']);
    expect(items[0]?.unitKind).toBe('class');
    expect(items[1]?.ratings.map((r) => [r.rater, r.binary])).toEqual([['annotation-1', 'fail'], ['annotation-2', 'fail']]);
    expect(items[2]?.ratings.map((r) => r.binary)).toEqual(['pass', 'fail']);
    expect(items[1]?.archiveEntry).toBe('codesplit_java_method/p/p/com.a.b/Big/run.code');
    expect(dacosUnitName('/codesplit_java_method/p/p/com.a.b/Big/run.code', false)).toBe('Big#run');
    expect(archiveDisplayPath('codesplit_java_method/p/p/com.a.b/Big/run.code')).toBe('com/a/b/Big.java');
    expect(archiveDisplayPath('codesplit_java_class/p/p/(default package)/Big.code')).toBe('Big.java');
  });

  it.each([false, true])('reads stored and deflated zip entries (zip64 %s)', (zip64) => {
    const zip = makeZip({ 'a/x.code': 'class X {}', 'a/y.code': 'class Y {}', 'b/z.code': 'zzz' }, zip64);
    const got = readZipEntries(zip, new Set(['a/x.code', 'a/y.code', 'missing']));
    expect([...got.entries()].sort()).toEqual([['a/x.code', 'class X {}'], ['a/y.code', 'class Y {}']]);
  });
});

describe('labeller calibration: prompts (only the task is swapped)', () => {
  it('swaps the language noun into our frozen personas exactly once and fails on drift', () => {
    expect(judgePersona('java')).toBe(JUDGE_PERSONA.replace('TypeScript projects', 'Java projects'));
    expect(labellerSystem('java')).toBe(SYSTEM_PROMPT.replace('a TypeScript code base', 'a Java code base')
      .replace('against an architectural style', 'against a design rule').replace('the style definition', 'the rule definition'));
    expect(() => swapOnce('no noun here', 'TypeScript', 'Java')).toThrow(/drifted/);
    expect(() => swapOnce('x x', 'x', 'y')).toThrow(/found 2/);
  });

  it('builds the judge prompt with the frozen v1 template', () => {
    const p = judgePrompt(item('mlcq:1:blob', 'blob', ['fail']));
    expect(p.split('\n').filter((l) => l.startsWith('## '))).toEqual(['## Rule', '## Rubric', '## Layer model', '## Unit', '## Source', '## Graph excerpt', '## Instructions']);
    expect(p).toContain(TASKS.blob?.rule ?? '?');
    expect(p).toContain('Kind: class\nId: src/Foo.java#Foo');
    expect(p).toContain('=====SOURCE-BEGIN src/Foo.java=====\nclass Foo {\n  // a comment');
  });

  it('builds the labeller prompt: numbered unit without comments, permuted options on run 1', () => {
    const it = item('mlcq:1:long-method', 'long-method', ['fail'], { unitKind: 'method', unitName: 'Foo#bar' });
    const [r0, r1] = callsFor(it, 'labeller', 'claude', 7);
    expect(r0?.prompt).toContain('## Design rule\n- Short methods');
    expect(r0?.prompt).toContain('    2 | ');
    expect(r0?.prompt).not.toContain('a comment');
    expect(r0?.prompt).toContain('Method Foo#bar in src/Foo.java is reported to show Long Method.');
    expect(r0?.prompt).toContain('A. yes\nB. no\nC. uncertain');
    expect(r1?.order).not.toEqual(['yes', 'no', 'uncertain']);
    expect(labellerPrompt(it, r1?.order ?? [])).toBe(r1?.prompt);
  });

  it('runs: Claude judge 3, Gemini judge 1, labeller 2', () => {
    const it = item('mlcq:1:blob', 'blob', ['fail']);
    expect([runsFor('judge', 'claude'), runsFor('judge', 'gemini'), runsFor('labeller', 'gemini')]).toEqual([3, 1, 2]);
    expect(callsFor(it, 'judge', 'claude', 1).map((c) => c.runIndex)).toEqual([0, 1, 2]);
    expect(callsFor(it, 'judge', 'gemini', 1)).toHaveLength(1);
    expect(callEstimate(10, 'claude', 'judge')).toEqual({ calls: 30, worstCase: 60 });
    expect(callEstimate(10, 'gemini', 'labeller')).toEqual({ calls: 20, worstCase: 80 });
  });

  it('applies the v1 decision rule', () => {
    const v = (pass: boolean, confidence = 0.8) => ({ valid: true as const, pass, confidence });
    const bad = { valid: false as const, why: 'x' };
    expect(judgeMajority([v(false), v(false, 0.6), v(true)])).toEqual({ label: 'fail', raw: 'fail', confidence: 0.7 });
    expect(judgeMajority([v(true), v(false), bad]).raw).toBe('warning');
    expect(judgeMajority([v(true), bad, bad]).raw).toBe('invalid');
    expect(judgeMajority([v(true)])).toEqual({ label: 'pass', raw: 'pass', confidence: 0.8 });
    expect(judgeMajority([bad]).raw).toBe('invalid');
    expect(parseJudgeVerdict('```json\n{"pass":false,"confidence":0.9}\n```')).toEqual({ valid: true, pass: false, confidence: 0.9 });
    expect(parseJudgeVerdict('{"pass":"no","confidence":0.9}').valid).toBe(false);
    expect(parseJudgeVerdict('{"pass":true}').valid).toBe(false);
  });

  it('freezes the task definitions by hash', () => {
    expect(tasksSha256()).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(TASKS).sort()).toEqual(['blob', 'complex-method', 'data-class', 'long-method', 'multifaceted-abstraction']);
  });
});

describe('labeller calibration: scoring', () => {
  it('computes consensus, pair α and the decision branches', () => {
    expect(consensus(item('a', 'blob', ['fail', 'fail', 'pass']))).toBe('fail');
    expect(consensus(item('a', 'blob', ['fail', 'pass']))).toBeNull();
    const perfect = pairStats([['fail', 'fail'], ['pass', 'pass']]);
    expect([perfect.alpha, perfect.observed, perfect.pabak]).toEqual([1, 1, 1]);
    expect(pairStats([]).alpha).toBeNull();
    expect(hhPairs([item('a', 'blob', ['fail', 'pass', 'pass'])])).toHaveLength(3);
    expect(decide(0.8, 1, 0.5, 0, -0.05, 0.1)).toBe('NO DECISION (invalid share)');
    expect(decide(1, 0.5, 0.5, 0, -0.05, 0.1)).toBe('NO DECISION (abstention share)');
    expect(decide(1, 1, 0.5, 0, -0.05, 0.1)).toBe('SUPPORT');
    expect(decide(1, 1, 0.3, 0, -0.05, 0.1)).toBe('SUPPORT (weak reference)');
    expect(decide(1, 1, 0.5, -0.3, -0.4, -0.2)).toBe('NOT SUPPORTED');
    expect(decide(1, 1, 0.5, -0.1, -0.2, 0)).toBe('INCONCLUSIVE');
    expect(DECISION_RULE.margin).toBe(0.1);
  });

  it('scores a model that always matches the consensus at least as well as the humans', () => {
    const items = Array.from({ length: 20 }, (_, i) => item(`i${String(i)}`, 'blob', i % 2 === 0 ? ['fail', 'fail', 'pass'] : ['pass', 'pass', 'fail']));
    const labels: RaterLabel[] = items.map((it) => ({ itemId: it.id, rater: 'claude', model: 'm', arm: 'judge', binary: consensus(it), raw: consensus(it) ?? 'invalid', procedureFailure: false, runs: [] }));
    const s = scoreRaterArm(items, labels, 'claude', 'judge');
    expect(s.valid).toBe(20);
    expect(s.delta).not.toBeNull();
    expect(s.delta as number).toBeGreaterThan(0);
    expect(s.consensus.kappa).toBe(1);
    expect(s.decision).toBe('SUPPORT (weak reference)');
  });
});

describe('labeller calibration: sample', () => {
  it('orders each task stratum deterministically and never stratifies on the human labels', () => {
    const items = Array.from({ length: 30 }, (_, i) => item(`mlcq:${String(i)}:blob`, i < 15 ? 'blob' : 'data-class', ['fail', 'pass', i % 3 === 0 ? 'fail' : 'pass']));
    const d = { dataset: 'mlcq' as const, seed: 5, minRatings: 3, perStratum: 4, tasks: ['blob', 'data-class'] };
    const a = orderedStrata(items, d);
    expect([...a.keys()]).toEqual(['blob', 'data-class']);
    expect(a.get('blob')?.map((i) => i.id)).toEqual(orderedStrata([...items].reverse(), d).get('blob')?.map((i) => i.id));
    expect(orderedStrata(items, { ...d, minRatings: 4 }).size).toBe(0);
  });

  it('walks past unresolvable items and reports them', async () => {
    const items = Array.from({ length: 6 }, (_, i) => item(`mlcq:${String(i)}:blob`, 'blob', ['fail', 'pass', 'pass']));
    const d = { dataset: 'mlcq' as const, seed: 1, minRatings: 3, perStratum: 3, tasks: ['blob'] };
    const order = orderedStrata(items, d).get('blob')?.map((i) => i.id) ?? [];
    const r = await resolveSample(items, d, (it) => Promise.resolve(it.id === order[0] ? { skip: 'HTTP 404' } : (it as ResolvedItem)));
    expect(r.items.map((i) => i.id)).toEqual(order.slice(1, 4));
    expect(r.perStratum.blob).toEqual({ eligible: 6, taken: 3, skipped: [{ id: order[0], why: 'HTTP 404' }] });
  });
});

describe('labeller calibration: fetch', () => {
  it('verifies the pinned md5 and re-uses a verified file', async () => {
    const dir = tmp();
    let calls = 0;
    const fetcher: Fetcher = () => { calls += 1; return Promise.resolve({ status: 200, body: Buffer.from('data') }); };
    const src = { dataset: 'x', doi: 'd', licence: 'l', files: [{ name: 'f.csv', url: 'u', checksum: `md5:${md5('data')}`, size: 4 }] };
    await fetchSource(src, dir, fetcher);
    await fetchSource(src, dir, fetcher);
    expect(calls).toBe(1);
    await expect(fetchSource({ ...src, files: [{ ...src.files[0]!, name: 'g.csv', checksum: 'md5:00' }] }, dir, fetcher)).rejects.toThrow(/differs from the pinned/);
  });

  it('slices the unit at the pinned commit and caches misses', async () => {
    const dir = tmp();
    const urls: string[] = [];
    const fetcher: Fetcher = (u) => { urls.push(u); return Promise.resolve(u.includes('Gone') ? { status: 404, body: Buffer.alloc(0) } : { status: 200, body: Buffer.from('l1\r\nl2\nl3\nl4') }); };
    const it = item('a', 'blob', ['fail']);
    expect(rawUrl(it)).toBe(`https://raw.githubusercontent.com/own/repo/${SHA}/src/Foo.java`);
    const resolve = codeResolver(dir, fetcher);
    const r = await resolve({ ...it, location: { ...it.location!, startLine: 2, endLine: 3 } });
    expect('code' in r && r.code).toBe('l2\nl3');
    const gone = { ...it, location: { ...it.location!, path: 'Gone.java' } };
    expect(await resolve(gone)).toEqual({ skip: 'HTTP 404' });
    expect(await resolve(gone)).toEqual({ skip: 'HTTP 404' });
    expect(urls.filter((u) => u.includes('Gone'))).toHaveLength(1);
    expect(await resolve({ ...it, location: { ...it.location!, endLine: 9 } })).toEqual({ skip: 'line range outside the file' });
    expect(sliceLines('a\nb', 0, 1)).toBeNull();
    expect(await codeResolver(tmp(), fetcher, true)(it)).toEqual({ skip: 'not cached (offline)' });
  });
});

describe('labeller calibration: cassette and runs', () => {
  const items = [item('mlcq:1:blob', 'blob', ['fail', 'fail', 'pass']), item('mlcq:2:blob', 'blob', ['pass', 'pass', 'pass'], { unitName: 'Bar' })];
  const truthOf = (p: string): 'fail' | 'pass' => (p.includes('#Foo') || p.includes('Class Foo') ? 'fail' : 'pass');

  it('records once, then replays with no call; labels carry the procedure outcome', async () => {
    const dir = tmp();
    const fake = fakeRater({ id: 'fake-claude', accuracy: 1, invalidRate: 0 }, truthOf);
    const budget = { cap: 100, used: 0 };
    const rec = await labelSample(items, fake, 'judge', { seed: 1, cassette: new Cassette(dir, 'record'), budget });
    expect(budget.used).toBe(6);
    expect(rec.map((l) => [l.binary, l.procedureFailure])).toEqual([['fail', false], ['pass', false]]);
    const again = { cap: 0, used: 0 };
    const rep = await labelSample(items, fake, 'judge', { seed: 1, cassette: new Cassette(dir, 'replay'), budget: again });
    expect(rep).toEqual(rec);
    const lab = await labelSample(items, fake, 'labeller', { seed: 1, cassette: new Cassette(dir, 'record'), budget });
    expect(lab.map((l) => l.raw)).toEqual(['yes', 'no']);
    await expect(labelSample(items, { ...fake, model: 'other' }, 'judge', { seed: 1, cassette: new Cassette(dir, 'replay'), budget: again })).rejects.toBeInstanceOf(CassetteMissError);
  });

  it('stops at the budget, retries once, and never stores a stop', async () => {
    const dir = tmp();
    const failing: Rater = { id: 'claude', model: 'm', provenance: {}, call: () => Promise.reject(new RaterError('LLM_CLI_EXIT', 'x', 'retry')) };
    const budget = { cap: 10, used: 0 };
    const r = await cassetteCall(new Cassette(dir, 'record'), failing, 'judge', { system: 's', prompt: 'p', schema: 'x' }, 0, 'i', budget);
    expect(r).toEqual({ failed: ['LLM_CLI_EXIT', 'LLM_CLI_EXIT'], key: expect.any(String) as string });
    expect(budget.used).toBe(2);
    const stop: Rater = { ...failing, call: () => Promise.reject(new RaterError('LLM_USAGE_LIMIT', 'limit', 'stop')) };
    await expect(cassetteCall(new Cassette(dir, 'record'), stop, 'judge', { system: 's', prompt: 'q', schema: 'x' }, 0, 'i', budget)).rejects.toThrow('limit');
    expect(fs.readdirSync(dir)).toEqual([]);
    await expect(cassetteCall(new Cassette(dir, 'record'), stop, 'judge', { system: 's', prompt: 'q', schema: 'x' }, 0, 'i', { cap: 0, used: 0 })).rejects.toBeInstanceOf(BudgetExhaustedError);
  });
});

describe('labeller calibration: command line', () => {
  it('parses arguments and refuses a data directory inside the repository', () => {
    expect(parseArgs(['dry-run', '--data', '/d', '--fake'])).toEqual({ cmd: 'dry-run', args: new Map([['--data', '/d']]), flags: new Set(['--fake']) });
    expect(() => dataDirOf(new Map([['--data', '/repo/x']]), '/repo')).toThrow(/outside the repository/);
    expect(dataDirOf(new Map([['--data', '/elsewhere']]), '/repo')).toBe('/elsewhere');
  });

  it('runs sample → dry-run → record → score on a synthetic MLCQ copy with no real model', async () => {
    const repo = tmp();
    const data = tmp();
    fs.mkdirSync(path.join(data, 'mlcq'));
    const rows = [MLCQ_HEADER];
    let id = 1;
    for (let s = 1; s <= 40; s += 1) {
      for (const smell of ['blob', 'data class', 'long method']) {
        const sev = (r: number): string => ((s + r) % 3 === 0 ? 'major' : 'none');
        for (const r of [1, 2, 3]) rows.push(mlcqRow(id++, r, s, smell, sev(r), '2019-01-01 00:00:00', smell === 'long method' ? 'function' : 'class', `org.a.C${String(s)}${smell === 'long method' ? '#m()' : ''}`));
      }
    }
    fs.writeFileSync(path.join(data, 'mlcq', 'MLCQCodeSmellSamples.csv'), rows.join('\n'));
    const fetcher: Fetcher = () => Promise.resolve({ status: 200, body: Buffer.from('class C {\n  int a;\n  void m() {}\n}') });
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: () => undefined, repoRoot: repo, fetcher };
    expect(await calibrationMain(['sample', '--data', data, '--dataset', 'mlcq'], io)).toBe(0);
    const sample = JSON.parse(fs.readFileSync(path.join(repo, 'results/v1.3-labeller-calibration/mlcq/sample.json'), 'utf8')) as { items: { id: string }[] };
    expect(sample.items).toHaveLength(96);
    out.length = 0;
    expect(await calibrationMain(['dry-run', '--data', data, '--dataset', 'mlcq', '--rater', 'claude', '--arm', 'judge', '--print', '1'], io)).toBe(0);
    const text = out.join('');
    expect(text).toContain('DRY RUN: no model is called.');
    expect(text).toContain('--- system ---\nYou are an architecture reviewer for Java projects.');
    expect(text).toContain('| mlcq | claude | judge | 96 | 3 | 288 | 0 | 288 | 576 |');
    const makeRater = (): Promise<Rater> => Promise.resolve({ ...fakeRater({ id: 'fake-claude', accuracy: 0.9, invalidRate: 0 }, () => 'fail'), id: 'claude' as const, model: CLAUDE_MODEL });
    expect(await calibrationMain(['record', '--data', data, '--dataset', 'mlcq', '--rater', 'claude', '--arm', 'judge', '--budget', '10', '--tmp-root', data], { ...io, makeRater })).toBe(3);
    expect(out.join('')).toContain('STOPPED BUDGET');
    expect(await calibrationMain(['record', '--data', data, '--dataset', 'mlcq', '--rater', 'claude', '--arm', 'judge', '--budget', '400', '--tmp-root', data], { ...io, makeRater })).toBe(0);
    out.length = 0;
    expect(await calibrationMain(['dry-run', '--data', data, '--dataset', 'mlcq', '--rater', 'claude', '--arm', 'judge', '--print', 'none'], io)).toBe(0);
    expect(out.join('')).toContain('| mlcq | claude | judge | 96 | 3 | 288 | 288 | 0 | 576 |');
    expect(await calibrationMain(['score'], io)).toBe(0);
    const report = fs.readFileSync(path.join(repo, 'results/v1.3-labeller-calibration/report.md'), 'utf8');
    expect(report).toContain('| claude | judge | ');
    expect(report).toContain('# Sensitivity: MLCQ major-or-worse mapping');
    // A prompt that differs from the pre-registered one is refused before any call.
    const pf = path.join(repo, 'results/v1.3-labeller-calibration/mlcq/prompts.json');
    const prompts = JSON.parse(fs.readFileSync(pf, 'utf8')) as { records: { promptSha256: string }[] };
    prompts.records[0]!.promptSha256 = '0'.repeat(64);
    fs.writeFileSync(pf, JSON.stringify(prompts));
    await expect(calibrationMain(['record', '--data', data, '--dataset', 'mlcq', '--rater', 'claude', '--arm', 'judge', '--budget', '1', '--tmp-root', data], { ...io, makeRater })).rejects.toThrow(/pre-registered prompts.json/);
  });
});
