import type { CellarEvent } from '../domain/events';
import { supplyBrew } from '../domain/lot/ingredientLot';
import type { LotStore } from '../domain/lot/LotStore';
import { lotOrRefuse } from './lotCommands';

/** Reaction to a kept brew: each lot gives its grams, one lot kept at a time (a repeated delivery changes nothing). */
export const supplyLots = (lots: LotStore) => (fact: CellarEvent): void => {
  if (fact.kind !== 'batch-brewed') return;
  for (const draw of fact.draws) lots.keep(supplyBrew(lotOrRefuse(lots, draw.lotId), fact.batchId, draw.grams));
};
