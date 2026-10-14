import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  customerId!: string;

  @Column()
  quantity!: number;

  @Column()
  total!: number;
}
