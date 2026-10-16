import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { scanProject, selfCheck } from '../../../../scripts/v1.3/judge-check3-selfcheck.js';
import { CHECK3_ROOT, CHECK_SETS, cleanTwinSite } from '../../../../scripts/v1.3/judge-v22-check2.js';

const LAYERED_SPEC = path.resolve('tests/fixtures/v1.3-check3/layered-library/spec.yaml');

function project(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check3-selfcheck-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

describe('CHECK-3 static self-check', () => {
  it('flags each seed pattern in a layered project', () => {
    const dir = project({
      'src/business/services/A.ts': "import { PrismaService } from '../../persistence/PrismaService';\nexport class A {\n  run(): void {\n    const db = new PrismaClient();\n  }\n}\n",
      'src/business/model/B.ts': "import { Entity } from 'typeorm';\nimport { Request } from 'express';\n@Entity()\nexport class B {}\n",
      'src/business/model/C.ts': "export class C {\n  // note\n  owner = 'u5a';\n}\n",
    });
    const patterns = scanProject(dir, LAYERED_SPEC, 'layered', 't').map((f) => f.pattern).sort();
    expect(patterns).toEqual([
      'SP-COMMENT', 'SP-FRAMEWORK-LEAK', 'SP-OPERATOR-CUE', 'SP-PERSIST-IN-DOMAIN', 'SP-PERSIST-IN-DOMAIN', 'SP-REPO-BYPASS-FACADE', 'SP-REPO-BYPASS-GLOBAL',
    ]);
  });

  it('does not flag a business service that calls an injected gateway, or ORM access inside persistence', () => {
    const dir = project({
      'src/business/services/A.ts': "import { AGateway } from '../../persistence/AGateway';\nexport class A {\n  constructor(private readonly rows: AGateway) {}\n}\n",
      'src/persistence/AGateway.ts': "import { PrismaService } from './PrismaService';\nexport class AGateway {\n  constructor(private readonly db: PrismaService) {}\n  all(): unknown {\n    return this.db.getRepository(1);\n  }\n}\n",
    });
    expect(scanProject(dir, LAYERED_SPEC, 'layered', 't')).toEqual([]);
  });

  it('passes on the committed CHECK-3 bases and fails on CHECK-2, on the six PrismaService services', () => {
    const c3 = selfCheck(CHECK_SETS.check3, undefined);
    expect(c3.checks.map((c) => [c.id, c.holds])).toEqual([['S1', true], ['S2', true], ['S3', true], ['S4', true], ['S5', true]]);
    expect(c3.ok).toBe(true);
    const c2 = selfCheck(CHECK_SETS.check2, undefined);
    expect(c2.ok).toBe(false);
    expect(c2.findings.map((f) => `${f.pattern} ${f.scope}`)).toHaveLength(6);
    expect(new Set(c2.findings.map((f) => f.pattern))).toEqual(new Set(['SP-REPO-BYPASS-FACADE']));
  });

  it('puts the bypass twin on the clean base, same method, on the gateway field', () => {
    const site = cleanTwinSite(path.resolve(CHECK3_ROOT, 'layered-library/project'), {
      filePath: 'src/business/services/LoanHistoryService.ts', line: 1, kind: 'repo-bypass',
      detail: { class: 'LoanHistoryService', method: 'note', field: 'db', orm: 'prisma', entity: '', doc: '' },
    });
    expect(site?.detail).toEqual({ class: 'LoanHistoryService', method: 'note', field: 'events' });
  });
});
