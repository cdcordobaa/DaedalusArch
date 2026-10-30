export interface JobEventDto {
  job_id: string;
  job_status: string;
  carrier_tracking_id: string | null;
}
