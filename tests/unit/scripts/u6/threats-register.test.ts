/**
 * U6 Docs lane (ADR-021 THR-9): structure and completeness of `Docs/threats-to-validity.md`.
 *
 * - REG-01 every register row has a type key, a handling with a mitigation (`M:`) or a reporting duty (`D:`), a status
 *   and report sections that are §1 keys (or `—` for engineering residuals);
 * - REG-02 row ids are unique and consecutive;
 * - REG-03 the §5 trace covers every item of each source (U1 §8, U3 §11, ADR-018..021, the Fable review A1–A8 / B1–B7,
 *   every THR-* finding of the audit) and points only at existing rows; every row is reached by the trace or names
 *   an audit finding id itself;
 * - REG-04 the §1 section keys are the Kap7–9 section numbers the register uses.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../../..');
const TEXT = readFileSync(join(ROOT, 'Docs/threats-to-validity.md'), 'utf8');
const AUDIT = JSON.parse(readFileSync(join(ROOT, 'Docs/DiagnosticRuns/so-readiness-audit-2026-10-08.json'), 'utf8')) as { id: string }[];

interface Row { id: string; type: string; handling: string; status: string; report: string; sources: string }

/** Splits a markdown table line on unescaped pipes. */
function cells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function registerRows(text: string): Row[] {
  return text.split('\n').filter((l) => /^\| TV-\d{2} \|/.test(l)).map((l) => {
    const c = cells(l);
    return { id: c[0] ?? '', type: c[1] ?? '', sources: c[3] ?? '', handling: c[4] ?? '', status: c[6] ?? '', report: c[7] ?? '' };
  });
}

function sectionKeys(text: string): Set<string> {
  const keys = text.split('\n').filter((l) => /^\| \d\.\d \| /.test(l)).map((l) => cells(l)[0] ?? '');
  return new Set(keys);
}

/** §5 trace: source → item → row ids. */
function trace(text: string): Map<string, Map<string, string[]>> {
  const start = text.indexOf('## 5. Source trace');
  const out = new Map<string, Map<string, string[]>>();
  for (const line of text.slice(start).split('\n').filter((l) => l.startsWith('| ') && l.includes('→') && !l.startsWith('| Source |'))) {
    const [source = '', items = ''] = cells(line);
    const m = new Map<string, string[]>();
    for (const part of items.split(/;\s*/)) {
      const [item = '', targets = ''] = part.split('→').map((s) => s.trim());
      m.set(item, targets.split(/,\s*/).filter((t) => t !== ''));
    }
    out.set(source, m);
  }
  return out;
}

const ROWS = registerRows(TEXT);
const TRACE = trace(TEXT);
const range = (n: number): string[] => Array.from({ length: n }, (_, i) => String(i + 1));

describe('threats-to-validity register (THR-9)', () => {
  it('REG-01 every row has a type, M:/D: handling, a status and §1 report keys', () => {
    const keys = sectionKeys(TEXT);
    expect(ROWS.length).toBeGreaterThan(0);
    for (const r of ROWS) {
      expect({ id: r.id, type: /^[CIESR](\/[CIESR])?$/.test(r.type) }).toEqual({ id: r.id, type: true });
      expect({ id: r.id, handling: /(^|\s)[MD]:/.test(r.handling) }).toEqual({ id: r.id, handling: true });
      expect({ id: r.id, status: r.status !== '' }).toEqual({ id: r.id, status: true });
      const report = r.report.split(/;\s*/);
      for (const k of report) expect({ id: r.id, key: k, ok: k === '—' || keys.has(k) }).toEqual({ id: r.id, key: k, ok: true });
    }
  });

  it('REG-02 ids are unique and consecutive from TV-01', () => {
    expect(ROWS.map((r) => r.id)).toEqual(ROWS.map((_, i) => `TV-${String(i + 1).padStart(2, '0')}`));
  });

  it('REG-03 the trace covers every item of each source', () => {
    const items = (source: string): string[] => [...(TRACE.get(source)?.keys() ?? [])];
    expect(items('U1 §8').sort()).toEqual(range(12).sort());
    expect(items('U3 §11').sort()).toEqual(range(13).sort());
    expect(items('ADR-018').sort()).toEqual(range(6).sort());
    expect(items('ADR-019').sort()).toEqual(range(6).sort());
    expect(items('ADR-020').sort()).toEqual(range(9).sort());
    expect(items('ADR-021').sort()).toEqual(range(5).sort());
    expect(items('Fable review').sort()).toEqual([...range(8).map((n) => `A${n}`), ...range(7).map((n) => `B${n}`)].sort());
    const thr = AUDIT.map((f) => f.id).filter((id) => id.startsWith('THR-')).sort();
    expect(thr.length).toBeGreaterThan(0);
    expect(items('Audit THR').sort()).toEqual(thr);
    // The U4 §11 table rows that carry a threat (24 of its 26 rows; "Seeded list" and "Function instability" have none).
    expect(items('U4 §11')).toHaveLength(24);
  });

  it('REG-03 every trace target exists, and every row is traced or cites an audit finding', () => {
    const ids = new Set(ROWS.map((r) => r.id));
    const traced = new Set<string>();
    for (const [source, m] of TRACE) {
      for (const [item, targets] of m) {
        expect({ source, item, n: targets.length > 0 }).toEqual({ source, item, n: true });
        for (const t of targets) {
          expect({ source, item, t, exists: ids.has(t) }).toEqual({ source, item, t, exists: true });
          traced.add(t);
        }
      }
    }
    const auditIds = AUDIT.map((f) => f.id);
    for (const r of ROWS) {
      const citesFinding = auditIds.some((id) => r.sources.includes(id) || r.status.includes(id));
      expect({ id: r.id, reached: traced.has(r.id) || citesFinding }).toEqual({ id: r.id, reached: true });
    }
  });

  it('REG-03 every audit finding a row names exists in the audit', () => {
    const auditIds = new Set(AUDIT.map((f) => f.id));
    const named = new Set([...TEXT.matchAll(/\b(SO[1-5]-[0-9A-Z]{1,2}|THR-\d|X-\d)\b/g)].map((m) => m[1] ?? ''));
    for (const id of named) expect({ id, known: auditIds.has(id) }).toEqual({ id, known: true });
  });

  it('REG-04 the section keys are the Kap7–9 sections used', () => {
    expect([...sectionKeys(TEXT)].sort()).toEqual(['7.1', '7.2', '7.3', '7.5', '8.1', '8.2', '8.4', '8.5', '9.2', '9.3']);
  });
});
