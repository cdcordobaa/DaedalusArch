export type LockerStatusCode = 'OK' | 'LOW' | 'SVC';

export class LockerReading {
  constructor(
    readonly lockerId: string,
    readonly statusCode: LockerStatusCode,
    readonly readAt: Date,
  ) {}

  needsService(): boolean {
    return this.statusCode !== 'OK';
  }
}
