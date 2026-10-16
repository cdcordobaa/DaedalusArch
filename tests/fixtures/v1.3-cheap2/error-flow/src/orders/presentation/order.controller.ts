import { NotFoundException } from '@nestjs/common';
import { OrderError } from '../domain/order-error';
import { OrderConfirmer } from '../application/order-confirmer';

export class OrderController {
  constructor(private readonly confirmer: OrderConfirmer) {}

  /** PLANTED P5: the domain error (through the OrderConfirmer port) only reaches a log call. */
  confirm(id: string): { ok: boolean } {
    try {
      this.confirmer.confirm(id);
    } catch (e) {
      console.error(e);
    }
    return { ok: true };
  }

  /** NEAR-MISS N1: an HTTP exception in the presentation layer is where it belongs. */
  find(id: string): string {
    if (id === '') throw new NotFoundException('no id');
    return id;
  }

  /** NEAR-MISS N3: the caught value is translated by a mapper. */
  confirmMapped(id: string): { status: number } {
    try {
      this.confirmer.confirm(id);
      return { status: 200 };
    } catch (e) {
      return toHttp(e);
    }
  }

  /** NEAR-MISS N4: the caught value is narrowed. */
  confirmNarrowed(id: string): number {
    try {
      this.confirmer.confirm(id);
      return 200;
    } catch (e) {
      if (e instanceof OrderError) return 409;
      return 500;
    }
  }
}

function toHttp(e: unknown): { status: number } {
  return { status: e instanceof OrderError ? 409 : 500 };
}
