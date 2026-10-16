import { randomUUID } from "crypto";
import { ConflictError, ExternalServiceError, ForbiddenError, NotFoundError, ValidationError } from "../domain/errors";
import { Actor, Category, Fixer, Item, LeaderboardEntry, RepairEvent } from "../domain/model";
import {
  requireCategory, requireDate, requireMobile, requireOutcome,
  requireText, requireTime, requireWeight,
} from "../domain/validation";
import {
  AddFixerCommand, CompleteRepairCommand, CompleteRepairResult, CreateEventCommand,
  EventRepository, FixerRepository, ItemRepository, OrderPartCommand, PlacedPartOrder,
  RegisterItemCommand, RepairCafeUseCases, ShipmentNotificationCommand, ShipmentResult,
  DoorMessage, SmsGateway, SpareBoxGateway, SparePart, VenueSmsStore,
} from "./ports";

const SMS_MAX = 160;
const SMS_ATTEMPT_TIMEOUT_MS = 5_000;
const SMS_RETRY_INTERVAL_MS = 10 * 60 * 1000;
const SMS_RETRY_WINDOW_MS = 2 * 60 * 60 * 1000;

export class RepairCafeService implements RepairCafeUseCases {
  constructor(
    private readonly events: EventRepository,
    private readonly fixers: FixerRepository,
    private readonly items: ItemRepository,
    private readonly sms: SmsGateway,
    private readonly spareBox: SpareBoxGateway,
    private readonly smsStore: VenueSmsStore,
    private readonly log: (msg: string) => void = () => undefined,
  ) {}

  async createEvent(cmd: CreateEventCommand): Promise<RepairEvent> {
    const opensAt = requireTime(cmd.opensAt, "opensAt");
    const closesAt = requireTime(cmd.closesAt, "closesAt");
    if (closesAt <= opensAt) throw new ValidationError("closesAt must be after opensAt");
    const event: RepairEvent = {
      id: randomUUID(),
      date: requireDate(cmd.date),
      venue: requireText(cmd.venue, "venue"),
      opensAt,
      closesAt,
    };
    await this.events.save(event);
    return event;
  }

  listEvents(): Promise<RepairEvent[]> {
    return this.events.list();
  }

  async getEvent(id: string): Promise<RepairEvent> {
    const event = await this.events.findById(id);
    if (!event) throw new NotFoundError(`event ${id} not found`);
    return event;
  }

  async addFixer(cmd: AddFixerCommand): Promise<Fixer> {
    await this.getEvent(cmd.eventId);
    if (!Array.isArray(cmd.categories) || cmd.categories.length === 0) {
      throw new ValidationError("categories must be a non-empty array");
    }
    const categories = [...new Set(cmd.categories.map((c: unknown) => requireCategory(c)))];
    const fixer: Fixer = {
      id: randomUUID(),
      eventId: cmd.eventId,
      name: requireText(cmd.name, "name"),
      categories,
    };
    await this.fixers.save(fixer);
    return fixer;
  }

  async listFixers(eventId: string): Promise<Fixer[]> {
    await this.getEvent(eventId);
    return this.fixers.listByEvent(eventId);
  }

  async registerItem(cmd: RegisterItemCommand): Promise<Item> {
    await this.getEvent(cmd.eventId);
    const category = requireCategory(cmd.category);
    const brand = requireText(cmd.brand, "brand");
    const model = requireText(cmd.model, "model");
    const problem = requireText(cmd.problem, "problem");
    const visitorName = requireText(cmd.visitorName, "visitorName");
    const visitorMobile = requireMobile(cmd.visitorMobile);
    const item: Item = {
      ticketNumber: await this.items.nextTicketNumber(),
      eventId: cmd.eventId,
      category,
      brand,
      model,
      problem,
      visitorName,
      visitorMobile,
      status: "waiting",
      registeredAt: Date.now(),
    };
    await this.items.save(item);
    return item;
  }

  async listItems(eventId: string): Promise<Item[]> {
    await this.getEvent(eventId);
    return this.items.listByEvent(eventId);
  }

  async getItem(ticketNumber: number): Promise<Item> {
    const item = await this.items.findByTicket(ticketNumber);
    if (!item) throw new NotFoundError(`ticket ${ticketNumber} not found`);
    return item;
  }

