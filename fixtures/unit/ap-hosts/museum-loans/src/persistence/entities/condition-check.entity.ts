import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('condition_checks')
export class ConditionCheckRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'artwork_id' })
  artworkId!: string;

  @Column()
  grade!: string;

  @Column()
  inspector!: string;

  @Column({ type: 'text' })
  notes!: string;

  @CreateDateColumn({ name: 'checked_at' })
  checkedAt!: Date;
}
