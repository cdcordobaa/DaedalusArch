import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderEntity } from './order.entity';
import { OrderService } from './order.service';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(@Body() dto: CreateOrderDto): Promise<OrderEntity> {
    return this.orderService.create(dto.customerId, dto.quantity, dto.unitPrice);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<OrderEntity> {
    return this.orderService.findOne(id);
  }
}
