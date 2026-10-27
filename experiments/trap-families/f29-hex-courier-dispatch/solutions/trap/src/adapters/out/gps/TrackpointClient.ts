/**
 * Client for Trackpoint's fleet GPS API (every rider's tracker reports to Trackpoint). The token is read from
 * TRACKPOINT_TOKEN. This build has no network access and talks to Trackpoint's sandbox feed, which the sandbox
 * publishes on globalThis.__trackpointSandbox (tracker id -> fixes).
 */

/** Trackpoint's wire format: coordinates in units of 1e-7 degrees, fix time in epoch milliseconds. */
export interface TrackpointFix {
  readonly device: string;
  readonly latE7: number;
  readonly lonE7: number;
  readonly fixedAtMs: number;
  readonly hdopCm: number;
}

type SandboxFeed = Record<string, readonly TrackpointFix[]>;

export class TrackpointClient {
  private readonly token: string;

  constructor(token: string = process.env.TRACKPOINT_TOKEN ?? '') {
    this.token = token;
  }

  /** Every fix Trackpoint holds for a tracker, oldest first. */
  async history(device: string): Promise<TrackpointFix[]> {
    if (this.token === '') throw new Error('Trackpoint: 401 (no token)');
    const feed = (globalThis as { __trackpointSandbox?: SandboxFeed }).__trackpointSandbox ?? {};
    return [...(feed[device] ?? [])].sort((a, b) => a.fixedAtMs - b.fixedAtMs);
  }

  /** The tracker's most recent fix, or null when Trackpoint has none. */
  async lastFix(device: string): Promise<TrackpointFix | null> {
    const fixes = await this.history(device);
    return fixes.at(-1) ?? null;
  }
}
