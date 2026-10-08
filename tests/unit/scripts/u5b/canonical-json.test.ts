/**
 * U5b Step 4: canonical JSON serialisation (FR-25; BR-U5b-26; domain-entities §3).
 */
import { canonicalBytes, canonicalize, ratio } from '../../../../scripts/lib/canonical-json.js';

const key = (functionId: string, filePath: string, target = '', discriminator: string[] = []): string =>
  JSON.stringify([functionId, filePath, target, discriminator]);

describe('canonicalize (BR-U5b-26)', () => {
  it('is independent of object insertion order', () => {
    const a = { b: 1, a: { y: 2, x: [3, { q: true, p: null }] } };
    const b = { a: { x: [3, { p: null, q: true }], y: 2 }, b: 1 };
    expect(canonicalize(a)).toBe(canonicalize(b));
    expect(canonicalize(a)).toBe('{\n  "a": {\n    "x": [\n      3,\n      {\n        "p": null,\n        "q": true\n      }\n    ],\n    "y": 2\n  },\n  "b": 1\n}\n');
  });

  it('serialises two GoldenScore-like values with maps built in different orders to identical bytes', () => {
    const k1 = key('FF-S01', 'src/a|b.ts', 'src/c.ts', ['IMPORTS']);
    const k2 = key('FF-C02', 'src/"q",x.ts');
    const k3 = key('FF-S01', 'src/a.ts');
    const first = { perKey: new Map([[k1, { tp: 1 }], [k2, { tp: 0 }], [k3, { tp: 2 }]]), precision: ratio(2 / 3) };
    const second = { precision: ratio(2 / 3), perKey: new Map([[k3, { tp: 2 }], [k1, { tp: 1 }], [k2, { tp: 0 }]]) };
    expect(canonicalBytes(first).equals(canonicalBytes(second))).toBe(true);
    const parsed = JSON.parse(canonicalize(first)) as { perKey: [string, unknown][]; precision: number };
    expect(parsed.perKey.map(([k]) => k)).toEqual([k2, k3, k1].sort((x, y) => (JSON.stringify(x) < JSON.stringify(y) ? -1 : 1)));
    expect(JSON.parse(parsed.perKey[0]?.[0] ?? 'null')).toEqual(['FF-C02', 'src/"q",x.ts', '', []]);
  });

  it('writes a stored ratio with toFixed(6): 0.1 + 0.2 -> 0.300000', () => {
    expect(canonicalize({ r: ratio(0.1 + 0.2) })).toBe('{\n  "r": 0.300000\n}\n');
    expect(canonicalize(ratio(1))).toBe('1.000000\n');
    expect(canonicalize(ratio(0))).toBe('0.000000\n');
  });

  it('keeps integers as integers and plain numbers as JSON writes them', () => {
    expect(canonicalize({ n: 12, z: 0, neg: -3 })).toBe('{\n  "n": 12,\n  "neg": -3,\n  "z": 0\n}\n');
    expect(canonicalize(0.5)).toBe('0.5\n');
  });

  it('omits undefined fields, keeps null, writes undefined array items as null', () => {
    expect(canonicalize({ a: undefined, b: null, c: [undefined, 1] })).toBe('{\n  "b": null,\n  "c": [\n    null,\n    1\n  ]\n}\n');
  });

  it('sorts nested maps (maps inside map values) and map keys that are tuples', () => {
    const inner1 = new Map<string, number>([['z', 1], ['a', 2]]);
    const inner2 = new Map<string, number>([['a', 2], ['z', 1]]);
    const v1 = new Map<string[], Map<string, number>>([[['b', 'x'], inner1], [['a', 'y'], inner2]]);
    const v2 = new Map<string[], Map<string, number>>([[['a', 'y'], new Map([['z', 1], ['a', 2]])], [['b', 'x'], new Map([['a', 2], ['z', 1]])]]);
    expect(canonicalize(v1)).toBe(canonicalize(v2));
    expect(JSON.parse(canonicalize(v1))).toEqual([[['a', 'y'], [['a', 2], ['z', 1]]], [['b', 'x'], [['a', 2], ['z', 1]]]]);
  });

  it('ends with a single newline, has no trailing whitespace and is UTF-8', () => {
    const text = canonicalize({ s: 'naïve ✓', e: [], o: {} });
    expect(text.endsWith('}\n')).toBe(true);
    expect(text.split('\n').every((line) => line === line.trimEnd())).toBe(true);
    expect(canonicalBytes({ s: '✓' }).toString('utf8')).toBe('{\n  "s": "✓"\n}\n');
    expect(text).toContain('"e": []');
    expect(text).toContain('"o": {}');
  });

  it('refuses values JSON cannot carry', () => {
    expect(() => canonicalize({ x: Number.NaN })).toThrow(/non-finite/);
    expect(() => ratio(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => canonicalize(new Set([1]))).toThrow(/Set/);
    expect(() => canonicalize({ f: () => 1 })).toThrow(/function/);
    expect(() => canonicalize(undefined)).toThrow(/undefined/);
    expect(() => canonicalize(new Date(0))).toThrow(/Date/);
  });
});
