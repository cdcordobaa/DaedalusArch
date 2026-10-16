import { Injectable } from '@nestjs/common';

@Injectable()
export class FormatterService {
  format(s: string): string {
    return s.toUpperCase();
  }
}
