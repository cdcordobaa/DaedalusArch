import { S3Client } from '@aws-sdk/client-s3';

/** NEAR-MISS N3: an adapter-role class, wherever it is placed. */
export class ReportStorageAdapter {
  constructor(private readonly s3: S3Client) {}

  put(body: string): Promise<unknown> {
    return this.s3.send({ body });
  }
}
