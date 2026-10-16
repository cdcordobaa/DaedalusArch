import { CatalogController } from './http/CatalogController';
import { HttpRequest, HttpResponse } from './http/HttpTypes';
import { OrderController } from './http/OrderController';

type Handler = (request: HttpRequest) => HttpResponse;

export class Router {
  private readonly routes = new Map<string, Handler>();

  constructor(catalog: CatalogController, orders: OrderController) {
    this.routes.set('GET /products', () => catalog.list());
    this.routes.set('POST /products', (r) => catalog.create(r));
    this.routes.set('POST /orders', (r) => orders.place(r));
    this.routes.set('GET /orders/:id', (r) => orders.show(r));
    this.routes.set('POST /orders/:id/cancel', (r) => orders.cancel(r));
  }

  handle(route: string, request: HttpRequest): HttpResponse {
    const handler = this.routes.get(route);
    return handler === undefined ? { status: 404, body: { error: `No route ${route}` } } : handler(request);
  }
}
