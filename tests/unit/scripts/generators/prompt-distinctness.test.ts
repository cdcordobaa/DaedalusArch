/**
 * BR-U5a-52 distinctness, checked on the committed templates (U5a plan Step 23; Q17; ADR-012). Beyond the shared
 * text (the folder-layout sentence, and for the word count the `none` template of the same task, which holds the
 * brief and the environment paragraph with the placeholder line): `none` has no layer name, dependency-direction
 * statement or threshold; `minimal-prose` has every layer name, a dependency-direction statement, 120–180 words, no
 * rule id and no numeric threshold; `full-aac` has rule ids and numeric thresholds.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadPromptTemplate } from '../../../../scripts/lib/generators/prompt.js';
import { TASK_IDS } from '../../../../scripts/lib/generators/schedule.js';
import type { SpecLevel, TaskId } from '../../../../scripts/lib/generators/types.js';

const REPO = process.cwd();
const FOLDER_SENTENCE = 'Organise the source code under src/ in exactly three folders: src/domain, src/application and src/infrastructure.';
const LAYER_NAMES = ['domain', 'application', 'infrastructure'];
const LAYER = new RegExp(`\\b(?:${LAYER_NAMES.join('|')})\\b`, 'i');
const DEPENDENCY_DIRECTION = /\b(?:depends?|dependency|dependencies)\b|\b(?:may|must|should|can)(?: not| never| only)? import\b/i;
const NUMBER = /(?<![\w.@/-])\d+(?:\.\d+)?(?![\w.])/;
const RULE_ID = /\bFF-[A-Z]+\d+\b/;

function template(level: SpecLevel, task: TaskId): string {
  const t = loadPromptTemplate(REPO, level, task);
  if (!t.success) throw new Error(t.errors.map((e) => e.message).join(';'));
  return t.data.template;
}

const beyondShared = (text: string): string => text.split(FOLDER_SENTENCE).join('');

/** The level block: the template minus the `none` template of the same task (which it must start with). */
function levelBlock(level: SpecLevel, task: TaskId): string {
  const base = template('none', task).trimEnd();
  const t = template(level, task);
  expect(t.startsWith(base)).toBe(true);
  return t.slice(base.length);
}

describe.each(TASK_IDS)('prompt templates for %s (BR-U5a-52)', (task) => {
  it('every level carries the shared folder sentence once and exactly one placeholder line', () => {
    for (const level of ['none', 'minimal-prose', 'full-aac'] as const) {
      const t = template(level, task);
      expect(t.split(FOLDER_SENTENCE)).toHaveLength(2);
      expect(t.split('\n').filter((l) => l === '{{TYPECHECK_COMMAND}}')).toHaveLength(1);
      expect(t).toMatch(/typescript, @types\/node, express and @types\/express/);
      expect(t).toMatch(/no network access and npm is not available/);
    }
  });

  it('none: no layer name, dependency-direction statement or threshold beyond the shared sentence', () => {
    const rest = beyondShared(template('none', task));
    expect(rest).not.toMatch(LAYER);
    expect(rest).not.toMatch(DEPENDENCY_DIRECTION);
    expect(rest).not.toMatch(NUMBER);
    expect(rest).not.toMatch(RULE_ID);
  });

  it('minimal-prose: every layer name, a dependency direction, 120–180 words, no rule id, no number; roles from the preset', () => {
    const block = levelBlock('minimal-prose', task);
    for (const name of LAYER_NAMES) expect(block).toMatch(new RegExp(`\\b${name}\\b`, 'i'));
    expect(block).toMatch(DEPENDENCY_DIRECTION);
    const words = block.trim().split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(120);
    expect(words).toBeLessThanOrEqual(180);
    expect(beyondShared(template('minimal-prose', task))).not.toMatch(RULE_ID);
    expect(beyondShared(template('minimal-prose', task))).not.toMatch(NUMBER);
    // Generated from presets/clean-architecture.yaml: every role of every layer is named.
    const preset = fs.readFileSync(path.join(REPO, 'presets/clean-architecture.yaml'), 'utf8');
    const roles = [...preset.matchAll(/^ {8}- ([a-z-]+)$/gm)].map((m) => m[1] ?? '');
    expect(roles.length).toBeGreaterThan(8);
    for (const role of roles) expect(block.toLowerCase()).toContain(role.replace('-impl', '-implementation').replace(/-/g, ' ').replace(/y$/, ''));
  });

  it('full-aac: rule ids and numeric thresholds, the preset verbatim', () => {
    const block = levelBlock('full-aac', task);
    expect(block).toMatch(RULE_ID);
    expect(block).toMatch(NUMBER);
    expect(block).toContain(fs.readFileSync(path.join(REPO, 'presets/clean-architecture.yaml'), 'utf8').trimEnd());
  });
});
