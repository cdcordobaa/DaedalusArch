export interface SubscribeSharesRequestDto {
  memberId: string;
  shares: number;
}

export interface SubscriptionResponseDto {
  id: string;
  memberId: string;
  shares: number;
}

export interface StatementResponseDto {
  memberName: string;
  shares: number;
  totalCreditsCents: number;
  creditCount: number;
  totalCredits: string;
}

export interface IssuedCreditsResponseDto {
  issued: number;
}

export interface ErrorResponseDto {
  message: string;
}
