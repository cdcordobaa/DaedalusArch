export interface FileEntryParamsDto {
  shipmentId: string;
}

export interface FileEntryResponseDto {
  shipmentId: string;
  clearance: string;
  clearanceLabel: string;
  entryNumber: string | null;
  dutyCents: number;
}
