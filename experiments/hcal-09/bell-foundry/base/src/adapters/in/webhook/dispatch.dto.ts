export interface DispatchNoticeDto {
  heat_number: string;
  dispatch_state: string;
  carrier: string;
  comment: string | null;
  assay_cert_url: string | null;
}
