import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { sortBy } from 'lodash';

/** PLANTED P2: a cloud SDK in the application layer. NEAR-MISS N2 (same file, other import): lodash is not a vendor SDK. */
export class ExportReport {
  private readonly s3 = new S3Client({});

  run(rows: { n: number }[]): Promise<unknown> {
    return this.s3.send(new PutObjectCommand({ Body: JSON.stringify(sortBy(rows, 'n')) }));
  }
}
