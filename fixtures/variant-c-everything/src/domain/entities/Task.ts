// VIOLATIONS: imports @nestjs/common AND express in domain layer
import { Injectable } from '@nestjs/common';
import * as express from 'express';

@Injectable()
export class Task {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly description: string,
    public readonly completed: boolean,
    public readonly categoryId: string,
    public readonly createdAt: Date
  ) {}

  complete(): Task {
    return new Task(this.id, this.title, this.description, true, this.categoryId, this.createdAt);
  }

  isValid(): boolean {
    return this.title.length > 0;
  }
}
