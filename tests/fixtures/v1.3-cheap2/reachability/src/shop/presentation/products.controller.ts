import { Controller, Get, Inject } from '@nestjs/common';
import { Product } from '../domain/product';
import { ProductRepository } from '../domain/product-repository';

@Controller('products')
export class ProductsController {
  constructor(@Inject('ProductRepository') private readonly repo: ProductRepository) {}

  /** PLANTED P1: the endpoint calls the repository port directly; it resolves to the infrastructure adapter. */
  @Get()
  list(): Product[] {
    return this.repo.findAll();
  }
}
