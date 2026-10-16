import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('invoices')
export class InvoiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  orderId!: string;

  @Column()
  amount!: number;
}
