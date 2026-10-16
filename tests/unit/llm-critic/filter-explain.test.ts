import {
  FE_SCHEMA_TEXT, FE_SOURCE_BUDGET_CHARS, answerOfResponse, buildFilterExplainPrompt, checkGrounding, checkTextReferences, findingKept,
  numberLines, outcomeOf, parseFilterExplainAnswer, renderFilterExplainPrompt,
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

  describe('R19: grounding is measured on what the prompt rendered', () => {
    const finding = { functionId: 'FF-S01', type: 'LAYER_VIOLATION', severity: 'critical', filePath: 'src/domain/big.ts', message: 'imports infra' };
    // About 2x the source budget: the first file is cut, the second never shown.
    const bigLines = Array.from({ length: 8000 }, (_, i) => `export const value${String(i)} = ${String(i)}; // ${'x'.repeat(10)}`);
    const big: ShownFile = { path: 'src/domain/big.ts', content: `${bigLines.join('\n')}\n` };
    const small: ShownFile = { path: 'src/infra/db.ts', content: 'export const db = 1;\n' };

    it('keeps the prompt text unchanged and returns only the shown files and lines', () => {
      const input = { finding, files: [big, small], layerModel: '(none)' };
      const rendered = renderFilterExplainPrompt(input);
      expect(rendered.prompt).toBe(buildFilterExplainPrompt(input));
      expect(rendered.prompt).toContain('[truncated]');
      expect(rendered.prompt).not.toContain('src/infra/db.ts=====');
      expect(rendered.shown.map((f) => f.path)).toEqual(['src/domain/big.ts']);
      const shownLines = (rendered.shown[0]?.content ?? '').split('\n').length;
      expect(shownLines).toBeGreaterThan(100);
      expect(shownLines).toBeLessThan(8000);
      // Every shown line is fully inside the rendered budget.
      expect(numberLines(rendered.shown[0]?.content ?? '').length).toBeLessThanOrEqual(FE_SOURCE_BUDGET_CHARS);
    });

    it('rejects a citation past the cut or of the omitted file', () => {
      const { shown } = renderFilterExplainPrompt({ finding, files: [big, small], layerModel: '(none)' });
      const past: FilterExplainAnswer = { ...ok, explanation: 'See src/domain/big.ts:7990.', citations: [{ filePath: 'src/domain/big.ts', startLine: 7990, endLine: 7990 }] };
      const omitted: FilterExplainAnswer = { ...ok, explanation: 'See src/domain/big.ts:2.', citations: [{ filePath: 'src/infra/db.ts', startLine: 1, endLine: 1 }] };
      expect(outcomeOf(past, [big, small]).status).toBe('dismiss'); // the full files would accept it
      expect(outcomeOf(past, shown).status).toBe('rejected');
      expect(outcomeOf(omitted, shown).status).toBe('rejected');
      expect(outcomeOf({ ...ok, explanation: 'See src/domain/big.ts:2.', citations: [{ filePath: 'src/domain/big.ts', startLine: 1, endLine: 3 }] }, shown).status).toBe('dismiss');
    });

    it('shows small files whole', () => {
      expect(renderFilterExplainPrompt({ finding, files: FILES, layerModel: '(none)' }).shown).toEqual(FILES);
    });
  });

  describe('R20: a bare line reference is checked against the file it refers to', () => {
    const order: ShownFile = { path: 'src/domain/order.ts', content: Array.from({ length: 40 }, (_, i) => `// ${String(i)}`).join('\n') };
    const repo: ShownFile = { path: 'src/infra/repo.ts', content: Array.from({ length: 300 }, (_, i) => `// ${String(i)}`).join('\n') };
    const files = [order, repo];

    it('attributes the line to the file named before it in the sentence', () => {
      expect(checkTextReferences('order.ts calls the ORM at line 212.', files)).toEqual(['explanation cites line 212 of src/domain/order.ts beyond 40']);
      expect(checkTextReferences('The adapter repo.ts maps it at line 212.', files)).toEqual([]);
      expect(checkTextReferences('In src/infra/repo.ts the query sits on lines 200-210, and order.ts uses it on line 12.', files)).toEqual([]);
    });

    it('falls back to the finding\'s own file (shown first) when no file is named', () => {
      expect(checkTextReferences('The import is on line 212.', files)).toEqual(['explanation cites line 212 of src/domain/order.ts beyond 40']);
      expect(checkTextReferences('The import is on line 12.', files)).toEqual([]);
      // A file named in an earlier sentence does not carry over.
      expect(checkTextReferences('See repo.ts. The import is on line 212.', files)).toHaveLength(1);
    });

    it('rejects the R20 scenario in checkGrounding', () => {
      const answer: FilterExplainAnswer = { ...ok, explanation: 'order.ts calls the ORM at line 212.', citations: [{ filePath: 'src/domain/order.ts', startLine: 1, endLine: 2 }] };
      expect(checkGrounding(answer, files).grounded).toBe(false);
    });
  });
});
