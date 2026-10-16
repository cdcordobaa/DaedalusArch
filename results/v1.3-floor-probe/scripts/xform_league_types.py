#!/usr/bin/env python3
"""League tool arm: entity types live in persistence/entities.ts; business/entities.ts re-exports them and keeps the
error classes; persistence imports './entities'. usage: xform_league_types.py <repo>"""
import os, sys
repo = sys.argv[1]
be = os.path.join(repo, 'src/business/entities.ts')
s = open(be).read()
i = s.index('export class ValidationError')
open(os.path.join(repo, 'src/persistence/entities.ts'), 'w').write('/** Records stored by the persistence layer. The business layer re-exports them. */\n' + s[:i].rstrip() + '\n')
open(be, 'w').write("export * from '../persistence/entities';\n\n" + s[i:])
pdir = os.path.join(repo, 'src/persistence')
for f in os.listdir(pdir):
    p = os.path.join(pdir, f)
    t = open(p).read()
    if "from '../business/entities'" in t:
        open(p, 'w').write(t.replace("from '../business/entities'", "from './entities'"))
