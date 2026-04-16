import { validateSpecAgainstProject } from '../../../src/spec-parser/spec-validator.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import { functionId } from '../../../src/shared/types/value-objects.js';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('validateSpecAgainstProject (v1.1)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'firewall-test-'));
    mkdirSync(join(tmpDir, 'src', 'domain'), { recursive: true });
    mkdirSync(join(tmpDir, 'src', 'infrastructure'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const baseSpec: ParsedSpec = {
    specVersion: '1.0.0',
    layerModel: {
      layers: [
        { name: 'domain', directories: ['src/domain'], naming: [], role: 'entity' },
        { name: 'infrastructure', directories: ['src/infrastructure'], naming: [], role: 'controller' },
      ],
    },
    fitnessFunctions: [
      {
        id: functionId('FF-S01'), name: 'dependency-direction',
        dimension: 'structural', severity: 'critical', route: 'symbolic',
        isBuiltIn: true, validated: true, enabled: true, excludePaths: [],
      },
    ],
    scoringWeights: { structural: 0.5, coupling: 0.2, pattern: 0.2, solid: 0.05, convention: 0.05, semantic: 0, intent: 0 },
    verdictThresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
    confidenceThresholds: { high: 0.85, medium: 0.60, iccMinimum: 0.70 },
    adrRules: [],
  };

  it('validates a valid spec against project', () => {
    const result = validateSpecAgainstProject(baseSpec, tmpDir);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects missing layer directory', () => {
    const spec: ParsedSpec = {
      ...baseSpec,
      layerModel: {
        layers: [
          ...baseSpec.layerModel.layers,
          { name: 'application', directories: ['src/application'], naming: [], role: 'use-case' },
        ],
      },
    };
    const result = validateSpecAgainstProject(spec, tmpDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'LAYER_DIR_NOT_FOUND')).toBe(true);
  });

  it('detects duplicate function IDs', () => {
    const spec: ParsedSpec = {
      ...baseSpec,
      fitnessFunctions: [
        { ...baseSpec.fitnessFunctions[0]! },
        { ...baseSpec.fitnessFunctions[0]!, name: 'other-fn' },
      ],
    };
    const result = validateSpecAgainstProject(spec, tmpDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'DUPLICATE_FUNCTION_ID')).toBe(true);
  });

  it('detects invalid glob pattern', () => {
    const spec: ParsedSpec = {
      ...baseSpec,
      fitnessFunctions: [
        { ...baseSpec.fitnessFunctions[0]!, excludePaths: [''] },
      ],
    };
    const result = validateSpecAgainstProject(spec, tmpDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'INVALID_GLOB_PATTERN')).toBe(true);
  });

  it('validates valid glob patterns without error', () => {
    const spec: ParsedSpec = {
      ...baseSpec,
      fitnessFunctions: [
        { ...baseSpec.fitnessFunctions[0]!, excludePaths: ['src/cli/**', '**/*.spec.ts'] },
      ],
    };
    const result = validateSpecAgainstProject(spec, tmpDir);
    expect(result.valid).toBe(true);
  });

  it('reports correct summary counts', () => {
    const spec: ParsedSpec = {
      ...baseSpec,
      fitnessFunctions: [
        { ...baseSpec.fitnessFunctions[0]! },
        { ...baseSpec.fitnessFunctions[0]!, id: functionId('FF-S02'), name: 'no-cyclic-deps', enabled: false, disabledReason: 'not needed' },
      ],
    };
    const result = validateSpecAgainstProject(spec, tmpDir);
    expect(result.summary.totalFunctions).toBe(2);
    expect(result.summary.enabledFunctions).toBe(1);
    expect(result.summary.disabledFunctions).toBe(1);
    expect(result.summary.totalLayers).toBe(2);
  });

  it('handles layer directories with glob suffixes', () => {
    const spec: ParsedSpec = {
      ...baseSpec,
      layerModel: {
        layers: [
          { name: 'domain', directories: ['src/domain/**'], naming: [], role: 'entity' },
          { name: 'infrastructure', directories: ['src/infrastructure/**'], naming: [], role: 'controller' },
        ],
      },
    };
    const result = validateSpecAgainstProject(spec, tmpDir);
    expect(result.valid).toBe(true);
  });
});
