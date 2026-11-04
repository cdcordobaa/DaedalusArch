const LIVE_BY_STATE = new Map<string, boolean>([
  ['ACTIVE', true],
  ['PAUSED', false],
  ['ENDED', false],
]);

export interface SensorCover {
  readonly leaseRef: string;
  readonly state: string;
  readonly units: number;
}

export const isLive = (cover: SensorCover): boolean => LIVE_BY_STATE.get(cover.state) ?? false;
