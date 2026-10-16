import { NotFoundError, ValidationError } from "../domain/errors.js";
import { formatTimeOfDay, parseTimeOfDay, validateCoordinates, type Route, type Stop } from "../domain/route.js";
import { isDelayNotificationDue } from "../domain/notificationPolicy.js";
import type { Pupil, Trip } from "../domain/pupil.js";
import { applyPosition, estimateArrival, type BusRun, type Position } from "../domain/busRun.js";
import type {
  BusRunRepository,
  Clock,
  IdGenerator,
  MailProvider,
  NotificationLedger,
  PupilRepository,
  PushProvider,
  RouteRepository,
} from "./ports.js";
import { applyTap, type TapKind } from "../domain/attendance.js";
import type { AttendanceRepository } from "./ports.js";
import type { NotificationChannel } from "../domain/pupil.js";

export interface TapInput {
  readerId: string;
  cardNumber: string;
  time: string;
}

export interface TapResult {
  accepted: true;
  matched: boolean;
  kind?: TapKind;
}

export interface StopInput {
  name: string;
  latitude: number;
  longitude: number;
  scheduledTime: string;
}

export interface PupilInput {
  name: string;
  school: string;
  parentEmail: string;
  morningStopId: string;
  afternoonStopId: string;
  cardNumber?: string;
  notificationChannel?: NotificationChannel;
  pushDeviceToken?: string;
}

export interface PositionInput {
  unitId: string;
  latitude: number;
  longitude: number;
  time: string;
}

export interface EtaResult {
  pupilId: string;
  trip: Trip;
  stopId: string;
  stopName: string;
  routeId: string;
  scheduledTime: string;
  delayMinutes: number;
  estimatedTime: string;
  status: "estimated" | "passed" | "no-live-data";
}

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new ValidationError(`${field} is required`);
  return value.trim();
}

export class BusTrackingService {
  constructor(
    private readonly routes: RouteRepository,
    private readonly pupils: PupilRepository,
    private readonly runs: BusRunRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly utcOffsetMinutes: number,
    private readonly mail: MailProvider,
    private readonly ledger: NotificationLedger,
    private readonly push: PushProvider,
    private readonly attendance: AttendanceRepository,
    private readonly schoolOfficeEmail: string,
  ) {}

  createRoute(name: string, stops: StopInput[]): Route {
    const routeName = requireString(name, "name");
    if (!Array.isArray(stops) || stops.length === 0) throw new ValidationError("stops must be a non-empty list");
    const route: Route = {
      id: this.ids.next(),
      name: routeName,
      stops: stops.map((s) => {
        validateCoordinates(s?.latitude, s?.longitude);
        return {
          id: this.ids.next(),
          name: requireString(s.name, "stop name"),
          latitude: s.latitude,
          longitude: s.longitude,
          scheduledMinutes: parseTimeOfDay(requireString(s.scheduledTime, "scheduledTime")),
        };
      }),
    };
    for (let i = 1; i < route.stops.length; i++) {
      const prev = route.stops[i - 1];
      const cur = route.stops[i];
      if (prev && cur && cur.scheduledMinutes < prev.scheduledMinutes) {
        throw new ValidationError("stops must be in scheduled order");
      }
    }
    this.routes.save(route);
    return route;
  }

  listRoutes(): Route[] {
    return this.routes.list();
  }

  getRoute(id: string): Route {
    const route = this.routes.findById(id);
    if (!route) throw new NotFoundError(`Route ${id} not found`);
    return route;
  }

  createPupil(input: PupilInput): Pupil {
    const pupil: Pupil = {
      id: this.ids.next(),
      name: requireString(input.name, "name"),
      school: requireString(input.school, "school"),
      parentEmail: requireString(input.parentEmail, "parentEmail"),
      morningStopId: requireString(input.morningStopId, "morningStopId"),
      afternoonStopId: requireString(input.afternoonStopId, "afternoonStopId"),
      notificationChannel: input.notificationChannel ?? "email",
    };
    if (pupil.notificationChannel !== "email" && pupil.notificationChannel !== "push") {
      throw new ValidationError("notificationChannel must be email or push");
    }
    if (input.cardNumber !== undefined) {
      pupil.cardNumber = requireString(input.cardNumber, "cardNumber");
      if (this.pupils.findByCardNumber(pupil.cardNumber)) throw new ValidationError("cardNumber is already in use");
    }
    if (pupil.notificationChannel === "push") {
      pupil.pushDeviceToken = requireString(input.pushDeviceToken, "pushDeviceToken");
    } else if (input.pushDeviceToken !== undefined) {
      pupil.pushDeviceToken = requireString(input.pushDeviceToken, "pushDeviceToken");
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(pupil.parentEmail)) throw new ValidationError("parentEmail is invalid");
    for (const stopId of [pupil.morningStopId, pupil.afternoonStopId]) {
      if (!this.routes.findByStopId(stopId)) throw new ValidationError(`Unknown stop ${stopId}`);
    }
    this.pupils.save(pupil);
    return pupil;
  }

