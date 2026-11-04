export interface OrderMetalParamsDto {
  commissionId: string;
}

export interface TuningParamsDto {
  commissionId: string;
  centsOff: number;
}

export interface CommissionResponseDto {
  commissionId: string;
  status: string;
}
