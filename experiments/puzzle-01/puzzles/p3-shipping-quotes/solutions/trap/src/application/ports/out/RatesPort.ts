import type { FastshipRateRequest, FastshipRateResponse } from 'fastship-sdk';

export interface RatesPort {
  rates(request: FastshipRateRequest): Promise<FastshipRateResponse>;
}
