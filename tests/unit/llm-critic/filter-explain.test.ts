import {
  FE_SCHEMA_TEXT, answerOfResponse, buildFilterExplainPrompt, checkGrounding, findingKept, numberLines, outcomeOf,
  parseFilterExplainAnswer,
} from '../../../src/llm-critic/filter-explain.js';
import type { FilterExplainAnswer, ShownFile } from '../../../src/llm-critic/filter-explain.js';

const FILES: ShownFile[] = [{ path: 'src/domain/a.ts', content: "import { Request } from 'express';\nexport class A {\n  run(): void {}\n}\n" }];
const ok: FilterExplainAnswer = {
  decision: 'dismiss',
  explanation: 'The import on line 1 of src/domain/a.ts:1 is unused by A (src/domain/a.ts:2-4).',
  fix: 'Remove the import.',
  citations: [{ filePath: 'src/domain/a.ts', startLine: 1, endLine: 4 }],
};

describe('filter-and-explain', () => {
  it('numbers lines and fences the cited files', () => {
    expect(numberLines('a\nb\n')).toBe('1| a\n2| b');
    const prompt = buildFilterExplainPrompt({
      finding: { functionId: 'FF-P01', type: 'DOMAIN_PURITY_VIOLATION', severity: 'critical', filePath: 'src/domain/a.ts', message: 'imports express' },
      files: FILES, layerModel: '- domain (kind: domain): src/domain/**',
    });
    expect(prompt).toContain('Rule intent: Domain files do not import framework');
    expect(prompt).toContain('1| import { Request }');
    expect(prompt).toContain('=====SOURCE-BEGIN src/domain/a.ts=====');
  });

  it('accepts a grounded answer and keeps a confirm, drops a grounded dismiss', () => {
    expect(checkGrounding(ok, FILES)).toEqual({ grounded: true, problems: [] });
    const dismiss = outcomeOf(ok, FILES);
    expect(dismiss.status).toBe('dismiss');
    expect(findingKept(dismiss)).toBe(false);
    expect(findingKept(outcomeOf({ ...ok, decision: 'confirm' }, FILES))).toBe(true);
  });

  it('rejects citations and references to lines or files that do not exist (the finding is kept)', () => {
    const bad = [
      { ...ok, citations: [{ filePath: 'src/domain/a.ts', startLine: 3, endLine: 9 }] },
      { ...ok, citations: [{ filePath: 'src/other.ts', startLine: 1, endLine: 1 }] },
      { ...ok, citations: [] },
      { ...ok, explanation: 'See src/domain/a.ts:12.' },
      { ...ok, explanation: 'See line 40.' },
      { ...ok, explanation: 'See src/infra/b.ts:1.' },
    ];
    for (const b of bad) {
      const o = outcomeOf(b, FILES);
      expect(o.status).toBe('rejected');
      expect(findingKept(o)).toBe(true);
    }
  });

  it('parses the structured output and validates its shape', () => {
    expect(parseFilterExplainAnswer({ ...ok })).toEqual(ok);
    expect(parseFilterExplainAnswer({ ...ok, decision: 'maybe' })).toBeNull();
    expect(parseFilterExplainAnswer({ ...ok, citations: [{ filePath: 'x', startLine: 1.5, endLine: 2 }] })).toBeNull();
    expect(answerOfResponse(JSON.stringify({ is_error: false, result: '', structured_output: ok }))).toEqual(ok);
    expect(JSON.parse(FE_SCHEMA_TEXT).required).toEqual(['decision', 'explanation', 'fix', 'citations']);
  });
});
