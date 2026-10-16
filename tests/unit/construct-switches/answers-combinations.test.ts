/**
 * R31 (Docs/v1.3/post-merge-review-2026-10-16.md): Q13 C is coherent only together with Q25 B (answer sheet, Q13; and
 * construct-switches.md). The answer script must say so when Q13 C comes without Q25 B, in its warnings and in the
 * sign-off lines, and stay silent when Q25 B is chosen too.
 */
import { parseAnswersDocument, signOffLines } from '../../../scripts/v1.3/lib/construct-answers.js';

const NEEDLE = /Q13 C without Q25 B/;

describe('R31: Q13 C needs Q25 B', () => {
  it('warns (parser and sign-off) on Q13 C alone', () => {
    const parsed = parseAnswersDocument({ Q13: 'C' });
    expect(parsed.warnings.some((w) => NEEDLE.test(w))).toBe(true);
    expect(signOffLines(parsed).some((l) => NEEDLE.test(l))).toBe(true);
  });

  it('is silent when Q25 B is chosen too, or Q13 is not C', () => {
    for (const doc of [{ Q13: 'C', Q25: 'B' }, { Q13: 'B' }, {}]) {
      const parsed = parseAnswersDocument(doc);
      expect(parsed.warnings.some((w) => NEEDLE.test(w))).toBe(false);
      expect(signOffLines(parsed).some((l) => NEEDLE.test(l))).toBe(false);
    }
  });
});
