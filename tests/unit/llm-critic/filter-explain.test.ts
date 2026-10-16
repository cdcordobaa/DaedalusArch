import {
  FE_SCHEMA_TEXT, answerOfResponse, buildFilterExplainPrompt, checkGrounding, findingKept, numberLines, outcomeOf,
  parseFilterExplainAnswer, renderFilterExplainPrompt, shownLineCounts,
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
    const n = r.shown[0]?.lineCount ?? 0;
    expect(n).toBeGreaterThan(100);
    expect(n).toBeLessThan(3000);
    // The last line counted as shown has its number label in the prompt; the next one does not.
    expect(r.prompt).toContain(`${String(n).padStart(4, ' ')}| `);
    expect(r.prompt).not.toContain(`${String(n + 1).padStart(4, ' ')}| `);
    expect(shownLineCounts([big, second])).toEqual(r.shown);
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
    expect(shown).toEqual([{ path: 'src/domain/a.ts', lineCount: 4 }, { path: 'src/infra/second.ts', lineCount: 2 }]);
    for (const a of [ok, { ...ok, explanation: 'See line 4.' }, { ...ok, explanation: 'See line 5.' }, { ...ok, citations: [{ filePath: 'src/infra/second.ts', startLine: 1, endLine: 3 }] }]) {
      expect(checkGrounding(a, shown)).toEqual(checkGrounding(a, files));
    }
  });

  const order: ShownFile = { path: 'src/domain/order.ts', content: Array.from({ length: 40 }, (_, i) => `// ${String(i)}`).join('\n') };
  const repo: ShownFile = { path: 'src/infra/repo.ts', content: Array.from({ length: 300 }, (_, i) => `// ${String(i)}`).join('\n') };
  const bare: FilterExplainAnswer = { ...ok, explanation: 'order.ts calls the ORM at line 212.', citations: [{ filePath: 'src/domain/order.ts', startLine: 1, endLine: 2 }] };

  it('R20: by default a bare line is checked against the longest shown file (documented heuristic)', () => {
    expect(checkGrounding(bare, [order, repo]).grounded).toBe(true);
    expect(checkGrounding(bare, [order, repo], { bareLines: 'longest' }).grounded).toBe(true);
    expect(outcomeOf(bare, [order, repo]).status).toBe('dismiss');
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
