import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('orders')
export class OrderRecord {
  @PrimaryColumn()
  id!: string;

  @Column()
  customerId!: string;

  @Column('int')
  totalCents!: number;
}
