import { randomUUID } from "node:crypto";
import type { Attendance } from "../domain/attendance.js";
import type { AttendanceRepository, BusRunRepository, Clock, IdGenerator, PupilRepository, RouteRepository } from "../application/ports.js";
import type { Route } from "../domain/route.js";
import type { Pupil } from "../domain/pupil.js";
import type { BusRun } from "../domain/busRun.js";

export class InMemoryRouteRepository implements RouteRepository {
  private readonly items = new Map<string, Route>();
  save(route: Route): void { this.items.set(route.id, route); }
  findById(id: string): Route | undefined { return this.items.get(id); }
  findByStopId(stopId: string): Route | undefined {
    return [...this.items.values()].find((r) => r.stops.some((s) => s.id === stopId));
  }
  list(): Route[] { return [...this.items.values()]; }
}

export class InMemoryPupilRepository implements PupilRepository {
  private readonly items = new Map<string, Pupil>();
  save(pupil: Pupil): void { this.items.set(pupil.id, pupil); }
  findById(id: string): Pupil | undefined { return this.items.get(id); }
  findByCardNumber(cardNumber: string): Pupil | undefined {
    return [...this.items.values()].find((p) => p.cardNumber === cardNumber);
  }
  list(): Pupil[] { return [...this.items.values()]; }
}

export class InMemoryAttendanceRepository implements AttendanceRepository {
  private readonly items = new Map<string, Attendance>();
  find(pupilId: string, date: string): Attendance | undefined { return this.items.get(`${pupilId}|${date}`); }
  save(a: Attendance): void { this.items.set(`${a.pupilId}|${a.date}`, a); }
}

export class InMemoryBusRunRepository implements BusRunRepository {
  private readonly items = new Map<string, BusRun>();
  save(run: BusRun): void { this.items.set(run.unitId, run); }
  findByUnitId(unitId: string): BusRun | undefined { return this.items.get(unitId); }
  findByRouteAndDate(routeId: string, date: string): BusRun | undefined {
    return [...this.items.values()].find((r) => r.routeId === routeId && r.date === date);
  }
}

export class UuidGenerator implements IdGenerator {
  next(): string { return randomUUID(); }
}

export class SystemClock implements Clock {
  now(): Date { return new Date(); }
}
