import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { Controllers } from '../container';

/** Adapts an async controller method to express, forwarding rejections to the error handler. */
function route(action: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    action(req, res).catch(next);
  };
}

export function apiRouter({ members, memberships, bookings, billing }: Controllers): Router {
  return Router()
    .post('/members', route((q, s) => members.register(q, s)))
    .get('/members', route((q, s) => members.byCompany(q, s)))
    .get('/members/:id', route((q, s) => members.findOne(q, s)))
    .post('/memberships', route((q, s) => memberships.start(q, s)))
    .post('/memberships/:id/pause', route((q, s) => memberships.pause(q, s)))
    .post('/memberships/:id/resume', route((q, s) => memberships.resume(q, s)))
    .post('/memberships/:id/cancel', route((q, s) => memberships.cancel(q, s)))
    .post('/desk-bookings', route((q, s) => bookings.bookDesk(q, s)))
    .get('/desk-bookings/:date', route((q, s) => bookings.desksOn(q, s)))
    .delete('/members/:memberId/desk-bookings/:bookingId', route((q, s) => bookings.cancelDesk(q, s)))
    .post('/rooms/:roomId/bookings', route((q, s) => bookings.bookRoom(q, s)))
    .get('/rooms/:roomId/bookings', route((q, s) => bookings.roomSchedule(q, s)))
    .delete('/room-bookings/:bookingId', route((q, s) => bookings.cancelRoom(q, s)))
    .post('/day-passes', route((q, s) => billing.sellDayPass(q, s)))
    .post('/memberships/:membershipId/invoices', route((q, s) => billing.issueInvoice(q, s)))
    .post('/invoices/:invoiceId/payment', route((q, s) => billing.markPaid(q, s)))
    .get('/members/:memberId/invoices', route((q, s) => billing.invoicesOf(q, s)));
}
