import { Actor, Fixer, Item, LeaderboardEntry, RepairEvent } from "../domain/model";

// Outbound ports
export interface EventRepository {
  save(event: RepairEvent): Promise<void>;
  findById(id: string): Promise<RepairEvent | undefined>;
  list(): Promise<RepairEvent[]>;
}

export interface FixerRepository {
  save(fixer: Fixer): Promise<void>;
  findById(id: string): Promise<Fixer | undefined>;
  listByEvent(eventId: string): Promise<Fixer[]>;
}

export interface ItemRepository {
  nextTicketNumber(): Promise<number>;
  save(item: Item): Promise<void>;
  findByTicket(ticketNumber: number): Promise<Item | undefined>;
  listByEvent(eventId: string): Promise<Item[]>;
  findByPartOrderNumber(orderNumber: string): Promise<Item | undefined>;
}

export interface SparePart {
  partId: string;
  name: string;
  price: number;
}

export interface PlacedPartOrder {
  orderNumber: string;
  expectedDelivery: string; // YYYY-MM-DD
}

export interface SpareBoxGateway {
  searchParts(brand: string, model: string): Promise<SparePart[]>;
  placeOrder(partId: string): Promise<PlacedPartOrder>;
}

export interface SmsGateway {
  /** message must be at most 160 characters */
  send(mobile: string, message: string): Promise<void>;
}

export interface DoorMessage {
  ticketNumber: number;
  mobile: string;
  message: string;
  createdAt: number;
}

/** Per-venue text-message switch and the board shown to volunteers at the door while texts are off. */
export interface VenueSmsStore {
  isEnabled(venue: string): Promise<boolean>;
  setEnabled(venue: string, enabled: boolean): Promise<void>;
  addDoorMessage(venue: string, message: DoorMessage): Promise<void>;
  listDoorMessages(venue: string): Promise<DoorMessage[]>;
}

// Inbound ports
export interface CreateEventCommand { date: unknown; venue: unknown; opensAt: unknown; closesAt: unknown }
export interface AddFixerCommand { eventId: string; name: unknown; categories: unknown }
export interface RegisterItemCommand {
  eventId: string; category: unknown; brand: unknown; model: unknown;
  problem: unknown; visitorName: unknown; visitorMobile: unknown;
}
export interface CompleteRepairCommand { actor: Actor; ticketNumber: number; outcome: unknown; weightKg: unknown }

export interface OrderPartCommand { actor: Actor; ticketNumber: number; partId: unknown }
export interface ShipmentNotificationCommand { orderNumber: unknown }

export interface CompleteRepairResult { item: Item; smsSent: boolean }
export interface ShipmentResult { item: Item; smsSent: boolean }

export interface RepairCafeUseCases {
  createEvent(cmd: CreateEventCommand): Promise<RepairEvent>;
  listEvents(): Promise<RepairEvent[]>;
  getEvent(id: string): Promise<RepairEvent>;
  addFixer(cmd: AddFixerCommand): Promise<Fixer>;
  listFixers(eventId: string): Promise<Fixer[]>;
  registerItem(cmd: RegisterItemCommand): Promise<Item>;
  listItems(eventId: string): Promise<Item[]>;
  getItem(ticketNumber: number): Promise<Item>;
  claimNextItem(actor: Actor): Promise<Item>;
  leaderboard(eventId: string): Promise<LeaderboardEntry[]>;
  completeRepair(cmd: CompleteRepairCommand): Promise<CompleteRepairResult>;
  searchParts(ticketNumber: number): Promise<SparePart[]>;
  orderPart(cmd: OrderPartCommand): Promise<Item>;
  partShipped(cmd: ShipmentNotificationCommand): Promise<ShipmentResult>;
  setSmsEnabled(venue: unknown, enabled: unknown): Promise<{ venue: string; enabled: boolean }>;
  getSmsEnabled(venue: unknown): Promise<{ venue: string; enabled: boolean }>;
  listDoorMessages(venue: unknown): Promise<DoorMessage[]>;
}