  listPupils(): Pupil[] {
    return this.pupils.list();
  }

  getPupil(id: string): Pupil {
    const pupil = this.pupils.findById(id);
    if (!pupil) throw new NotFoundError(`Pupil ${id} not found`);
    return pupil;
  }

  /** Links a unit to the route it drives on the given day (default today); resets its progress. */
  linkUnit(unitId: string, routeId: string, date?: string): BusRun {
    const id = requireString(unitId, "unitId");
    this.getRoute(routeId);
    const day = date === undefined ? this.clock.now().toISOString().slice(0, 10) : date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new ValidationError("date must be YYYY-MM-DD");
    const run: BusRun = { unitId: id, routeId, date: day };
    this.runs.save(run);
    return run;
  }

  /** Records a GPS fix. Returns false when the unit is not linked to a route. */
  recordPosition(input: PositionInput): boolean {
    const unitId = requireString(input?.unitId, "unitId");
    validateCoordinates(input.latitude, input.longitude);
    const time = new Date(input.time);
    if (typeof input.time !== "string" || Number.isNaN(time.getTime())) throw new ValidationError("time must be an ISO date-time");
    const position: Position = { unitId, latitude: input.latitude, longitude: input.longitude, time };
    const run = this.runs.findByUnitId(unitId);
    if (!run) return false;
    const route = this.routes.findById(run.routeId);
    if (!route) return false;
    // Units with a wrong clock must not cause bogus delays: ignore fixes too far from our own time.
    if (Math.abs(time.getTime() - this.clock.now().getTime()) > MAX_CLOCK_SKEW_MS) return true;
    const before = run.lastPassage;
    applyPosition(run, route, position, this.utcOffsetMinutes);
    this.runs.save(run);
    if (run.lastPassage && run.lastPassage !== before) {
      this.notifyDelay(run, route, run.lastPassage.stopIndex, run.lastPassage.delayMinutes);
      if (run.lastPassage.stopIndex === route.stops.length - 1) this.reportMissingPupils(run, route);
    }
    return true;
  }

  /**
   * Records a card tap from a bus reader (the reader id is the id of the bus unit).
   * Taps alternate between boarding and leaving; the parent is told in their chosen channel.
   */
  recordTap(input: TapInput): TapResult {
    const readerId = requireString(input?.readerId, "readerId");
    const cardNumber = requireString(input.cardNumber, "cardNumber");
    const time = new Date(input.time);
    if (typeof input.time !== "string" || Number.isNaN(time.getTime())) throw new ValidationError("time must be an ISO date-time");
    const pupil = this.pupils.findByCardNumber(cardNumber);
    if (!pupil) return { accepted: true, matched: false };
    const date = time.toISOString().slice(0, 10);
    const { attendance, kind } = applyTap(this.attendance.find(pupil.id, date), pupil.id, date);
    this.attendance.save(attendance);
    const verb = kind === "board" ? "boarded" : "left";
    this.notifyParent(pupil, `Bus ${readerId}`, `${pupil.name} ${verb} the bus at ${time.toISOString().slice(11, 16)} UTC.`);
    return { accepted: true, matched: true, kind };
  }

  private notifyParent(pupil: Pupil, subject: string, text: string): void {
    if (pupil.notificationChannel === "push" && pupil.pushDeviceToken) {
      this.push.send({ deviceToken: pupil.pushDeviceToken, text }).catch(() => {
        // Push failed: fall back to e-mail so the parent is still informed.
        this.mail.send({ to: pupil.parentEmail, subject, body: text });
      });
      return;
    }
    this.mail.send({ to: pupil.parentEmail, subject, body: text });
  }

  /** When the bus reaches the school (last stop), e-mails the office about morning pupils who never tapped on. */
  private reportMissingPupils(run: BusRun, route: Route): void {
    const key = `${route.id}|${run.date}`;
    if (this.ledger.isCancelled(`${key}|morning`) || this.ledger.isAbsenceReported(key)) return;
    this.ledger.markAbsenceReported(key);
    const schoolStopId = (route.stops[route.stops.length - 1] as Stop).id;
    const stopIds = new Set(route.stops.filter((s) => s.id !== schoolStopId).map((s) => s.id));
    const missing = this.pupils.list().filter((p) =>
      stopIds.has(p.morningStopId) && !this.attendance.find(p.id, run.date)?.hasBoarded);
    if (missing.length === 0) return;
    this.mail.send({
      to: this.schoolOfficeEmail,
      subject: `Pupils not on the bus: ${route.name}`,
      body: `The bus of route ${route.name} has reached the school on ${run.date}. These pupils did not tap on: ${missing.map((p) => p.name).join(", ")}.`,
    });
  }

