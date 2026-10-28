export interface SubmitCaseRequestDto {
  caseId: string;
  dentistId: string;
  product: 'crown' | 'aligner';
  teeth: number[];
  scanBase64: string;
}

export interface SubmitCaseResponseDto {
  caseId: string;
  status: string;
  amountCents: number | null;
}
