/**
 * Scalar built-ins: the Cypher functions the template census needs, plus the three APOC collection functions the
 * templates call (`apoc.coll.indexOf`, `apoc.coll.toSet`, `apoc.coll.sort`), implemented as built-ins with APOC 5.26's
 * own semantics (Docs/v1.3/cypher-interpreter.md §3). A name outside this table is rejected, never guessed.
 */
import { CypherUnsupportedError } from './parse.js';
import {
  CypherMap, CypherPath, CypherRuntimeError, checkedInt, cypherOrder, equivalenceKey, isList, isNode, isNumber, isRel, scalarToString, typeName,
} from './values.js';
import type { Value } from './values.js';

type Fn = (args: readonly Value[]) => Value;

function arity(name: string, args: readonly Value[], min: number, max = min): void {
  if (args.length < min || args.length > max) throw new CypherRuntimeError(`Function ${name} called with ${String(args.length)} arguments`, 'Neo.ClientError.Statement.SyntaxError');
}

function str(name: string, v: Value): string {
  if (typeof v !== 'string') throw new CypherRuntimeError(`Expected a String for ${name}, got ${typeName(v)}`);
  return v;
}

function int(name: string, v: Value): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number' && Number.isInteger(v)) return BigInt(v);
  throw new CypherRuntimeError(`Expected an Integer for ${name}, got ${typeName(v)}`);
}

function list(name: string, v: Value): readonly Value[] {
  if (!isList(v)) throw new CypherRuntimeError(`Expected a List for ${name}, got ${typeName(v)}`);
  return v;
}

/** Strings are measured and cut by code point, as Neo4j's `StringValue` does. */
function codePoints(s: string): string[] {
  return Array.from(s); // code points, as Neo4j counts them (not UTF-16 units, not grapheme clusters)
}

/**
 * Java `Character.isWhitespace`: Unicode Zs, Zl and Zp except the no-break spaces U+00A0, U+2007 and U+202F, plus
 * U+0009-U+000D and U+001C-U+001F. Neo4j trims strings by this test, code point by code point; JavaScript's
 * `String.prototype.trim` set differs (it strips the no-break spaces and U+FEFF, and keeps U+001C-U+001F).
 */
const UNICODE_SEPARATOR = /^[\p{Zs}\p{Zl}\p{Zp}]$/u;
const JAVA_NON_BREAKING = new Set(['\u00A0', '\u2007', '\u202F']);

function isJavaWhitespace(ch: string): boolean {
  const cp = ch.charCodeAt(0);
  if ((cp >= 0x09 && cp <= 0x0d) || (cp >= 0x1c && cp <= 0x1f)) return true;
  return UNICODE_SEPARATOR.test(ch) && !JAVA_NON_BREAKING.has(ch);
}

/** Strip leading and/or trailing Java whitespace (every whitespace character is a single UTF-16 unit). */
function javaTrim(s: string, start = true, end = true): string {
  let i = 0;
  let j = s.length;
  if (start) while (i < j && isJavaWhitespace(s.charAt(i))) i++;
  if (end) while (j > i && isJavaWhitespace(s.charAt(j - 1))) j--;
  return s.slice(i, j);
}

const INT64_MAX = 2n ** 63n - 1n;
const INT64_MIN = -(2n ** 63n);

/** Java's `(long) d` narrowing: NaN is 0, values outside the int64 range (and the infinities) saturate, else truncate. */
function javaLongCast(d: number): bigint {
  if (Number.isNaN(d)) return 0n;
  if (d >= 2 ** 63) return INT64_MAX;
  if (d <= -(2 ** 63)) return INT64_MIN;
  return BigInt(Math.trunc(d));
}