  /** The fixer must exist, belong to the event, be signed in at its venue and (optionally) repair the category. */
  private async authorize(actor: Actor, eventId: string, category?: Category): Promise<Fixer> {
    const fixer = await this.fixers.findById(actor.fixerId);
    if (!fixer) throw new ForbiddenError(`fixer ${actor.fixerId} is unknown`);
    const event = await this.events.findById(eventId);
    if (!event) throw new NotFoundError(`event ${eventId} not found`);
    if (fixer.eventId !== eventId) throw new ForbiddenError("fixer is not part of this event");
    if (event.venue.trim().toLowerCase() !== actor.venue.trim().toLowerCase()) {
      throw new ForbiddenError("fixer is signed in at a different venue");
    }
    if (category && !fixer.categories.includes(category)) {
      throw new ForbiddenError(`fixer cannot repair ${category}`);
    }
    return fixer;
  }

  async leaderboard(eventId: string): Promise<LeaderboardEntry[]> {
    await this.getEvent(eventId);
    const fixers = await this.fixers.listByEvent(eventId);
    const items = await this.items.listByEvent(eventId);
    const entries = fixers.map((f): LeaderboardEntry => {
      const fixed = items.filter((i) => i.outcome === "fixed" && i.outcomeByFixerId === f.id);
      const kg = fixed.reduce((sum, i) => sum + (i.weightKg ?? 0), 0);
      return { fixerId: f.id, fixerName: f.name, itemsFixed: fixed.length, kgSaved: Math.round(kg * 1000) / 1000 };
    });
    return entries.sort(
      (a, b) => b.itemsFixed - a.itemsFixed || b.kgSaved - a.kgSaved || a.fixerName.localeCompare(b.fixerName),
    );
  }

  async claimNextItem(actor: Actor): Promise<Item> {
    const fixerId = actor.fixerId;
    const found = await this.fixers.findById(fixerId);
    if (!found) throw new NotFoundError(`fixer ${fixerId} not found`);
    const fixer = await this.authorize(actor, found.eventId);
    const all = await this.items.listByEvent(fixer.eventId);
    if (all.some((i) => i.status === "in_repair" && i.fixerId === fixerId)) {
      throw new ConflictError("fixer is already working on an item");
    }
    const next = all
      .filter((i) => i.status === "waiting" && fixer.categories.includes(i.category))
      .sort((a, b) => a.ticketNumber - b.ticketNumber)[0];
    if (!next) throw new NotFoundError("no waiting item in the fixer's categories");
    next.status = "in_repair";
    next.fixerId = fixerId;
    await this.items.save(next);
    return next;
  }

  async completeRepair(cmd: CompleteRepairCommand): Promise<CompleteRepairResult> {
    const item = await this.getItem(cmd.ticketNumber);
    await this.authorize(cmd.actor, item.eventId, item.category);
    const outcome = requireOutcome(cmd.outcome);
    const weightKg = requireWeight(cmd.weightKg);
    if (item.status !== "in_repair") throw new ConflictError("item is not being repaired");
    item.status = "done";
    item.outcome = outcome;
    item.outcomeByFixerId = cmd.actor.fixerId;
    item.outcomeAtVenue = cmd.actor.venue.trim();
    item.weightKg = weightKg;
    await this.items.save(item);

    const smsSent = await this.notify(item, this.readyMessage(item));
    return { item, smsSent };
  }

  async searchParts(ticketNumber: number): Promise<SparePart[]> {
    const item = await this.getItem(ticketNumber);
    try {
      return await this.spareBox.searchParts(item.brand, item.model);
    } catch (err) {
      throw new ExternalServiceError(`SpareBox search failed: ${String(err)}`);
    }
  }

  async orderPart(cmd: OrderPartCommand): Promise<Item> {
    const item = await this.getItem(cmd.ticketNumber);
    await this.authorize(cmd.actor, item.eventId, item.category);
    const partId = requireText(cmd.partId, "partId");
    if (item.status !== "in_repair") throw new ConflictError("item is not being repaired");
    const part = (await this.searchParts(cmd.ticketNumber)).find((p) => p.partId === partId);
    if (!part) throw new NotFoundError(`part ${partId} not found for ${item.brand} ${item.model}`);
    let placed: PlacedPartOrder;
    try {
      placed = await this.spareBox.placeOrder(part.partId);
    } catch (err) {
      throw new ExternalServiceError(`SpareBox order failed: ${String(err)}`);
    }
    item.status = "awaiting_part";
    item.partOrder = {
      orderedByFixerId: cmd.actor.fixerId,
      orderedAtVenue: cmd.actor.venue.trim(),
      orderNumber: placed.orderNumber,
      partId: part.partId,
      partName: part.name,
      price: part.price,
      expectedDelivery: placed.expectedDelivery,
      shipped: false,
    };
    await this.items.save(item);
    return item;
  }

