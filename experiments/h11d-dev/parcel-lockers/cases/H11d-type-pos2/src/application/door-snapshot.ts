// The use case keeps a snapshot that copies the lockbox door report's field names.
export interface DoorSnapshot {
  readonly door_state: string;
  readonly opened_at: string;
  readonly battery_pct: number;
}
