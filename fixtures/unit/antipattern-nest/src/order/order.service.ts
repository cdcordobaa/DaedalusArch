import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from './order.entity';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
  ) {}

  async create(customerId: string, quantity: number, unitPrice: number): Promise<OrderEntity> {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }
    const order = this.orderRepository.create({ customerId, quantity, total: quantity * unitPrice });
    return this.orderRepository.save(order);
  }

  async findOne(id: string): Promise<OrderEntity> {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (order === null) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }
}
