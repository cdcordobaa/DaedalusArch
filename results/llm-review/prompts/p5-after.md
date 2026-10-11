You are reviewing a TypeScript project for violations of its architecture description. The project is in the current working directory. You can read every file of the project and run read-only commands; you cannot modify files and you have no network access.

Task: list every violation of the rules below that you find in the project's source files. Report each violation once, as one entry with:
- file: the path of the violating file, relative to the project root (the file that contains the offending import, class or declaration; for an import cycle, each file of the cycle that you report);
- rule: the id of the violated rule, exactly as written below (for example FF-S01);
- reason: one sentence naming the import, class or declaration that breaks the rule.

Report only violations of the rules listed below, judged by the description below. If you find no violation, return an empty list. Your final answer must be the JSON object of the given output schema, and nothing else.

Architecture description:

Architecture style: nestjs.

Layers, in this order (a file belongs to the first layer whose directories match it, else to the first layer whose file patterns match it; a file that matches no layer is unmapped, and layer rules do not apply to it):
1. domain (kind: domain); directories src/domain/**, src/core/**, src/entities/**, src/models/**, **/domain/**, **/entities/**, **/models/**; file patterns **/*.entity.ts, **/*.model.ts
2. infrastructure (kind: infrastructure); directories src/infrastructure/**, src/persistence/**, src/adapters/**, src/prisma/**, src/lib/**, src/common/middleware/**, src/common/filters/**, src/common/pipes/**, **/dal/**; file patterns **/*.repository.ts, **/*.worker.ts, **/workers/**, **/strategies/**
3. application (kind: application); directories src/application/**, src/use-cases/**, src/services/**, **/dtos/**, **/queries/**, **/services/**; file patterns **/*.service.ts, **/*.processor.ts, **/dto/**, **/*.dto.ts, **/*.query.ts
4. presentation (kind: presentation); directories src/controllers/**, src/gateways/**, src/common/guards/**, src/common/interceptors/**, **/controllers/**; file patterns **/*.controller.ts, **/*.module.ts, **/*.guard.ts, **/*.interceptor.ts, **/*.gateway.ts

Rules (each rule has an id; a violation is a file that breaks the rule):
- FF-S01 (dependency-direction, structural): A file of a layer must not import a file of a layer listed after it in the layer list above.
- FF-S02 (no-cyclic-deps, structural): Files must not form an import cycle (a chain of imports that leads back to its first file).
- FF-S04 (no-domain-outward-dep, structural): A file of a domain-kind layer must not import a file of any other layer.
- FF-P01 (domain-purity, pattern): A file of a domain-kind layer must not import any of these packages: typeorm, express, prisma, @prisma/*, sequelize.
- FF-P02 (dependency-inversion, pattern): In an application-kind layer, at least 0.85 of the constructor-injected dependencies of a class must be interfaces or abstract types, not concrete classes.
- FF-P03 (repository-pattern, pattern): A repository class (name containing Repository or Repo) in an infrastructure-kind layer must implement an interface.
- FF-P04 (use-case-isolation, pattern): A use-case class of an application-kind layer must inject only types of the domain-kind and application-kind layers.
- FF-P05 (controller-no-entity, pattern): A controller class must not reach a domain entity class within two import or injection steps.
- FF-P06 (domain-state-purity, pattern): A class of a domain-kind layer must not hold an infrastructure-layer type in a field or through constructor injection.
- FF-C01 (domain-stability, coupling): A file of a domain-kind layer must have instability (outgoing / (incoming + outgoing) imports to and from other layers) of at most 0.3.
- FF-C02 (module-fan-out, coupling): A file must not import more than 12 distinct project files.
- FF-C03 (component-instability, coupling): A layer-mapped file must have instability (outgoing / (incoming + outgoing) imports) of at most 0.8.
- FF-C04 (no-orphan-files, coupling): Every layer-mapped file that is not an index barrel must import, re-export or be imported by at least one other project file.
- FF-C05 (max-fan-in, coupling): A file must not be imported by more than 20 distinct project files.
- FF-SO01 (single-responsibility-proxy, solid): A class must declare at most 10 methods and inject at most 5 constructor dependencies.
- FF-SO02 (interface-segregation-proxy, solid): An interface must declare at most 5 methods.
- FF-SO03 (inheritance-depth, solid): A class must not sit more than 3 levels deep in an extends chain.
- FF-CV02 (naming-services, convention): A service or use-case class (name containing Service or UseCase) of an application-kind layer must have a name matching *Service|*UseCase.
- FF-CV03 (naming-repos, convention): A repository class (name containing Repository or Repo) must have a name matching *Repository|*Repo.
- FF-N01 (architectural-integrity, integrity): The module's files form one coherent unit with a consistent abstraction and boundary. A violation: The files split into unrelated concerns, duplicate a rule or invariant that should live in one place, or bypass the module's own abstractions.
- FF-N02 (intent-alignment, semantic): The unit's responsibilities match the role of its declared layer. A violation: The file carries a responsibility that belongs to a different layer kind, for example persistence, transport or framework logic in a domain file, or business rules in an infrastructure or presentation file.
