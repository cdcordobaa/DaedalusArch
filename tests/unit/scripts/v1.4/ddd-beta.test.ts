/**
 * DDD beta capability helpers (`scripts/v1.4/lib/ddd-beta.ts`): concept map, grain census, the shadow class-grain
 * FF-DT01 measurement, rule preconditions, the per-rule recall summary and the beta bar, on hand-made facts.
 */
import {
  betaReady, conceptMap, grainCensus, rulePreconditions, shadowClassGrainDt01, summariseByRule, twinTally,
} from '../../../../scripts/v1.4/lib/ddd-beta.js';
import type { FileFact, KeyRow, SpecDecl } from '../../../../scripts/v1.4/lib/ddd-beta.js';

const spec: SpecDecl = {
  layers: [
    { name: 'domain', kind: 'domain', directories: ['src/*/domain/**'], roles: [] },
    { name: 'application', kind: 'application', directories: ['src/*/application/**'], roles: [] },
    { name: 'composition', kind: 'application', directories: ['src/main.ts'], roles: ['composition-root'] },
  ],
  allowed: new Map([['application', ['domain']], ['composition', ['domain', 'application']]]),
  ddd: {
    source_root: 'src/',
    contexts: [{ name: 'registry', root: 'src/registry/', public_api: [], acl: [] }, { name: 'deployment', root: 'src/deployment/' }],
    outside_contexts: ['src/main.ts'],
    aggregates: [{ name: 'Volunteer', context: 'registry', module: 'src/registry/domain/**', root: 'src/registry/domain/volunteer.ts', inner_entities: ['src/registry/domain/skill.ts'] }],
    value_objects: ['src/**/value-objects/**'],
    repositories: ['src/*/domain/*Repository.ts'],
    domain_event_types: ['DomainEvent'],
    application_services: ['src/*/application/*.ts'],
  },
};

const cls = (name: string, ext: string | null = null, impl: string[] = []): FileFact['classes'][number] => ({ name, extends: ext, implements: impl });

// Agent shape: the inner entities live in the root's file; no skill.ts exists.
const agentFacts: FileFact[] = [
  { file: 'src/registry/domain/volunteer.ts', classes: [cls('Volunteer'), cls('Skill'), cls('Certification')], imports: [], types: ['VolunteerSkill', 'VolunteerRepository'] },
  { file: 'src/registry/domain/volunteerRepository.ts', classes: [], imports: [{ target: 'src/registry/domain/volunteer.ts', names: ['Volunteer'] }] },
  { file: 'src/registry/application/service.ts', classes: [cls('RegistryService')], imports: [{ target: 'src/registry/domain/volunteer.ts', names: ['Volunteer', 'Skill'] }] },
  { file: 'src/deployment/domain/incident.ts', classes: [cls('Incident'), cls('Opened', null, ['DomainEvent'])], imports: [] },
  { file: 'src/main.ts', classes: [], imports: [] },
];

describe('ddd-beta helpers', () => {
  it('maps declarations to files and classes, and flags a declaration that names no code', () => {
    const rows = conceptMap(spec, agentFacts);
    const inner = rows.find((r) => r.concept === 'inner entity' && r.item === 'Volunteer');
    expect(inner).toMatchObject({ files: 0, mapsToCode: false });
    expect(rows.find((r) => r.concept === 'aggregate root')).toMatchObject({ files: 1, classes: 3, mapsToCode: true });
    expect(rows.find((r) => r.concept === 'value object')).toMatchObject({ files: 0, mapsToCode: false });
    expect(rows.find((r) => r.concept === 'domain event (by type)')).toMatchObject({ classes: 1, mapsToCode: true });
    expect(rows.filter((r) => r.concept === 'bounded context').map((r) => r.files)).toEqual([3, 1]);
  });

  it('places inner entities by grain and counts the class-grain imports the file rules cannot see', () => {
    const g = grainCensus(spec, agentFacts);
    expect(g.domainMultiClassFiles).toBe(2);
    expect(g.perAggregate[0]).toMatchObject({ rootClasses: ['Volunteer', 'Skill', 'Certification'], classesInRootFile: ['Skill', 'Certification'], innerInDeclaredFile: [] });
    expect(g.perAggregate[0]?.innerInSharedFile).toEqual(['Skill', 'Certification']);
    expect(g.perAggregate[0]?.typesInRootFile).toEqual(['VolunteerSkill']);
    expect(shadowClassGrainDt01(spec, agentFacts, g)).toEqual([{ aggregate: 'Volunteer', source: 'src/registry/application/service.ts', target: 'src/registry/domain/volunteer.ts', name: 'Skill' }]);
  });

  it('reports the file preconditions per rule', () => {
    const p = Object.fromEntries(rulePreconditions(spec, agentFacts).map((x) => [x.rule, x.holds]));
    expect(p).toMatchObject({ 'FF-DS01': true, 'FF-DS02': true, 'FF-DT01': false, 'FF-DT02': false, 'FF-DT03': false, 'FF-DT04': true, 'FF-S01': true, 'FF-S02': true, 'FF-P07': true });
  });

  it('summarises recall per rule at key grain and tallies twin false fires', () => {
    const row = (o: Partial<KeyRow>): KeyRow => ({ baseId: 'a', baseKind: 'real', operatorId: 'MO-D01', positiveId: 'MO-D01', role: 'positive', status: 'detected', expected: [{ functionId: 'FF-DT01' }], hits: [true], newBlocking: [], ...o });
    const rows = [
      row({}), row({ baseId: 'b', status: 'missed', hits: [false] }), row({ status: 'typecheck', hits: [] }),
      row({ role: 'twin', operatorId: 'MO-D01n', status: 'false-fire', newBlocking: [{ functionId: 'FF-DS02' }] }), row({ role: 'twin', operatorId: 'MO-D01n', status: 'silent' }),
    ];
    const s = summariseByRule(rows, ['FF-DT01']).find((x) => x.baseKind === '*');
    expect(s).toMatchObject({ keys: 2, hits: 1, bases: 2, basesDetected: 1, rate: 0.5 });
    expect(twinTally(rows)).toEqual([{ positiveId: 'MO-D01', evaluated: 2, falseFires: 1, rules: ['FF-DS02'] }]);
  });

  it('applies the proposed beta bar', () => {
    expect(betaReady(3, 0.95, 0)).toEqual({ ready: true, reasons: [] });
    expect(betaReady(1, null, 1).reasons).toHaveLength(3);
  });
});