  async partShipped(cmd: ShipmentNotificationCommand): Promise<ShipmentResult> {
    const orderNumber = requireText(cmd.orderNumber, "orderNumber");
    const item = await this.items.findByPartOrderNumber(orderNumber);
    if (!item || !item.partOrder) throw new NotFoundError(`order ${orderNumber} not found`);
    if (item.partOrder.shipped) return { item, smsSent: false };
    item.partOrder.shipped = true;
    await this.items.save(item);

    const smsSent = await this.notify(item, this.shippedMessage(item));
    return { item, smsSent };
  }

  async setSmsEnabled(venue: unknown, enabled: unknown): Promise<{ venue: string; enabled: boolean }> {
    const v = requireText(venue, "venue");
    if (typeof enabled !== "boolean") throw new ValidationError("enabled must be a boolean");
    await this.smsStore.setEnabled(v, enabled);
    return { venue: v, enabled };
  }

  async getSmsEnabled(venue: unknown): Promise<{ venue: string; enabled: boolean }> {
    const v = requireText(venue, "venue");
    return { venue: v, enabled: await this.smsStore.isEnabled(v) };
  }

  listDoorMessages(venue: unknown): Promise<DoorMessage[]> {
    return this.smsStore.listDoorMessages(requireText(venue, "venue"));
  }

  /** Never throws: a text problem must not affect the item. Returns true if the text was sent right away. */
  private async notify(item: Item, message: string): Promise<boolean> {
    try {
      const event = await this.events.findById(item.eventId);
      const venue = event?.venue ?? "";
      const queued: DoorMessage = { ticketNumber: item.ticketNumber, mobile: item.visitorMobile, message, createdAt: Date.now() };
      if (!(await this.smsStore.isEnabled(venue))) {
        await this.smsStore.addDoorMessage(venue, queued);
        return false;
      }
      if (await this.attempt(queued)) return true;
      this.scheduleRetry(venue, queued, Date.now() + SMS_RETRY_WINDOW_MS);
    } catch (err) {
      this.log(`failed to handle text for ticket ${item.ticketNumber}: ${String(err)}`);
    }
    return false;
  }

  private async attempt(m: DoorMessage): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("text message timed out")), SMS_ATTEMPT_TIMEOUT_MS);
      });
      await Promise.race([this.sms.send(m.mobile, m.message), timeout]);
      return true;
    } catch (err) {
      this.log(`failed to text ticket ${m.ticketNumber}: ${String(err)}`);
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private scheduleRetry(venue: string, m: DoorMessage, deadline: number): void {
    if (Date.now() + SMS_RETRY_INTERVAL_MS > deadline) return;
    setTimeout(() => {
      void (async () => {
        try {
          if (!(await this.smsStore.isEnabled(venue))) {
            await this.smsStore.addDoorMessage(venue, m);
            return;
          }
          if (await this.attempt(m)) return;
        } catch (err) {
          this.log(`text retry failed for ticket ${m.ticketNumber}: ${String(err)}`);
        }
        this.scheduleRetry(venue, m, deadline);
      })();
    }, SMS_RETRY_INTERVAL_MS);
  }

  private shippedMessage(item: Item): string {
    const order = item.partOrder;
    if (!order) return "";
    const price = order.price.toFixed(2);
    const msg = `Hi ${item.visitorName}, the part for your ${item.brand} ${item.model} (ticket ${item.ticketNumber}) has shipped. Delivery: ${order.expectedDelivery}. Part price: ${price}, payable on collection.`;
    return msg.length <= SMS_MAX
      ? msg
      : `Ticket ${item.ticketNumber}: part shipped. Delivery ${order.expectedDelivery}. Part price ${price}, payable on collection.`;
  }

  private readyMessage(item: Item): string {
    const msg = `Hi ${item.visitorName}, your ${item.brand} ${item.model} (ticket ${item.ticketNumber}) is ready to collect.`;
    return msg.length <= SMS_MAX ? msg : `Your item (ticket ${item.ticketNumber}) is ready to collect.`;
  }
}
