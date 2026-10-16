import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('lenders')
export class LenderRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ length: 2 })
  country!: string;

  @Column({ name: 'contact_email' })
  contactEmail!: string;

  @Column({ default: false })
  anonymous!: boolean;
}
