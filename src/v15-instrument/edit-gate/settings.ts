/**
 * Edit-gate hook settings (v1.5; promoted from `experiments/edit-gate/settings.ts`). The harness-bound
 * `editGateArgs` stays in the experiment, since it needs the generator argv of `scripts/lib/`. The frozen argv
 * carries customizations off: `--setting-sources ""`, `--settings {"autoMemoryEnabled":false,"disableAllHooks":true}`
 * and `--disable-slash-commands`. This arm differs in one value only: its `--settings` JSON turns hooks on and names
 * the gate's two hooks (PostToolUse on Edit|Write|MultiEdit, and Stop), each running the relay. `--setting-sources ""`
 * stays, so a `.claude/settings.json` the agent writes in its tree is ignored. Recorded as an exploratory difference
 * from the baseline's customizations-off flags (README).
 */

export interface GateRelay {
  /** Node binary the relay runs on (readable and executable by the generator). */
  readonly nodeBinary: string;
  /** `<harnessRoot>/bin/gate-relay.cjs` (root-owned, 0755, no puzzle text). */
  readonly relay: string;
  /** The hub's socket (in a 0755 directory; the socket 0666). */
  readonly socket: string;
}

export const GATE_MATCHER = 'Edit|Write|MultiEdit';
/** Hook timeout in seconds (note §3); the relay itself gives up after 8 s and prints nothing. */
export const GATE_HOOK_TIMEOUT_S = 10;

const shq = (s: string): string => (/^[A-Za-z0-9_./:=@-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);

export function relayCommand(r: GateRelay): string {
  return [r.nodeBinary, r.relay, r.socket].map(shq).join(' ');
}

/** The arm's `--settings` value. */
export function gateSettings(r: GateRelay): Record<string, unknown> {
  const hook = { type: 'command', command: relayCommand(r), timeout: GATE_HOOK_TIMEOUT_S };
  return {
    autoMemoryEnabled: false,
    disableAllHooks: false,
    hooks: {
      PostToolUse: [{ matcher: GATE_MATCHER, hooks: [hook] }],
      Stop: [{ hooks: [hook] }],
    },
  };
}

export function gateSettingsJson(r: GateRelay): string {
  return JSON.stringify(gateSettings(r));
}

/** The frozen argv with the `--settings` value replaced by the arm's (exactly one value changes). */
export function withGateSettings(frozen: readonly string[], r: GateRelay): readonly string[] {
  const i = frozen.indexOf('--settings');
  if (i < 0 || i + 1 >= frozen.length) throw new Error('frozen argv has no --settings value');
  const prev = JSON.parse(frozen[i + 1] as string) as Record<string, unknown>;
  if (prev.disableAllHooks !== true) throw new Error('frozen --settings no longer sets disableAllHooks: refusing to guess');
  const out = [...frozen];
  out[i + 1] = gateSettingsJson(r);
  return Object.freeze(out);
}
