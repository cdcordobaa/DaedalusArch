import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  customerId!: string;

  @Column('int')
  totalCents!: number;

  static create(id: string, customerId: string, totalCents: number): Order {
    if (totalCents < 0) throw new Error('total must be non-negative');
    const order = new Order();
    order.id = id;
    order.customerId = customerId;
    order.totalCents = totalCents;
    return order;
  }

  isLarge(): boolean {
    return this.totalCents >= 100_000;
  }
}
