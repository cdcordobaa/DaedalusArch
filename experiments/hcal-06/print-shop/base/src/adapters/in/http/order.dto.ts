export interface SendToPrintParamsDto {
  orderId: string;
}

export interface SendToPrintResponseDto {
  orderId: string;
  status: string;
  artworkProblems: string[];
}
