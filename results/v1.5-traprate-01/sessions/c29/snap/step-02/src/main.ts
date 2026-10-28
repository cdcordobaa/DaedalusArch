import { openPassOffice, passReactions } from './passes';
import { MemoryPassStore } from './passes/infrastructure/MemoryPassStore';
import { openSchool, schoolReactions, type SchoolParts } from './school';
import { MemoryLessonStore } from './school/infrastructure/MemoryLessonStore';
import { MemoryPupilCards } from './school/infrastructure/MemoryPupilCards';
import { Mailroom } from './wiring/mailroom';

/**
 * Composition root of the resort. After each change the mailroom delivers what was written, so a caller sees the
 * resort settled when the call returns.
 */
export function createApp() {
  const passStore = new MemoryPassStore();
  const lessonStore = new MemoryLessonStore();
  const parts: SchoolParts = { lessons: lessonStore, cards: new MemoryPupilCards() };
  const office = openPassOffice(passStore);
  const school = openSchool(parts);
  const mailroom = new Mailroom([passStore, lessonStore]);
  mailroom.subscribe(schoolReactions(parts));
  mailroom.subscribe(passReactions(passStore));

  function settled<T>(change: () => T): T {
    const out = change();
    mailroom.drain();
    return out;
  }

  return {
    issuePass: (holder: string, credit: number) => settled(() => office.issue(holder, credit)),
    loadCredit: (passNo: string, euros: number) => settled(() => office.load(passNo, euros)),
    payAtKiosk: (passNo: string, euros: number, what: string) => settled(() => office.pay(passNo, euros, what)),
    pass: (passNo: string) => office.pass(passNo),
    offerLesson: (title: string, day: string, places: number, price: number) => settled(() => school.offer(title, day, places, price)),
    enrol: (passNo: string, lessonId: string) => settled(() => school.enrol(passNo, lessonId)),
    withdraw: (passNo: string, lessonId: string) => settled(() => school.withdraw(passNo, lessonId)),
    callOff: (lessonId: string) => settled(() => school.callOff(lessonId)),
    lesson: (lessonId: string) => school.lesson(lessonId),
    placeOf: (lessonId: string, passNo: string) => school.placeOf(lessonId, passNo),
    pupils: (lessonId: string) => school.pupils(lessonId),
  };
}
