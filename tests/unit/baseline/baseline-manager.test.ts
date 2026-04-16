import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  generateKey,
  createBaseline,
  loadBaseline,
  saveBaseline,
  compareBaseline,
} from '../../../src/baseline/baseline-manager.js';
import type { Violation } from '../../../src/shared/taxonomy/violation-types.js';
import type { BaselineSnapshot } from '../../../src/shared/types/baseline.js';
import { functionId } from '../../../src/shared/types/value-objects.js';

function makeViolation(overrides: Partial<Violation> = {}): Violation {
  return {
    id: 'v-001',
    type: 'LAYER_VIOLATION',
    dimension: 'structural',
    severity: 'critical',
    functionId: functionId('FF-S01'),
    route: 'symbolic',
    filePath: 'src/domain/service.ts',
    message: 'Domain imports from infrastructure',
    deterministic: true,
    ...overrides,
  };
}

describe('baseline-manager', () => {
  describe('generateKey', () => {
    it('produces stable keys for the same violation', () => {
      const v = makeViolation();
      expect(generateKey(v)).toBe(generateKey(v));
    });

    it('produces different keys for different files', () => {
      const v1 = makeViolation({ filePath: 'src/a.ts' });
      const v2 = makeViolation({ filePath: 'src/b.ts' });
      expect(generateKey(v1)).not.toBe(generateKey(v2));
    });

    it('produces different keys for different function IDs', () => {
      const v1 = makeViolation({ functionId: functionId('FF-S01') });
      const v2 = makeViolation({ functionId: functionId('FF-S02') });
      expect(generateKey(v1)).not.toBe(generateKey(v2));
    });

    it('produces different keys for different violation types', () => {
      const v1 = makeViolation({ type: 'LAYER_VIOLATION' });
      const v2 = makeViolation({ type: 'CYCLIC_DEPENDENCY' });
      expect(generateKey(v1)).not.toBe(generateKey(v2));
    });

    it('ignores line numbers (stability)', () => {
      // Line numbers are not in the key — same file/rule/type = same key
      const v1 = makeViolation({ message: 'line 10' });
      const v2 = makeViolation({ message: 'line 20' });
      expect(generateKey(v1)).toBe(generateKey(v2));
    });
  });

  describe('createBaseline', () => {
    it('creates a snapshot from violations', () => {
      const violations = [
        makeViolation({ id: 'v-001', filePath: 'src/a.ts' }),
        makeViolation({ id: 'v-002', filePath: 'src/b.ts' }),
      ];

      const snapshot = createBaseline(violations, 'firewall.spec.yaml');

      expect(snapshot.version).toBe('1.0');
      expect(snapshot.specFile).toBe('firewall.spec.yaml');
      expect(snapshot.totalViolations).toBe(2);
      expect(snapshot.violations).toHaveLength(2);
      expect(snapshot.createdAt).toBeTruthy();
    });

    it('creates empty baseline for zero violations', () => {
      const snapshot = createBaseline([], 'firewall.spec.yaml');
      expect(snapshot.totalViolations).toBe(0);
      expect(snapshot.violations).toHaveLength(0);
    });
  });

  describe('saveBaseline / loadBaseline', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('round-trips a baseline through save/load', () => {
      const violations = [makeViolation()];
      const snapshot = createBaseline(violations, 'spec.yaml');
      const filePath = path.join(tmpDir, 'baseline.json');

      const saveResult = saveBaseline(snapshot, filePath);
      expect(saveResult.success).toBe(true);

      const loadResult = loadBaseline(filePath);
      expect(loadResult.success).toBe(true);
      if (!loadResult.success) return;

      expect(loadResult.data.version).toBe('1.0');
      expect(loadResult.data.totalViolations).toBe(1);
      expect(loadResult.data.violations[0]?.key).toBe(snapshot.violations[0]?.key);
    });

    it('fails to load nonexistent file', () => {
      const result = loadBaseline('/nonexistent/path.json');
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.errors[0]?.code).toBe('BASELINE_NOT_FOUND');
    });

    it('fails to load invalid JSON structure', () => {
      const filePath = path.join(tmpDir, 'invalid.json');
      fs.writeFileSync(filePath, '{"foo": "bar"}');

      const result = loadBaseline(filePath);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.errors[0]?.code).toBe('BASELINE_INVALID');
    });

    it('fails to load invalid JSON syntax', () => {
      const filePath = path.join(tmpDir, 'bad.json');
      fs.writeFileSync(filePath, 'not json at all');

      const result = loadBaseline(filePath);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.errors[0]?.code).toBe('BASELINE_PARSE_ERROR');
    });
  });

  describe('compareBaseline', () => {
    const baselineViolation = makeViolation({ id: 'v-001', filePath: 'src/a.ts' });
    const newViolation = makeViolation({ id: 'v-002', filePath: 'src/c.ts' });

    let baseline: BaselineSnapshot;

    beforeAll(() => {
      baseline = createBaseline([baselineViolation], 'spec.yaml');
    });

    it('classifies existing violations as baseline', () => {
      const result = compareBaseline([baselineViolation], baseline, 'baseline.json');
      expect(result.baselineViolations).toHaveLength(1);
      expect(result.newViolations).toHaveLength(0);
      expect(result.removedFromBaseline).toHaveLength(0);
    });

    it('classifies new violations as new', () => {
      const result = compareBaseline([newViolation], baseline, 'baseline.json');
      expect(result.baselineViolations).toHaveLength(0);
      expect(result.newViolations).toHaveLength(1);
    });

    it('detects removed violations', () => {
      const result = compareBaseline([], baseline, 'baseline.json');
      expect(result.removedFromBaseline).toHaveLength(1);
      expect(result.removedFromBaseline[0]?.ruleId).toBe(baselineViolation.functionId);
    });

    it('handles mixed baseline and new violations', () => {
      const result = compareBaseline(
        [baselineViolation, newViolation],
        baseline,
        'baseline.json',
      );
      expect(result.baselineViolations).toHaveLength(1);
      expect(result.newViolations).toHaveLength(1);
      expect(result.removedFromBaseline).toHaveLength(0);
    });

    it('returns correct baselineFilePath', () => {
      const result = compareBaseline([], baseline, '/path/to/baseline.json');
      expect(result.baselineFilePath).toBe('/path/to/baseline.json');
    });
  });
});
