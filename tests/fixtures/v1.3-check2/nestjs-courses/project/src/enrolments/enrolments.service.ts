import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainError } from '../domain/domain-error';
import { Enrolment } from '../domain/enrolment';
import { toCourse } from '../courses/courses.service';
import { CourseEntity } from '../persistence/entities/course.entity';
import { EnrolmentEntity } from '../persistence/entities/enrolment.entity';

@Injectable()
export class EnrolmentsService {
  constructor(
    @InjectRepository(EnrolmentEntity)
    private readonly enrolmentRepository: Repository<EnrolmentEntity>,
    @InjectRepository(CourseEntity)
    private readonly courseRepository: Repository<CourseEntity>,
  ) {}

  async enrol(courseId: string, studentEmail: string): Promise<Enrolment> {
    if (!studentEmail.includes('@')) {
      throw new DomainError('invalid', 'A valid student email is required');
    }
    const entity = await this.courseRepository.findOne({ where: { id: courseId } });
    if (entity === null) throw new DomainError('missing', `Course ${courseId} not found`);
    const existing = await this.enrolmentRepository.count({ where: { courseId, studentEmail } });
    if (existing > 0) throw new DomainError('duplicate', `${studentEmail} is already enrolled`);
    const course = toCourse(entity);
    course.admit();
    entity.enrolled = course.enrolled;
    await this.courseRepository.save(entity);
    const enrolment = new Enrolment(courseId, studentEmail, new Date());
    await this.enrolmentRepository.save(this.enrolmentRepository.create({ ...enrolment }));
    return enrolment;
  }

  async withdraw(courseId: string, studentEmail: string): Promise<boolean> {
    const row = await this.enrolmentRepository.findOne({ where: { courseId, studentEmail } });
    if (row === null) throw new DomainError('missing', `${studentEmail} is not enrolled`);
    const enrolment = new Enrolment(row.courseId, row.studentEmail, row.enrolledAt);
    await this.enrolmentRepository.delete({ id: row.id });
    return enrolment.withinCoolingOff(new Date());
  }
}
