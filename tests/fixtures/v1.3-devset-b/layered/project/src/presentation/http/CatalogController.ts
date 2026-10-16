import { CatalogService } from '../../business/services/CatalogService';
import { renderProduct } from '../views/ProductView';
import { errorResponse } from './ErrorHandling';
import { HttpRequest, HttpResponse } from './HttpTypes';

export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  list(): HttpResponse {
    return { status: 200, body: this.catalog.listProducts().map(renderProduct) };
  }

  create(request: HttpRequest): HttpResponse {
    try {
      const product = this.catalog.addProduct(
        String(request.body['sku']),
        String(request.body['name']),
        Number(request.body['priceCents']),
        Number(request.body['stock']),
      );
      return { status: 201, body: renderProduct(product) };
    } catch (error) {
      return errorResponse(error);
    }
  }
}
