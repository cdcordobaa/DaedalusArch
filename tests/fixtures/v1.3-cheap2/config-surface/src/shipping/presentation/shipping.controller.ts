import { ConfigService } from '@nestjs/config';

/** PLANTED P3: ConfigService.get in a controller. */
export class ShippingController {
  constructor(private readonly config: ConfigService) {}

  key(): string {
    return this.config.get<string>('CARRIER_API_KEY') ?? '';
  }
}
