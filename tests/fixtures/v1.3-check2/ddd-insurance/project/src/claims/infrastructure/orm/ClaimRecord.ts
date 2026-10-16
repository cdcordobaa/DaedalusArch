import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('claims')
export class ClaimRecord {
  @PrimaryColumn()
  id!: string;

  @Column()
  policyNumber!: string;

  @Column()
  peril!: string;

  @Column()
  incidentOn!: Date;

  @Column()
  claimedCents!: number;

  @Column()
  status!: string;

  @Column()
  paidCents!: number;
}
