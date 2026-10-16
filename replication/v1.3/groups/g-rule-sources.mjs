// Rule-source verification (Docs/v1.3/rule-source-verification.md): the row count of the sealed sources table
// (Docs/v1.3/style-rule-sources.md). The other figures are about external texts (books, articles, web pages) and are
// listed as needs-external. style-rule-sources.md and its errata state no checkable number (bibliographic refs only).
const DOC = 'Docs/v1.3/rule-source-verification.md';

export default [{
  id: 'g-rulesrc-rows',
  title: 'Rule-source verification: rows of the sealed sources table',
  needs: 'offline',
  basis: 're-derived',
  slow: false,
  how: 'count the body rows of the table in Docs/v1.3/style-rule-sources.md',
  numbers: [
    { id: 'g-rulesrc-13-rows', doc: DOC, line: 3, what: 'rows of the style-rule-sources.md table', stated: 'the 13 rows' },
  ],
  async run(ctx) {
    const rows = ctx.read('Docs/v1.3/style-rule-sources.md').split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Style |'));
    return { 'g-rulesrc-13-rows': `the ${rows.length} rows` };
  },
}, {
  id: 'g-rulesrc-external',
  title: 'Rule-source verification: facts about external texts',
  needs: 'needs-external',
  basis: 're-derived',
  how: 'read the external sources (DDD Reference 2015 PDF, O\'Reilly previews, Cockburn 2005 article)',
  numbers: [
    { id: 'g-rulesrc-ddd-ref-pages', doc: DOC, line: 8, what: 'page count of Evans, DDD Reference (2015)', stated: '59 pp.', note: 'External PDF, not in the repository.' },
    { id: 'g-rulesrc-oreilly-403', doc: DOC, line: 13, what: 'HTTP status of the O\'Reilly previews', stated: 'returned 403', note: 'A web fetch at the time of writing; not reproducible offline.' },
  ],
}];