function toIntegerOf(v: Value): Value {
  if (v === null) return null;
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') return javaLongCast(v); // FloatingPointValue.longValue(): a Java (long) cast
  if (typeof v === 'boolean') return v ? 1n : 0n;
  if (typeof v === 'string') {
    const t = javaTrim(v);
    if (/^[+-]?\d+$/.test(t)) {
      try { return checkedInt(BigInt(t)); } catch { return null; }
    }
    // JS Number() would also skip whitespace Java keeps (a no-break space): such a string does not parse.
    const d = t === t.trim() ? Number(t) : Number.NaN;
    return t !== '' && Number.isFinite(d) ? checkedInt(BigInt(Math.trunc(d))) : null;
  }
  throw new CypherRuntimeError(`Invalid input for function 'toInteger()': ${typeName(v)}`);
}

function toFloatOf(v: Value): Value {
  if (v === null) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string') {
    const t = javaTrim(v);
    if (t === '' || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?[fFdD]?$|^[+-]?(NaN|Infinity)$/.test(t)) return null;
    return Number(t.replace(/[fFdD]$/, ''));
  }
  throw new CypherRuntimeError(`Invalid input for function 'toFloat()': ${typeName(v)}`);
}

const FUNCTIONS: ReadonlyMap<string, Fn> = new Map<string, Fn>([
  ['coalesce', (a) => a.find((v) => v !== null) ?? null],
  ['type', (a) => { arity('type', a, 1); const r = a[0] as Value; if (r === null) return null; if (!isRel(r)) throw new CypherRuntimeError(`type() expects a Relationship, got ${typeName(r)}`); return r.type; }],
  ['labels', (a) => { arity('labels', a, 1); const n = a[0] as Value; if (n === null) return null; if (!isNode(n)) throw new CypherRuntimeError('labels() expects a Node'); return [...n.labels]; }],
  ['id', (a) => { arity('id', a, 1); const n = a[0] as Value; if (n === null) return null; if (!isNode(n) && !isRel(n)) throw new CypherRuntimeError('id() expects a Node or Relationship'); return BigInt(n.id); }],
  ['keys', (a) => {
    arity('keys', a, 1);
    const n = a[0] as Value;
    if (n === null) return null;
    if (isNode(n) || isRel(n)) return [...n.properties.keys()];
    if (n instanceof CypherMap) return [...n.entries.keys()];
    throw new CypherRuntimeError('keys() expects a Node, Relationship or Map');
  }],
  ['nodes', (a) => { arity('nodes', a, 1); const p = a[0] as Value; if (p === null) return null; if (!(p instanceof CypherPath)) throw new CypherRuntimeError('nodes() expects a Path'); return [...p.nodes]; }],
  ['relationships', (a) => { arity('relationships', a, 1); const p = a[0] as Value; if (p === null) return null; if (!(p instanceof CypherPath)) throw new CypherRuntimeError('relationships() expects a Path'); return [...p.rels]; }],
  ['startnode', (a) => { arity('startNode', a, 1); const r = a[0] as Value; if (r === null) return null; if (!isRel(r)) throw new CypherRuntimeError('startNode() expects a Relationship'); return r.start; }],
  ['endnode', (a) => { arity('endNode', a, 1); const r = a[0] as Value; if (r === null) return null; if (!isRel(r)) throw new CypherRuntimeError('endNode() expects a Relationship'); return r.end; }],
  ['length', (a) => {
    arity('length', a, 1);
    const p = a[0] as Value;
    if (p === null) return null;
    if (p instanceof CypherPath) return BigInt(p.rels.length);
    throw new CypherRuntimeError(`length() expects a Path, got ${typeName(p)}`);
  }],
  ['size', (a) => {
    arity('size', a, 1);
    const v = a[0] as Value;
    if (v === null) return null;
    if (typeof v === 'string') return BigInt(codePoints(v).length);
    if (isList(v)) return BigInt(v.length);
    throw new CypherRuntimeError(`size() expects a String or List, got ${typeName(v)}`);
  }],
  ['head', (a) => { arity('head', a, 1); const v = a[0] as Value; if (v === null) return null; return list('head', v)[0] ?? null; }],
  ['last', (a) => { arity('last', a, 1); const v = a[0] as Value; if (v === null) return null; const l = list('last', v); return l[l.length - 1] ?? null; }],
  ['tail', (a) => { arity('tail', a, 1); const v = a[0] as Value; if (v === null) return null; return list('tail', v).slice(1); }],
  ['reverse', (a) => {
    arity('reverse', a, 1);
    const v = a[0] as Value;
    if (v === null) return null;
    if (typeof v === 'string') return codePoints(v).reverse().join('');
    return [...list('reverse', v)].reverse();
  }],
  ['isempty', (a) => {
    arity('isEmpty', a, 1);
    const v = a[0] as Value;
    if (v === null) return null;
    if (typeof v === 'string') return v.length === 0;
    if (isList(v)) return v.length === 0;
    if (v instanceof CypherMap) return v.entries.size === 0;
    throw new CypherRuntimeError('isEmpty() expects a String, List or Map');
  }],
  ['range', (a) => {
    arity('range', a, 2, 3);
    const [s, e, st] = [int('range', a[0] as Value), int('range', a[1] as Value), a.length === 3 ? int('range', a[2] as Value) : 1n];
    if (st === 0n) throw new CypherRuntimeError('step argument to range() cannot be zero', 'Neo.ClientError.Statement.ArgumentError');
    const out: bigint[] = [];
    if (st > 0n) for (let i = s; i <= e; i += st) out.push(i);
    else for (let i = s; i >= e; i += st) out.push(i);
    return out;
  }],
  ['split', (a) => {
    arity('split', a, 2);
    const [s, d] = a as [Value, Value];
    if (s === null || d === null) return null;
    if (isList(d)) throw new CypherUnsupportedError('split() with a list of delimiters');
    return str('split', s).split(str('split', d));
  }],
  ['substring', (a) => {
    arity('substring', a, 2, 3);
    const s = a[0] as Value;
    if (s === null) return null;
    const cps = codePoints(str('substring', s));
    const start = Number(int('substring', a[1] as Value));
    if (start < 0) throw new CypherRuntimeError('Invalid input for function substring(): start must be non-negative', 'Neo.ClientError.Statement.ArgumentError');
    if (a.length === 2) return cps.slice(start).join('');
    const len = Number(int('substring', a[2] as Value));
    if (len < 0) throw new CypherRuntimeError('Invalid input for function substring(): length must be non-negative', 'Neo.ClientError.Statement.ArgumentError');
    return cps.slice(start, start + len).join('');
  }],
  ['left', (a) => {
    arity('left', a, 2);
    const s = a[0] as Value;
    if (a[1] === null) throw new CypherRuntimeError('left(): length must not be null', 'Neo.ClientError.Statement.ArgumentError');
    if (s === null) return null;
    const n = Number(int('left', a[1] as Value));
    if (n < 0) throw new CypherRuntimeError('left(): negative length', 'Neo.ClientError.Statement.ArgumentError');
    return codePoints(str('left', s)).slice(0, n).join('');
  }],
  ['right', (a) => {
    arity('right', a, 2);
    const s = a[0] as Value;
    if (a[1] === null) throw new CypherRuntimeError('right(): length must not be null', 'Neo.ClientError.Statement.ArgumentError');
    if (s === null) return null;
    const n = Number(int('right', a[1] as Value));
    if (n < 0) throw new CypherRuntimeError('right(): negative length', 'Neo.ClientError.Statement.ArgumentError');
    const cps = codePoints(str('right', s));
    return cps.slice(Math.max(0, cps.length - n)).join('');
  }],
  ['replace', (a) => {
    arity('replace', a, 3);
    if (a.some((v) => v === null)) return null;
    return str('replace', a[0] as Value).replaceAll(str('replace', a[1] as Value), str('replace', a[2] as Value));
  }],
  ['tolower', (a) => { arity('toLower', a, 1); const s = a[0] as Value; return s === null ? null : str('toLower', s).toLowerCase(); }],
  ['toupper', (a) => { arity('toUpper', a, 1); const s = a[0] as Value; return s === null ? null : str('toUpper', s).toUpperCase(); }],
  ['trim', (a) => { arity('trim', a, 1); const s = a[0] as Value; return s === null ? null : javaTrim(str('trim', s)); }],
  ['ltrim', (a) => { arity('ltrim', a, 1); const s = a[0] as Value; return s === null ? null : javaTrim(str('ltrim', s), true, false); }],
  ['rtrim', (a) => { arity('rtrim', a, 1); const s = a[0] as Value; return s === null ? null : javaTrim(str('rtrim', s), false, true); }],
  ['tostring', (a) => { arity('toString', a, 1); const v = a[0] as Value; return v === null ? null : scalarToString(v); }],
  ['tointeger', (a) => { arity('toInteger', a, 1); return toIntegerOf(a[0] as Value); }],
  ['tofloat', (a) => { arity('toFloat', a, 1); return toFloatOf(a[0] as Value); }],
  ['toboolean', (a) => {
    arity('toBoolean', a, 1);
    const v = a[0] as Value;
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'string') { const t = v.trim().toLowerCase(); return t === 'true' ? true : t === 'false' ? false : null; }
    if (typeof v === 'bigint') return v !== 0n;
    throw new CypherRuntimeError('toBoolean() expects a String, Boolean or Integer');
  }],
  ['abs', (a) => { arity('abs', a, 1); const v = a[0] as Value; if (v === null) return null; if (typeof v === 'bigint') return checkedInt(v < 0n ? -v : v); if (typeof v === 'number') return Math.abs(v); throw new CypherRuntimeError('abs() expects a number'); }],
  ['sign', (a) => { arity('sign', a, 1); const v = a[0] as Value; if (v === null) return null; if (typeof v === 'bigint') return v > 0n ? 1n : v < 0n ? -1n : 0n; if (typeof v === 'number') return javaLongCast(Math.sign(v)); throw new CypherRuntimeError('sign() expects a number'); }],
  ['ceil', (a) => { arity('ceil', a, 1); const v = a[0] as Value; if (v === null) return null; if (!isNumber(v)) throw new CypherRuntimeError('ceil() expects a number'); return Math.ceil(Number(v)); }],
  ['floor', (a) => { arity('floor', a, 1); const v = a[0] as Value; if (v === null) return null; if (!isNumber(v)) throw new CypherRuntimeError('floor() expects a number'); return Math.floor(Number(v)); }],
  ['sqrt', (a) => { arity('sqrt', a, 1); const v = a[0] as Value; if (v === null) return null; if (!isNumber(v)) throw new CypherRuntimeError('sqrt() expects a number'); return Math.sqrt(Number(v)); }],
  // ── APOC 5.26 collection functions (the three the templates call) ──
  // apoc.coll.indexOf(coll, value): `-1` for a null list; values compare as Neo4j values, so an INTEGER equals the
  // same FLOAT (`indexOf([1, 2], 2.0)` is 1 on 5.26.24, not Java `Long.equals(Double)`'s -1).
  ['apoc.coll.indexOf', (a) => {
    arity('apoc.coll.indexOf', a, 2);
    const [l, v] = a as [Value, Value];
    if (l === null) return -1n;
    const items = list('apoc.coll.indexOf', l);
    const key = equivalenceKey(v);
    return BigInt(items.findIndex((x) => equivalenceKey(x) === key));
  }],
  // apoc.coll.toSet(coll): first occurrences in order (a LinkedHashSet); null for a null list. Equivalence as in
  // DISTINCT (1 and 1.0 are one element, the first kept; checked on 5.26.24).
  ['apoc.coll.toSet', (a) => {
    arity('apoc.coll.toSet', a, 1);
    const l = a[0] as Value;
    if (l === null) return null;
    const seen = new Set<string>();
    const out: Value[] = [];
    for (const x of list('apoc.coll.toSet', l)) {
      const k = equivalenceKey(x);
      if (!seen.has(k)) { seen.add(k); out.push(x); }
    }
    return out;
  }],
  // apoc.coll.sort(coll): ascending; `[]` for a null list (5.26.24); a null element fails in APOC (NullPointerException).
  ['apoc.coll.sort', (a) => {
    arity('apoc.coll.sort', a, 1);
    const l = a[0] as Value;
    if (l === null) return [];
    const items = [...list('apoc.coll.sort', l)];
    if (items.some((x) => x === null)) throw new CypherRuntimeError('Failed to invoke function `apoc.coll.sort`: Caused by: java.lang.NullPointerException', 'Neo.ClientError.Procedure.ProcedureCallFailed');
    return items.sort(cypherOrder);
  }],
]);

