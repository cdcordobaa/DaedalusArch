export interface SchedulePilotageParamsDto {
  jobId: string;
  notes?: string;
}

export interface SchedulePilotageResponseDto {
  jobId: string;
  status: string;
  fee: string | null;
}
