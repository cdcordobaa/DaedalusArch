export type JobStatus = 'RECEIVED' | 'PREFLIGHT' | 'PRINTING' | 'BINDING' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type PreflightError = 'ERR_LOW_DPI' | 'ERR_BLEED_MISSING' | 'ERR_FONT_NOT_EMBEDDED' | 'ERR_COLOR_PROFILE';
export type PaperStock = 'PH_MATTE_100' | 'PH_GLOSS_130' | 'PH_UNCOATED_90';
export type PrintHubErrorCode = 'ERR_QUOTA' | 'ERR_AUTH' | 'ERR_UNAVAILABLE';

export interface PrintJobRequest {
  sku_code: string;
  page_count: number;
  paper_stock: PaperStock;
  copies: number;
  ship_to_postcode: string;
}

export interface PrintJobResponse {
  job_id: string;
  job_status: JobStatus;
  preflight_errors: PreflightError[];
  carrier_tracking_id: string | null;
  estimated_ship_date: string;
  unit_cost_cents: number;
}

export class PrintHubError extends Error {
  code: PrintHubErrorCode;
}

export class PrintHubClient {
  constructor(options: { api_key: string });
  submit(request: PrintJobRequest): Promise<PrintJobResponse>;
  status(job_id: string): Promise<PrintJobResponse>;
}
