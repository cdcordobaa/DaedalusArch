import { OrderItem, OrderService } from '../../business/services/OrderService';
import { renderOrder } from '../views/OrderView';
import { errorResponse } from './ErrorHandling';
import { HttpRequest, HttpResponse } from './HttpTypes';

export class OrderController {
  constructor(private readonly orders: OrderService) {}

  place(request: HttpRequest): HttpResponse {
    try {
      const items = (request.body['items'] as OrderItem[] | undefined) ?? [];
      return { status: 201, body: renderOrder(this.orders.placeOrder(String(request.body['customerId']), items)) };
    } catch (error) {
      return errorResponse(error);
    }
  }

  cancel(request: HttpRequest): HttpResponse {
    try {
      return { status: 200, body: renderOrder(this.orders.cancelOrder(String(request.params['id']))) };
    } catch (error) {
      return errorResponse(error);
    }
  }

  show(request: HttpRequest): HttpResponse {
    try {
      return { status: 200, body: renderOrder(this.orders.getOrder(String(request.params['id']))) };
    } catch (error) {
      return errorResponse(error);
    }
  }
}