/** The built-in for a function name: Cypher built-ins case-insensitively, APOC names exactly. */
export function lookupFunction(name: string): Fn | undefined {
  return FUNCTIONS.get(name) ?? FUNCTIONS.get(name.toLowerCase());
}

export const AGGREGATES: ReadonlySet<string> = new Set(['count', 'collect', 'sum', 'avg', 'min', 'max', 'stdev', 'stdevp', 'percentilecont', 'percentiledisc']);

// ── regular expressions (`=~`) ──
const regexCache = new Map<string, RegExp>();

/** What Java's `.` matches without `(?s)`: anything but its line terminators (`\n`, `\r`, NEL, LS, PS). */
const JAVA_DOT = '[^\\n\\r\\u{85}\\u{2028}\\u{2029}]';
/** Java's `\s` without UNICODE_CHARACTER_CLASS: the six ASCII whitespace characters (JS `\s` is Unicode). */
const JAVA_SPACE = '\\t\\n\\x0B\\f\\r ';
/** Characters that keep their backslash in a `u`-mode pattern (JS SyntaxCharacter and `/`). */
const SYNTAX_CHARS = '^$\\.*+?()[]{}|/';
/** Java escapes with no JS equivalent of the same meaning: rejected wherever they appear. */
const JAVA_ONLY_ESCAPES = 'pPhHRXvVGNQEAZzc';

