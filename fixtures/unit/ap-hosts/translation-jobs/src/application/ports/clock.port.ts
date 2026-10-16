import { Token } from 'typedi';

export interface ClockPort {
  now(): Date;
}

export const CLOCK = new Token<ClockPort>('clock');
