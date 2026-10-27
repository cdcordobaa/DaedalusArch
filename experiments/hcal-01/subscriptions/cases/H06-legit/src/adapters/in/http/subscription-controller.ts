import { SubscribePort } from '../../../application/ports/in/subscribe-port';
import { CancelSubscriptionPort } from '../../../application/ports/in/cancel-subscription-port';
import { GenerateInvoicePort } from '../../../application/ports/in/generate-invoice-port';
import {
  AlreadyCancelledError,
  AlreadySubscribedError,
  DomainError,
  PlanNotFoundError,
  SubscriptionNotFoundError,
} from '../../../domain/errors';

export interface HttpRequest {
  readonly body: unknown;
  readonly params: Record<string, string>;
}

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

export class SubscriptionController {
  constructor(
    private readonly subscribe: SubscribePort,
    private readonly cancel: CancelSubscriptionPort,
    private readonly invoices: GenerateInvoicePort,
  ) {}

  async create(req: HttpRequest): Promise<HttpResponse> {
    const body = req.body as Record<string, unknown> | null;
    if (!body || typeof body.customerId !== 'string' || typeof body.planId !== 'string') {
      return { status: 400, body: { error: 'customerId and planId must be strings' } };
    }
    if (!/^[a-z0-9-]{1,40}$/.test(body.planId) || body.customerId.trim().length === 0) {
      return { status: 400, body: { error: 'malformed identifier' } };
    }
    try {
      const sub = await this.subscribe.execute({ customerId: body.customerId, planId: body.planId });
      return { status: 201, body: { id: sub.id, status: sub.status } };
    } catch (e) {
      return this.toHttp(e);
    }
  }

  async remove(req: HttpRequest): Promise<HttpResponse> {
    const id = req.params.id;
    if (!id) return { status: 400, body: { error: 'id is required' } };
    try {
      await this.cancel.execute({ subscriptionId: id });
      return { status: 204, body: null };
    } catch (e) {
      return this.toHttp(e);
    }
  }

  async invoice(req: HttpRequest): Promise<HttpResponse> {
    const id = req.params.id;
    if (!id) return { status: 400, body: { error: 'id is required' } };
    try {
      const invoice = await this.invoices.execute({ subscriptionId: id });
      return { status: 201, body: { id: invoice.id, cents: invoice.amount.cents } };
    } catch (e) {
      return this.toHttp(e);
    }
  }

  private toHttp(e: unknown): HttpResponse {
    if (e instanceof PlanNotFoundError || e instanceof SubscriptionNotFoundError) {
      return { status: 404, body: { error: e.message } };
    }
    if (e instanceof AlreadyCancelledError || e instanceof AlreadySubscribedError) {
      return { status: 409, body: { error: e.message } };
    }
    if (e instanceof DomainError) return { status: 422, body: { error: e.message } };
    return { status: 500, body: { error: 'internal error' } };
  }
}
