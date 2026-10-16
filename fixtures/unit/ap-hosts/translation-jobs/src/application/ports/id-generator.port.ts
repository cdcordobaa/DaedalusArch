import { Token } from 'typedi';

export interface IdGeneratorPort {
  next(): string;
}

export const IDS = new Token<IdGeneratorPort>('ids');
