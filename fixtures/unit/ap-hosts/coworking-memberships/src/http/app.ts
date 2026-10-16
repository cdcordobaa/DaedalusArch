import express, { Application } from 'express';
import { Controllers } from '../container';
import { errorHandler } from './error-handler';
import { apiRouter } from './routes';

export function createApp(controllers: Controllers): Application {
  return express().use(express.json()).use('/api', apiRouter(controllers)).use(errorHandler);
}
