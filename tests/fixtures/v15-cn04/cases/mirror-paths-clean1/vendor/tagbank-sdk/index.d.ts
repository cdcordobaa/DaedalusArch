// A tool-tagging vendor SDK, vendored into the project (resolved through tsconfig paths).
export type TagbankScanState = 'TAG_OK' | 'TAG_WORN' | 'TAG_MISSING';
export interface TagbankScan {
  tagId: string;
  state: TagbankScanState;
  scannedAt: string;
}
export declare class TagbankClient {
  constructor(options: { apiKey: string });
  scan(toolRef: string): Promise<TagbankScan>;
}
