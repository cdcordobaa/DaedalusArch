import { PrismaService } from './PrismaService';
import { BookRecord } from './records/BookRecord';

export class BookGateway {
  constructor(private readonly db: PrismaService) {}

  findByIsbn(isbn: string): Promise<BookRecord | null> {
    return this.db.book.findUnique({ where: { isbn } });
  }

  async updateCopies(isbn: string, copiesAvailable: number): Promise<void> {
    await this.db.book.update({ where: { isbn }, data: { copiesAvailable } });
  }
}
