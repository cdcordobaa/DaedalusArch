import express from 'express';
import { FixtureRepository, PitchRepository, PlayerRepository, TeamRepository } from '../persistence/repositories';
import { WeatherNowClient } from '../persistence/weather-client';
import { FakeMailer } from '../persistence/fake-mailer';
import { WeatherService } from '../business/weather-service';
import { TeamService } from '../business/team-service';
import { FixtureService } from '../business/fixture-service';
import { buildRouter, errorHandler } from './controllers';

const teamRepo = new TeamRepository();
const playerRepo = new PlayerRepository();
const fixtureRepo = new FixtureRepository();
const pitchRepo = new PitchRepository();
export const mailer = new FakeMailer();
const weather = new WeatherService(fixtureRepo, pitchRepo, teamRepo, new WeatherNowClient(), mailer);

const app = express();
app.use(express.json());
app.use(buildRouter(new TeamService(teamRepo, playerRepo), new FixtureService(fixtureRepo, teamRepo, pitchRepo), weather));
app.use(errorHandler);

// every evening at 18:00 check tomorrow's fixtures
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 18 && now.getMinutes() === 0) {
    const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
    weather.checkMatchDay(tomorrow).catch((e) => console.error('weather check failed', e));
  }
}, 60000);

app.listen(Number(process.env.PORT ?? 3000), () => console.log('league service listening'));
