export interface DonationRequestDto {
  donorEmail: string;
  amountCents: number;
  currency: string;
}
export interface DonationResponseDto {
  id?: string;
  error?: string;
}
