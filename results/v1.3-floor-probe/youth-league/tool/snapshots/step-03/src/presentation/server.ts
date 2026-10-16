import express from 'express';
import { createServices } from '../business/container';
import { buildRouter, errorHandler } from './controllers';

const services = createServices();
export const mailer = services.mailer;

const app = express();
app.use(express.json());
app.use(buildRouter(services.teams, services.fixtures, services.weather, services.referees));
app.use(errorHandler);

// every evening at 18:00 check tomorrow's fixtures
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 18 && now.getMinutes() === 0) {
    const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
    services.weather.checkMatchDay(tomorrow).catch((e) => console.error('weather check failed', e));
  }
}, 60000);

app.listen(Number(process.env.PORT ?? 3000), () => console.log('league service listening'));
