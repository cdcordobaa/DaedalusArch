import { DomainError } from './domain-error';

export class Course {
  id: string;
  title: string;
  capacity: number;
  enrolled: number;
  published: boolean;

  constructor(id: string, title: string, capacity: number, enrolled: number, published: boolean) {
    this.id = id;
    this.title = title;
    this.capacity = capacity;
    this.enrolled = enrolled;
    this.published = published;
  }

  admit(): void {
    if (!this.published) throw new DomainError('invalid', `${this.title} is not open for enrolment`);
    if (this.enrolled >= this.capacity) throw new DomainError('full', `${this.title} is full`);
    this.enrolled += 1;
  }

  release(): void {
    this.enrolled = Math.max(0, this.enrolled - 1);
  }
}
