import express from 'express';
import { FixtureRepository, PlayerRepository, TeamRepository } from '../persistence/repositories';
import { TeamService } from '../business/team-service';
import { FixtureService } from '../business/fixture-service';
import { buildRouter, errorHandler } from './controllers';

const teamRepo = new TeamRepository();
const playerRepo = new PlayerRepository();
const fixtureRepo = new FixtureRepository();

const app = express();
app.use(express.json());
app.use(buildRouter(new TeamService(teamRepo, playerRepo), new FixtureService(fixtureRepo, teamRepo)));
app.use(errorHandler);

app.listen(Number(process.env.PORT ?? 3000), () => console.log('league service listening'));
