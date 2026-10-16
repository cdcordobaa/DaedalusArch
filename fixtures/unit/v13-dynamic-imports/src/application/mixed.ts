import { both } from '../infrastructure/both';

export async function staticAndDynamic(): Promise<string[]> {
  const again = await import('../infrastructure/both');
  return [both, again.both];
}
