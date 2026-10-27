export interface EstimateBillQuery {
  readonly meterId: string;
  readonly days: number;
}

export interface EstimateBillResult {
  readonly projectedKwh: number;
  readonly cents: number;
  readonly currency: string;
  readonly level: "normal" | "high";
}

export interface EstimateBillPort {
  execute(query: EstimateBillQuery): Promise<EstimateBillResult>;
}
