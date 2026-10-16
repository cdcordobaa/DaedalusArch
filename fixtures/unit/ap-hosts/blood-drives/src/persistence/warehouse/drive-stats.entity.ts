import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One row per closed drive in the regional blood service's Postgres warehouse, which the planning team queries
 * for stock forecasts. Operational data stays in MongoDB.
 */
@Entity('drive_stats')
export class DriveStatsRow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'drive_id', unique: true })
  driveId!: string;

  @Column()
  region!: string;

  @Column({ name: 'drive_date', type: 'date' })
  driveDate!: string;

  @Column({ name: 'booked' })
  booked!: number;

  @Column({ name: 'collected_units' })
  collectedUnits!: number;

  @Column({ name: 'deferred_donors' })
  deferredDonors!: number;

  @CreateDateColumn({ name: 'loaded_at' })
  loadedAt!: Date;
}
