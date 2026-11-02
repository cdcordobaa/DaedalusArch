/**
 * v1.5.7 (2026-11-02) R-D5S revision, development fixtures (`experiments/r-d5s-dev/README.md`). Zero model calls, no
 * Neo4j. Each tree is a small lodging context (owner `RoomCalendar` of the set invariant `room-no-overlap`) with one
 * variant file overlaid. Positives and their hard clean twins:
 * - a then-block that logs and then throws (P1) vs the same block inside the owner (T1);
 * - a `switch` case that throws (P2) vs the same switch inside the owner (T2);
 * - a batch handler that `continue`s past a booking write (P3) vs a filter loop that `continue`s past a push (T3);
 * - a domain service reading the calendar (P4) vs a value object validating its own range in `domain/shared` (T4).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadRules, runTree } from '../../../src/v15-instrument/index.js';

const SPEC = `spec_version: "1.0.0"
architecture:
  style: ddd
  layers:
    - { name: domain, kind: domain, directories: ["src/*/domain/**"] }
    - { name: application, kind: application, directories: ["src/*/application/**"] }
    - { name: infrastructure, kind: infrastructure, directories: ["src/*/infrastructure/**"] }
  ddd:
    source_root: src/
    contexts:
      - { name: lodging, root: src/lodging/, public_api: [], acl: [] }
    outside_contexts: []
    aggregates:
      - { name: RoomCalendar, context: lodging, module: "src/lodging/domain/calendar/**", root: src/lodging/domain/calendar/RoomCalendar.ts, inner_entities: [] }
      - { name: Booking, context: lodging, module: "src/lodging/domain/booking/**", root: src/lodging/domain/booking/Booking.ts, inner_entities: [] }
    repositories: ["src/*/domain/**/*Repository.ts", "src/*/infrastructure/**/*Repository.ts"]
    domain_event_types: [DomainEvent]
    invariants:
      - { id: room-no-overlap, kind: set, owner: RoomCalendar, over: [Booking], terms: [roomId, checkIn, checkOut], statement: "a room never has two overlapping bookings" }
`;

const CAL = (body: string): string => `import { Booking } from '../booking/Booking';

export class RoomCalendar {
  private items: Booking[] = [];
  constructor(readonly roomId: string) {}
  bookings(): readonly Booking[] {
    return this.items;
  }
  book(b: Booking): void {
${body}
    this.items.push(b);
  }
}
`;
const OWNER_CHECK = `    if (this.items.some((x) => x.checkIn < b.checkOut && b.checkIn < x.checkOut)) throw new Error('room is taken');`;

const BASE: Record<string, string> = {
  'src/lodging/domain/booking/Booking.ts': `export class Booking {
  constructor(readonly id: string, readonly roomId: string, readonly checkIn: number, readonly checkOut: number) {}
}
`,
  'src/lodging/domain/calendar/RoomCalendar.ts': CAL(OWNER_CHECK),
  'src/lodging/domain/calendar/RoomCalendarRepository.ts': `import { RoomCalendar } from './RoomCalendar';

export interface RoomCalendarRepository {
  find(roomId: string): RoomCalendar | undefined;
  save(c: RoomCalendar): void;
}
`,
  'src/lodging/infrastructure/InMemoryRoomCalendarRepository.ts': `import { RoomCalendar } from '../domain/calendar/RoomCalendar';
import { RoomCalendarRepository } from '../domain/calendar/RoomCalendarRepository';

export class InMemoryRoomCalendarRepository implements RoomCalendarRepository {
  private rows = new Map<string, RoomCalendar>();
  find(roomId: string): RoomCalendar | undefined {
    return this.rows.get(roomId);
  }
  save(c: RoomCalendar): void {
    this.rows.set(c.roomId, c);
  }
}
`,
  'src/lodging/application/BookingService.ts': `import { Booking } from '../domain/booking/Booking';
import { RoomCalendarRepository } from '../domain/calendar/RoomCalendarRepository';

export class BookingService {
  constructor(private repo: RoomCalendarRepository) {}
  book(id: string, roomId: string, checkIn: number, checkOut: number): void {
    const cal = this.repo.find(roomId);
    if (!cal) throw new Error('no such room');
    cal.book(new Booking(id, roomId, checkIn, checkOut));
    this.repo.save(cal);
  }
}
`,
};

const SERVICE_WITH = (guard: string): string => `import { Booking } from '../domain/booking/Booking';
import { RoomCalendarRepository } from '../domain/calendar/RoomCalendarRepository';

export interface Log { warn(m: string): void }

