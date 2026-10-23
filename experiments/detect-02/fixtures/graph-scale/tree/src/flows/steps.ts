import { createStep } from './sdk';
import { UserRepository } from '../repo/user.repository';
import { IProductModuleService } from '../models/product';

declare const users: UserRepository;
declare const products: IProductModuleService;

export const saveUserStep = createStep('save-user', async (input: { name: string }) => {
  await users.create({ name: input.name });
});

export const createProductsStep = createStep('create-products', async (input: { title: string }[]) => {
  await products.createProducts(input);
  await products.listProducts();
});
