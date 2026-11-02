import { DebitoraClient } from 'debitora-sdk';
import { PlansController } from '../adapters/inbound/http/PlansController';
import { InMemoryPlans } from '../adapters/outbound/memory/InMemoryPlans';
import { DebitoraMandatesAdapter } from '../adapters/outbound/debitora/DebitoraMandatesAdapter';
import { DebitoraChargesAdapter } from '../adapters/outbound/debitora/DebitoraChargesAdapter';
import { PlanService } from '../application/services/PlanService';
import { PlanLetterService } from '../application/services/PlanLetterService';
import { ChargeStatusService } from '../application/services/ChargeStatusService';

/** Composition root. The Debitora token comes from DEBITORA_ACCESS_TOKEN. The returned object is the app. */
export function createApp() {
  const debitora = new DebitoraClient({ accessToken: process.env.DEBITORA_ACCESS_TOKEN ?? '' });
  const mandates = new DebitoraMandatesAdapter(debitora);
  const charges = new DebitoraChargesAdapter(debitora);
  const plans = new PlanService(new InMemoryPlans(), mandates, charges);
  const http = new PlansController(plans, new PlanLetterService(mandates), new ChargeStatusService(charges));
  return {
    start: async (planId: string, address: string, flues: number, sweepsPerYear: number, mandateId: string) => (await http.postPlan({ planId, address, flues, sweepsPerYear, mandateId })).body,
    recordSweep: async (planId: string, date: string) => (await http.postSweep(planId, { date })).body,
    stop: async (planId: string) => (await http.postStop(planId)).body,
    letter: async (mandateId: string) => (await http.getLetter(mandateId)).body,
    chargeStatus: async (paymentId: string) => (await http.getCharge(paymentId)).body,
    http,
  };
}
