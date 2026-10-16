import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('loans')
export class LoanRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'artwork_id' })
  artworkId!: string;

  @Column({ name: 'lender_id' })
  lenderId!: string;

  @Column({ name: 'starts_on', type: 'date' })
  startsOn!: string;

  @Column({ name: 'ends_on', type: 'date' })
  endsOn!: string;

  @Column({ name: 'insured_value', type: 'numeric' })
  insuredValue!: number;

  @Column({ length: 3 })
  currency!: string;

  @Column({ default: 'requested' })
  status!: string;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy!: string;

  @CreateDateColumn({ name: 'requested_at' })
  requestedAt!: Date;
}
