/**
 * ADR-016 b exclusions (Build and Test Step 31): FF-CV01 and FF-CV04 are `enabled: false` with a reason in every shipped
 * spec and preset since BT-E1. The U1 mechanism tests (layer-kind, style and binding rules, BR-U1-14..19, 43, 46) are
 * about the compiler, not about which checks a shipped spec enables, so they re-enable the two in memory and keep
 * covering those rules. Spec-content assertions live in the golden suite and in report-builder.test.ts.
 */
import type { ParsedSpec } from '../../../src/shared/types/spec.js';

export const ADR016B_DISABLED: readonly string[] = ['FF-CV01', 'FF-CV04'];

export function reenableAdr016b(spec: ParsedSpec): ParsedSpec {
  return {
    ...spec,
    fitnessFunctions: spec.fitnessFunctions.map((f) => {
      if (!ADR016B_DISABLED.includes(String(f.id))) return f;
      const { disabledReason: _r, ...rest } = f;
      return { ...rest, enabled: true };
    }),
  };
}
