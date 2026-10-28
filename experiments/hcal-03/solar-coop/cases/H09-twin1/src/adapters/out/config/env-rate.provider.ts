import { RateProvider } from '../../../application/ports/out/rate-provider.port';
import { RATE_CENTS_PER_KWH } from '../../../domain/credit-calculator';

export class EnvRateProvider implements RateProvider {
  async centsPerKwh(): Promise<number> {
    return Number(process.env.COOP_RATE_CENTS ?? RATE_CENTS_PER_KWH);
  }
}
