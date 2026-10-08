// OI-U4-1, BR-U4-ISO-06, ISO-07: shape checks over the scrubbed Part 2 probe fixtures
// (U4 plan Step 10). The init-* negatives each differ from init-clean in one field.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = resolve(__dirname, '../../fixtures/claude-cli');
const FILES = readdirSync(DIR).filter((name) => name.endsWith('.json')).sort();

function load(name: string): unknown {
  return JSON.parse(readFileSync(resolve(DIR, name), 'utf8')) as unknown;
}

function collect(value: unknown, key: string, out: unknown[] = []): unknown[] {
  if (Array.isArray(value)) {
    for (const item of value) collect(item, key, out);
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === key) out.push(v);
      collect(v, key, out);
    }
  }
  return out;
}

describe('Claude CLI probe fixtures', () => {
  it('holds the scrubbed probe set and the four derived init negatives', () => {
    for (const name of [
      'auth-error.json',
      'canary-result.json',
      'config-allowlist.json',
      'envelope-noschema.json',
      'envelope-schema-tools-off.json',
      'envelope-schema-tools-on.json',
      'init-clean.json',
      'init-tools-off.json',
      'init-tools-on.json',
      'probe-values.json',
      'timing.json',
      'init-extra-tool.json',
      'init-mcp.json',
      'init-other-model.json',
      'init-apikey.json',
    ]) {
      expect(FILES).toContain(name);
    }
  });

  it.each(FILES)('%s parses as JSON', (name) => {
    expect(() => load(name)).not.toThrow();
  });

  it('canary negative under the neutral cwd found no token', () => {
    const canary = load('canary-result.json') as { tokensFound: { neutral: unknown[] } };
    expect(canary.tokensFound.neutral).toEqual([]);
  });

  it.each(FILES)('%s carries only placeholder session_id and uuid values', (name) => {
    const parsed = load(name);
    for (const key of ['session_id', 'uuid']) {
      for (const value of collect(parsed, key)) {
        expect(value).toMatch(/^<[a-z0-9-]+>$/);
      }
    }
  });

  it('each init negative differs from init-clean in exactly one field', () => {
    const clean = load('init-clean.json') as Record<string, unknown>;
    const expected: Record<string, string> = {
      'init-extra-tool.json': 'tools',
      'init-mcp.json': 'mcp_servers',
      'init-other-model.json': 'model',
      'init-apikey.json': 'apiKeySource',
    };
    for (const [name, field] of Object.entries(expected)) {
      const variant = load(name) as Record<string, unknown>;
      const changed = Object.keys(clean).filter(
        (k) => JSON.stringify(clean[k]) !== JSON.stringify(variant[k]),
      );
      expect(changed).toEqual([field]);
      expect(Object.keys(variant).sort()).toEqual(Object.keys(clean).sort());
    }
  });

  it('init-clean meets the probe pass condition', () => {
    const clean = load('init-clean.json') as {
      tools: unknown;
      mcp_servers: unknown;
      model: unknown;
      apiKeySource: unknown;
    };
    expect(clean.tools).toEqual(['StructuredOutput']);
    expect(clean.mcp_servers).toEqual([]);
    expect(clean.model).toBe('claude-opus-5-5');
    expect(clean.apiKeySource).toBe('none');
  });
});
