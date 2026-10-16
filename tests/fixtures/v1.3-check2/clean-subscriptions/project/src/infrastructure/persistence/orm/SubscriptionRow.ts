import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('subscriptions')
export class SubscriptionRow {
  @PrimaryColumn()
  id!: string;

  @Column()
  customerId!: string;

  @Column()
  planCode!: string;

  @Column()
  seats!: number;

  @Column()
  state!: string;
}
