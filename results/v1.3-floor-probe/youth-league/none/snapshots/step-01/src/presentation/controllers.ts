import { NextFunction, Request, Response, Router } from 'express';
import { TeamService } from '../business/team-service';
import { FixtureService } from '../business/fixture-service';
import { NotFoundError, ValidationError } from '../business/entities';

export function buildRouter(teams: TeamService, fixtures: FixtureService): Router {
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
  return r;
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const status = err instanceof NotFoundError ? 404 : err instanceof ValidationError ? 400 : 500;
  res.status(status).json({ error: err.message });
}
