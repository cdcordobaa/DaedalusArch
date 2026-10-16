declare module '@prisma/client' {
  export interface ItemRow { sku: string; description: string; unitWeightGrams: number; reorderLevel: number }
  export interface BinRow { code: string; sku: string | null; quantity: number; maxWeightGrams: number }
  export interface StockCountRow { id: string; binCode: string; counted: number; expected: number; countedAt: Date }
  export interface Delegate<T, K extends keyof T> {
    findUnique(args: { where: Pick<T, K> }): Promise<T | null>;
    findMany(args?: { where?: Partial<T> }): Promise<T[]>;
    create(args: { data: T }): Promise<T>;
    update(args: { where: Pick<T, K>; data: Partial<T> }): Promise<T>;
  }
  export class PrismaClient {
    item: Delegate<ItemRow, 'sku'>;
    bin: Delegate<BinRow, 'code'>;
    stockCount: Delegate<StockCountRow, 'id'>;
    $connect(): Promise<void>;
  }
}
