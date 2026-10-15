export class Invoice {
  constructor(
    readonly id: string,
    readonly createdAt: Date,
    readonly total: number,
    readonly dueDate: Date,
  ) {}

  isOverdue(today: Date): boolean {
    return today.getTime() > this.dueDate.getTime();
  }
}
