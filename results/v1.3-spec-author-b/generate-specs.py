"""K2 (v1.3): generate the author-B specs. Usage: K2_REPOS=<dir of clones> python3 results/v1.3-spec-author-b/generate-specs.py

Generate author-B specs: preset text with the architecture block and default_exclude_paths replaced."""
import os, re, pathlib

REPO = pathlib.Path(__file__).resolve().parents[2]
OUT = REPO / 'results/v1.3-spec-author-b/specs'
OUT.mkdir(parents=True, exist_ok=True)

BASE_EX = ['node_modules/**', 'dist/**', '**/*.spec.ts', '**/*.test.ts']


def L(name, dirs, kind=None, roles=None, file_patterns=None):
    return dict(name=name, kind=kind, dirs=dirs, roles=roles or [], fp=file_patterns or [])


def layers_yaml(layers):
    out = ['  layers:']
    for l in layers:
        out.append(f'    - name: {l["name"]}')
        if l['kind']:
            out.append(f'      kind: {l["kind"]}')
        out.append('      directories:')
        out += [f'        - "{d}"' for d in l['dirs']]
        if l['fp']:
            out.append('      file_patterns:')
            out += [f'        - "{d}"' for d in l['fp']]
        if l['roles']:
            out.append('      roles:')
            out += [f'        - {r}' for r in l['roles']]
        out.append('')
    return out


def deps_yaml(deps):
    out = ['  allowed_dependencies:']
    for f, t in deps:
        out.append(f'    - from: {f}')
        out.append(f'      to: [{", ".join(t)}]')
    return out


def qlist(xs):
    return '[' + ', '.join(f'"{x}"' for x in xs) + ']'


def ddd_yaml(d):
    out = ['  ddd:', f'    source_root: {d["source_root"]}', '    contexts:']
    for c in d['contexts']:
        out += [f'      - name: {c["name"]}', f'        root: {c["root"]}',
                f'        public_api: {qlist(c.get("public_api", []))}', f'        acl: {qlist(c.get("acl", []))}']
    out.append(f'    outside_contexts: {qlist(d["outside"])}')
    out.append('    aggregates:')
    for a in d['aggregates']:
        out += [f'      - name: {a["name"]}', f'        context: {a["context"]}', f'        module: "{a["module"]}"',
                f'        root: {a["root"]}', f'        inner_entities: {qlist(a.get("inner", []))}']
    out.append(f'    value_objects: {qlist(d["value_objects"])}')
    out.append(f'    repositories: {qlist(d["repositories"])}')
    out.append(f'    domain_event_types: [{", ".join(d["event_types"])}]')
    out.append(f'    application_services: {qlist(d["app_services"])}')
    return out


HEX_DEPS = [('application', ['domain']), ('adapters-inbound', ['application', 'domain']),
            ('adapters-outbound', ['application', 'domain']),
            ('config', ['domain', 'application', 'adapters-inbound', 'adapters-outbound'])]
DDD_DEPS = [('application', ['domain']), ('infrastructure', ['application', 'domain']), ('api', ['application', 'domain']),
            ('composition', ['domain', 'application', 'infrastructure', 'api'])]

CA_ROLES = dict(domain=['entity', 'value-object', 'domain-service', 'repository-interface'],
                application=['use-case', 'dto', 'application-service'],
                infrastructure=['repository-impl', 'controller', 'middleware', 'orm-entity'])
LAY_ROLES = dict(persistence=['repository', 'data-access-object', 'orm-entity'],
                 business=['business-service', 'entity', 'value-object'], presentation=['controller', 'view', 'presenter'])
HEX_ROLES = {'domain': ['entity', 'value-object', 'domain-service', 'port'],
             'application': ['use-case', 'port', 'application-service'],
             'adapters-inbound': ['controller', 'cli-command', 'message-consumer'],
             'adapters-outbound': ['repository', 'gateway', 'external-api-client'],
             'config': ['composition-root', 'module']}
DDD_ROLES = {'domain': ['aggregate', 'entity', 'value-object', 'domain-event', 'repository-interface'],
             'application': ['application-service', 'port'], 'infrastructure': ['repository', 'anti-corruption-layer'],
             'api': ['controller'], 'composition': ['composition-root']}
HEX_KIND = {'domain': 'domain', 'application': 'application', 'adapters-inbound': 'presentation',
            'adapters-outbound': 'infrastructure', 'config': 'application'}
