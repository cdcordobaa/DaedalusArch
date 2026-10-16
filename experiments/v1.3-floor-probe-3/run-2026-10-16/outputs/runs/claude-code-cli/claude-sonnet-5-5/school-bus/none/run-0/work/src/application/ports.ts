import type { Route } from "../domain/route.js";
import type { Pupil } from "../domain/pupil.js";
import type { Attendance } from "../domain/attendance.js";
import type { BusRun } from "../domain/busRun.js";

export interface RouteRepository {
  save(route: Route): void;
  findById(id: string): Route | undefined;
  findByStopId(stopId: string): Route | undefined;
  list(): Route[];
}

export interface PupilRepository {
  save(pupil: Pupil): void;
  findById(id: string): Pupil | undefined;
  findByCardNumber(cardNumber: string): Pupil | undefined;
  list(): Pupil[];
}

export interface BusRunRepository {
  save(run: BusRun): void;
  findByUnitId(unitId: string): BusRun | undefined;
  findByRouteAndDate(routeId: string, date: string): BusRun | undefined;
}

export interface IdGenerator {
  next(): string;
}

export interface Clock {
  now(): Date;
}

export interface MailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface MailProvider {
  send(message: MailMessage): void;
}

export interface PushMessage {
  deviceToken: string;
  text: string;
}

/** Sends push notifications through PingPost. */
export interface PushProvider {
  send(message: PushMessage): Promise<void>;
}

export interface AttendanceRepository {
  find(pupilId: string, date: string): Attendance | undefined;
  save(attendance: Attendance): void;
}

/** Remembers which notifications were already sent for a trip. */
export interface NotificationLedger {
  lastDelayNotified(tripKey: string, email: string): number | undefined;
  recordDelayNotified(tripKey: string, email: string, delayMinutes: number): void;
  isCancelled(tripKey: string): boolean;
  markCancelled(tripKey: string): void;
  isAbsenceReported(tripKey: string): boolean;
  markAbsenceReported(tripKey: string): void;
}
