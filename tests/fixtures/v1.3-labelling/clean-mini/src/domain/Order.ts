import { Db } from '../infrastructure/Db.js';
import { Injectable } from '@nestjs/common';

@Injectable()
export class Order {
  constructor(readonly id: string) {}
  save(db: Db): void {
    db.write(this.id);
  }
}
