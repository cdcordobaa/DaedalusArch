import { Db } from '../infrastructure/Db.js';

export class OrderPolicy {
  constructor(private readonly db: Db) {}
  allowed(): boolean {
    return this.db.ready;
  }
}
