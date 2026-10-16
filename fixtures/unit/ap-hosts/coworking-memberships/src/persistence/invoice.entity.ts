import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Invoices are written to the finance team's accounting database, which is mapped with TypeORM and shared with
 * their reconciliation service; membership data stays in the Prisma schema.
 */
@Entity('invoices')
export class InvoiceRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'member_id' })
  memberId!: string;

  @Column({ name: 'membership_id' })
  membershipId!: string;

  @Column()
  period!: string;

  @Column({ name: 'amount_cents' })
  amountCents!: number;

  @Column({ default: 'open' })
  status!: string;

  @Column({ name: 'payment_reference', nullable: true })
  paymentReference!: string;

  @CreateDateColumn({ name: 'issued_at' })
  issuedAt!: Date;
}
