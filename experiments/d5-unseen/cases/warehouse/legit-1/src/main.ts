import { CatalogService } from './storage/application/CatalogService';
import { InMemorySkuRepository } from './storage/infrastructure/InMemorySkuRepository';

export const catalog = new CatalogService(new InMemorySkuRepository());
