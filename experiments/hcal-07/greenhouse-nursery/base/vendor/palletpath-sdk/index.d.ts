export type ConsignmentStatus = 'BOOKED' | 'COLLECTED' | 'AT_HUB' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURNED';
export type RejectCode = 'RJ_OVERWEIGHT' | 'RJ_POSTCODE_UNSERVED' | 'RJ_LIVE_PLANTS_EMBARGO' | 'RJ_NO_COLLECTION_SLOT';

export interface ConsignmentRequest {
  sender_account: string;
  consignee_postcode: string;
  pallet_count: number;
  gross_weight_kg: number;
  collection_date: string;
}

export interface ConsignmentResponse {
  consignment_no: string;
  consignment_status: ConsignmentStatus;
  delivery_depot: string | null;
  pod_signature: string | null;
}

export class PalletPathRejection extends Error {
  reject_code: RejectCode;
}

export class PalletPathOutage extends Error {}

export class PalletPathClient {
  constructor(options: { account_token: string });
  book(request: ConsignmentRequest): Promise<ConsignmentResponse>;
  track(consignment_no: string): Promise<ConsignmentResponse>;
}