  /** Cancels a trip (default today) and e-mails the parents of pupils at the stops not yet passed. */
  cancelTrip(routeId: string, trip: Trip, date?: string): { cancelled: true; notified: number } {
    if (trip !== "morning" && trip !== "afternoon") throw new ValidationError("trip must be morning or afternoon");
    const route = this.getRoute(routeId);
    const day = date === undefined ? this.clock.now().toISOString().slice(0, 10) : date;
    if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new ValidationError("date must be YYYY-MM-DD");
    const key = `${route.id}|${day}|${trip}`;
    if (this.ledger.isCancelled(key)) return { cancelled: true, notified: 0 };
    this.ledger.markCancelled(key);
    const run = this.runs.findByRouteAndDate(route.id, day);
    const firstStop = run?.lastPassage ? run.lastPassage.stopIndex + 1 : 0;
    const emails = new Set<string>();
    for (const pupil of this.pupilsAtStops(route, firstStop, [trip])) {
      if (emails.has(pupil.parentEmail)) continue;
      emails.add(pupil.parentEmail);
      this.mail.send({
        to: pupil.parentEmail,
        subject: `Bus trip cancelled: ${route.name}`,
        body: `The ${trip} trip of route ${route.name} on ${day} has been cancelled.`,
      });
    }
    return { cancelled: true, notified: emails.size };
  }

  /** Mutes delay e-mails of a route for today (the ledger is keyed by day, so it lapses at midnight). */
  muteDelays(routeId: string): { muted: true; date: string } {
    const route = this.getRoute(routeId);
    const date = this.clock.now().toISOString().slice(0, 10);
    this.ledger.markCancelled(`${route.id}|${date}|delays-muted`);
    return { muted: true, date };
  }

  private pupilsAtStops(route: Route, firstStop: number, trips: Trip[]): Pupil[] {
    const stopIds = new Set(route.stops.slice(firstStop).map((s) => s.id));
    return this.pupils.list().filter((p) =>
      trips.some((t) => stopIds.has(t === "morning" ? p.morningStopId : p.afternoonStopId)));
  }

  private notifyDelay(run: BusRun, route: Route, passedIndex: number, delayMinutes: number): void {
    const key = `${route.id}|${run.date}`;
    if (this.ledger.isCancelled(`${key}|morning`) && this.ledger.isCancelled(`${key}|afternoon`)) return;
    if (this.ledger.isCancelled(`${key}|delays-muted`)) return;
    const later = route.stops.slice(passedIndex + 1);
    const sentTo = new Set<string>();
    for (const pupil of this.pupilsAtStops(route, passedIndex + 1, ["morning", "afternoon"])) {
      const email = pupil.parentEmail;
      if (sentTo.has(email)) continue;
      if (!isDelayNotificationDue(delayMinutes, this.ledger.lastDelayNotified(key, email))) continue;
      sentTo.add(email);
      this.ledger.recordDelayNotified(key, email, delayMinutes);
      const stop = (later.find((s) => s.id === pupil.morningStopId) ?? later.find((s) => s.id === pupil.afternoonStopId)) as Stop;
      this.mail.send({
        to: email,
        subject: `Bus delayed: ${route.name}`,
        body: `The bus is ${Math.round(delayMinutes)} minutes late. New estimate for ${pupil.name} at ${stop.name}: ${formatTimeOfDay(stop.scheduledMinutes + delayMinutes)}.`,
      });
    }
  }

  getEta(pupilId: string, trip: Trip): EtaResult {
    if (trip !== "morning" && trip !== "afternoon") throw new ValidationError("trip must be morning or afternoon");
    const pupil = this.getPupil(pupilId);
    const stopId = trip === "morning" ? pupil.morningStopId : pupil.afternoonStopId;
    const route = this.routes.findByStopId(stopId);
    if (!route) throw new NotFoundError(`Stop ${stopId} not found`);
    const today = this.clock.now().toISOString().slice(0, 10);
    const run = this.runs.findByRouteAndDate(route.id, today);
    const estimate = estimateArrival(run, route, stopId);
    const stop = route.stops.find((s) => s.id === stopId);
    if (!stop) throw new NotFoundError(`Stop ${stopId} not found`);
    return {
      pupilId,
      trip,
      stopId,
      stopName: stop.name,
      routeId: route.id,
      scheduledTime: formatTimeOfDay(stop.scheduledMinutes),
      delayMinutes: Math.round(estimate.delayMinutes * 10) / 10,
      estimatedTime: formatTimeOfDay(estimate.estimatedMinutes),
      status: estimate.status,
    };
  }
}
