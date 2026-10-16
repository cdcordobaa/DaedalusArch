import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';

// clean (nest-provider-multiple-modules): OrdersService is provided once and exported.
@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
