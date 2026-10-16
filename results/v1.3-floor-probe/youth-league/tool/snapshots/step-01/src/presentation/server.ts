import express from 'express';
import { createServices } from '../business/container';
import { buildRouter, errorHandler } from './controllers';

const services = createServices();

const app = express();
app.use(express.json());
app.use(buildRouter(services.teams, services.fixtures));
app.use(errorHandler);

app.listen(Number(process.env.PORT ?? 3000), () => console.log('league service listening'));
