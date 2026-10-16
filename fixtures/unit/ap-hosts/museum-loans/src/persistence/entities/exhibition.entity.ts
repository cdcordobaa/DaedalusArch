import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('exhibitions')
export class ExhibitionRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column({ name: 'gallery_code' })
  galleryCode!: string;

  @Column({ name: 'opens_on', type: 'date' })
  opensOn!: string;

  @Column({ name: 'closes_on', type: 'date' })
  closesOn!: string;

  @Column()
  capacity!: number;

  @Column({ default: 'planned' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
