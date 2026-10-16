import { BinTable } from '../../persistence/tables/BinTable';
import { ItemTable } from '../../persistence/tables/ItemTable';
import { Bin } from '../stock/Bin';
import { Item } from '../stock/Item';
import { StockError } from '../stock/StockError';

export class ReceivingService {
  constructor(
    private readonly items: ItemTable,
    private readonly bins: BinTable,
  ) {}

  async receive(sku: string, binCode: string, quantity: number): Promise<Bin> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new StockError('Received quantity must be a positive whole number');
    }
    const item = await this.item(sku);
    const bin = await this.bin(binCode);
    bin.put(item, quantity);
    await this.bins.store({ ...bin });
    return bin;
  }

  async pick(sku: string, quantity: number): Promise<{ picked: number; reorder: boolean }> {
    const item = await this.item(sku);
    let left = quantity;
    let onHand = 0;
    for (const data of await this.bins.holding(sku)) {
      const bin = new Bin(data.code, data.sku, data.quantity, data.maxWeightGrams);
      const take = Math.min(left, bin.quantity);
      if (take > 0) {
        bin.take(take);
        await this.bins.store({ ...bin });
        left -= take;
      }
      onHand += bin.quantity;
    }
    return { picked: quantity - left, reorder: item.needsReorder(onHand) };
  }

  private async item(sku: string): Promise<Item> {
    const d = await this.items.find(sku);
    if (d === null) throw new StockError(`Unknown item ${sku}`);
    return new Item(d.sku, d.description, d.unitWeightGrams, d.reorderLevel);
  }

  private async bin(code: string): Promise<Bin> {
    const d = await this.bins.find(code);
    if (d === null) throw new StockError(`Unknown bin ${code}`);
    return new Bin(d.code, d.sku, d.quantity, d.maxWeightGrams);
  }
}
