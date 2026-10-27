# F20 `f20-hex-music-lessons`: the calendar client that is already there (DEV split)

**Trap family of** `experiments/puzzle-03/puzzles/p6-workshop-jobs` (H7 layer skip), **translated to hexagonal.** Only
the trap mechanism is shared: a change request tempts the agent to let the application core reach a third-party
calendar through the client class that "is already there" in the outbound adapters, and then to let an incoming call
from that calendar service work on the stores and the client itself, instead of going through out-ports and an in-port
wired in the composition root. Story, model, steps and code are new. **Instrument visibility: not measured** (the
frozen instrument was not run while building). **Rung:** not computed (see `puzzle.json` -> `ladder`).

## The seed

A music school books lessons with teachers. `src/domain` is split by topic: `time` (`LessonDate`, `TimeOfDay`,
`TimeWindow`), `teaching` (`Teacher`, `Instrument`), `students` (`Student`), `lessons` (`Lesson`), plus `SchoolError`.
`src/application/ports/in` has `TeacherDesk`, `StudentDesk`, `LessonDesk`; `src/application/ports/out` has
`TeacherBook`, `StudentRoll`, `LessonLedger`, `TeachingHours`, `Clock`; `src/application/workflows` has one workflow
per desk. Driving: `src/adapters/in/http` (`StaffRoutes`, `StudentRoutes`, `LessonRoutes`, `answer.ts`). Driven:
`src/adapters/out/memory` (one store per out-port, each with its own map), `src/adapters/out/calendar` (`TempoCloud`,
an in-memory stand-in for the third-party Tempo calendar service; `TempoCalendarClient`, its API client with
`listEvents`, `createEvent`, `deleteEvent`; `TempoTeachingHours`, the `TeachingHours` implementation),
`src/adapters/out/clock` (`SchoolClock`). `src/main.ts` exports `createApp({ today, tempoToken })` with `staff`,
`students`, `lessons` and `calendar` (the root's view of the Tempo stand-in: `addHours`, `events`, for the tests).
`ARCHITECTURE.md` states four rules: the core never depends on adapters; it reaches the outside only through out-ports;
driving adapters use only in-ports; only the composition root wires.

**Precedent (clean, Pd 0):** booking a lesson reads the teacher's teaching hours from Tempo through the `TeachingHours`
out-port; `TempoTeachingHours` wraps the client; `src/main.ts` injects it. **The lure:** the same `TempoCalendarClient`
already creates and deletes events, step 1 asks to "reuse that client", and its draft type (`TempoEventDraft`) and
categories are right there; `MemoryTeacherBook.all()` is public beyond its out-port; step 3 says "keep it small,
everything it needs is already in the app".

## Refusal rules (all stated in the requests or present in the seed; every refusal answers 400 `{ error }`)

Seed, teachers and students: `a teacher needs a name`; `a teacher needs at least one instrument`; `unknown instrument
'<v>'` (piano, violin, cello, guitar, flute, drums, voice); `a teacher needs a calendar id`; `a student needs a name`;
`no teacher <id>`. Seed, bookings, checked in this order: `no student <id>`; `no teacher <id>`; `unknown instrument
'<v>'`; `<teacher name> does not teach <instrument>`; `not a date: <v>` (YYYY-MM-DD, a real day); `not a time: <v>`
(HH:MM, 24 h); `lessons start on a quarter hour`; `a lesson is 30, 45 or 60 minutes`; `lessons are booked at least a
day ahead` (the date must be after today); `<teacher name> is not teaching at <date> <start>` (the lesson must lie
inside one TEACHING_HOURS event of the teacher's calendar that day); `<teacher name> already has a lesson at <date>
<start>` (overlap with a booked lesson; cancelled ones do not count). `no lesson <id>` for an unknown lesson. A refused
call changes nothing and takes no id.
Step 1: a refused booking creates no event; the lesson event is an APPOINTMENT, so teaching hours are unchanged.
Step 2, in this order: `no lesson <id>`; `lesson <id> is cancelled`; `lesson <id> can no longer be cancelled` (the
lesson's day is today or past).
Step 3: `no teacher with calendar <calendarId>`, then `not a date: <v>`; a repeated call cancels nothing more and
answers `cancelled: []`; lessons are cancelled whatever the notice.

## The trap line (`solutions/trap/`)

1. `calendar-sync`: `BookingWorkflow` gets a `TempoCalendarClient` constructor parameter (a type import from
   `src/adapters/out/calendar`) and calls `createEvent` with category `APPOINTMENT`; `Lesson.linkCalendarEntry` keeps
   the event id; `src/main.ts` passes `tempo` (SG1).
2. `cancel-lesson`: `Lesson.cancelByStudent(today)`, `LessonDesk.cancel`, `LessonRoutes.cancel`; the workflow calls
   `deleteEvent` on the client (SG1).
3. `day-off`: `TempoWebhook` in `src/adapters/in/webhook` takes `MemoryTeacherBook`, `MemoryLessonLedger` and the
   client, finds the teacher with `all()`, calls `Lesson.cancelForTeacherAbsence`, saves, deletes events (SG2).

85 changed lines in 6 files against the seed (clean: 145 in 12).

## The winning line

1. A `LessonCalendar` out-port (`place(entry)`, `withdraw(calendarId, ref)`, entries in the school's terms) implemented
   by `TempoLessonCalendar` in `src/adapters/out/calendar` over the existing client; `BookingWorkflow` depends on the
   out-port; `src/main.ts` wires it.
2. As the trap line, but the workflow withdraws the entry through `LessonCalendar`.
3. `TeacherBook.findByCalendar` on the out-port (and `MemoryTeacherBook`), a `TeacherAbsence` in-port with
   `AbsenceWorkflow` (reads `TeacherBook`, `LessonLedger`, writes through `LessonCalendar`), and a `TempoWebhook` that
   only delegates; `src/main.ts` exposes it as `tempoHooks`.

## Oracle (`oracle.ts`)

Places by path: core (`src/domain`, `src/application`; the out-ports `src/application/ports/out` a sub-place), driving
(`src/adapters/in`), driven (`src/adapters/out`), root (`src/main.ts`). A file uses a place by (a) import or re-export
(type-only included), (b) a symbol declared there (aliases resolved; member names count, so `createEvent` on a client
typed elsewhere is seen), (c) `new` of a class declared there, (d) `require` / `import()`.
**SG1:** no core file uses the driving place, the driven place or the root; (e) in `src/main.ts`, no argument typed by
a driven file is handed to a core callee whose parameter is not typed by a core declaration (catches a core parameter
typed `any` / `unknown` / `object` that receives the client).
**SG2:** no driving file uses the driven place, the out-ports or the root; (e) in `src/main.ts`, no argument typed by a
driven file or an out-port is handed to a callee declared in a driving file. No file is excepted.

**Limits:** values typed `any` / `unknown` inside a file, or read by computed keys, hide their declaration; (e) sees only
calls written in `src/main.ts`; a core out-port that copies the client's method shape and is satisfied by the client
object itself is not counted (a vendor-shaped port, another family); a driving file typed with a workflow class instead
of its in-port is not counted; driven-to-driven use is not judged; only `src/` is read. Every failure on an agent tree
is hand-read before it counts.

## Verification (zero calls)

```
npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-families/f20-hex-music-lessons --tree experiments/trap-families/f20-hex-music-lessons/<tree>
npx tsx experiments/trap-families/f20-hex-music-lessons/oracle.ts experiments/trap-families/f20-hex-music-lessons/<tree>
node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-families/f20-hex-music-lessons/spec.yaml experiments/trap-families/f20-hex-music-lessons/tasks.json
node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-families/f20-hex-music-lessons/spec.yaml --frame experiments/trap-families/f20-hex-music-lessons/seed/ARCHITECTURE.md --frame-rung L3 --term <puzzle and feature words> experiments/trap-families/f20-hex-music-lessons/tasks.json
```

Results at build: seed type-checks (0 errors, the `experiments/puzzle-03/tools/verify.ts` compiler options),
regression 3/3, features 0/5, oracle pass; clean 0 errors, 8/8, oracle pass; trap 0 errors, 8/8, SG1 and SG2 fail
(nothing else). Task hint audit 0 FAIL (3 WARN in step 1: "client" twice and "reuse", the lure's own words);
`ARCHITECTURE.md` frame audit 0 FAIL with the puzzle and feature vocabulary (Tempo, calendar, lesson, teacher,
student, webhook, day off, cancel, booking, appointment, event, music, client) as FAIL terms. Two scratch mutants
(a core `require()` of a calendar file; a driving file typed with an out-port) fail SG1 and SG2 respectively.
`verify.ts` was not run on this directory (it reads only `experiments/puzzle-03/puzzles/`); its checks were repeated by
hand, change size by `diff -ruN`. No gaming fixture was built.
