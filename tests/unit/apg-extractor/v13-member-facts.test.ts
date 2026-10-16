/**
 * v1.3 class-member facts (`memberFacts` extractor option): field modifiers, accessors, mutator methods and
 * assignments outside the constructor, on Class and Method nodes. Fixture: `fixtures/unit/v13-member-facts`.
 * Notes: aidlc-docs/construction/v1.3-member-facts/notes.md.
 */
import * as path from 'node:path';
import { Project } from 'ts-morph';
import { extractAPG } from '../../../src/apg-extractor/index.js';
import { DEFAULT_OPTIONS, V12E_DEFAULT_OPTIONS, V13_DEFAULT_OPTIONS } from '../../../src/apg-extractor/types.js';
import { assignedThisFields, extractClassMemberFacts, MEMBER_FACT_KEYS } from '../../../src/apg-extractor/member-facts.js';
import type { ClassMemberFacts } from '../../../src/apg-extractor/member-facts.js';
import type { APGNode, APGResult } from '../../../src/shared/types/apg.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const FIXTURE = path.join(REPO_ROOT, 'fixtures/unit/v13-member-facts');
const GOLDEN_FIXTURES = ['correct-reference', 'variant-a-structural', 'variant-b-pattern', 'variant-c-everything', 'variant-d-subtle']
  .map((id) => path.join(REPO_ROOT, 'fixtures', id));

const FACT_KEYS: readonly (keyof ClassMemberFacts)[] = [
  'fields', 'readonlyFields', 'staticFields', 'publicFields', 'protectedFields', 'privateFields',
  'getAccessors', 'setAccessors', 'mutatorMethods', 'fieldsAssignedOutsideConstructor',
];

async function extract(dir: string, options: Parameters<typeof extractAPG>[1]): Promise<APGResult> {
  const r = await extractAPG(dir, options);
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.data;
}

function node(apg: APGResult, type: 'Class' | 'Method', name: string): APGNode {
  const n = apg.nodes.find((x) => x.type === type && x.name === name);
  if (n === undefined) throw new Error(`no ${type} ${name}`);
  return n;
}

/** Facts of one class declared in a source snippet. */
function factsOf(source: string): ClassMemberFacts {
  const sf = new Project({ useInMemoryFileSystem: true }).createSourceFile('x.ts', source);
  const cls = sf.getClasses()[0];
  if (cls === undefined) throw new Error('no class');
  return extractClassMemberFacts(cls);
}

describe('option defaults', () => {
  it('memberFacts is OFF in the v1.2E defaults and ON in the v1.3 defaults', () => {
    expect(V12E_DEFAULT_OPTIONS.memberFacts).toBe(false);
    expect(V13_DEFAULT_OPTIONS.memberFacts).toBe(true);
    expect(DEFAULT_OPTIONS.memberFacts).toBe(true);
  });
});

describe('member facts on the fixture (v1.3 defaults)', () => {
  let apg: APGResult;
  beforeAll(async () => { apg = await extract(FIXTURE, V13_DEFAULT_OPTIONS); });

  it('readonly parameter properties and static readonly fields: Money is immutable', () => {
    const p = node(apg, 'Class', 'Money').properties;
    expect(p.fields).toEqual(['ZERO_CURRENCY', 'cents', 'currency']);
    expect(p.readonlyFields).toEqual(['ZERO_CURRENCY', 'cents', 'currency']);
    expect(p.staticFields).toEqual(['ZERO_CURRENCY']);
    expect(p.publicFields).toEqual(['ZERO_CURRENCY', 'cents', 'currency']);
    expect(p.setAccessors).toEqual([]);
    expect(p.mutatorMethods).toEqual([]);
    expect(p.fieldsAssignedOutsideConstructor).toEqual([]);
  });

  it('private fields with public getters only, assigned in the constructor only: Email is immutable', () => {
    const p = node(apg, 'Class', 'Email').properties;
    expect(p.fields).toEqual(['local', '#domain']);
    expect(p.privateFields).toEqual(['local', '#domain']);
    expect(p.publicFields).toEqual([]);
    expect(p.readonlyFields).toEqual(['#domain']);
    expect(p.getAccessors).toEqual(['user', 'domain']);
    expect(p.setAccessors).toEqual([]);
    expect(p.mutatorMethods).toEqual([]);
    expect(p.fieldsAssignedOutsideConstructor).toEqual([]);
  });

  it('visibility, readonly and static: Counter has one public mutable instance field', () => {
    const p = node(apg, 'Class', 'Counter').properties;
    expect(p.fields).toEqual(['created', 'count', 'step', 'label']);
    expect(p.publicFields).toEqual(['created', 'count', 'label']);
    expect(p.protectedFields).toEqual(['step']);
    expect(p.staticFields).toEqual(['created']);
    expect(p.readonlyFields).toEqual(['label']);
    // Constructor-only assignment, and `Counter.created += 1` is not a `this` field.
    expect(p.fieldsAssignedOutsideConstructor).toEqual([]);
  });

  it('set accessors: Quantity (probe g01 shape) has a set accessor that reassigns a private field', () => {
    const p = node(apg, 'Class', 'Quantity').properties;
    expect(p.getAccessors).toEqual(['value']);
    expect(p.setAccessors).toEqual(['value']);
    expect(p.privateFields).toEqual(['current']);
    expect(p.mutatorMethods).toEqual([]);
    expect(p.fieldsAssignedOutsideConstructor).toEqual(['current']);
  });

  it('mutators: public methods and arrow properties that assign a this field, not private, protected or static ones', () => {
    const p = node(apg, 'Class', 'Range').properties;
    expect(p.mutatorMethods).toEqual(['widen', 'swap', 'bump']);
    expect(p.fieldsAssignedOutsideConstructor).toEqual(['low', 'high']);
    expect(p.readonlyFields).toEqual(['items', 'bump']);
  });

  it('Method nodes carry visibility and the this fields their body assigns', () => {
    const m = (name: string): Readonly<Record<string, unknown>> => node(apg, 'Method', `Range.${name}`).properties;
    expect(m('widen')).toMatchObject({ visibility: 'public', assignedFields: ['low', 'high'] });
    expect(m('swap')).toMatchObject({ visibility: 'public', assignedFields: ['low', 'high'] });
    expect(m('track')).toMatchObject({ visibility: 'public', assignedFields: [] });
    expect(m('withLow')).toMatchObject({ visibility: 'public', assignedFields: [] });
    expect(m('later')).toMatchObject({ visibility: 'public', assignedFields: [] });
    expect(m('reset')).toMatchObject({ visibility: 'private', assignedFields: ['low'] });
    expect(m('shrink')).toMatchObject({ visibility: 'protected', assignedFields: ['high'] });
    expect(m('unit')).toMatchObject({ visibility: 'public', isStatic: true });
  });

  it('the facts are extracted for classes outside value-object folders too (the template selects by path)', () => {
    const p = node(apg, 'Class', 'Order').properties;
    expect(p.setAccessors).toEqual(['state']);
    expect(p.mutatorMethods).toEqual(['cancel']);
  });
});

