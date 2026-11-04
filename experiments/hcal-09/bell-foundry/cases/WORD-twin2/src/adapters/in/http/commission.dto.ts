export interface OrderMetalParamsDto {
  commissionId: string;
  comment?: string;
}

export interface TuningParamsDto {
  commissionId: string;
  centsOff: number;
}

export interface CommissionResponseDto {
  commissionId: string;
  status: string;
}
