import { buildSpecView, whichLayer } from '../../../src/mcp-server/spec-view.js';
import { allowedTransitions } from '../../../src/mcp-server/spec-rules.js';
import { CLEAN_ARCH_SPEC, LAYERED_SPEC, NO_DOMAIN_SPEC, loadSpec } from './helpers.js';

describe('get_architecture_spec view', () => {
  it('lists layers inner to outer with globs, roles and import directions (clean-architecture)', async () => {
    const view = buildSpecView(await loadSpec(CLEAN_ARCH_SPEC), CLEAN_ARCH_SPEC);
    expect(view.style).toBe('clean-architecture');
    expect(view.layerOrder).toEqual(['domain', 'application', 'infrastructure']);
    const byName = Object.fromEntries(view.layers.map((l) => [l.name, l]));
    expect(byName.domain).toMatchObject({
      index: 0,
      kind: 'domain',
      globs: ['src/domain/**'],
      mayImport: [],
      mayNotImport: ['application', 'infrastructure'],
    });
    expect(byName.application).toMatchObject({
      mayImport: ['domain'],
      mayNotImport: ['infrastructure'],
    });
    expect(byName.infrastructure).toMatchObject({
      mayImport: ['domain', 'application'],
      mayNotImport: [],
    });
    expect(byName.domain?.roles).toContain('entity');
  });

  it('reports the domain-purity packages and the verdict thresholds', async () => {
    const view = buildSpecView(await loadSpec(CLEAN_ARCH_SPEC), CLEAN_ARCH_SPEC);
    expect(view.forbiddenPackages).toEqual([
      '@nestjs/*',
      'typeorm',
      'express',
      'prisma',
      '@prisma/*',
      'sequelize',
    ]);
    expect(view.verdictThresholds).toEqual({ pass: 0.8, warning: 0.65, softBlock: 0.5 });
  });

  it('gives every rule a status and the template description', async () => {
    const view = buildSpecView(await loadSpec(CLEAN_ARCH_SPEC), CLEAN_ARCH_SPEC);
    const rule = (id: string) => view.rules.find((r) => r.id === id);
    expect(rule('FF-S01')).toMatchObject({
      status: 'active',
      checkedByCheckImport: true,
      name: 'dependency-direction',
    });
    expect(rule('FF-S01')?.description).toMatch(/lower layer imports from a higher layer/);
    expect(rule('FF-S03')).toMatchObject({
      status: 'not-applicable',
      statusReason: 'not applicable to style clean-architecture',
      checkedByCheckImport: false,
    });
    expect(rule('FF-CV01')?.status).toBe('disabled');
    expect(rule('FF-CV01')?.statusReason).toMatch(/ADR-016/);
    expect(rule('FF-N02')).toMatchObject({ route: 'neuronal', status: 'active' });
    expect(rule('FF-N02')?.description).toMatch(/role of its declared layer/);
    expect(view.rules).toHaveLength((await loadSpec(CLEAN_ARCH_SPEC)).fitnessFunctions.length);
  });

  it('applies closed layering for the layered style', async () => {
    const spec = await loadSpec(LAYERED_SPEC);
    expect(allowedTransitions(spec)).toEqual(['business>persistence', 'presentation>business']);
    const view = buildSpecView(spec, LAYERED_SPEC);
    expect(view.layerOrder).toEqual(['persistence', 'business', 'presentation']);
    expect(view.rules.find((r) => r.id === 'FF-S03')).toMatchObject({
      status: 'active',
      checkedByCheckImport: true,
    });
    expect(view.rules.find((r) => r.id === 'FF-S04')?.status).toBe('not-applicable');
    const presentation = view.layers.find((l) => l.name === 'presentation');
    expect(presentation).toMatchObject({ mayImport: ['business'], mayNotImport: ['persistence'] });
  });

  it('has no domain packages and only the declared rules for a spec without a domain layer', async () => {
    const view = buildSpecView(await loadSpec(NO_DOMAIN_SPEC), NO_DOMAIN_SPEC);
    expect(view.forbiddenPackages).toEqual([]);
    expect(view.rules.map((r) => r.name).filter((n) => n.startsWith('domain'))).toEqual([]);
    expect(view.layers.map((l) => l.kind)).toEqual(['infrastructure', 'presentation']);
  });
});

describe('which_layer', () => {
  it('maps a path to its layer with the matching glob and the import directions', async () => {
    const spec = await loadSpec(CLEAN_ARCH_SPEC);
    const result = whichLayer(spec, './src/application/use-cases/CreateTaskUseCase.ts');
    expect(result).toMatchObject({
      path: 'src/application/use-cases/CreateTaskUseCase.ts',
      layer: 'application',
      matchedBy: 'directory',
      matchedGlob: 'src/application/**',
      mayImport: ['domain'],
      mayNotImport: ['infrastructure'],
      forbiddenPackages: [],
    });
  });

  it('lists forbidden packages for a domain file only', async () => {
    const spec = await loadSpec(CLEAN_ARCH_SPEC);
    expect(whichLayer(spec, 'src/domain/entities/Task.ts').forbiddenPackages).toContain('typeorm');
    expect(
      whichLayer(spec, 'src/infrastructure/controllers/TaskController.ts').forbiddenPackages,
    ).toEqual([]);
  });

  it('returns a null layer with a note for a path no layer claims', async () => {
    const result = whichLayer(await loadSpec(CLEAN_ARCH_SPEC), 'scripts/build.ts');
    expect(result.layer).toBeNull();
    expect(result.matchedBy).toBeNull();
    expect(result.note).toMatch(/no layer glob matches/);
  });

  it('takes the first matching layer in spec order and normalises backslashes', async () => {
    const spec = await loadSpec(LAYERED_SPEC);
    expect(whichLayer(spec, 'src\\infrastructure\\controllers\\NoteController.ts').layer).toBe(
      'presentation',
    );
    expect(whichLayer(spec, 'src/application/Foo.ts').layer).toBe('business');
  });
});
