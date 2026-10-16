#!/usr/bin/env python3
"""League tool arm, steps 2-5: the wiring of the none-arm server.ts, expressed in the repaired structure
(business/container.ts builds services and persistence; presentation/server.ts only uses createServices()).
usage: xform_league_wiring.py <repo> <step>"""
import sys
repo, step = sys.argv[1], int(sys.argv[2])
repos = ['FixtureRepository', 'PitchRepository', 'PlayerRepository', 'TeamRepository'] + (['RefereeRepository'] if step >= 3 else [])
imports = [f"import {{ {', '.join(sorted(repos))} }} from '../persistence/repositories';",
           "import { WeatherNowClient } from '../persistence/weather-client';",
           "import { FakeMailer } from '../persistence/fake-mailer';",
           "import { TeamService } from './team-service';",
           "import { FixtureService } from './fixture-service';",
           "import { WeatherService } from './weather-service';"]
body = ["  const teamRepo = new TeamRepository();", "  const playerRepo = new PlayerRepository();",
        "  const fixtureRepo = new FixtureRepository();", "  const pitchRepo = new PitchRepository();",
        "  const mailer = new FakeMailer();"]
ret = ["    mailer,", "    teams: new TeamService(teamRepo, playerRepo),"]
if step >= 3:
    imports.append("import { RefereeService } from './referee-service';")
    body.append("  const referees = new RefereeService(new RefereeRepository(), fixtureRepo, teamRepo, playerRepo);")
    ret.append("    fixtures: new FixtureService(fixtureRepo, teamRepo, pitchRepo, referees),")
    ret.append("    referees,")
else:
    ret.append("    fixtures: new FixtureService(fixtureRepo, teamRepo, pitchRepo),")
ret.append("    weather: new WeatherService(fixtureRepo, pitchRepo, teamRepo, new WeatherNowClient(), mailer),")
if step >= 4:
    imports.append("import { TableService } from './table-service';")
    ret.append("    tables: new TableService(fixtureRepo, teamRepo),")
container = '\n'.join(imports) + "\n\n/** Builds the business services with their persistence. */\nexport function createServices() {\n" + '\n'.join(body) + "\n  return {\n" + '\n'.join(ret) + "\n  };\n}\n"
open(f'{repo}/src/business/container.ts', 'w').write(container)
args = ['services.teams', 'services.fixtures', 'services.weather'] + (['services.referees'] if step >= 3 else []) + (['services.tables'] if step >= 4 else [])
server = f"""import express from 'express';
import {{ createServices }} from '../business/container';
import {{ buildRouter, errorHandler }} from './controllers';

const services = createServices();
export const mailer = services.mailer;

const app = express();
app.use(express.json());
app.use(buildRouter({', '.join(args)}));
app.use(errorHandler);

// every evening at 18:00 check tomorrow's fixtures
setInterval(() => {{
  const now = new Date();
  if (now.getHours() === 18 && now.getMinutes() === 0) {{
    const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
    services.weather.checkMatchDay(tomorrow).catch((e) => console.error('weather check failed', e));
  }}
}}, 60000);

app.listen(Number(process.env.PORT ?? 3000), () => console.log('league service listening'));
"""
open(f'{repo}/src/presentation/server.ts', 'w').write(server)
