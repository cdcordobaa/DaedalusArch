// look-alike (use-case-framework-free): '@nestjsx/crud' is not '@nestjs/*'.
import { Crud } from '@nestjsx/crud';

export interface OrderDto {
  readonly id: string;
  readonly totalCents: number;
}
export const crud = Crud;
