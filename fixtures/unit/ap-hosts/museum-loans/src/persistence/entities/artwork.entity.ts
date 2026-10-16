import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('artworks')
export class ArtworkRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'accession_number', unique: true })
  accessionNumber!: string;

  @Column()
  title!: string;

  @Column()
  artist!: string;

  @Column({ nullable: true })
  year!: number;

  @Column()
  medium!: string;

  @Column({ name: 'condition_grade' })
  conditionGrade!: string;

  @Column()
  location!: string;
}
