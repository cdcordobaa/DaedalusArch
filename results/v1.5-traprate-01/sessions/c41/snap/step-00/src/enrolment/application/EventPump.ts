import type { SchoolEvent } from '../../shared-kernel/SchoolEvent';
import type { EventBacklog } from './ports/EventBacklog';

export type Listener = (fact: SchoolEvent) => void;

/** Hands stored facts to their listeners after the change that raised them is kept. A listener may raise more. */
export class EventPump {
  private readonly listeners: { readonly type: string; readonly listener: Listener }[] = [];

  constructor(private readonly backlog: EventBacklog) {}

  subscribe(type: string, listener: Listener): void {
    this.listeners.push({ type, listener });
  }

  drain(): void {
    for (let due = this.backlog.drainUnsent(); due.length > 0; due = this.backlog.drainUnsent()) {
      for (const fact of due) {
        for (const entry of this.listeners) if (entry.type === fact.type) entry.listener(fact);
      }
    }
  }
}
