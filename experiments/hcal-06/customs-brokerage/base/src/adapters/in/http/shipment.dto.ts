export interface FileEntryParamsDto {
  shipmentId: string;
}

export interface FileEntryResponseDto {
  shipmentId: string;
  clearance: string;
  entryNumber: string | null;
  dutyCents: number;
}
