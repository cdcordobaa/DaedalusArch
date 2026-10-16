import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { FormatterService } from '../shared/formatter.service';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { InvoiceService } from './invoice.service';

@Module({
  imports: [OrdersModule],
  controllers: [BillingController],
  // violating (nest-provider-multiple-modules): FormatterService is also registered in ReportsModule.
  providers: [BillingService, InvoiceService, FormatterService],
})
export class BillingModule {}
