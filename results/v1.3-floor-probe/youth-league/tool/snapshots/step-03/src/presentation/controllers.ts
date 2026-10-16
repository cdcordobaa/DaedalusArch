import { NextFunction, Request, Response, Router } from 'express';
import { TeamService } from '../business/team-service';
import { FixtureService } from '../business/fixture-service';
import { WeatherService } from '../business/weather-service';
import { RefereeService } from '../business/referee-service';
import { NotFoundError, ValidationError } from '../business/entities';

export function buildRouter(teams: TeamService, fixtures: FixtureService, weather: WeatherService, referees: RefereeService): Router {
  const r = Router();
  r.post('/teams', (req, res) => {
    res.status(201).json(teams.registerTeam(req.body));
  });
  r.get('/teams', (_req, res) => {
    res.json(teams.listTeams());
  });
  r.get('/teams/:id/players', (req, res) => {
    res.json(teams.playersOf(req.params.id));
  });
  r.post('/players', (req, res) => {
    res.status(201).json(teams.registerPlayer(req.body));
  });
  r.post('/fixtures', (req, res) => {
    res.status(201).json(fixtures.schedule(req.body));
  });
  r.get('/fixtures', (_req, res) => {
    res.json(fixtures.list());
  });
  r.put('/fixtures/:id/result', (req, res) => {
    res.json(fixtures.recordResult(req.params.id, Number(req.body.homeGoals), Number(req.body.awayGoals)));
  });
  r.post('/pitches', (req, res) => {
    res.status(201).json(fixtures.registerPitch(req.body.name, req.body.postcode));
  });
  r.post('/fixtures/:id/postpone', (req, res) => {
    res.json(fixtures.postpone(req.params.id, req.body.kickOff));
  });
  r.post('/match-days/:date/weather-check', async (req, res) => {
    res.json(await weather.checkMatchDay(req.params.date));
  });
  r.post('/referees', (req, res) => {
    res.status(201).json(referees.register(req.body));
  });
  r.get('/referees', (_req, res) => {
    res.json(referees.list());
  });
  r.put('/fixtures/:id/referee', (req, res) => {
    res.json(referees.assign(req.params.id, req.body.refereeId));
  });
  return r;
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const status = err instanceof NotFoundError ? 404 : err instanceof ValidationError ? 400 : 500;
  res.status(status).json({ error: err.message });
}
