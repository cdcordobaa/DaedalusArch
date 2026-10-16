import express from 'express';
import { apiRouter, errorHandler } from './api';
import { createServices } from '../business/container';

const services = createServices();

const app = express();
app.use(express.json());
app.use(apiRouter(services.apiaries, services.scales, services.treatments));
app.use(errorHandler);
app.listen(Number(process.env.PORT ?? 3000), () => console.log('beekeepers service listening'));
