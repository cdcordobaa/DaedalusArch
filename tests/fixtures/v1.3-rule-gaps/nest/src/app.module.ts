import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { BillingModule } from './billing/billing.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { ReportsModule } from './reports/reports.module';

@Module({ imports: [OrdersModule, BillingModule, ReportsModule, NotificationsModule, AuditModule] })
export class AppModule {}
