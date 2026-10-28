import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { Outbox } from '../application/ports/Outbox';
import { Section, type SectionState } from '../domain/section/Section';
import type { SectionRepository } from '../domain/section/SectionRepository';
import { SectionId } from '../domain/section/value-objects/SectionId';

/** Sections and their outbox in one store: saving a section stores its pending events in the same step. */
export class InMemorySectionRepository implements SectionRepository, Outbox {
  private readonly rows = new Map<string, SectionState>();
  private outbox: DomainEvent[] = [];
  private sequence = 0;

  nextId(): SectionId {
    this.sequence += 1;
    return SectionId.of(`S-${String(this.sequence).padStart(4, '0')}`);
  }

  byId(id: SectionId): Section | undefined {
    const row = this.rows.get(id.value);
    return row === undefined ? undefined : Section.restore(row);
  }

  save(section: Section): void {
    const events = section.pullEvents();
    this.rows.set(section.id.value, section.state());
    this.outbox = [...this.outbox, ...events];
  }

  saveAll(sections: readonly Section[]): void {
    const states = sections.map((s) => s.state());
    const events = sections.flatMap((s) => s.pullEvents());
    for (const state of states) this.rows.set(state.id.value, state);
    this.outbox = [...this.outbox, ...events];
  }

  takePending(): DomainEvent[] {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }
}
