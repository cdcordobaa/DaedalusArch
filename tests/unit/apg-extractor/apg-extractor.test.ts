import { extractAPG, APGExtractor } from '../../../src/apg-extractor/apg-extractor.js';
import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import { runId } from '../../../src/shared/types/value-objects.js';
import { resolve } from 'node:path';

const CORRECT_REFERENCE = resolve(__dirname, '../../../fixtures/correct-reference');
const NONEXISTENT = '/nonexistent/path/that/does/not/exist';

describe('extractAPG — error cases', () => {
  it('returns PROJECT_NOT_FOUND for missing path', async () => {
    const result = await extractAPG(NONEXISTENT);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0].code).toBe('PROJECT_NOT_FOUND');
    }
  });

  it('returns TSCONFIG_NOT_FOUND for dir without tsconfig.json', async () => {
    // Use os.tmpdir or a known dir without tsconfig
    const result = await extractAPG('/tmp');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0].code).toBe('TSCONFIG_NOT_FOUND');
    }
  });
});

describe('extractAPG — explicit tsconfig (ADR-032)', () => {
  it('reads only the given tsconfig and ignores the project tsconfig.json', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const root = mkdtempSync(join(tmpdir(), 'adr032-'));
    try {
      const proj = join(root, 'cell');
      mkdirSync(join(proj, 'src'), { recursive: true });
      mkdirSync(join(proj, 'other'), { recursive: true });
      writeFileSync(join(proj, 'src/a.ts'), 'export const a = 1;\n');
      writeFileSync(join(proj, 'other/b.ts'), 'export const b = 2;\n');
      // The tree's own tsconfig would include other/ only.
      writeFileSync(join(proj, 'tsconfig.json'), JSON.stringify({ include: ['other/**/*.ts'] }));
      const pinned = join(root, 'pinned.json');
      writeFileSync(pinned, JSON.stringify({ compilerOptions: { strict: true }, include: [`${proj}/src/**/*.ts`] }));
      const files = (r: Awaited<ReturnType<typeof extractAPG>>): string[] =>
        r.success ? [...new Set(r.data.nodes.map((n) => n.filePath))].sort() : ['FAIL'];
      const own = await extractAPG(proj);
      const over = await extractAPG(proj, {}, pinned);
      expect(files(own).some((f) => f.includes('other/b.ts'))).toBe(true);
      expect(files(over).some((f) => f.includes('src/a.ts'))).toBe(true);
      expect(files(over).some((f) => f.includes('other/'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('an explicit tsconfig lets a tree without tsconfig.json be extracted; a missing one is TSCONFIG_NOT_FOUND', async () => {
    const r = await extractAPG(CORRECT_REFERENCE, {}, '/nonexistent/tsconfig.json');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors[0].code).toBe('TSCONFIG_NOT_FOUND');
  });
});

describe('extractAPG — successful extraction', () => {
  it('returns DomainResult.ok for correct-reference fixture', async () => {
    const result = await extractAPG(CORRECT_REFERENCE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nodes.length).toBeGreaterThan(0);
      expect(result.data.edges.length).toBeGreaterThan(0);
      expect(result.data.parseCoverage.total).toBeGreaterThan(0);
    }
  }, 30_000);

  it('APGResult has nodes[] and edges[] arrays (US-1.5)', async () => {
    const result = await extractAPG(CORRECT_REFERENCE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data.nodes)).toBe(true);
      expect(Array.isArray(result.data.edges)).toBe(true);
    }
  }, 30_000);

  it('all node types are within the 5 permitted types (US-1.2)', async () => {
    const VALID_TYPES = new Set(['File', 'Class', 'Interface', 'Method', 'Function']);
    const result = await extractAPG(CORRECT_REFERENCE);
    expect(result.success).toBe(true);
    if (result.success) {
      for (const node of result.data.nodes) {
        expect(VALID_TYPES.has(node.type)).toBe(true);
      }
    }
  }, 30_000);

  it('all edge types are within the 7 permitted types (US-1.3)', async () => {
    const VALID_TYPES = new Set([
      'IMPORTS', 'IMPLEMENTS', 'EXTENDS',
      'CONSTRUCTOR_INJECTS', 'CALLS', 'DECLARES', 'CONTAINS',
    ]);
    const result = await extractAPG(CORRECT_REFERENCE);
    expect(result.success).toBe(true);
    if (result.success) {
      for (const edge of result.data.edges) {
        expect(VALID_TYPES.has(edge.type)).toBe(true);
      }
    }
  }, 30_000);

  it('parseCoverage percentage is between 0 and 100', async () => {
    const result = await extractAPG(CORRECT_REFERENCE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parseCoverage.percentage).toBeGreaterThanOrEqual(0);
      expect(result.data.parseCoverage.percentage).toBeLessThanOrEqual(100);
    }
  }, 30_000);
});

describe('APGExtractor (PipelineStage)', () => {
  function makeContext() {
    return new FirewallContext(runId('test-run-u2'));
  }

  it('sets apgResult on context when extraction succeeds', async () => {
    const extractor = new APGExtractor();
    const ctx = makeContext();
    const result = await extractor.execute(CORRECT_REFERENCE, ctx);
    expect(result.success).toBe(true);
    expect(() => ctx.getApgResult()).not.toThrow();
  }, 30_000);

  it('does NOT set apgResult on context when extraction fails', async () => {
    const extractor = new APGExtractor();
    const ctx = makeContext();
    const result = await extractor.execute(NONEXISTENT, ctx);
    expect(result.success).toBe(false);
    expect(() => ctx.getApgResult()).toThrow('has not run');
  });

  it('adds audit entry on success', async () => {
    const extractor = new APGExtractor();
    const ctx = makeContext();
    await extractor.execute(CORRECT_REFERENCE, ctx);
    const audit = ctx.auditLog;
    expect(audit.some(e => e.stage === 'apg-extractor' && e.event === 'extraction_complete')).toBe(true);
  }, 30_000);

  it('adds audit entry on failure', async () => {
    const extractor = new APGExtractor();
    const ctx = makeContext();
    await extractor.execute(NONEXISTENT, ctx);
    const audit = ctx.auditLog;
    expect(audit.some(e => e.stage === 'apg-extractor' && e.event === 'extraction_failed')).toBe(true);
  });
});
