import { createServer } from "node:http";
import { createDispatcher } from "./shared/http";
import { RegistryService } from "./registry/application/registry-service";
import { InMemoryVolunteerRepository } from "./registry/infrastructure/in-memory-volunteer-repository";
import { MedCertVerifier } from "./registry/acl/medcert-verifier";
import { CsvLicenceRegistry } from "./registry/acl/licence-csv-registry";
import { registryRoutes } from "./registry/api/routes";
import { DeploymentService } from "./deployment/application/deployment-service";
import { InMemoryIncidentRepository, InMemoryShiftRepository } from "./deployment/infrastructure/in-memory-repositories";
import { RegistryVolunteerDirectory } from "./deployment/acl/registry-volunteer-directory";
import { ImpactReportService } from "./deployment/application/impact-report-service";
import { deploymentRoutes } from "./deployment/api/routes";

const registry = new RegistryService(
  new InMemoryVolunteerRepository(),
  new MedCertVerifier(process.env.MEDCERT_BASE_URL ?? "http://localhost:9000"),
  new CsvLicenceRegistry(process.env.LICENCE_CSV_URL ?? "http://localhost:9001/licences.csv"),
);
const incidents = new InMemoryIncidentRepository();
const shifts = new InMemoryShiftRepository();
const directory = new RegistryVolunteerDirectory(registry);
const deployment = new DeploymentService(incidents, shifts, directory);
const reports = new ImpactReportService(deployment, incidents, shifts, directory);

registry.onQualificationChanged((id) => deployment.reconcileVolunteer(id));

const DAY_MS = 24 * 60 * 60 * 1000;
const reverify = () => registry.reverifyAll().catch((e) => console.error("Daily re-verification failed", e));
void reverify();
setInterval(reverify, DAY_MS).unref();

const server = createServer(createDispatcher([...registryRoutes(registry), ...deploymentRoutes(deployment, reports)]));
const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Relief coordination service listening on :${port}`));
