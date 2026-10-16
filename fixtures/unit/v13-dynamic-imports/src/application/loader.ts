import { Order } from '../domain/order';

/* eslint-disable @typescript-eslint/no-require-imports */
export async function literalCases(): Promise<unknown[]> {
  const db = await import('../infrastructure/db');
  const cache = import('../infrastructure/cache').then((m) => m.cache);
  const mailer = await import(`../infrastructure/mailer`);
  const domain = await import('../domain');
  const report = await import('@app/infrastructure/report');
  const legacy = require('../infrastructure/legacy') as { legacy: string };
  const esm = await import('../infrastructure/esm-style.js');
  return [db, await cache, mailer, domain, report, legacy, esm, new Order('o-1')];
}

export async function nonLiteralCases(name: string): Promise<unknown[]> {
  const a = await import(name);
  const b = await import(`../plugins/${name}`);
  const c = await import('../plugins/' + name);
  const d = require(name) as unknown;
  return [a, b, c, d];
}

export type TypedRef = import('../infrastructure/typed').Typed;

export async function unresolvable(): Promise<unknown> {
  return import('../infrastructure/missing');
}
