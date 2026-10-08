/**
 * Envelope reader and model-usage rule (U5a plan Step 19; BR-U5a-46, 47; NFR-v1.2E-08).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  ENVELOPE_UNREADABLE,
  parseEnvelope,
  readEnvelope,
  writeEnvelope,
} from '../../../../scripts/lib/generators/envelope.js';
import { judgeModelUsage } from '../../../../scripts/lib/generators/model-usage.js';

const PINNED = 'pinned-model-1';
const HELPER = 'helper-small-1';
const SECRET = 'super-secret-value-123';

const FULL = {
  type: 'result',
  subtype: 'success',
  is_error: false,
  num_turns: 12,
  permission_denials: [{ tool_name: 'Bash', tool_input: { command: 'rm -rf /' } }],
  total_cost_usd: 0.42,
  duration_ms: 65000,
  session_id: 'sess-1',
  result: `done; token ${SECRET}`,
  modelUsage: {
    [PINNED]: { inputTokens: 100, outputTokens: 5000 },
    [HELPER]: { inputTokens: 10, outputTokens: 40 },
  },
};

const FIELDS = [
  ['is_error', 'isError'],
  ['subtype', 'subtype'],
  ['num_turns', 'numTurns'],
  ['permission_denials', 'permissionDenials'],
  ['total_cost_usd', 'totalCostUsd'],
  ['duration_ms', 'durationMs'],
  ['session_id', 'sessionId'],
  ['modelUsage', 'modelUsage'],
] as const;

describe('envelope reader (BR-U5a-46)', () => {
  it('reads a full envelope', () => {
    const r = readEnvelope(JSON.stringify(FULL));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).toEqual({
      isError: false,
      subtype: 'success',
      numTurns: 12,
      permissionDenials: FULL.permission_denials,
      totalCostUsd: 0.42,
      durationMs: 65000,
      sessionId: 'sess-1',
      modelUsage: { [PINNED]: { outputTokens: 5000 }, [HELPER]: { outputTokens: 40 } },
    });
  });

  it.each(FIELDS)('a missing %s is recorded absent, never fatal', (raw, key) => {
    const env = Object.fromEntries(Object.entries(FULL).filter(([k]) => k !== raw));
    const r = readEnvelope(JSON.stringify(env));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).not.toHaveProperty(key);
    expect(Object.keys(r.data)).toHaveLength(FIELDS.length - 1);
  });

  it('mistyped fields are absent; per-model tokens tolerate output_tokens and junk', () => {
    const r = readEnvelope(
      JSON.stringify({
        is_error: 'no',
        num_turns: '3',
        permission_denials: {},
        session_id: 7,
        modelUsage: { a: { output_tokens: 3 }, b: 'x', c: { outputTokens: -1 } },
      }),
    );
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ modelUsage: { a: { outputTokens: 3 }, b: {}, c: {} } });
  });

  it.each([
    ['plain text', 'Error: usage limit reached'],
    ['empty', ''],
    ['truncated JSON', '{"is_error": false, "modelUsage": {'],
    ['a JSON array', '[1,2]'],
    ['a JSON string', '"hello"'],
  ])('non-JSON or non-object stdout (%s) → envelope-unreadable', (_label, stdout) => {
    const r = readEnvelope(stdout);
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.errors[0]?.code).toBe(ENVELOPE_UNREADABLE);
    expect(r.errors[0]?.context).toMatchObject({ failureReason: 'envelope-unreadable' });
  });

  it('accepts surrounding whitespace and a preceding log line', () => {
    expect(readEnvelope(`\n  ${JSON.stringify(FULL)}  \n`).success).toBe(true);
    expect(readEnvelope(`warning: something\n${JSON.stringify({ subtype: 'success' })}\n`).success).toBe(true);
  });

  it('stores the full envelope after scrubDeep', () => {
    const r = parseEnvelope(JSON.stringify(FULL), [SECRET]);
    expect(r.success).toBe(true);
    if (!r.success) return;
    const text = JSON.stringify(r.data.scrubbed);
    expect(text).not.toContain(SECRET);
    expect(r.data.scrubbed.session_id).toBe('sess-1');
    expect(r.data.scrubbed.modelUsage).toEqual(FULL.modelUsage);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-env-'));
    try {
      const file = path.join(tmp, 'run-0', 'envelope.json');
      writeEnvelope(file, r.data.scrubbed);
      expect(fs.readFileSync(file, 'utf8')).not.toContain(SECRET);
      expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(r.data.scrubbed);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('model-usage rule (BR-U5a-47)', () => {
  it('pinned dominant + one haiku-style helper → valid with one auxiliary', () => {
    const v = judgeModelUsage(PINNED, { modelUsage: { [PINNED]: { outputTokens: 5000 }, [HELPER]: { outputTokens: 40 } } });
    expect(v).toEqual({ valid: true, resolvedModelId: PINNED, auxiliaryModels: [{ id: HELPER, outputTokens: 40 }] });
  });

  it('pinned alone → valid, no auxiliary', () => {
    expect(judgeModelUsage(PINNED, { modelUsage: { [PINNED]: { outputTokens: 1 } } })).toEqual({
      valid: true,
      resolvedModelId: PINNED,
      auxiliaryModels: [],
    });
  });

  it('pinned absent → pinned-absent', () => {
    expect(judgeModelUsage(PINNED, { modelUsage: { other: { outputTokens: 10 }, [HELPER]: {} } })).toEqual({
      valid: false,
      reason: 'pinned-absent',
      auxiliaryModels: [
        { id: HELPER, outputTokens: 0 },
        { id: 'other', outputTokens: 10 },
      ],
    });
  });

  it('pinned present but not dominant → pinned-not-dominant (a tie is not dominant)', () => {
    const v = judgeModelUsage(PINNED, { modelUsage: { [PINNED]: { outputTokens: 40 }, [HELPER]: { outputTokens: 900 } } });
    expect(v).toEqual({ valid: false, reason: 'pinned-not-dominant', auxiliaryModels: [{ id: HELPER, outputTokens: 900 }] });
    const tie = judgeModelUsage(PINNED, { modelUsage: { [PINNED]: { outputTokens: 50 }, [HELPER]: { outputTokens: 50 } } });
    expect(tie.valid).toBe(false);
    if (!tie.valid) expect(tie.reason).toBe('pinned-not-dominant');
  });

  it('no or empty modelUsage → no-model-usage', () => {
    expect(judgeModelUsage(PINNED, {})).toEqual({ valid: false, reason: 'no-model-usage', auxiliaryModels: [] });
    expect(judgeModelUsage(PINNED, { modelUsage: {} })).toEqual({ valid: false, reason: 'no-model-usage', auxiliaryModels: [] });
  });

  it('works end to end from a raw envelope', () => {
    const r = readEnvelope(JSON.stringify(FULL));
    if (!r.success) throw new Error('envelope');
    const v = judgeModelUsage(PINNED, r.data);
    expect(v.valid).toBe(true);
    expect(v.auxiliaryModels).toEqual([{ id: HELPER, outputTokens: 40 }]);
  });
});
