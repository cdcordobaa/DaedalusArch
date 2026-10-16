import { Module } from '@nestjs/common';
import { ProductsController } from './shop/presentation/products.controller';
import { OrdersController } from './shop/presentation/orders.controller';
import { InMemoryProductRepository } from './shop/infrastructure/in-memory-product.repository';
import { SystemClock } from './shop/infrastructure/clock';
import { PlaceOrder } from './shop/application/place-order';

/** NEAR-MISS N4: SystemClock is reached only through this provider list. */
@Module({ controllers: [ProductsController, OrdersController], providers: [InMemoryProductRepository, SystemClock, PlaceOrder] })
export class AppModule {}
