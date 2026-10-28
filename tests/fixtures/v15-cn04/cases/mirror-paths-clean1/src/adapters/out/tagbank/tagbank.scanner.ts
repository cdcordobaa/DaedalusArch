import { TagbankClient } from 'tagbank-sdk';
import type { Tool } from '@core/tool';

/** Reads a tool's RFID tag through the vendor SDK. */
export class TagbankScanner {
  constructor(private readonly client: TagbankClient) {}

  async isTagged(tool: Tool): Promise<boolean> {
    const scan = await this.client.scan(tool.name);
    return scan.state !== 'TAG_MISSING';
  }
}