describe('assignment forms', () => {
  it('counts =, compound assignment, ++/--, delete and destructuring; not nested targets or other objects', () => {
    const f = factsOf(`class V {
      a = 0; b = 0; c = 0; d = 0; e = 0; g?: number; h = 0; o = { x: 1 }; list: number[] = [];
      m1() { this.a = 1; }
      m2() { this.b += 1; this.c ??= 2; }
      m3() { this.d--; ++this.e; }
      m4() { delete this.g; }
      m5() { ({ h: this.h } = { h: 1 }); }
      m6() { this.o.x = 2; this.list.push(1); const other = new V(); other.a = 3; }
      m7() { this['a'] = 4; }
      m8() { const f = () => { this.a = 5; }; f(); }
      m9() { const o = { set(this: { a: number }) { this.a = 6; } }; return o; }
    }`);
    expect(f.mutatorMethods).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', 'm7', 'm8']);
    expect(f.fieldsAssignedOutsideConstructor).toEqual(['a', 'b', 'c', 'd', 'e', 'g', 'h']);
  });

  it('assignedThisFields of an undefined body is empty (abstract or overload signatures)', () => {
    expect(assignedThisFields(undefined)).toEqual([]);
  });

  it('constructor-only assignment is not a mutation; a public readonly field is not mutable', () => {
    const f = factsOf(`class V { readonly x: number; private y: number; constructor() { this.x = 1; this.y = 2; } get y2() { return this.y; } }`);
    expect(f.fieldsAssignedOutsideConstructor).toEqual([]);
    expect(f.mutatorMethods).toEqual([]);
    expect(f.readonlyFields).toEqual(['x']);
  });

  it('static accessors and static methods are left out', () => {
    const f = factsOf(`class V { static n = 0; static set count(v: number) { V.n = v; } static bump(this: typeof V) { this.n = 1; } }`);
    expect(f.setAccessors).toEqual([]);
    expect(f.mutatorMethods).toEqual([]);
    expect(f.staticFields).toEqual(['n']);
  });

  it('every fact list is present (possibly empty) on every class', () => {
    const f = factsOf('class Empty {}');
    for (const k of FACT_KEYS) expect(f[k]).toEqual([]);
    expect([...FACT_KEYS, 'visibility', 'assignedFields']).toEqual(MEMBER_FACT_KEYS);
  });
});

describe('v1.2E byte-identity', () => {
  it('without memberFacts no Class or Method node carries a member fact (v1.2E defaults)', async () => {
    const apg = await extract(FIXTURE, V12E_DEFAULT_OPTIONS);
    for (const n of apg.nodes.filter((x) => x.type === 'Class' || x.type === 'Method')) {
      for (const k of MEMBER_FACT_KEYS) expect(n.properties).not.toHaveProperty(k);
    }
  });

  it.each(GOLDEN_FIXTURES)('%s: the v1.3 graph without memberFacts equals the v1.3 graph minus the member facts', async (dir) => {
    const off = await extract(dir, { ...V13_DEFAULT_OPTIONS, memberFacts: false });
    const on = await extract(dir, V13_DEFAULT_OPTIONS);
    const strip = (n: APGNode): APGNode => {
      const props = Object.fromEntries(Object.entries(n.properties).filter(([k]) => !MEMBER_FACT_KEYS.includes(k)));
      return { ...n, properties: props };
    };
    expect(JSON.stringify({ ...on, nodes: on.nodes.map(strip) })).toBe(JSON.stringify(off));
  });
});
