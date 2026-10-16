"""Emit one layer spec per project from projects.json (v1.3-validity-predictive).

Each spec is presets/nestjs.yaml with the `architecture:` block replaced: the layer order, roles,
decorators and file_patterns of the preset are kept, the project's own directory map and patterns
are added, and `fitness_functions:` is copied verbatim. Run: python3 scripts/v1.3/predictive/make_specs.py
"""
import json
import pathlib

REPO = pathlib.Path(__file__).resolve().parents[3]
SRC = json.loads((REPO / 'scripts/v1.3/predictive/projects.json').read_text())
OUT = REPO / 'results/v1.3-validity-predictive/specs'
PRESET = (REPO / 'presets/nestjs.yaml').read_text()
FF = PRESET[PRESET.index('fitness_functions:'):]

# Preset layer order (inner -> outer), roles, decorators and file patterns (presets/nestjs.yaml).
LAYERS = [
    ('domain', 'd', ['entity', 'value-object', 'domain-service', 'repository-interface'], [], ['**/*.entity.ts']),
    ('infrastructure', 'i', ['repository-impl', 'orm-entity', 'external-service', 'middleware', 'worker'], [],
     ['**/*.repository.ts', '**/*.worker.ts', '**/workers/**', '**/strategies/**']),
    ('application', 'a', ['use-case', 'dto', 'application-service', 'processor'], [],
     ['**/*.service.ts', '**/*.service.ee.ts', '**/*.processor.ts', '**/dto/**', '**/dtos/**', '**/*.dto.ts', '**/*.usecase.ts', '**/*.use-case.ts']),
    ('presentation', 'pr', ['controller', 'module', 'gateway', 'guard', 'interceptor'], ['"@Controller"', '"@Module"'],
     ['**/*.controller.ts', '**/*.controller.ee.ts', '**/*.module.ts', '**/*.guard.ts', '**/*.interceptor.ts', '**/*.gateway.ts', '**/*.resolver.ts']),
]


def q(s: str) -> str:
    return '"' + s.replace('"', '\\"') + '"'


def spec(p: dict) -> str:
    out = [
        f'# v1.3-validity-predictive: layer spec for `{p["id"]}` ({p["repo"]}, root {p["root"]}, {p["framework"]}).',
        '# Derived from presets/nestjs.yaml (relaxed layering: presentation -> application -> infrastructure -> domain).',
        '# The directory map is this project\'s; fitness_functions are the preset\'s, verbatim.',
        f'# Unmapped: {p["unmapped"]}',
        '# Written from folder listings at T before any tool run on the project.',
        '',
        'spec_version: "1.0.0"',
        '',
        'architecture:',
        '  style: nestjs',
        '',
        '  layers:',
    ]
    for name, key, roles, decos, pats in LAYERS:
        m = p.get(key, {})
        dirs = [x if x.startswith(p['p']) else p['p'] + x for x in m.get('dirs', [])]
        pp = list(dict.fromkeys(pats + m.get('pats', [])))
        out.append(f'    - name: {name}')
        if dirs:
            out.append('      directories:')
            out += [f'        - {q(x)}' for x in dirs]
        out.append('      file_patterns:')
        out += [f'        - {q(x)}' for x in pp]
        out.append('      roles:')
        out += [f'        - {r}' for r in roles]
        if decos:
            out.append('      decorators:')
            out += [f'        - {x}' for x in decos]
        out.append('')
    return '\n'.join(out) + '\n' + FF


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for p in SRC['projects']:
        (OUT / f'{p["id"]}.yaml').write_text(spec(p))
    print(f'{len(SRC["projects"])} specs -> {OUT.relative_to(REPO)}')
