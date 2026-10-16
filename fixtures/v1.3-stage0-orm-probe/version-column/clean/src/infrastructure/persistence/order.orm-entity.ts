import { Column, Entity, PrimaryColumn, VersionColumn } from 'typeorm';

@Entity('orders')
export class OrderRecord {
  @PrimaryColumn()
  id!: string;

  @Column()
  customerId!: string;

  @Column('int')
  totalCents!: number;

  @VersionColumn()
  version!: number;
}
