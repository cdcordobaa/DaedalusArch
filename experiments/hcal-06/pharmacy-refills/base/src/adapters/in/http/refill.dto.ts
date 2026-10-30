export interface RequestRefillParamsDto {
  refillId: string;
}

export interface RequestRefillResponseDto {
  refillId: string;
  status: string;
  copay: string;
}
