import { Controller } from '@nestjs/common';
import { BillingService } from './billing.service';

// clean (controller-bypasses-application).
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}
  bill(id: string): string {
    return this.billing.bill(id);
  }
}
