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

describe('filter-and-explain grounding against what the prompt showed (R19, R20)', () => {
  const finding = { functionId: 'FF-P01', type: 'DOMAIN_PURITY_VIOLATION', severity: 'critical', filePath: 'src/domain/big.ts', message: 'imports express' };
  // 3,000 numbered lines of ~45 chars: well over FE_SOURCE_BUDGET_CHARS (96,000), so the body is cut and file 2 dropped.
  const big: ShownFile = { path: 'src/domain/big.ts', content: Array.from({ length: 3000 }, (_, i) => `export const value${String(i)} = 'xxxxxxxxxxxxxxxxxxxx';`).join('\n') };
  const second: ShownFile = { path: 'src/infra/second.ts', content: 'export const s = 1;\nexport const t = 2;\n' };

  it('R19: renderFilterExplainPrompt reports only the files and line prefix it rendered', () => {
    const r = renderFilterExplainPrompt({ finding, files: [big, second], layerModel: '- domain' });
    expect(r.prompt).toBe(buildFilterExplainPrompt({ finding, files: [big, second], layerModel: '- domain' }));
    expect(r.prompt).toContain('[truncated]');
    expect(r.prompt).not.toContain('src/infra/second.ts=====');
    expect(r.shown.map((s) => s.path)).toEqual(['src/domain/big.ts']);
    const n = (r.shown[0]?.content ?? '').split('\n').length;
    expect(n).toBeGreaterThan(100);
    expect(n).toBeLessThan(3000);
    // The last line counted as shown has its number label in the prompt; the next one does not.
    expect(r.prompt).toContain(`${String(n).padStart(4, ' ')}| `);
    expect(r.prompt).not.toContain(`${String(n + 1).padStart(4, ' ')}| `);
  });

  it('R19: a citation of a dropped file or of lines past the cut is ungrounded', () => {
    const { shown } = renderFilterExplainPrompt({ finding, files: [big, second], layerModel: '- domain' });
    const cite = (filePath: string, line: number): FilterExplainAnswer => ({ ...ok, explanation: 'See the cited code.', citations: [{ filePath, startLine: line, endLine: line }] });
    expect(outcomeOf(cite('src/domain/big.ts', 10), shown).status).toBe('dismiss');
    expect(outcomeOf(cite('src/domain/big.ts', 2800), shown).status).toBe('rejected');
    expect(outcomeOf(cite('src/infra/second.ts', 1), shown).status).toBe('rejected');
    expect(outcomeOf({ ...cite('src/domain/big.ts', 10), explanation: 'big.ts:2900 holds it.' }, shown).status).toBe('rejected');
    expect(outcomeOf({ ...cite('src/domain/big.ts', 10), explanation: 'At line 2900.' }, shown).status).toBe('rejected');
  });

  it('R19: an untruncated prompt gives the same counts and outcomes as the full files', () => {
    const files: ShownFile[] = [FILES[0] as ShownFile, second];
    const { shown, prompt } = renderFilterExplainPrompt({ finding, files, layerModel: '- domain' });
    expect(prompt).not.toContain('[truncated]');
    expect(shown).toEqual(files);
    for (const a of [ok, { ...ok, explanation: 'See line 4.' }, { ...ok, explanation: 'See line 5.' }, { ...ok, citations: [{ filePath: 'src/infra/second.ts', startLine: 1, endLine: 3 }] }]) {
      expect(checkGrounding(a, shown)).toEqual(checkGrounding(a, files));
    }
  });

  const order: ShownFile = { path: 'src/domain/order.ts', content: Array.from({ length: 40 }, (_, i) => `// ${String(i)}`).join('\n') };
  const repo: ShownFile = { path: 'src/infra/repo.ts', content: Array.from({ length: 300 }, (_, i) => `// ${String(i)}`).join('\n') };
  const bare: FilterExplainAnswer = { ...ok, explanation: 'order.ts calls the ORM at line 212.', citations: [{ filePath: 'src/domain/order.ts', startLine: 1, endLine: 2 }] };

  it("R20: by default ('attributed') a bare line is checked against the file named before it; 'longest' is the pre-R20 heuristic", () => {
    expect(checkGrounding(bare, [order, repo]).grounded).toBe(false);
    expect(checkGrounding(bare, [order, repo], { bareLines: 'attributed' })).toEqual(checkGrounding(bare, [order, repo]));
    expect(outcomeOf(bare, [order, repo]).status).toBe('rejected');
    expect(checkGrounding(bare, [order, repo], { bareLines: 'longest' }).grounded).toBe(true);
    expect(outcomeOf(bare, [order, repo], 'PARSE_FAILURE', { bareLines: 'longest' }).status).toBe('dismiss');
    // 'finding-file' ignores a file named in the sentence; 'attributed' does not.
    const named = { ...bare, explanation: 'The adapter repo.ts maps it at line 212.' };
    expect(checkGrounding(named, [order, repo]).grounded).toBe(true);
    expect(checkGrounding(named, [order, repo], { bareLines: 'finding-file' }).grounded).toBe(false);
  });

  it("R20: bareLines 'finding-file' checks a bare line against the finding's own (first shown) file", () => {
    const g = checkGrounding(bare, [order, repo], { bareLines: 'finding-file' });
    expect(g.grounded).toBe(false);
    expect(g.problems.join(' ')).toContain('beyond 40');
    expect(outcomeOf(bare, [order, repo], 'PARSE_FAILURE', { bareLines: 'finding-file' }).status).toBe('rejected');
    expect(checkGrounding({ ...bare, explanation: 'order.ts calls the ORM at line 12.' }, [order, repo], { bareLines: 'finding-file' }).grounded).toBe(true);
    // A single shown file: both modes agree.
    const single = { ...bare, citations: [{ filePath: 'src/infra/repo.ts', startLine: 1, endLine: 2 }] };
    expect(checkGrounding(single, [repo], { bareLines: 'finding-file' })).toEqual(checkGrounding(single, [repo]));
    expect(checkGrounding(single, [repo], { bareLines: 'finding-file' }).grounded).toBe(true);
  });
});
