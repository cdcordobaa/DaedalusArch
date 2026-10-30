export interface TrackingEventDto {
  consignment_no: string;
  consignment_status: string;
  pod_signature: string | null;
  event_time: string;
}
