import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('enrolments')
export class EnrolmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  courseId!: string;

  @Column()
  studentEmail!: string;

  @Column()
  enrolledAt!: Date;
}