interface JavaFlags { i: boolean; m: boolean; s: boolean; u: boolean }

/** One escape or character: its JS text and, when it denotes one character, that code point. */
interface Atom { readonly text: string; readonly cp?: number }

/**
 * Translate a Java pattern body (leading flags already stripped) to a JS `u`-mode source with the Java meaning, or
 * throw `CypherUnsupportedError` for a construct whose meaning would differ. Java (?i) without (?u) folds ASCII letters
 * only, so it is expanded by hand (`a` becomes `[aA]`) instead of using the JS `i` flag (which folds Unicode).
 */
function translateJavaRegex(pattern: string, body: string, f: JavaFlags): string {
  const asciiCase = f.i && !f.u;
  const n = body.length;
  let pos = 0;
  const reject = (what: string): never => {
    throw new CypherUnsupportedError(`Java-only regular expression syntax (${what}) in ${JSON.stringify(pattern)}`);
  };
  const hexAt = (len: number): number | undefined => {
    const h = body.slice(pos, pos + len);
    return h.length === len && /^[0-9a-fA-F]+$/.test(h) ? parseInt(h, 16) : undefined;
  };
  const isAsciiLetter = (cp: number): boolean => (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a);
  const caseChar = (a: Atom): string => {
    if (!asciiCase || a.cp === undefined || !isAsciiLetter(a.cp)) return a.text;
    const ch = String.fromCharCode(a.cp);
    return `[${ch.toLowerCase()}${ch.toUpperCase()}]`;
  };

  /** The escape at `body[pos]` (a backslash). */
  const escape = (inClass: boolean): Atom => {
    const e = body[pos + 1];
    if (e === undefined) { pos += 1; return { text: '\\' }; } // a trailing backslash: a SyntaxError, as in Java
    pos += 2;
    switch (e) {
      case 'd': case 'D': case 'w': case 'W': return { text: `\\${e}` };
      case 's': return { text: inClass ? JAVA_SPACE : `[${JAVA_SPACE}]` };
      case 'S': return inClass ? reject('\\S inside a class') : { text: `[^${JAVA_SPACE}]` };
      case 'b': case 'B': return inClass ? reject('\\b inside a class') : { text: `\\${e}` };
      case 't': return { text: '\\t', cp: 0x09 };
      case 'n': return { text: '\\n', cp: 0x0a };
      case 'r': return { text: '\\r', cp: 0x0d };
      case 'f': return { text: '\\f', cp: 0x0c };
      case 'a': return { text: '\\x07', cp: 0x07 };
      case 'e': return { text: '\\x1B', cp: 0x1b };
      case 'x': {
        if (body[pos] === '{') return reject('\\x{...}');
        const cp = hexAt(2);
        if (cp === undefined) return { text: '\\x' }; // malformed: a SyntaxError
        pos += 2;
        return { text: `\\x${body.slice(pos - 2, pos)}`, cp };
      }
      case 'u': {
        const cp = hexAt(4);
        if (cp === undefined) return { text: '\\u' }; // malformed (Java has no \u{...}): a SyntaxError
        pos += 4;
        return { text: `\\u${body.slice(pos - 4, pos)}`, cp };
      }
      case 'k': {
        if (inClass) return reject('\\k inside a class');
        if (asciiCase) return reject('a backreference under ASCII (?i)');
        const m = /^<[A-Za-z][A-Za-z0-9]*>/.exec(body.slice(pos));
        if (m === null) return { text: '\\k' };
        pos += m[0].length;
        return { text: `\\k${m[0]}` };
      }
      case '0': return reject('octal escape');
      default: break;
    }
    if (e >= '1' && e <= '9') {
      if (inClass) return reject('a backreference inside a class');
      if (asciiCase) return reject('a backreference under ASCII (?i)');
      return { text: `\\${e}` };
    }
    if (/[A-Za-z]/.test(e)) {
      if (JAVA_ONLY_ESCAPES.includes(e)) return reject(`\\${e}`);
      return { text: `\\${e}` }; // not an escape in Java either: a SyntaxError
    }
    // Java lets a backslash precede any non-alphabetic character; u-mode JS only a SyntaxCharacter, `/` and (in a class) `-`.
    const cp = body.codePointAt(pos - 1) ?? 0;
    const ch = String.fromCodePoint(cp);
    pos += ch.length - 1;
    return SYNTAX_CHARS.includes(ch) || (inClass && ch === '-') ? { text: `\\${ch}`, cp } : { text: ch, cp };
  };

  const literal = (): Atom => {
    const cp = body.codePointAt(pos) ?? 0;
    const ch = String.fromCodePoint(cp);
    pos += ch.length;
    return { text: ch, cp };
  };

  /** A class `[...]` at `body[pos]`; ASCII case partners of its letters are appended under ASCII (?i). */
  const charClass = (): string => {
    pos += 1;
    let text = '[';
    if (body[pos] === '^') { text += '^'; pos += 1; }
    if (body[pos] === ']') return reject('] first in a class');
    const partners: string[] = [];
    const addPartners = (lo: number, hi: number): void => {
      for (const [from, to, shift] of [[0x61, 0x7a, -32], [0x41, 0x5a, 32]] as const) {
        const a = Math.max(lo, from);
        const b = Math.min(hi, to);
        if (a <= b) partners.push(a === b ? String.fromCharCode(a + shift) : `${String.fromCharCode(a + shift)}-${String.fromCharCode(b + shift)}`);
      }
    };
    while (pos < n) {
      const ch = body[pos];
      if (ch === ']') { pos += 1; return `${text}${partners.join('')}]`; }
      if (ch === '[') return reject('a nested class');
      if (ch === '&' && body[pos + 1] === '&') return reject('class intersection &&');
      const lo = ch === '\\' ? escape(true) : literal();
      if (lo.cp !== undefined && body[pos] === '-' && pos + 1 < n && body[pos + 1] !== ']') {
        pos += 1;
        if (body[pos] === '[') return reject('a nested class');
        const hi = body[pos] === '\\' ? escape(true) : literal();
        text += `${lo.text}-${hi.text}`;
        if (asciiCase && hi.cp !== undefined) addPartners(lo.cp, hi.cp);
        continue;
      }
      text += lo.text;
      if (asciiCase && lo.cp !== undefined) addPartners(lo.cp, lo.cp);
    }
    return text; // unterminated: a SyntaxError
  };

  /** After a quantifier: a lazy `?` is kept, a possessive `+` rejected. */
  const quantifierSuffix = (): string => {
    if (body[pos] === '+') return reject('possessive quantifier');
    if (body[pos] === '?') { pos += 1; return '?'; }
    return '';
  };

  let out = '';
  while (pos < n) {
    const ch = body[pos];
    if (ch === '\\') { out += caseChar(escape(false)); continue; }
    if (ch === '[') { out += charClass(); continue; }
    if (ch === '(' && body[pos + 1] === '?') {
      const m = /^(?::|=|!|<=|<!|<[A-Za-z][A-Za-z0-9]*>)/.exec(body.slice(pos + 2));
      if (m === null) return reject(body[pos + 2] === '>' ? 'atomic group' : 'inline flags or group construct');
      out += `(?${m[0]}`;
      pos += 2 + m[0].length;
      continue;
    }
    if (ch === '*' || ch === '+' || ch === '?') { pos += 1; out += ch + quantifierSuffix(); continue; }
    if (ch === '{') {
      const m = /^\{\d+(?:,\d*)?\}/.exec(body.slice(pos));
      pos += m === null ? 1 : m[0].length;
      out += m === null ? '{' : m[0] + quantifierSuffix(); // a lone `{` is a SyntaxError, as in Java
      continue;
    }
    if (ch === '}' || ch === ']') { pos += 1; out += `\\${ch}`; continue; } // literal in Java
    if (ch === '.') { pos += 1; out += f.s ? '.' : JAVA_DOT; continue; }
    out += caseChar(literal());
  }
  return out;
}

