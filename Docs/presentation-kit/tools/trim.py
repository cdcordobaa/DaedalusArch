import json
S = '/private/tmp/claude-501/-Volumes-Life-OS-Users-Arkatechie-Development-Archi-Firewall-DaedalusArch/3ea7dab4-b64a-4481-829e-334a9bfa22a1/scratchpad/kit-tools/data/'
D = '/Volumes/Life-OS/Users/Arkatechie/Development/Archi-Firewall/DaedalusArch/.claude/worktrees/agent-acaa7a2a492af2a0e/Docs/presentation-kit/data/'
keepP = {'specifier', 'line', 'lines', 'isTypeOnly', 'importedNames', 'positions', 'inferred', 'publicSurface', 'field', 'kind', 'imports', 'viaReExport', 'reExportHop'}
for f in ['hexagonal__clean.json', 'hexagonal__v01-domain-uses-outbound-adapter-constant.json', 'hexagonal__clean__apg2.json']:
    d = json.load(open(S + f))
    idmap = {}
    used = set()
    for n in d['nodes']:
        base = n['type'] + ':' + (n['file'] or n['name']) + ('#' + n['name'] if n['type'] not in ('File',) else '')
        k = base
        i = 2
        while k in used:
            k = base + '~' + str(i)
            i += 1
        used.add(k)
        idmap[n['id']] = k
    nodes = [{'id': idmap[n['id']], 'type': n['type'], 'name': n['name'], 'file': n['file'], 'layer': n.get('layer')} for n in d['nodes']]
    edges = [{'type': e['type'], 'source': idmap[e['s']], 'target': idmap[e['t']], 'properties': {k: v for k, v in e['properties'].items() if k in keepP}} for e in d['edges']]
    out = {
        'source': 'extractAPG on tests/fixtures/v1.3-reference/hexagonal (variant %s), %s; layers from scripts/v1.3/lib/layer-assignment.ts under the reference spec. Node ids are readable keys made by the kit; the extractor ids are left out.' % (d['variant'], 'V13_APG2_OPTIONS' if d['mode'] == 'apg2' else 'V13_DEFAULT_OPTIONS'),
        'style': d['style'], 'variant': d['variant'], 'mode': d['mode'], 'nodes': nodes, 'edges': edges,
    }
    json.dump(out, open(D + f.replace('__', '.'), 'w'), indent=1)
    print(f, len(nodes), len(edges))
t = json.load(open(S + 'tf1.json'))
rows = [{k: (v.replace('../../../../', '') if isinstance(v, str) else v) for k, v in r.items()} for r in t['apg2']]
json.dump({
    'source': 'boundaryTypeLeak (src/fitness-compiler/apg2-in-memory.ts) on extractAPG(tests/fixtures/v1.3-apg2/type-flow, V13_APG2_OPTIONS). The V13_DEFAULT_OPTIONS graph gives no rows. The committed live Neo4j check returned the same number of rows (Docs/DiagnosticRuns/apg2-scope-2026-10-15/fixtures-live.json: type-flow, boundary-type-leak, live 5 = mirror 5).',
    'apg2Rows': rows, 'v13Rows': t['v13']}, open(D + 'type-flow.boundary-type-leak.json', 'w'), indent=1)
c = json.load(open(S + 'compiled.json'))
json.dump(c, open(D + 'compiled-cypher.json', 'w'), indent=1)
print('ok')
