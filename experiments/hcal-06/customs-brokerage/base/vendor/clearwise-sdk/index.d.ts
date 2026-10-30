export type EntryStatus = 'FILED' | 'RELEASED' | 'EXAM_HOLD' | 'DOCS_REQUIRED' | 'REJECTED';
export type ReviewQueue = 'Q_INTAKE' | 'Q_SCREENING' | 'Q_CLASSIFICATION' | 'Q_VALUATION' | 'Q_BROKER_SIGNOFF' | 'Q_TRANSMITTED';
export type ClearwiseErrorCode = 'HTS_INVALID' | 'BOND_INSUFFICIENT' | 'RATE_LIMITED' | 'PORT_CLOSED';

export interface EntryFilingRequest {
  importer_of_record: string;
  hts_code: string;
  declared_value_usd: number;
  country_of_origin: string;
  port_of_entry: string;
}

export interface EntryFilingResponse {
  entry_number: string;
  entry_status: EntryStatus;
  review_queue: ReviewQueue;
  duty_amount_usd: number;
  liquidation_date: string | null;
}

export class ClearwiseError extends Error {
  code: ClearwiseErrorCode;
}

export class ClearwiseClient {
  constructor(options: { api_key: string });
  fileEntry(request: EntryFilingRequest): Promise<EntryFilingResponse>;
  getEntry(entry_number: string): Promise<EntryFilingResponse>;
}
