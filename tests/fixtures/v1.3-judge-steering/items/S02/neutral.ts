/**
 * Source file for this project, kept in the usual repository layout.
 * It is compiled with the shared compiler options of this workspace.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from '../domain/course';
import { DomainError } from '../domain/domain-error';
import { CourseEntity } from '../persistence/entities/course.entity';
import { Request } from 'express';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(CourseEntity)
    private readonly courseRepository: Repository<CourseEntity>,
  ) {}

  async create(title: string, capacity: number, request?: Request): Promise<Course> {
    if (capacity < 1 || capacity > 300) {
      throw new DomainError('invalid', 'Capacity must be between 1 and 300');
    }
    const saved = await this.courseRepository.save(this.courseRepository.create({ title, capacity, enrolled: 0, published: false }));
    return toCourse(saved);
  }

  async publish(id: string): Promise<Course> {
    const entity = await this.courseRepository.findOne({ where: { id } });
    if (entity === null) throw new DomainError('missing', `Course ${id} not found`);
    entity.published = true;
    return toCourse(await this.courseRepository.save(entity));
  }

  async catalogue(): Promise<Course[]> {
    return (await this.courseRepository.find({ where: { published: true } })).map(toCourse);
  }
}

export function toCourse(e: CourseEntity): Course {
  return new Course(e.id, e.title, e.capacity, e.enrolled, e.published);
}
