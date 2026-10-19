/** Test helpers of ontology v0: the fixture cases and a throw-away project on disk. */
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { NoCallProvider, prepareOntologyInput, runOntology } from '../../../../src/apg-enrich/ontology/index.js';
import type { ExpectedSemanticManifest, OntologyInput, OntologyRunDetail, ScriptedAnswers } from '../../../../src/apg-enrich/ontology/index.js';
import type { LayerModel } from '../../../../src/shared/types/spec.js';

export const FIXTURES = join(__dirname, '../../../fixtures/v1.3-ontology');
export const LAYERS = JSON.parse(readFileSync(join(FIXTURES, 'layers.json'), 'utf8')) as LayerModel;
export const CASES = [
  'case-01-rule-dup-shapes', 'case-02-misplaced-pricing', 'case-03-concept-fragmentation',
  'case-04a-control-near-miss-rules', 'case-04b-control-clean-notification', 'case-04c-control-distinct-concepts',
] as const;

export function fixtureInput(caseId: string): Promise<OntologyInput> {
  return prepareOntologyInput(join(FIXTURES, caseId), { layerModel: LAYERS });
}

export const MOCK_DESCRIPTION = { provider: 'mock', model: 'mock-ontology', temperature: null } as const;

/** The run detail of a planted case, replayed from the committed mock cassettes (no provider call). */
export function replayDetail(input: OntologyInput, caseId: string): Promise<OntologyRunDetail> {
  return runOntology(input, { provider: new NoCallProvider(MOCK_DESCRIPTION), cacheMode: 'replay', cacheDir: join(FIXTURES, 'cassettes-mock', caseId) });
}

export function manifest(caseId: string): ExpectedSemanticManifest {
  return JSON.parse(readFileSync(join(FIXTURES, caseId, 'expected-semantic.json'), 'utf8')) as ExpectedSemanticManifest;
}

export function mockAnswers(caseId: string): ScriptedAnswers {
  return JSON.parse(readFileSync(join(FIXTURES, 'mock-answers', `${caseId}.json`), 'utf8')) as ScriptedAnswers;
}

export function tempDir(prefix: string): { dir: string; cleanup: () => void } {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  return { dir, cleanup: () => { rmSync(dir, { recursive: true, force: true }); } };
}

/** Writes a small project (tsconfig + files) and prepares the ontology input over it. */
export async function projectInput(files: Record<string, string>): Promise<{ input: OntologyInput; cleanup: () => void }> {
  const { dir, cleanup } = tempDir('ontology-proj-');
  const all: Record<string, string> = {
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2021', module: 'CommonJS', moduleResolution: 'node', strict: true, skipLibCheck: true, types: [] }, include: ['src/**/*.ts'] }),
    ...files,
  };
  for (const [rel, text] of Object.entries(all)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  return { input: await prepareOntologyInput(dir, { layerModel: LAYERS }), cleanup };
}

export function nodeId(input: OntologyInput, type: string, name: string): string {
  const n = input.apg.nodes.find((x) => x.type === type && x.name === name);
  if (n === undefined) throw new Error(`no ${type} ${name}`);
  return n.id;
}