export class BookingService {
  constructor(private repo: RoomCalendarRepository, private log: Log) {}
  book(id: string, roomId: string, checkIn: number, checkOut: number): void {
    const cal = this.repo.find(roomId);
    if (!cal) throw new Error('no such room');
${guard}
    cal.book(new Booking(id, roomId, checkIn, checkOut));
    this.repo.save(cal);
  }
}
`;

const VARIANTS: Record<string, Record<string, string>> = {
  // P1: the rejection logs first, then throws (not a lone throw)
  P1: {
    'src/lodging/application/BookingService.ts': SERVICE_WITH(`    const clash = cal.bookings().some((b) => b.checkIn < checkOut && checkIn < b.checkOut);
    if (clash) {
      this.log.warn('room ' + roomId + ' is taken');
      throw new Error('room is taken');
    }`),
  },
  // T1: the same log-then-throw block, inside the owner
  T1: {
    'src/lodging/domain/calendar/RoomCalendar.ts': CAL(`    const clash = this.items.some((x) => x.checkIn < b.checkOut && b.checkIn < x.checkOut);
    if (clash) {
      console.warn('room ' + b.roomId + ' is taken');
      throw new Error('room is taken');
    }`),
  },
  // P2: a switch case that throws, in the application service
  P2: {
    'src/lodging/application/BookingService.ts': SERVICE_WITH(`    switch (cal.bookings().some((b) => b.checkIn < checkOut && checkIn < b.checkOut)) {
      case true:
        this.log.warn('taken');
        throw new Error('room is taken');
      default:
        break;
    }`),
  },
  // T2: the same switch inside the owner
  T2: {
    'src/lodging/domain/calendar/RoomCalendar.ts': CAL(`    switch (this.items.some((x) => x.checkIn < b.checkOut && b.checkIn < x.checkOut)) {
      case true:
        throw new Error('room is taken');
      default:
        break;
    }`),
  },
  // P3: a batch handler skips (continue) a booking whose overlap it decides itself; the skipped work writes
  P3: {
    'src/lodging/infrastructure/messaging/BookingBatchHandler.ts': `import { BookingService } from '../../application/BookingService';
import { RoomCalendarRepository } from '../../domain/calendar/RoomCalendarRepository';

export interface BookMsg { id: string; roomId: string; checkIn: number; checkOut: number }

export class BookingBatchHandler {
  constructor(private service: BookingService, private repo: RoomCalendarRepository) {}
  onBatch(batch: BookMsg[]): void {
    for (const m of batch) {
      const taken = this.repo.find(m.roomId)?.bookings().some((b) => b.checkIn < m.checkOut && m.checkIn < b.checkOut) ?? false;
      if (taken) continue;
      this.service.book(m.id, m.roomId, m.checkIn, m.checkOut);
    }
  }
}
`,
  },
  // T3: a filter loop in a query: continue skips a push into a local list, nothing that writes
  T3: {
    'src/lodging/application/BookingQueries.ts': `import { Booking } from '../domain/booking/Booking';
import { RoomCalendarRepository } from '../domain/calendar/RoomCalendarRepository';

export class BookingQueries {
  constructor(private repo: RoomCalendarRepository) {}
  inWindow(roomId: string, from: number, to: number): Booking[] {
    const out: Booking[] = [];
    for (const b of this.repo.find(roomId)?.bookings() ?? []) {
      if (b.roomId !== roomId || b.checkIn >= to || b.checkOut <= from) continue;
      out.push(b);
    }
    return out;
  }
}
`,
  },
  // P4: a domain service outside the owner decides the overlap on the calendar's bookings
  P4: {
    'src/lodging/domain/policy/BookingPolicy.ts': `import { RoomCalendar } from '../calendar/RoomCalendar';

export class BookingPolicy {
  assertFree(cal: RoomCalendar, checkIn: number, checkOut: number): void {
    if (cal.bookings().some((b) => b.checkIn < checkOut && checkIn < b.checkOut)) throw new Error('room is taken');
  }
}
`,
  },
  // T4: a value object in domain/shared validates its own range with two invariant term names
  T4: {
    'src/lodging/domain/shared/StayRange.ts': `export class StayRange {
  constructor(readonly checkIn: number, readonly checkOut: number) {
    if (checkIn >= checkOut) throw new Error('check-out must follow check-in');
  }
}
`,
  },
};

describe('v1.5.7 R-D5S: rejection shapes and value guards (development fixtures)', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v157-d5s-'));
  afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const rules = loadRules();
  const spec = path.join(scratch, 'spec.yaml');
  fs.writeFileSync(spec, SPEC);
  const d5s = async (variant: string | null) => {
    const root = path.join(scratch, variant ?? 'base');
    for (const [f, body] of Object.entries({ ...BASE, ...(variant ? VARIANTS[variant] : {}) })) {
      fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
      fs.writeFileSync(path.join(root, f), body);
    }
    return (await runTree(root, rules, { spec, scratch: path.join(scratch, '_s') })).findings.filter((x) => x.rule === 'R-D5S');
  };

  it('the base (owner enforces the overlap) is silent', async () => {
    expect(await d5s(null)).toEqual([]);
  });

  it.each([
    ['P1', 'src/lodging/application/BookingService.ts'],
    ['P2', 'src/lodging/application/BookingService.ts'],
    ['P3', 'src/lodging/infrastructure/messaging/BookingBatchHandler.ts'],
    ['P4', 'src/lodging/domain/policy/BookingPolicy.ts'],
  ])('%s: flags the overlap decided outside RoomCalendar', async (v, file) => {
    const f = await d5s(v);
    expect(f.map((x) => x.file)).toContain(file);
    expect(f.every((x) => x.evidence.includes('room-no-overlap'))).toBe(true);
  });

  it.each(['T1', 'T2', 'T3', 'T4'])('%s: the hard clean twin is silent', async (v) => {
    expect(await d5s(v)).toEqual([]);
  });

  it('P2 reports the case clause as the guard (switch expression === case)', async () => {
    const f = await d5s('P2');
    expect(f[0]!.evidence).toContain('=== true');
  });
});
