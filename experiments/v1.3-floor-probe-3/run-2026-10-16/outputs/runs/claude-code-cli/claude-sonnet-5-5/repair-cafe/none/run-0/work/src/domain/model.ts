export const CATEGORIES = ["electrical", "bikes", "textiles", "furniture"] as const;
export type Category = (typeof CATEGORIES)[number];

export const OUTCOMES = ["fixed", "advice_given", "not_repairable"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export type ItemStatus = "waiting" | "in_repair" | "awaiting_part" | "done";

export interface RepairEvent {
  id: string;
  date: string; // YYYY-MM-DD
  venue: string;
  opensAt: string; // HH:MM
  closesAt: string; // HH:MM
}

export interface Fixer {
  id: string;
  eventId: string;
  name: string;
  categories: Category[];
}

export interface Actor {
  fixerId: string;
  venue: string;
}

export interface LeaderboardEntry {
  fixerId: string;
  fixerName: string;
  itemsFixed: number;
  kgSaved: number;
}

export interface PartOrder {
  orderedByFixerId?: string;
  orderedAtVenue?: string;
  orderNumber: string;
  partId: string;
  partName: string;
  price: number;
  expectedDelivery: string;
  shipped: boolean;
}

export interface Item {
  ticketNumber: number;
  eventId: string;
  category: Category;
  brand: string;
  model: string;
  problem: string;
  visitorName: string;
  visitorMobile: string;
  status: ItemStatus;
  registeredAt: number;
  fixerId?: string;
  outcome?: Outcome;
  outcomeByFixerId?: string;
  outcomeAtVenue?: string;
  weightKg?: number;
  partOrder?: PartOrder;
}
