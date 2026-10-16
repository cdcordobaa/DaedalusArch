import { Injectable } from '@nestjs/common';

@Injectable()
export class OrdersRepository {
  find(id: string): string {
    return id;
  }
}
