export interface PilotLogEntry {
  readonly boarding_time_utc: string;
  readonly disembark_time_utc: string | null;
  readonly pilot_licence_no: string;
}

export function openLogEntry(licence: string, at: string): PilotLogEntry {
  return { boarding_time_utc: at, disembark_time_utc: null, pilot_licence_no: licence };
}
