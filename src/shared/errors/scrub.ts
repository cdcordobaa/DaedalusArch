/**
 * Secret scrubber (C10, NFR-05, NFR-08; later consumer FR-13).
 *
 * U0 ships the module only; no caller in `src/` routes text through it yet
 * (decision D-U0-6: U2 wires `Neo4jRepository` errors, U3 warnings/audit/report,
 * U4 cassettes and CLI stderr).
 *
 * Behaviour:
 * - every non-empty, non-whitespace known secret is removed by literal match
 *   (no regular expression is built from a secret); overlapping and adjacent
 *   matches are merged, so overlapping secrets are removed completely;
 * - credentialed `bolt|neo4j|neo4j+s|neo4j+ssc|http|https` URIs keep scheme and
 *   host (`scheme://user:pass@host` becomes `scheme://[REDACTED]@host`);
 * - `Bearer <token>`, `sk-ant-…`, `sk-…`, `AIza…` key shapes and
 *   `password=…`, `apiKey=…`, `api_key=…`, `token=…` values are redacted;
 * - existing `[REDACTED]` tokens are never rewritten, so scrubbing is idempotent.
 */
import type { DomainWarning } from './domain-result.js';

export const REDACTED = '[REDACTED]';

const CIRCULAR = '[Circular]';
const MAX_PASSES = 8;

interface PatternRule {
  readonly pattern: RegExp;
  readonly replacement: string;
}

/**
 * Applied to text that contains no `[REDACTED]` token. Order matters: URI
 * credentials first, then the specific key shapes before the generic `sk-`.
 */
const PATTERN_RULES: readonly PatternRule[] = [
  // scheme://user:pass@host → scheme://[REDACTED]@host (password may contain '@'; greedy up to the last '@' before '/')
  {
    pattern: /\b(bolt(?:\+ssc|\+s)?|neo4j(?:\+ssc|\+s)?|https?):\/\/[^\s/@:]+:[^\s/]+@/gi,
    replacement: `$1://${REDACTED}@`,
  },
  { pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]{8,}=*/gi, replacement: `Bearer ${REDACTED}` },
  { pattern: /\bsk-ant-[A-Za-z0-9_-]{8,}/g, replacement: REDACTED },
  { pattern: /\bsk-[A-Za-z0-9_-]{20,}/g, replacement: REDACTED },
  { pattern: /\bAIza[0-9A-Za-z_-]{30,}/g, replacement: REDACTED },
  // password=…, apiKey=…, api_key=…, token=… (also NEO4J_PASSWORD=…, GITHUB_TOKEN=…); quoted or bare value
  {
    pattern: /\b([A-Za-z0-9_]*(?:password|api_?key|token))=(?:"[^"]*"|'[^']*'|[^\s&,;"']+)/gi,
    replacement: `$1=${REDACTED}`,
  },
];

/** Half-open ranges `[start, end)` of every `[REDACTED]` token in `text`. */
function tokenRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  let at = text.indexOf(REDACTED);
  while (at !== -1) {
    ranges.push([at, at + REDACTED.length]);
    at = text.indexOf(REDACTED, at + REDACTED.length);
  }
  return ranges;
}

/** Literal known-secret removal; characters inside existing tokens are never masked. */
function redactKnownSecrets(text: string, secrets: readonly string[]): string {
  if (secrets.length === 0 || text.length === 0) {
    return text;
  }
  const insideToken = new Uint8Array(text.length);
  for (const [start, end] of tokenRanges(text)) {
    insideToken.fill(1, start, end);
  }
  const mask = new Uint8Array(text.length);
  let any = false;
  for (const secret of secrets) {
    let at = text.indexOf(secret);
    while (at !== -1) {
      for (let i = at; i < at + secret.length; i++) {
        if (insideToken[i] === 0) {
          mask[i] = 1;
          any = true;
        }
      }
      at = text.indexOf(secret, at + 1);
    }
  }
  if (!any) {
    return text;
  }
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (mask[i] === 1) {
      while (i < text.length && mask[i] === 1) {
        i++;
      }
      out += REDACTED;
    } else {
      out += text.charAt(i);
      i++;
    }
  }
  return out;
}

/** Pattern redaction on the text between existing tokens only. */
function redactPatterns(text: string): string {
  return text
    .split(REDACTED)
    .map((segment) =>
      PATTERN_RULES.reduce((acc, rule) => acc.replace(rule.pattern, rule.replacement), segment),
    )
    .join(REDACTED);
}

function normaliseSecrets(knownSecrets: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const secret of knownSecrets) {
    if (secret.trim().length > 0) {
      unique.add(secret);
    }
  }
  // Longest first (the merged mask makes the order irrelevant for the result; kept for clarity).
  return [...unique].sort((a, b) => b.length - a.length);
}

function scrubWith(text: string, secrets: readonly string[]): string {
  let current = text;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    // Shapes first, so a credentialed URI loses user and password together.
    const next = redactKnownSecrets(redactPatterns(current), secrets);
    if (next === current) {
      return next;
    }
    current = next;
  }
  return current;
}

/**
 * Returns `text` with every known secret and every recognised credential shape
 * replaced by `[REDACTED]`. Text without secrets is returned byte-identical.
 * Pass `[]` when there are no known secrets.
 */
export function scrubSecrets(text: string, knownSecrets: readonly string[]): string {
  return scrubWith(text, normaliseSecrets(knownSecrets));
}

/**
 * Returns a copy of `warning` with `message` and every string inside `context`
 * scrubbed; `code` and all other fields are kept as they are.
 */
export function scrubWarning<W extends DomainWarning>(warning: W, knownSecrets: readonly string[]): W {
  const secrets = normaliseSecrets(knownSecrets);
  return warningWith(warning, (text) => scrubWith(text, secrets));
}

