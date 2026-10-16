/**
 * ISE vocabularies, fixed before any measurement (2026-10-15) and not tuned on the reference set. Tokens are path
 * segments, lower-cased with `-` and `_` removed (`use-cases` -> `usecases`). The robustness probe's renamed
 * directories (`kernel`, `orchestration`, `platform`) are deliberately NOT in any list: the probe tests the
 * edge-structure fallback, not the vocabulary.
 */

export function normaliseToken(segment: string): string {
  return segment.toLowerCase().replace(/[-_.\s]/g, '');
}

/** Synonyms per canonical-preset layer name: a unit whose directory token is listed maps to that layer. */
export const LAYER_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  domain: ['domain', 'core', 'entities', 'entity', 'model', 'models', 'sharedkernel'],
  application: ['application', 'usecases', 'usecase', 'app', 'interactors', 'services'],
  infrastructure: ['infrastructure', 'infra', 'frameworks', 'drivers', 'persistence', 'acl', 'anticorruption', 'external'],
  presentation: ['presentation', 'ui', 'web', 'controllers', 'views', 'http', 'rest'],
  business: ['business', 'logic', 'bll', 'services', 'model', 'models'],
  persistence: ['persistence', 'data', 'dal', 'db', 'database', 'repositories', 'storage'],
  'adapters-inbound': ['inbound', 'driving', 'primary', 'in', 'input'],
  'adapters-outbound': ['outbound', 'driven', 'secondary', 'out', 'output'],
  config: ['config', 'configuration', 'bootstrap', 'composition', 'container', 'di', 'wiring'],
  api: ['api', 'controllers', 'http', 'web', 'presentation', 'rest'],
  composition: ['main', 'bootstrap', 'composition', 'server', 'index'],
};

/** Style-indicative directory tokens. */
export const STYLE_TOKENS = {
  cleanCore: ['domain', 'core', 'entities'],
  cleanApplication: ['application', 'usecases', 'usecase', 'interactors'],
  cleanInfrastructure: ['infrastructure', 'infra', 'frameworks', 'drivers'],
  useCases: ['usecases', 'usecase', 'interactors'],
  layeredPresentation: ['presentation', 'ui', 'web'],
  layeredBusiness: ['business', 'logic', 'bll'],
  layeredPersistence: ['persistence', 'data', 'dal', 'database'],
  hexAdapters: ['adapters', 'adapter'],
  hexDirections: ['inbound', 'outbound', 'driving', 'driven', 'primary', 'secondary'],
  hexPorts: ['ports', 'port'],
  hexPortDirections: ['in', 'out', 'inbound', 'outbound', 'driving', 'driven'],
  composition: ['config', 'configuration', 'bootstrap', 'composition', 'container', 'di', 'wiring'],
  dddLayers: ['domain', 'application', 'infrastructure', 'api', 'acl', 'interfaces'],
  dddSharedKernel: ['sharedkernel', 'shared', 'common'],
  dddBoundary: ['acl', 'anticorruption', 'contracts', 'publishedlanguage'],
  valueObjects: ['valueobjects', 'valueobject', 'vo'],
  events: ['events', 'event'],
} as const;

/** Directories that only group other units (a unit is split into its children). */
export const CONTAINER_TOKENS: readonly string[] = ['adapters', 'adapter', 'common', 'modules', 'features', 'layers', 'contexts', 'boundedcontexts'];

/** NestJS class decorators. */
export const NEST_DECORATORS: readonly string[] = ['Module', 'Controller', 'Injectable', 'Catch', 'Resolver', 'WebSocketGateway'];

/** NestJS dot-suffix file names (`attendees.controller.ts`). */
export const NEST_FILE_SUFFIX = /\.(module|controller|service|dto|guard|filter|interceptor|pipe|gateway|resolver|repository|entity|strategy)\.ts$/;

/** External packages that mark framework code. */
export const FRAMEWORK_PACKAGES: readonly RegExp[] = [/^@nestjs\//, /^typeorm$/, /^express$/, /^prisma$/, /^@prisma\//, /^sequelize$/, /^mongoose$/, /^class-transformer$/, /^class-validator$/, /^koa$/, /^fastify$/];
