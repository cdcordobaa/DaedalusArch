import { createServer } from "node:http";
import { dispatch } from "./shared/http.js";
import { VolunteerService } from "./registry/application/volunteerService.js";
import { InMemoryVolunteerRepository } from "./registry/infrastructure/inMemoryVolunteerRepository.js";
import { MedCertVerifier } from "./registry/acl/medCertVerifier.js";
import { LicenceRegistryVerifier } from "./registry/acl/licenceRegistryVerifier.js";
import { SkillCertificateVerifier } from "./registry/acl/skillCertificateVerifier.js";
import { startDaily } from "./registry/infrastructure/dailyJob.js";
import { registryRoutes } from "./registry/api/routes.js";
import { isSkill } from "./registry/domain/volunteer.js";
import { DeploymentService } from "./deployment/application/deploymentService.js";
import { InMemoryIncidentRepository, InMemoryShiftRepository } from "./deployment/infrastructure/inMemoryRepositories.js";
import { RegistryVolunteerDirectory } from "./deployment/acl/registryVolunteerDirectory.js";
import { deploymentRoutes } from "./deployment/api/routes.js";

const medCert = new MedCertVerifier(process.env["MEDCERT_URL"] ?? "http://localhost:9000");
const licences = new LicenceRegistryVerifier(process.env["LICENCE_CSV_URL"] ?? "http://localhost:9001/licences.csv");

const registry = new VolunteerService(
  new InMemoryVolunteerRepository(),
  new SkillCertificateVerifier({ first_aid: medCert, heavy_machinery: licences }, [medCert, licences]),
);

const deployment = new DeploymentService(
  new InMemoryIncidentRepository(),
  new InMemoryShiftRepository(),
  new RegistryVolunteerDirectory(registry),
  isSkill,
);

registry.onCertificationLost((volunteerId) => deployment.releaseForVolunteer(volunteerId));

startDaily(() => registry.reverifyAll());

const routes = [...registryRoutes(registry), ...deploymentRoutes(deployment)];
const port = Number(process.env["PORT"] ?? 3000);

createServer((req, res) => {
  void dispatch(routes, req, res);
}).listen(port, () => {
  console.log(`Relief coordination service listening on ${port}`);
});
