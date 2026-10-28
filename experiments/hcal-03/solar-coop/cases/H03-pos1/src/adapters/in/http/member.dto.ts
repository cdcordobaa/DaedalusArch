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
}

export interface IssuedCreditsResponseDto {
  issued: number;
  provider: string;
}

export interface ErrorResponseDto {
  message: string;
}
