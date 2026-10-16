import express from 'express';
import { BookKayak } from '../application/book-kayak';
import { HandOutKayak } from '../application/hand-out-kayak';
import { ReturnKayak } from '../application/return-kayak';
import { rentalRoutes } from './http/routes';
import { PaddlePayClient } from './payments/paddle-pay-client';
import { InMemoryBookingRepository } from './persistence/in-memory-booking-repository';
import { InMemoryKayakRepository } from './persistence/in-memory-kayak-repository';

export function buildApp(): express.Express {
  const kayaks = new InMemoryKayakRepository();
  const bookings = new InMemoryBookingRepository();
  const paddlePay = new PaddlePayClient();
  const app = express();
  app.use(express.json());
  app.use(
    rentalRoutes({
      bookKayak: new BookKayak(kayaks, bookings, paddlePay),
      handOutKayak: new HandOutKayak(bookings),
      returnKayak: new ReturnKayak(bookings),
    }),
  );
  return app;
}

if (require.main === module) {
  buildApp().listen(3000, () => console.log('kayak rentals on :3000'));
}
