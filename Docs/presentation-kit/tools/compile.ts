// Presentation kit: compile the real Cypher of chosen rules with the repo's fitness compiler (V13_COMPILE_OPTIONS).
// Usage (repo root): npx tsx compile.ts <out.json>
import * as fs from 'node:fs';
import * as path from 'node:path';
const REPO = process.cwd();
const imp = (p: string) => import(path.join(REPO, p));
async function main() {
  const { parseSpec } = await imp('src/spec-parser/index.ts');
  const { compileFunctions, V13_COMPILE_OPTIONS, instantiateTemplate } = await imp('src/fitness-compiler/index.ts');
  const { compilerInputFromSpec } = await imp('src/fitness-compiler/compiler-input.ts');
  const { APG2_TEMPLATES, APG2_TEMPLATE_TIERS } = await imp('src/fitness-compiler/apg2-templates.ts');
  const { apg2Params } = await imp('src/fitness-compiler/apg2-in-memory.ts');
  const out: Record<string, unknown> = {};
  const jobs: [string, string, string][] = [
    ['B1', 'tests/fixtures/v1.3-reference/clean-architecture/spec.yaml', 'FF-S01'],
    ['B2', 'presets/ddd.yaml', 'FF-DT03'],
    ['B3', 'tests/fixtures/v1.3-reference/hexagonal/spec.yaml', 'FF-S03'],
    ['A2', 'tests/fixtures/v1.3-reference/hexagonal/spec.yaml', 'FF-S01'],
  ];
  for (const [key, spec, fid] of jobs) {
    const parsed = await parseSpec({ specFilePath: path.join(REPO, spec) });
    if (!parsed.success) throw new Error('parse ' + spec + JSON.stringify(parsed.errors));
    const res = compileFunctions(compilerInputFromSpec(parsed.data), V13_COMPILE_OPTIONS);
    if (!res.success) throw new Error('compile ' + spec);
    const q = res.data.symbolicQueries.find((x: any) => x.functionId === fid);
    out[key] = { spec, functionId: fid, name: q?.name, severity: q?.severity, cypher: q?.cypher, params: q?.params, totalCompiled: res.data.totalCompiled };
  }
  // APG v2: the template instantiated as the live run does, with the type-flow fixture's layer model.
  const cases = JSON.parse(fs.readFileSync(path.join(REPO, 'tests/fixtures/v1.3-apg2/cases.json'), 'utf8'));
  const proj = cases.projects['type-flow'];
  const layerModel = { layers: proj.layers.map((l: any) => ({ name: l.name, directories: l.directories, naming: [], role: '', kind: l.kind, kindSource: 'explicit' })) };
  const params = apg2Params(layerModel as any);
  const tpl = APG2_TEMPLATES.get('boundary-type-leak');
  out.B4 = { spec: 'tests/fixtures/v1.3-apg2/cases.json (projects.type-flow)', template: 'boundary-type-leak', tier: APG2_TEMPLATE_TIERS.get('boundary-type-leak'), cypher: instantiateTemplate(tpl, params as any), params };
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  for (const [k, v] of Object.entries(out)) console.log('=====', k, (v as any).name ?? (v as any).template, '\n' + (v as any).cypher, '\nPARAMS', JSON.stringify((v as any).params));
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