DDD_KIND = {'domain': 'domain', 'application': 'application', 'infrastructure': 'infrastructure', 'api': 'presentation',
            'composition': 'application'}

# nestjs preset's file_patterns kept verbatim; preset directories kept and repo directories appended.
NEST_PRESET_DIRS = {
    'domain': ['src/domain/**', 'src/core/**', 'src/entities/**', 'src/models/**'],
    'infrastructure': ['src/infrastructure/**', 'src/persistence/**', 'src/adapters/**', 'src/prisma/**', 'src/lib/**',
                       'src/common/middleware/**', 'src/common/filters/**', 'src/common/pipes/**'],
    'application': ['src/application/**', 'src/use-cases/**', 'src/services/**'],
    'presentation': ['src/controllers/**', 'src/gateways/**', 'src/common/guards/**', 'src/common/interceptors/**'],
}
NEST_FP = {
    'domain': [],
    'infrastructure': ['**/*.repository.ts', '**/*.worker.ts', '**/workers/**', '**/strategies/**'],
    'application': ['**/*.service.ts', '**/*.processor.ts', '**/dto/**', '**/*.dto.ts'],
    'presentation': ['**/*.controller.ts', '**/*.module.ts', '**/*.guard.ts', '**/*.interceptor.ts', '**/*.gateway.ts'],
}
NEST_ROLES = {'domain': ['entity', 'value-object', 'domain-service', 'repository-interface'],
              'infrastructure': ['repository-impl', 'orm-entity', 'external-service', 'middleware', 'worker'],
              'application': ['use-case', 'dto', 'application-service', 'processor'],
              'presentation': ['controller', 'module', 'gateway', 'guard', 'interceptor']}


def ca(dom, app, infra):
    return [L('domain', dom, roles=CA_ROLES['domain']), L('application', app, roles=CA_ROLES['application']),
            L('infrastructure', infra, roles=CA_ROLES['infrastructure'])]


def lay(pers, bus, pres):
    return [L('persistence', pers, 'infrastructure', LAY_ROLES['persistence']),
            L('business', bus, 'domain', LAY_ROLES['business']),
            L('presentation', pres, 'presentation', LAY_ROLES['presentation'])]


def hexa(**dirs):
    names = ['domain', 'application', 'adapters-inbound', 'adapters-outbound', 'config']
    return [L(n, dirs[n.replace('-', '_')], HEX_KIND[n], HEX_ROLES[n]) for n in names]


def ddd_layers(**dirs):
    names = ['domain', 'application', 'infrastructure', 'api', 'composition']
    return [L(n, dirs[n], DDD_KIND[n], DDD_ROLES[n]) for n in names]


def nest(**extra):
    out = []
    for n in ['domain', 'infrastructure', 'application', 'presentation']:
        out.append(L(n, NEST_PRESET_DIRS[n] + extra.get(n, []), None, NEST_ROLES[n], NEST_FP[n]))
    return out


FORUM = pathlib.Path(os.environ['K2_REPOS']) / 'ddd-forum'  # clones at the selection.json pins
FORUM_VOS = sorted(str(f.relative_to(FORUM)) for f in FORUM.glob('src/modules/*/domain/*.ts')
                   if 'extends ValueObject' in f.read_text() and not f.name.endswith('.spec.ts'))
FORUM_UCS = sorted(str(f.relative_to(FORUM)) for f in FORUM.glob('src/modules/*/useCases/**/*.ts')
                   if f.name.endswith('UseCase.ts') or f.stem.lower() == f.parent.name.lower())