function warningWith<W extends DomainWarning>(warning: W, scrubText: (text: string) => string): W {
  const copy: W = { ...warning, message: scrubText(warning.message) };
  if (warning.context !== undefined) {
    return { ...copy, context: deepCopy(warning.context, scrubText, new Set<object>()) };
  }
  return copy;
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

function deepCopy<T>(value: T, scrubText: (text: string) => string, ancestors: Set<object>): T {
  if (typeof value === 'string') {
    return scrubText(value) as T;
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  if (ancestors.has(value)) {
    return CIRCULAR as T;
  }
  if (Array.isArray(value)) {
    ancestors.add(value);
    const copy = value.map((item: unknown) => deepCopy(item, scrubText, ancestors));
    ancestors.delete(value);
    return copy as T;
  }
  if (!isPlainObject(value)) {
    // Dates, Maps, class instances and similar are returned as they are.
    return value;
  }
  ancestors.add(value);
  const copy: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    copy[key] = deepCopy(item, scrubText, ancestors);
  }
  ancestors.delete(value);
  return copy as T;
}

/**
 * Deep copy of `value` with every string scrubbed. Arrays and plain objects are
 * copied (the input is never mutated, frozen input is fine); other values are
 * returned unchanged; a reference back to an ancestor becomes `"[Circular]"`.
 */
export function scrubDeep<T>(value: T, knownSecrets: readonly string[]): T {
  const secrets = normaliseSecrets(knownSecrets);
  return deepCopy(value, (text) => scrubWith(text, secrets), new Set<object>());
}

// ── Neo4j connection secrets (BR-U2-39, S-1; moved here from neo4j-repository.ts at U3-R11, BR-U3-58) ──

/** The URI schemes this module recognises; never treated as a known secret (BR-U2-39). */
const SCHEME_TOKENS: ReadonlySet<string> = new Set([
  'bolt', 'bolt+s', 'bolt+ssc', 'neo4j', 'neo4j+s', 'neo4j+ssc', 'http', 'https',
]);

/** Minimum length of a known secret; shorter values would mask ordinary words (BR-U2-39). */
const MIN_SECRET_LENGTH = 8;

/** Port assumed when the URI names none (Bolt default). */
const DEFAULT_BOLT_PORT = '7687';

/** The connection values a run's secrets are derived from. */
export interface Neo4jSecretSource {
  readonly neo4jUri: string;
  readonly neo4jUser: string;
  readonly neo4jPassword: string;
}

/**
 * Known secrets (`[NEO4J_PASSWORD, NEO4J_URI, host:port]`, each kept only when at least 8 characters,
 * not the user and not a scheme token) and the resolved-address pattern for the URI's port (IPv4,
 * bracketed IPv6, bare `::1`), BR-U2-39 / BR-U3-58. The single definition used by the repository,
 * the report assembler, the audit log and batch error rows.
 */
export interface ScrubPolicy {
  readonly secrets: readonly string[];
  readonly addressPattern: RegExp;
}

/** `host:port` of the URI's authority when the URI carries an explicit port, else undefined. */
function explicitHostPort(uri: string): string | undefined {
  const authority = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/(?:[^@/?#]*@)?([^/?#]+)/.exec(uri)?.[1];
  if (authority === undefined) return undefined;
  return /^(?:\[[^\]]*\]|[^:]+):\d+$/.test(authority) ? authority : undefined;
}

function portOf(uri: string): string {
  return /:(\d+)$/.exec(explicitHostPort(uri) ?? '')?.[1] ?? DEFAULT_BOLT_PORT;
}

export function neo4jScrubPolicy(source: Neo4jSecretSource): ScrubPolicy {
  const hostPort = explicitHostPort(source.neo4jUri);
  const candidates = [source.neo4jPassword, source.neo4jUri, ...(hostPort !== undefined ? [hostPort] : [])];
  const secrets = candidates.filter((s) =>
    s.length >= MIN_SECRET_LENGTH && s !== source.neo4jUser && !SCHEME_TOKENS.has(s.toLowerCase()));
  const port = portOf(source.neo4jUri); // digits only, safe inside a pattern
  const addressPattern = new RegExp(
    `\\b\\d{1,3}(?:\\.\\d{1,3}){3}:${port}\\b|\\[[0-9A-Fa-f:.]+\\]:${port}\\b|(?<![0-9A-Fa-f:])::1:${port}\\b`,
    'g',
  );
  return { secrets, addressPattern };
}

/** NFR-05, D-U0-6: resolved addresses first, then known secrets and credential shapes (BR-U2-39). */
export function scrubWithPolicy(text: string, policy: ScrubPolicy): string {
  return scrubSecrets(text.replace(policy.addressPattern, REDACTED), policy.secrets);
}

/** `scrubWarning` under a `ScrubPolicy` (message and every string in `context`). */
export function scrubWarningWithPolicy<W extends DomainWarning>(warning: W, policy: ScrubPolicy): W {
  const secrets = normaliseSecrets(policy.secrets);
  return warningWith(warning, (text) => scrubWith(text.replace(policy.addressPattern, REDACTED), secrets));
}

/** `scrubDeep` under a `ScrubPolicy`. */
export function scrubDeepWithPolicy<T>(value: T, policy: ScrubPolicy): T {
  const secrets = normaliseSecrets(policy.secrets);
  return deepCopy(value, (text) => scrubWith(text.replace(policy.addressPattern, REDACTED), secrets), new Set<object>());
}

/** A policy that only applies the credential-shape patterns (no known secret, no address). */
export const SHAPES_ONLY: ScrubPolicy = { secrets: [], addressPattern: /(?!)/g };
