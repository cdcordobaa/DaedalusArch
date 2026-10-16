#!/usr/bin/env python3
"""Market tool arm: express a none-arm step tree in the repaired structure (records in persistence/models.ts,
re-exported by business/models.ts; persistence imports './models'). usage: xform_market.py <repo>"""
import os, sys
repo = sys.argv[1]
bm = os.path.join(repo, 'src/business/models.ts')
s = open(bm).read()
i = s.index('export class BusinessError')
open(os.path.join(repo, 'src/persistence/models.ts'), 'w').write('/** Records stored by the persistence layer. The business layer re-exports them. */\n' + s[:i].rstrip() + '\n')
open(bm, 'w').write("export * from '../persistence/models';\n\n" + s[i:])
pdir = os.path.join(repo, 'src/persistence')
for f in os.listdir(pdir):
    p = os.path.join(pdir, f)
    t = open(p).read()
    if "from '../business/models'" in t:
        open(p, 'w').write(t.replace("from '../business/models'", "from './models'"))
