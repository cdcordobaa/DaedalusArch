export interface SchedulePilotageParamsDto {
  jobId: string;
}

export interface SchedulePilotageResponseDto {
  jobId: string;
  status: string;
  fee: string | null;
}