SPECS = {
    # ── clean-architecture ──
    'pvarentsov-clean': dict(style='clean-architecture', layers=ca(
        ['src/core/domain/**', 'src/core/common/**'],
        ['src/core/service/**'],
        ['src/infrastructure/**', 'src/application/**', 'src/*.ts']),
        exclude=['test/**']),
    'luizomf-clean-api': dict(style='clean-architecture', layers=ca(
        ['src/domain/**'],
        ['src/application/**'],
        ['src/infrastructure/**', 'src/presentation/**', 'src/main/**', 'src/common/adapters/**']),
        exclude=[]),
    'dannielhugo-clean': dict(style='clean-architecture', layers=ca(
        ['src/app/core/**'],
        ['src/app/*/**', 'src/app/*.ts'],
        ['src/data/**', 'src/frameworks/**']),
        exclude=[]),
    # ── layered ──
    'bulletproof-nodejs': dict(style='layered', layers=lay(
        ['src/models/**'],
        ['src/services/**', 'src/interfaces/**', 'src/subscribers/**', 'src/decorators/**'],
        ['src/api/**', 'src/jobs/**']),
        exclude=['tests/**']),
    'w3tec-express-boilerplate': dict(style='layered', layers=lay(
        ['src/api/repositories/**', 'src/api/models/**', 'src/database/**'],
        ['src/api/services/**', 'src/api/subscribers/**', 'src/api/errors/**', 'src/auth/**'],
        ['src/api/controllers/**', 'src/api/middlewares/**', 'src/api/resolvers/**', 'src/api/types/**',
         'src/api/Context.ts']),
        exclude=['test/**']),
    'talento90-typescript-node': dict(style='layered', layers=lay(
        ['src/repositories/**', 'src/lib/**'],
        ['src/managers/**', 'src/entities/**', 'src/errors.ts'],
        ['src/server/**']),
        exclude=['test/**']),
    # ── nestjs ──
    'zeldaplay-api': dict(style='nestjs', layers=nest(
        infrastructure=['src/app/database/**', 'src/app/redis/**', 'src/app/config/**', 'src/app/options/**'],
        domain=['src/app/models/**', 'src/app/**/models/**'],
        application=['src/app/interfaces/**', 'src/app/validators/**'],
        presentation=['src/app/guards/**']),
        exclude=None),
    'neoteric-nestjs-auth': dict(style='nestjs', layers=nest(
        domain=['src/app/**/entity/**', 'src/app/_helpers/entity/**', 'src/app/_helpers/database/repository.interface.ts'],
        infrastructure=['src/app/database/**', 'src/migrations/**', 'src/app/_helpers/database/**',
                        'src/app/_helpers/filters/**', 'src/app/_helpers/middleware/**', 'src/app/_helpers/mail/**',
                        'src/app/_helpers/sms/**', 'src/app/_helpers/push/**', 'src/app/home/attom/**',
                        'src/app/**/*.providers.ts', 'src/app/auth/stategies/**', 'src/app/**/pipe/**'],
        application=['src/app/security/**/!(*.module).ts', 'src/app/*/security/**', 'src/app/**/*.validator.ts'],
        presentation=['src/app/**/*.resolver.ts', 'src/app/_helpers/graphql/**', 'src/app/_helpers/decorators/**',
                      'src/app/**/*.command.ts']),
        exclude=None),
    'vivify-nestjs-boilerplate': dict(style='nestjs', layers=nest(
        domain=['src/modules/**/*.entity.ts'],
        infrastructure=['src/migrations/**', 'src/modules/user/password.transformer.ts', 'src/modules/auth/jwt.strategy.ts',
                        'src/utils/**', 'src/modules/common/transformer/**', 'src/modules/config/config.service.ts'],
        application=['src/modules/auth/*.payload.ts', 'src/modules/common/validator/**'],
        presentation=['src/modules/auth/jwt-guard.ts', 'src/modules/common/decorator/**']),
        exclude=None),
    # ── hexagonal ──
    'conduit-ports-adapters': dict(style='hexagonal', layers=hexa(
        domain=['src/core/types/**', 'src/core/*/types.ts'],
        application=['src/core/*/use-cases/**'],
        adapters_inbound=['src/ports/express/**'],
        adapters_outbound=['src/ports/adapters/**', 'src/ports/db-in-memory/**', 'src/ports/jwt/**'],
        config=['src/app.ts', 'src/index.ts', 'src/config/**']),
        exclude=['src/config/tests/**', '**/*.test.*'], deps=HEX_DEPS),
    'ddialar-hexagonal-boilerplate': dict(style='hexagonal', layers=hexa(
        domain=['src/core/**'],
        application=['src/ports/**'],
        adapters_inbound=['src/adapters/transportLayer/**'],
        adapters_outbound=['src/adapters/dataSources/**'],
        config=['src/server.ts', 'src/adapters/index.ts']),
        exclude=['**/tests/**', '**/__test__/**'], deps=HEX_DEPS),
    'nest-products-hexagonal': dict(style='hexagonal', layers=hexa(
        domain=['src/domain/**/!(*.module).ts'],
        application=['src/application/**/!(*.module).ts'],
        adapters_inbound=['src/infrastructure/controllers/**', 'src/infrastructure/exceptions/**'],
        adapters_outbound=['src/infrastructure/adapters/**', 'src/infrastructure/mapper/**'],
        config=['src/main.ts', 'src/**/*.module.ts', 'src/infrastructure/config.service.ts']),
        exclude=['test/**'], deps=HEX_DEPS),
    # ── ddd ──
    'ddd-forum': dict(style='ddd', layers=ddd_layers(
        domain=['src/modules/*/domain/**', 'src/shared/domain/**', 'src/shared/core/**', 'src/modules/*/repos/*Repo.ts'],
        application=['src/modules/*/useCases/**/!(*Controller|index).ts', 'src/modules/*/subscriptions/!(index).ts',
                     'src/modules/*/dtos/**', 'src/modules/*/services/authService.ts'],
        infrastructure=['src/modules/*/repos/implementations/**', 'src/modules/*/repos/index.ts',
                        'src/modules/*/mappers/**', 'src/modules/*/services/redis/**', 'src/shared/infra/database/**',
                        'src/shared/infra/Mapper.ts'],
        api=['src/modules/*/infra/http/**', 'src/modules/*/useCases/**/*Controller.ts', 'src/shared/infra/http/**'],
        composition=['src/index.ts', 'src/modules/*/useCases/**/index.ts', 'src/modules/*/subscriptions/index.ts',
                     'src/modules/*/services/index.ts', 'src/config/**']),
        exclude=['public/**'], deps=DDD_DEPS,
        ddd=dict(source_root='src/modules/',
                 contexts=[dict(name='forum', root='src/modules/forum/',
                                public_api=['src/modules/forum/domain/events/**', 'src/modules/forum/dtos/**']),
                           dict(name='users', root='src/modules/users/',
                                public_api=['src/modules/users/domain/events/**', 'src/modules/users/dtos/**',
                                            'src/modules/users/useCases/**/index.ts'])],
                 outside=[],
                 aggregates=[
                     dict(name='User', context='users', module='src/modules/users/domain/**',
                          root='src/modules/users/domain/user.ts'),
                     dict(name='Member', context='forum', module='src/modules/forum/domain/member*.ts',
                          root='src/modules/forum/domain/member.ts'),
                     dict(name='Post', context='forum', module='src/modules/forum/domain/**',
                          root='src/modules/forum/domain/post.ts',
                          inner=['src/modules/forum/domain/comment.ts', 'src/modules/forum/domain/postVote.ts',
                                 'src/modules/forum/domain/commentVote.ts']),
                 ],
                 value_objects=FORUM_VOS,
                 repositories=['src/modules/*/repos/*Repo.ts', 'src/modules/*/repos/implementations/*.ts'],
                 event_types=['IDomainEvent'],
                 app_services=FORUM_UCS)),
    'finance-project-ddd': dict(style='ddd', layers=ddd_layers(
        domain=['src/modules/*/domain/**', 'src/modules/shared/domain/**', 'src/modules/shared/interfaces/**',
                'src/modules/shared/utils/**', 'src/modules/shared/proxies/**'],
        application=['src/modules/*/application/use-cases/**'],
        infrastructure=['src/modules/*/infra/repo/**', 'src/modules/*/infra/entities/**',
                        'src/modules/*/infra/services/queries/**', 'src/modules/*/infra/services/strategies/**',
                        'src/modules/shared/infra/connections/**'],
        api=['src/modules/*/infra/resolver/**', 'src/modules/*/infra/inputs/**', 'src/modules/*/infra/types/**',
             'src/modules/*/infra/services/decorators/**', 'src/modules/*/infra/services/guards/**',
             'src/modules/*/infra/*.service.ts', 'src/docs/**', 'src/health-check/**', 'src/utils/**', 'src/types/**'],
        composition=['src/main.ts', 'src/app.module.ts', 'src/modules/*/infra/*.module.ts',
                     'src/modules/shared/infra/shared.module.ts', 'src/modules/shared/index.ts', 'src/config/**']),
        exclude=['**/tests/**', '**/mocks/**', '**/*.mock.ts'], deps=DDD_DEPS,
        ddd=dict(source_root='src/modules/',
                 contexts=[dict(name='budget-box', root='src/modules/budget-box/'),
                           dict(name='transaction', root='src/modules/transaction/'),
                           dict(name='user', root='src/modules/user/', public_api=['src/modules/user/domain/index.ts'])],
                 outside=['src/modules/shared/**'],
                 aggregates=[
                     dict(name='BudgetBox', context='budget-box', module='src/modules/budget-box/domain/**',
                          root='src/modules/budget-box/domain/budget-box.aggregate.ts',
                          inner=['src/modules/budget-box/domain/reason.domain-entity.ts']),
                     dict(name='Transaction', context='transaction', module='src/modules/transaction/domain/**',
                          root='src/modules/transaction/domain/transaction.aggregate.ts'),
                     dict(name='User', context='user', module='src/modules/user/domain/**',
                          root='src/modules/user/domain/user.aggregate.ts'),
                 ],
                 value_objects=['src/**/*.value-object.ts'],
                 repositories=['src/modules/*/domain/interfaces/*.repository.interface.ts',
                               'src/modules/*/infra/repo/*.repository.ts'],
                 event_types=['IDomainEvent'],
                 app_services=['src/modules/*/application/use-cases/**/*.use-case.ts'])),
    'event-sourcing-ddd': dict(style='ddd', layers=ddd_layers(
        domain=['src/domain/**', 'src/core/**'],
        application=['src/commandHandlers/**', 'src/commands/**', 'src/eventHandlers/**'],
        infrastructure=['src/infrastructure/**', 'src/projection/**'],
        api=['src/interfaces/**'],
        composition=['src/index.ts', 'src/entrypoint.ts', 'src/config/**']),
        exclude=[], deps=DDD_DEPS,
        ddd=dict(source_root='src/',
                 contexts=[dict(name='library', root='src/domain/',
                                public_api=['src/domain/**'])],
                 outside=['src/core/**', 'src/commandHandlers/**', 'src/commands/**', 'src/eventHandlers/**',
                          'src/infrastructure/**', 'src/interfaces/**', 'src/projection/**', 'src/config/**',
                          'src/constants/**', 'src/*.ts'],
                 aggregates=[
                     dict(name='Book', context='library', module='src/domain/book/**', root='src/domain/book/Book.ts'),
                     dict(name='User', context='library', module='src/domain/user/**', root='src/domain/user/User.ts'),
                 ],
                 value_objects=['src/domain/**/*ValueObject.ts'],
                 repositories=['src/domain/*/I*Repository.ts', 'src/infrastructure/repositories/*Repository.ts'],
                 event_types=['IEvent', 'Event'],
                 app_services=['src/commandHandlers/**/*.ts'])),
}


