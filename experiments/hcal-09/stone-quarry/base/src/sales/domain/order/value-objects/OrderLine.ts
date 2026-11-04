export type Product = 'crushed-20mm' | 'sub-base' | 'armour-stone' | 'quarry-dust';

export interface OrderLine {
  readonly product: Product;
  readonly tonnes: number;
}

export const orderLine = (product: Product, tonnes: number): OrderLine => {
  if (!(tonnes > 0)) throw new Error('an order line needs a positive tonnage');
  return Object.freeze({ product, tonnes });
};