/**
 * Java `Pattern.matches` semantics: the whole string must match. Leading inline flags `(?i)`, `(?s)`, `(?m)`, `(?u)`
 * are read; the body is translated to a JS `u`-mode pattern (so `.` is one code point) with Java's meaning of `.`,
 * `\s`, ASCII `(?i)` and identity escapes. Java-only syntax (possessive quantifiers, atomic groups, `\p{..}`, `\h`,
 * `\R`, `\x{..}`, `\Q..\E`, `\A`/`\Z`/`\z`, class union and intersection, inline flags elsewhere) is rejected.
 */
export function javaRegex(pattern: string): RegExp {
  const hit = regexCache.get(pattern);
  if (hit !== undefined) return hit;
  let body = pattern;
  const f: JavaFlags = { i: false, m: false, s: false, u: false };
  for (;;) {
    const m = /^\(\?([imsu]+)\)/.exec(body);
    if (m === null) break;
    for (const ch of m[1] ?? '') f[ch as keyof JavaFlags] = true;
    body = body.slice(m[0].length);
  }
  const source = translateJavaRegex(pattern, body, f);
  const flags = `u${f.s ? 's' : ''}${f.m ? 'm' : ''}${f.i && f.u ? 'i' : ''}`;
  // (?m) makes ^ and $ inside the pattern line anchors; the whole-input requirement must not become one.
  const anchored = f.m ? `(?<![\\s\\S])(?:${source})(?![\\s\\S])` : `^(?:${source})$`;
  let re: RegExp;
  try {
    re = new RegExp(anchored, flags);
  } catch (e) {
    throw new CypherRuntimeError(`Invalid Regex: ${e instanceof Error ? e.message : String(e)}`, 'Neo.ClientError.Statement.ArgumentError');
  }
  regexCache.set(pattern, re);
  return re;
}
