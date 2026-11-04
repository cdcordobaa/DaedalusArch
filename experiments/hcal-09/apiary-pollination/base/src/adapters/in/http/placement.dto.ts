export interface PrepareDeliveryParamsDto {
  placementId: string;
}

export interface PlacementResponseDto {
  placementId: string;
  status: string;
  hives: number;
  requestId: string;
}
