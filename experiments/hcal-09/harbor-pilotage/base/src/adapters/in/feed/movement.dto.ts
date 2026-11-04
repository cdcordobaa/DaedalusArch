export interface MovementDto {
  imo_number: string;
  berth_window_ref: string;
  phase: string;
  squat: number;
  notes: string | null;
  reported_at_utc: string;
}
