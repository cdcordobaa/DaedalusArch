import { Book } from '../../domain/entities/Book';
import { BookRepository } from '../../domain/repositories/BookRepository';
import { Isbn } from '../../domain/value-objects/Isbn';
import { BookDto, toBookDto } from '../dto/BookDto';
import { IdGenerator } from '../ports/IdGenerator';

export interface RegisterBookCommand {
  isbn: string;
  title: string;
  author: string;
  copies: number;
}

export class RegisterBookUseCase {
  constructor(
    private readonly books: BookRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: RegisterBookCommand): Promise<BookDto> {
    const book = new Book(this.ids.next('book'), Isbn.parse(command.isbn), command.title, command.author, command.copies);
    await this.books.save(book);
    return toBookDto(book);
  }
}
