#!/usr/bin/env python3
"""Hive tool arm: the record interfaces move to persistence/model.ts (business/model.ts imports and re-exports them,
keeping constants, rules and DomainError); persistence imports './model'; the wiring of presentation/app.ts moves to
business/container.ts. usage: xform_hive.py <repo>"""
import os, re, sys
repo = sys.argv[1]
bm = os.path.join(repo, 'src/business/model.ts')
s = open(bm).read()
blocks = re.findall(r'^export interface (\w+)(?: extends [^{]+)? \{\n.*?^\}\n', s, flags=re.S | re.M)
iface_text = ''.join(m.group(0) + '\n' for m in re.finditer(r'^export interface \w+(?: extends [^{]+)? \{\n.*?^\}\n', s, flags=re.S | re.M))
rest = re.sub(r'^export interface \w+(?: extends [^{]+)? \{\n.*?^\}\n\n?', '', s, flags=re.S | re.M)
open(os.path.join(repo, 'src/persistence/model.ts'), 'w').write('/** Records stored by the persistence layer. The business layer re-exports them. */\n' + iface_text.rstrip() + '\n')
head = f"import {{ {', '.join(blocks)} }} from '../persistence/model';\n\nexport * from '../persistence/model';\n\n"
open(bm, 'w').write(head + rest.lstrip())
pdir = os.path.join(repo, 'src/persistence')
for f in os.listdir(pdir):
    p = os.path.join(pdir, f)
    t = open(p).read()
    if "from '../business/model'" in t:
        open(p, 'w').write(t.replace("from '../business/model'", "from './model'"))
# wiring: everything app.ts builds before `const app = express();` goes to business/container.ts
ap = os.path.join(repo, 'src/presentation/app.ts')
a = open(ap).read()
lines = a.splitlines()
imp = [l for l in lines if l.startswith('import ')]
start = max(i for i, l in enumerate(lines) if l.startswith('import ')) + 1
end = next(i for i, l in enumerate(lines) if l.startswith('const app = express()'))
wiring = [l for l in lines[start:end] if l.strip()]
names = [re.match(r'const (\w+) =', l).group(1) for l in wiring]
cimp = [l.replace("'../business/", "'./") for l in imp if "'../persistence/" in l or "'../business/" in l]
used = [n for n in names if re.search(r'\b' + n + r'\b', '\n'.join(lines[end:]))]
container = '\n'.join(cimp) + "\n\n/** Builds the business services with their persistence. */\nexport function createServices() {\n" + \
    '\n'.join('  ' + l for l in wiring) + "\n  return { " + ', '.join(used) + " };\n}\n"
open(os.path.join(repo, 'src/business/container.ts'), 'w').write(container)
keep_imp = [l for l in imp if "'../persistence/" not in l and "'../business/" not in l]
tail = '\n'.join(lines[end:])
for n in used:
    tail = re.sub(r'\b' + n + r'\b', f'services.{n}', tail)
open(ap, 'w').write('\n'.join(keep_imp) + "\nimport { createServices } from '../business/container';\n\nconst services = createServices();\n\n" + tail + '\n')
