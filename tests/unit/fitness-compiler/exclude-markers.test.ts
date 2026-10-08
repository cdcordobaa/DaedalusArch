import * as path from 'node:path';
import { EXCLUDE_MARKER_RE, replaceExcludeMarkers } from '../../../src/fitness-compiler/exclude-injector.js';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';

const ALIAS_PRED = (a: string): string => `AND NONE(ep IN $excludePatterns WHERE ${a}.filePath =~ ep)`;
const NODES_PRED = (p: string): string =>
  `AND NONE(n IN nodes(${p}) WHERE ANY(ep IN $excludePatterns WHERE n.filePath =~ ep))`;

describe('replaceExcludeMarkers (BR-U1-32, domain-entities.md §3.8)', () => {
  it('alias form', () => {
    expect(replaceExcludeMarkers('WHERE x > 1 /*EXCLUDE:c*/ RETURN c', true))
      .toBe(`WHERE x > 1 ${ALIAS_PRED('c')} RETURN c`);
  });

  it('nodes(<path>) form', () => {
    expect(replaceExcludeMarkers('WHERE true /*EXCLUDE:nodes(p)*/ RETURN p', true))
      .toBe(`WHERE true ${NODES_PRED('p')} RETURN p`);
  });

  it('replaces every marker', () => {
    const text = 'A /*EXCLUDE:src*/ B /*EXCLUDE:nodes(path)*/ C /*EXCLUDE:f*/';
    expect(replaceExcludeMarkers(text, true))
      .toBe(`A ${ALIAS_PRED('src')} B ${NODES_PRED('path')} C ${ALIAS_PRED('f')}`);
  });

  it('empty exclude list: every marker becomes the empty string', () => {
    expect(replaceExcludeMarkers('A /*EXCLUDE:src*/ B /*EXCLUDE:nodes(path)*/ C', false)).toBe('A  B  C');
  });

  it('text without markers is unchanged', () => {
    expect(replaceExcludeMarkers('MATCH (n) RETURN n', true)).toBe('MATCH (n) RETURN n');
  });

  it('EXCLUDE_MARKER_RE matches both forms and is stateless across calls', () => {
    const text = '/*EXCLUDE:a*/ /*EXCLUDE:nodes(p)*/';
    expect([...text.matchAll(EXCLUDE_MARKER_RE)].map((m) => [m[1], m[2]])).toEqual([[undefined, 'a'], ['p', undefined]]);
    expect(replaceExcludeMarkers(text, false)).toBe(' ');
    expect(replaceExcludeMarkers(text, false)).toBe(' ');
  });
});

// BR-U1-32 (b) pin: the splice (retired at K8) landed on these aliases; the anchors keep them.
describe('exclude anchor alias pin (BR-U1-32 b)', () => {
  const ROOT = path.resolve(__dirname, '../../..');

  it.each([
    ['specs/daedalus-arch.yaml', 'FF-P02', 'c'],
    ['specs/daedalus-arch.yaml', 'FF-C02', 'f'],
    ['specs/daedalus-arch.yaml', 'FF-C03', 'f'],
    ['specs/daedalus-arch.yaml', 'FF-C05', 'f'],
    ['presets/nestjs.yaml', 'FF-S03', 'src'],
  ])('%s %s -> alias %s', async (spec, id, alias) => {
    const parsed = await parseSpec({ specFilePath: path.join(ROOT, spec) });
    if (!parsed.success) throw new Error(`${spec} did not parse`);
    const ff = parsed.data.fitnessFunctions.find((f) => String(f.id) === id);
    if (!ff) throw new Error(`${id} not declared in ${spec}`);
    expect(ff.excludePaths.length).toBeGreaterThan(0);
    const tmpl = CYPHER_TEMPLATES.get(ff.name);
    if (!tmpl) throw new Error(`no template ${ff.name}`);
    const markers = [...tmpl.template.matchAll(EXCLUDE_MARKER_RE)].map((m) => m[2]);
    expect(markers).toEqual([alias]);
    const cypher = replaceExcludeMarkers(tmpl.template, true);
    const aliases = [...cypher.matchAll(/NONE\(ep IN \$excludePatterns WHERE (\w+)\.filePath =~ ep\)/g)].map((m) => m[1]);
    expect(aliases).toEqual([alias]);
  });
});
