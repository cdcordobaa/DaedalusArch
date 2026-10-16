import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('reservations')
export class ReservationRecord {
  @PrimaryColumn()
  id!: string;

  @Column()
  spotCode!: string;

  @Column()
  plate!: string;

  @Column()
  from!: Date;

  @Column()
  hours!: number;

  @Column()
  cancelled!: boolean;
}
