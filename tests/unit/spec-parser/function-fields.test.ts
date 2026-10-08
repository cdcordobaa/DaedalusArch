import {
  FUNCTION_FIELD_KEYS, FIELD_TO_YAML_KEY, mapFunctionSpecificFields,
} from '../../../src/spec-parser/function-fields.js';
import { PATTERN_GRAMMAR } from '../../../src/spec-parser/spec-schema.js';

describe('FUNCTION_FIELD_KEYS (FR-07, BR-U1-03)', () => {
  it('maps the six YAML keys in the fixed order', () => {
    expect(Object.entries(FUNCTION_FIELD_KEYS)).toEqual([
      ['forbidden_imports', 'forbiddenImports'],
      ['max_public_methods', 'maxPublicMethods'],
      ['max_dependencies', 'maxDependencies'],
      ['max_interface_methods', 'maxInterfaceMethods'],
      ['max_depth', 'maxDepth'],
      ['pattern', 'pattern'],
    ]);
  });

  it('FIELD_TO_YAML_KEY is the reverse map', () => {
    expect(FIELD_TO_YAML_KEY).toEqual({
      forbiddenImports: 'forbidden_imports',
      maxPublicMethods: 'max_public_methods',
      maxDependencies: 'max_dependencies',
      maxInterfaceMethods: 'max_interface_methods',
      maxDepth: 'max_depth',
      pattern: 'pattern',
    });
  });
});

describe('mapFunctionSpecificFields (FR-07, BR-U1-03, BR-U1-07)', () => {
  it.each([
    ['forbidden_imports', ['express', '@nestjs/*'], 'forbiddenImports'],
    ['max_public_methods', 12, 'maxPublicMethods'],
    ['max_dependencies', 7, 'maxDependencies'],
    ['max_interface_methods', 5, 'maxInterfaceMethods'],
    ['max_depth', 3, 'maxDepth'],
    ['pattern', '*Service|*UseCase', 'pattern'],
  ])('maps %s to %s', (yamlKey, value, field) => {
    const { fields, errors } = mapFunctionSpecificFields({ id: 'FF-X01', [yamlKey]: value }, 'fitness_functions[0]');
    expect(errors).toEqual([]);
    expect(fields).toEqual({ [field]: value });
  });

  it('keeps 0 and [] as values (presence is != null)', () => {
    const { fields } = mapFunctionSpecificFields(
      { max_dependencies: 0, max_depth: 0, forbidden_imports: [] }, 'p',
    );
    expect(fields).toEqual({ forbiddenImports: [], maxDependencies: 0, maxDepth: 0 });
  });

  it('omits absent and null keys (no undefined-valued properties)', () => {
    const { fields } = mapFunctionSpecificFields({ id: 'FF-X01', max_depth: null, threshold: 0.8 }, 'p');
    expect(fields).toEqual({});
    expect(Object.keys(fields)).toEqual([]);
    expect('maxDepth' in fields).toBe(false);
  });

  it('emits fields in FUNCTION_FIELD_KEYS order regardless of YAML order', () => {
    const { fields } = mapFunctionSpecificFields(
      { pattern: '*Repo', max_depth: 2, forbidden_imports: ['fs'], max_public_methods: 4 }, 'p',
    );
    expect(Object.keys(fields)).toEqual(['forbiddenImports', 'maxPublicMethods', 'maxDepth', 'pattern']);
  });

  it('copies list values (no aliasing of the raw array)', () => {
    const raw = { forbidden_imports: ['express'] };
    const { fields } = mapFunctionSpecificFields(raw, 'p');
    expect(fields.forbiddenImports).toEqual(['express']);
    expect(fields.forbiddenImports).not.toBe(raw.forbidden_imports);
  });

  it('reports a mistyped value on the defensive errors channel and omits it', () => {
    const { fields, errors } = mapFunctionSpecificFields(
      { max_depth: -1, forbidden_imports: 'express', pattern: 3 }, 'fitness_functions[2]',
    );
    expect(fields).toEqual({});
    expect(errors.map((e) => e.path)).toEqual([
      'fitness_functions[2].forbidden_imports',
      'fitness_functions[2].max_depth',
      'fitness_functions[2].pattern',
    ]);
  });
});

describe('PATTERN_GRAMMAR (BR-U1-06, BR-U1-02 pin)', () => {
  it('equals the frozen domain-entities.md §5 string', () => {
    expect(PATTERN_GRAMMAR).toBe('^[A-Za-z0-9_$*?]+(\\|[A-Za-z0-9_$*?]+)*$');
  });

  it.each(['*Service', '*Service|*UseCase', '*Repository|*Repo|*Store', 'Legacy$*', 'A?b_9'])(
    'accepts %s', (v) => { expect(new RegExp(PATTERN_GRAMMAR).test(v)).toBe(true); },
  );

  it.each(['*Repo|', '|*Repo', 'a||b', '.*Service', '* Service', ''])(
    'rejects %j', (v) => { expect(new RegExp(PATTERN_GRAMMAR).test(v)).toBe(false); },
  );
});
