/**
 * Build and Test Step 55: the E7 spec generator applies the registered rule mechanically (ADR-019 item 3; OI-12).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { applyChain, evidenceOf, mapLayers, parseRule, RULE_DOC, styleOf } from '../../../../scripts/generate-e7-specs.js';
import { ROOT } from './score-fixture.js';

const rule = parseRule(readFileSync(join(ROOT, RULE_DOC), 'utf8'));

describe('E7 spec rule (Docs/e7-spec-rule.md)', () => {
  it('parses the machine block; no word is in two groups', () => {
    expect(rule.version).toBe(1);
    expect(rule.projects).toHaveLength(6);
    expect(() => parseRule('```yaml e7-spec-rule\nversion: 1\ngroups:\n  D: { segments: [x], suffixes: [] }\n  A: { segments: [x], suffixes: [] }\n  I: { segments: [], suffixes: [] }\n  P: { segments: [], suffixes: [] }\n```\n')).toThrow(/in groups D and A/);
  });

  it('style order: clean markers in two groups > @nestjs/core > layered', () => {
    const clean = evidenceOf(['src/a/domain/x.ts', 'src/a/application/y.ts'], rule);
    expect(styleOf(clean, true, rule)).toMatchObject({ style: 'clean-architecture', row: 1 });
    const one = evidenceOf(['src/a/domain/x.ts', 'src/a/services/y.ts'], rule);
    expect(styleOf(one, true, rule)).toMatchObject({ style: 'nestjs', row: 2 });
    expect(styleOf(one, false, rule)).toMatchObject({ style: 'layered', row: 3 });
  });

  it('collects segments below src/ and second-last suffixes, per group, sorted', () => {
    const ev = evidenceOf(['src/Controllers/user.controller.ts', 'src/repositories/user.repository.ts', 'src/main.ts', 'src/x/user.entity.ts'], rule);
    expect(ev.segments.P).toEqual(['controllers']);
    expect(ev.segments.I).toEqual(['repositories']);
    expect(ev.suffixes).toMatchObject({ P: ['controller'], I: ['repository'], D: ['entity'] });
  });

  it('appends mapped globs after the preset entries, deterministically, and the chain is idempotent', () => {
    const preset = readFileSync(join(ROOT, 'presets/layered.yaml'), 'utf8');
    const ev = evidenceOf(['src/controllers/a.controller.ts', 'src/services/b.service.ts', 'src/repositories/c.ts'], rule);
    const text = applyChain(mapLayers(preset, 'layered', ev, rule));
    expect(applyChain(text)).toBe(text);
    expect(applyChain(mapLayers(preset, 'layered', ev, rule))).toBe(text);
    const spec = parseYaml(text) as { architecture: { layers: { name: string; directories: string[]; file_patterns?: string[] }[] } };
    const by = Object.fromEntries(spec.architecture.layers.map((l) => [l.name, l]));
    expect(by.persistence?.directories).toEqual(['src/persistence/**', '**/repositories/**']);
    expect(by.business?.directories.slice(0, 2)).toEqual(['src/business/**', '**/services/**']);
    expect(by.business?.file_patterns).toContain('**/*.service.ts');
    expect(by.presentation?.directories).toEqual(['src/presentation/**', '**/controllers/**']);
  });
});
