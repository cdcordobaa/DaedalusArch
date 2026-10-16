import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { Container } from 'typedi';
import { JobsController } from './jobs.controller';
import { QuotesController } from './quotes.controller';
import { TranslatorsController } from './translators.controller';

function route(action: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    action(req, res).catch(next);
  };
}

export function httpRouter(): Router {
  const quotes = Container.get(QuotesController);
  const jobs = Container.get(JobsController);
  const translators = Container.get(TranslatorsController);
  return Router()
    .post('/quotes', route((q, s) => quotes.request(q, s)))
    .post('/quotes/:quoteId/acceptance', route((q, s) => quotes.accept(q, s)))
    .get('/jobs/late', route((q, s) => jobs.late(q, s)))
    .get('/jobs/:jobId', route((q, s) => jobs.findOne(q, s)))
    .get('/clients/:clientId/jobs', route((q, s) => jobs.forClient(q, s)))
    .post('/jobs/:jobId/assignment', route((q, s) => jobs.assign(q, s)))
    .post('/jobs/:jobId/delivery', route((q, s) => jobs.deliver(q, s)))
    .post('/jobs/:jobId/review', route((q, s) => jobs.review(q, s)))
    .post('/jobs/:jobId/cancellation', route((q, s) => jobs.cancel(q, s)))
    .post('/translators', route((q, s) => translators.register(q, s)))
    .get('/translators', route((q, s) => translators.forPair(q, s)));
}
