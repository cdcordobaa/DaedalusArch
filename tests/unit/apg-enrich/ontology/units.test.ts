/** v1.4 U3 (BR-U3-10): the declared bounded context of a class unit, beside the component (unchanged). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildContext, componentOf, declaredContextOf } from '../../../../src/apg-enrich/cheap/context.js';
import { DEFAULT_CHEAP_OPTIONS } from '../../../../src/apg-enrich/cheap/types.js';
import { buildUnits, prepareOntologyInput } from '../../../../src/apg-enrich/ontology/index.js';
import type { OntologyInput } from '../../../../src/apg-enrich/ontology/index.js';
import type { LayerModel } from '../../../../src/shared/types/spec.js';
import { FIXTURES, LAYERS } from './helpers.js';

const CASE05 = join(FIXTURES, 'ns02', 'case-05-fragmentation-in-context');
const CASE05_LAYERS = JSON.parse(readFileSync(join(CASE05, 'layers.json'), 'utf8')) as LayerModel;

function unitsOf(input: OntologyInput, layerModel: LayerModel): ReturnType<typeof buildUnits> {
  const ctx = buildContext({ apg: input.apg, project: input.project, projectRoot: input.projectRoot, layerModel }, DEFAULT_CHEAP_OPTIONS);
  return buildUnits(ctx, input.cheap, { ruleMinDensity: 1 });
}

describe('declared context of a class unit', () => {
  it('declaredContextOf uses the componentOf prefix test, and componentOf is unchanged', () => {
    expect(declaredContextOf('src/sales/domain/customer.ts', CASE05_LAYERS)).toBe('sales');
    expect(declaredContextOf('src/salesforce/x.ts', CASE05_LAYERS)).toBeNull();
    expect(declaredContextOf('src/sales/domain/customer.ts', LAYERS)).toBeNull();
    expect(declaredContextOf('src/sales/domain/customer.ts')).toBeNull();
    expect(componentOf('src/sales/domain/customer.ts', CASE05_LAYERS)).toBe('sales');
    expect(componentOf('src/billing/domain/invoice.ts', LAYERS)).toBe('billing');
    expect(componentOf('main.ts')).toBe('(root)');
  });

  it('every class of case-05 is in the declared context sales; with the parent layers.json none is declared', async () => {
    const input = await prepareOntologyInput(CASE05, { layerModel: CASE05_LAYERS });
    const declared = unitsOf(input, CASE05_LAYERS);
    expect(declared.classes.length).toBeGreaterThan(0);
    expect(declared.classes.every((c) => c.declaredContext === 'sales' && c.component === 'sales')).toBe(true);
    const parent = unitsOf(input, LAYERS);
    expect(parent.classes.every((c) => c.declaredContext === null)).toBe(true);
    expect(parent.classes.map((c) => c.component)).toEqual(declared.classes.map((c) => c.component));
  }, 60_000);
});
