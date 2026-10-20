/**
 * Which ADR-018 listing failures a dedicated, signed-in Claude config dir may carry (pure; entry names and reasons only).
 * The CLI recreates `plugins/` and `skills/` and syncs the account's skills and plugins into `plugins/synced/**` and
 * `skills/synced/**` at every start (2026-10-19); it also writes `state/**` and the `tui` settings key. Those are
 * tolerated ONLY because every session that uses such a dir disables customizations: BF-01 runs with
 * --disable-slash-commands plus a run-time init check (`initExtensionViolations`), and the loop's generator runs with
 * `--safe-mode` (CLAUDE.md, skills, installed plugins, hooks, MCP servers and custom commands disabled;
 * `scripts/lib/generators/argv.ts`). Any CLAUDE.md or MCP config file, history, project transcripts and every other
 * entry still fail.
 */
export const RESEARCH_CLI_SETTINGS_KEYS: readonly string[] = ['tui'];

export function researchListingFailures(failures: readonly { readonly entry: string; readonly reason: string }[]): { entry: string; reason: string }[] {
  const synced = (e: string): boolean => /^(plugins|skills)\/synced(\/|$)/.test(e);
  const under = (dir: string): boolean => failures.some((f) => f.entry.startsWith(`${dir}/`) && !synced(f.entry));
  const allowed = (f: { entry: string; reason: string }): boolean => {
    if ((f.entry === 'plugins' || f.entry === 'skills') && !under(f.entry)) return true;
    // The CLI syncs the account's skills and plugins here at every start (2026-10-19). Tolerated because every session
    // runs with --disable-slash-commands and initExtensionViolations() fails any session whose init shows one loaded.
    if (synced(f.entry)) return !/(^|\/)CLAUDE\.md$|(^|\/)\.?mcp(_config|-config)?\.json$/i.test(f.entry);
    if (f.entry === 'state' || f.entry.startsWith('state/')) return !/(^|\/)CLAUDE\.md$|(^|\/)\.?mcp(_config|-config)?\.json$/i.test(f.entry);
    const keys = /^settings\.json has disallowed keys: (.+)$/.exec(f.reason);
    if (f.entry === 'settings.json' && keys !== null) return (keys[1] ?? '').split(/,\s*/).every((k) => RESEARCH_CLI_SETTINGS_KEYS.includes(k.trim()));
    return false;
  };
  return failures.filter((f) => !allowed(f)).map((f) => ({ entry: f.entry, reason: f.reason }));
}
