import type { CriticVerdict } from './types.js';

/**
 * Parse a raw LLM response string into a CriticVerdict.
 * Returns null if parsing fails.
 */
export function parseVerdict(raw: string): CriticVerdict | null {
  try {
    // Try to extract JSON from the response (LLM may include markdown fences)
    const jsonStr = extractJSON(raw);
    if (!jsonStr) return null;

    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    const pass = typeof parsed['pass'] === 'boolean' ? parsed['pass'] : null;
    if (pass === null) return null;

    const confidence = clampConfidence(Number(parsed['confidence'] ?? 0.5));
    const reasoning = String(parsed['reasoning'] ?? '');
    const evidence = Array.isArray(parsed['evidence'])
      ? (parsed['evidence'] as unknown[]).map(String)
      : [];
    const violations = Array.isArray(parsed['violations'])
      ? (parsed['violations'] as Record<string, unknown>[]).map((v) => ({
        filePath: String(v['filePath'] ?? 'unknown'),
        message: String(v['message'] ?? ''),
      }))
      : [];

    return { pass, confidence, reasoning, evidence, violations };
  } catch {
    return null;
  }
}

function extractJSON(raw: string): string | null {
  // Try raw string as JSON
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) return trimmed;

  // Try to extract from markdown code block
  const match = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (match?.[1]) return match[1].trim();

  // Try to find first { to last }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);

  return null;
}

function clampConfidence(value: number): number {
  if (Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}
