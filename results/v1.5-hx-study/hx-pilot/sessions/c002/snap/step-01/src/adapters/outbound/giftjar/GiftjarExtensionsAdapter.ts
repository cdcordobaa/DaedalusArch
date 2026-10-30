import type { GiftjarClient } from 'giftjar-sdk';
import type { ExtensionResult } from '../../../application/ports/in/VoucherDesk';
import type { VoucherExtensions } from '../../../application/ports/out/VoucherExtensions';

export class GiftjarExtensionsAdapter implements VoucherExtensions {
  constructor(private readonly client: GiftjarClient) {}

  async extend(code: string): Promise<ExtensionResult> {
    const e = await this.client.extend(code);
    return e.outcome === 'extended' ? 'extended' : 'refused';
  }
}
