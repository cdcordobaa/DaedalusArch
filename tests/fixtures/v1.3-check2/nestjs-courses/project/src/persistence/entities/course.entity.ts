import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('courses')
export class CourseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column()
  capacity!: number;

  @Column()
  enrolled!: number;

  @Column()
  published!: boolean;
}
