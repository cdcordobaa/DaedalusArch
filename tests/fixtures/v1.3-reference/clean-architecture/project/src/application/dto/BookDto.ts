import { Book } from '../../domain/entities/Book';

export interface BookDto {
  id: string;
  isbn: string;
  title: string;
  author: string;
  copiesAvailable: number;
}

export function toBookDto(book: Book): BookDto {
  return {
    id: book.id,
    isbn: book.isbn.value,
    title: book.title,
    author: book.author,
    copiesAvailable: book.copiesAvailable,
  };
}
