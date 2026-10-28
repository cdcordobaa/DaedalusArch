import { Drop } from './enrolment/application/Drop';
import { Enrol } from './enrolment/application/Enrol';
import { EventRelay } from './enrolment/application/EventRelay';
import { GetRoster } from './enrolment/application/GetRoster';
import { OpenSection } from './enrolment/application/OpenSection';
import { SendOpeningNotice } from './enrolment/application/SendOpeningNotice';
import { SwitchSection } from './enrolment/application/SwitchSection';
import { InMemoryNotices } from './enrolment/infrastructure/InMemoryNotices';
import { InMemorySectionRepository } from './enrolment/infrastructure/InMemorySectionRepository';

export interface AppOptions {
  /** Today's date as YYYY-MM-DD; defaults to the system date. */
  readonly today?: () => string;
}

/** Composition root. Every command delivers the events it stored before it returns. */
export function createApp(options: AppOptions = {}) {
  const today = options.today ?? (() => new Date().toISOString().slice(0, 10));
  const sections = new InMemorySectionRepository();
  const notices = new InMemoryNotices();
  const relay = new EventRelay(sections);
  const opening = new SendOpeningNotice(notices);
  relay.on('SectionOpened', (e) => opening.handle(e));
  const command = <T>(run: () => T): T => {
    const result = run();
    relay.deliverPending();
    return result;
  };
  return {
    openSection: (courseCode: string, capacity: number): string => command(() => new OpenSection(sections).execute(courseCode, capacity)),
    enrol: (sectionId: string, studentId: string): void => command(() => new Enrol(sections).execute(sectionId, studentId)),
    drop: (sectionId: string, studentId: string): void => command(() => new Drop(sections).execute(sectionId, studentId)),
    switchSection: (studentId: string, fromSectionId: string, toSectionId: string): void =>
      command(() => new SwitchSection(sections).execute(studentId, fromSectionId, toSectionId)),
    rosterOf: (sectionId: string): string[] => new GetRoster(sections).execute(sectionId),
    notices: (): string[] => notices.all(),
  };
}
