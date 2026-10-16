import { BusTrackingService } from "../application/busTrackingService.js";
import { FakeMailProvider, InMemoryNotificationLedger } from "./fakeMailProvider.js";
import { createHttpApp } from "./httpApp.js";
import { FakePushProvider, HttpPingPostProvider } from "./pingPostProvider.js";
import {
  InMemoryAttendanceRepository,
  InMemoryBusRunRepository,
  InMemoryPupilRepository,
  InMemoryRouteRepository,
  SystemClock,
  UuidGenerator,
} from "./inMemoryRepositories.js";

const pingPostUrl = process.env["PINGPOST_URL"];
const utcOffsetMinutes = Number(process.env["UTC_OFFSET_MINUTES"] ?? 0);
const service = new BusTrackingService(
  new InMemoryRouteRepository(),
  new InMemoryPupilRepository(),
  new InMemoryBusRunRepository(),
  new UuidGenerator(),
  new SystemClock(),
  Number.isFinite(utcOffsetMinutes) ? utcOffsetMinutes : 0,
  new FakeMailProvider(),
  new InMemoryNotificationLedger(),
  pingPostUrl
    ? new HttpPingPostProvider(pingPostUrl, process.env["PINGPOST_API_KEY"])
    : new FakePushProvider(),
  new InMemoryAttendanceRepository(),
  process.env["SCHOOL_OFFICE_EMAIL"] ?? "office@school.example",
);

const port = Number(process.env["PORT"] ?? 3000);
createHttpApp(service).listen(port, () => {
  console.log(`School bus tracking listening on ${port}`);
});