def build(id_, s):
    preset = (REPO / f'presets/{s["style"]}.yaml').read_text()
    i = preset.index('\nfitness_functions:')
    tail = preset[i + 1:]
    # Drop the preset's default_exclude_paths block; ours is appended at the end.
    preset_ex = []
    m = re.search(r'^default_exclude_paths:\n((?:  - .*\n)+)', tail, re.M)
    if m:
        preset_ex = [re.sub(r'^  - "?(.*?)"?$', r'\1', x) for x in m.group(1).rstrip('\n').split('\n')]
        tail = tail[:m.start()] + tail[m.end():]
    ex = list(dict.fromkeys((preset_ex or BASE_EX) + (s.get('exclude') or [])))
    arch = ['spec_version: "1.0.0"', '', 'architecture:', f'  style: {s["style"]}', '']
    arch += layers_yaml(s['layers'])
    if s.get('deps'):
        arch += deps_yaml(s['deps'])
    if s.get('ddd'):
        arch += ddd_yaml(s['ddd'])
    head = [f'# Author-B spec for external-set repo {id_} (v1.3 K2, spec-author reliability).',
            f'# Fitness functions, thresholds and weights copied verbatim from presets/{s["style"]}.yaml; only the',
            '# architecture block (layer globs, DDD declarations) and default_exclude_paths are authored here.',
            '# Rationale: results/v1.3-spec-author-b/spec-rationale.md', '']
    body = '\n'.join(head + arch) + '\n\n' + tail.rstrip('\n') + '\n\ndefault_exclude_paths:\n' + \
        ''.join(f'  - "{x}"\n' for x in ex)
    (OUT / f'{id_}.yaml').write_text(body)


if __name__ == '__main__':
    for k, v in SPECS.items():
        build(k, v)
    print(len(SPECS), 'specs written')
