<!-- U5a prompt template, level full-aac (BR-U5a-52). One template per task section below; each has exactly one type-check command placeholder. -->
<!-- task: task-management -->
Build a TypeScript REST API with Express for task management. Users can create projects, add tasks to a project with a title, a description, an optional due date and a status of todo, in progress or done, assign a task to a user, list the tasks of a project filtered by status or assignee, and mark a task as done. A task cannot be marked done twice, and only existing users can be assignees. Keep all data in memory; there is no database. Expose the API from a small HTTP server entry point.

Organise the source code under src/ in exactly three folders: src/domain, src/application and src/infrastructure.

Environment: the working directory already contains package.json and a read-only node_modules with exactly these packages: typescript, @types/node, express and @types/express. Node built-in modules are also available. There is no network access and npm is not available, so do not install, add or update any package, and do not modify package.json or node_modules. Write TypeScript files only, under src/. The project is type-checked in strict mode with target ES2022 and lib ES2022, CommonJS modules, node module resolution, esModuleInterop, skipLibCheck and forceConsistentCasingInFileNames enabled, no emit and no incremental build; type definitions are read from node_modules/@types and only the node types are loaded globally. To type-check your work, run exactly this command, with nothing added or changed:

{{TYPECHECK_COMMAND}}

The work is finished when that command reports no errors.

Architecture specification: the project is evaluated against this specification, reproduced verbatim.

```yaml
# Architectonic Firewall — Clean Architecture Preset
# Canonical fitness functions with empirically calibrated thresholds.
# Use as a starting point; override thresholds and exclude_paths per project.

spec_version: "1.0.0"

architecture:
  style: clean-architecture

  layers:
    - name: domain
      directories:
        - src/domain/**
      roles:
        - entity
        - value-object
        - domain-service
        - repository-interface

    - name: application
      directories:
        - src/application/**
      roles:
        - use-case
        - dto
        - application-service

    - name: infrastructure
      directories:
        - src/infrastructure/**
      roles:
        - repository-impl
        - controller
        - middleware
        - orm-entity

fitness_functions:

  # ── STRUCTURAL ──

  - id: FF-S01
    name: dependency-direction
    dimension: structural
    severity: critical
    route: symbolic
    validated: true

  - id: FF-S02
    name: no-cyclic-deps
    dimension: structural
    severity: critical
    route: symbolic
    validated: true

  - id: FF-S03
    name: no-layer-skip
    dimension: structural
    severity: critical
    route: symbolic
    validated: false

  - id: FF-S04
    name: no-domain-outward-dep
    dimension: structural
    severity: major
    route: symbolic
    validated: false

  # ── PATTERN ──

  - id: FF-P01
    name: domain-purity
    dimension: pattern
    severity: critical
    route: symbolic
    validated: true
    forbidden_imports:
      - "@nestjs/*"
      - typeorm
      - express
      - prisma
      - "@prisma/*"
      - sequelize

  - id: FF-P02
    name: dependency-inversion
    dimension: pattern
    severity: critical
    route: symbolic
    validated: true
    threshold: 0.85

  - id: FF-P03
    name: repository-pattern
    dimension: pattern
    severity: critical
    route: symbolic
    validated: true

  - id: FF-P04
    name: use-case-isolation
    dimension: pattern
    severity: major
    route: symbolic
    validated: true

  - id: FF-P05
    name: controller-no-entity
    dimension: pattern
    severity: major
    route: symbolic
    validated: false

  # ── COUPLING ──

  - id: FF-C01
    name: domain-stability
    dimension: coupling
    severity: major
    route: symbolic
    validated: true
    threshold: 0.3

  - id: FF-C02
    name: module-fan-out
    dimension: coupling
    severity: major
    route: symbolic
    validated: true
    threshold: 10

  - id: FF-C03
    name: component-instability
    dimension: coupling
    severity: major
    route: symbolic
    validated: true

  - id: FF-C04
    name: no-orphan-files
    dimension: coupling
    severity: minor
    route: symbolic
    validated: false

  - id: FF-C05
    name: max-fan-in
    dimension: coupling
    severity: minor
    route: symbolic
    validated: false
    threshold: 15

  - id: FF-C06
    name: abstraction-ratio
    dimension: coupling
    severity: advisory
    route: symbolic
    validated: false
    threshold: 0.3

  # ── SOLID ──

  - id: FF-SO01
    name: single-responsibility-proxy
    dimension: solid
    severity: major
    route: symbolic
    validated: true
    max_public_methods: 10
    max_dependencies: 5

  - id: FF-SO02
    name: interface-segregation-proxy
    dimension: solid
    severity: major
    route: symbolic
    validated: true
    max_interface_methods: 5

  - id: FF-SO03
    name: inheritance-depth
    dimension: solid
    severity: minor
    route: symbolic
    validated: false
    max_depth: 3

  # ── CONVENTION ──

  - id: FF-CV01
    name: naming-conventions
    dimension: convention
    severity: minor
    route: symbolic
    validated: true

  - id: FF-CV02
    name: naming-services
    dimension: convention
    severity: minor
    route: symbolic
    validated: false
    pattern: "*Service|*UseCase"

  - id: FF-CV03
    name: naming-repos
    dimension: convention
    severity: minor
    route: symbolic
    validated: false
    pattern: "*Repository|*Repo"

  - id: FF-CV04
    name: naming-controllers
    dimension: convention
    severity: minor
    route: symbolic
    validated: false
    pattern: "*Controller"

  - id: FF-CV05
    name: test-file-pairing
    dimension: convention
    severity: advisory
    route: symbolic
    validated: false

  - id: FF-CV06
    name: no-index-logic
    dimension: convention
    severity: advisory
    route: symbolic
    validated: false

  # ── NEURONAL ──

  - id: FF-N01
    name: srp-semantic
    dimension: integrity
    severity: major
    route: neuronal
    validated: false
    semantic_criteria:
      rule: "A class should have exactly one reason to change"
      rubric:
        pass: "Class responsibilities are cohesive and serve a single purpose"
        fail: "Class mixes unrelated concerns (data access + business logic, etc.)"
        evidence_required: "Cite specific methods that indicate mixed responsibilities"

  - id: FF-N02
    name: layering-intent
    dimension: semantic
    severity: major
    route: neuronal
    validated: false
    semantic_criteria:
      rule: "Code should respect the documented architectural intent"
      rubric:
        pass: "File is in the correct layer and dependencies respect layer boundaries"
        fail: "File logic or dependencies contradict the architectural layer it lives in"
        evidence_required: "Cite the specific import or logic that violates the intent"

default_exclude_paths:
  - "node_modules/**"
  - "dist/**"
  - "**/*.spec.ts"
  - "**/*.test.ts"

scoring:
  weights:
    structural: 0.35
    coupling: 0.20
    pattern: 0.30
    solid: 0.10
    convention: 0.05

  full_mode_weights:
    structural: 0.32
    coupling: 0.18
    pattern: 0.27
    solid: 0.10
    convention: 0.05
    semantic: 0.04
    integrity: 0.04

  thresholds:
    pass: 0.80
    warning: 0.65
    soft_block: 0.50

confidence_thresholds:
  high: 0.85
  medium: 0.60
  icc_minimum: 0.70
```
<!-- task: order-fulfilment -->
Build a TypeScript REST API with Express for order fulfilment. Customers place orders for catalogue products with quantities; placing an order reserves stock and fails when stock is insufficient. An order moves through the states placed, paid, packed, shipped and delivered, in that order only. An order can be cancelled before it is shipped, which releases its reserved stock. Staff can list orders by state and see the stock level of each product. Keep all data in memory; there is no database. Expose the API from a small HTTP server entry point.

Organise the source code under src/ in exactly three folders: src/domain, src/application and src/infrastructure.

Environment: the working directory already contains package.json and a read-only node_modules with exactly these packages: typescript, @types/node, express and @types/express. Node built-in modules are also available. There is no network access and npm is not available, so do not install, add or update any package, and do not modify package.json or node_modules. Write TypeScript files only, under src/. The project is type-checked in strict mode with target ES2022 and lib ES2022, CommonJS modules, node module resolution, esModuleInterop, skipLibCheck and forceConsistentCasingInFileNames enabled, no emit and no incremental build; type definitions are read from node_modules/@types and only the node types are loaded globally. To type-check your work, run exactly this command, with nothing added or changed:

{{TYPECHECK_COMMAND}}

The work is finished when that command reports no errors.

Architecture specification: the project is evaluated against this specification, reproduced verbatim.

```yaml
# Architectonic Firewall — Clean Architecture Preset
# Canonical fitness functions with empirically calibrated thresholds.
# Use as a starting point; override thresholds and exclude_paths per project.

spec_version: "1.0.0"

architecture:
  style: clean-architecture

  layers:
    - name: domain
      directories:
        - src/domain/**
      roles:
        - entity
        - value-object
        - domain-service
        - repository-interface

    - name: application
      directories:
        - src/application/**
      roles:
        - use-case
        - dto
        - application-service

    - name: infrastructure
      directories:
        - src/infrastructure/**
      roles:
        - repository-impl
        - controller
        - middleware
        - orm-entity

fitness_functions:

  # ── STRUCTURAL ──

  - id: FF-S01
    name: dependency-direction
    dimension: structural
    severity: critical
    route: symbolic
    validated: true

  - id: FF-S02
    name: no-cyclic-deps
    dimension: structural
    severity: critical
    route: symbolic
    validated: true

  - id: FF-S03
    name: no-layer-skip
    dimension: structural
    severity: critical
    route: symbolic
    validated: false

  - id: FF-S04
    name: no-domain-outward-dep
    dimension: structural
    severity: major
    route: symbolic
    validated: false

  # ── PATTERN ──

  - id: FF-P01
    name: domain-purity
    dimension: pattern
    severity: critical
    route: symbolic
    validated: true
    forbidden_imports:
      - "@nestjs/*"
      - typeorm
      - express
      - prisma
      - "@prisma/*"
      - sequelize

  - id: FF-P02
    name: dependency-inversion
    dimension: pattern
    severity: critical
    route: symbolic
    validated: true
    threshold: 0.85

  - id: FF-P03
    name: repository-pattern
    dimension: pattern
    severity: critical
    route: symbolic
    validated: true

  - id: FF-P04
    name: use-case-isolation
    dimension: pattern
    severity: major
    route: symbolic
    validated: true

  - id: FF-P05
    name: controller-no-entity
    dimension: pattern
    severity: major
    route: symbolic
    validated: false

  # ── COUPLING ──

  - id: FF-C01
    name: domain-stability
    dimension: coupling
    severity: major
    route: symbolic
    validated: true
    threshold: 0.3

  - id: FF-C02
    name: module-fan-out
    dimension: coupling
    severity: major
    route: symbolic
    validated: true
    threshold: 10

  - id: FF-C03
    name: component-instability
    dimension: coupling
    severity: major
    route: symbolic
    validated: true

  - id: FF-C04
    name: no-orphan-files
    dimension: coupling
    severity: minor
    route: symbolic
    validated: false

  - id: FF-C05
    name: max-fan-in
    dimension: coupling
    severity: minor
    route: symbolic
    validated: false
    threshold: 15

  - id: FF-C06
    name: abstraction-ratio
    dimension: coupling
    severity: advisory
    route: symbolic
    validated: false
    threshold: 0.3

  # ── SOLID ──

  - id: FF-SO01
    name: single-responsibility-proxy
    dimension: solid
    severity: major
    route: symbolic
    validated: true
    max_public_methods: 10
    max_dependencies: 5

  - id: FF-SO02
    name: interface-segregation-proxy
    dimension: solid
    severity: major
    route: symbolic
    validated: true
    max_interface_methods: 5

  - id: FF-SO03
    name: inheritance-depth
    dimension: solid
    severity: minor
    route: symbolic
    validated: false
    max_depth: 3

  # ── CONVENTION ──

  - id: FF-CV01
    name: naming-conventions
    dimension: convention
    severity: minor
    route: symbolic
    validated: true

  - id: FF-CV02
    name: naming-services
    dimension: convention
    severity: minor
    route: symbolic
    validated: false
    pattern: "*Service|*UseCase"

  - id: FF-CV03
    name: naming-repos
    dimension: convention
    severity: minor
    route: symbolic
    validated: false
    pattern: "*Repository|*Repo"

  - id: FF-CV04
    name: naming-controllers
    dimension: convention
    severity: minor
    route: symbolic
    validated: false
    pattern: "*Controller"

  - id: FF-CV05
    name: test-file-pairing
    dimension: convention
    severity: advisory
    route: symbolic
    validated: false

  - id: FF-CV06
    name: no-index-logic
    dimension: convention
    severity: advisory
    route: symbolic
    validated: false

  # ── NEURONAL ──

  - id: FF-N01
    name: srp-semantic
    dimension: integrity
    severity: major
    route: neuronal
    validated: false
    semantic_criteria:
      rule: "A class should have exactly one reason to change"
      rubric:
        pass: "Class responsibilities are cohesive and serve a single purpose"
        fail: "Class mixes unrelated concerns (data access + business logic, etc.)"
        evidence_required: "Cite specific methods that indicate mixed responsibilities"

  - id: FF-N02
    name: layering-intent
    dimension: semantic
    severity: major
    route: neuronal
    validated: false
    semantic_criteria:
      rule: "Code should respect the documented architectural intent"
      rubric:
        pass: "File is in the correct layer and dependencies respect layer boundaries"
        fail: "File logic or dependencies contradict the architectural layer it lives in"
        evidence_required: "Cite the specific import or logic that violates the intent"

default_exclude_paths:
  - "node_modules/**"
  - "dist/**"
  - "**/*.spec.ts"
  - "**/*.test.ts"

scoring:
  weights:
    structural: 0.35
    coupling: 0.20
    pattern: 0.30
    solid: 0.10
    convention: 0.05

  full_mode_weights:
    structural: 0.32
    coupling: 0.18
    pattern: 0.27
    solid: 0.10
    convention: 0.05
    semantic: 0.04
    integrity: 0.04

  thresholds:
    pass: 0.80
    warning: 0.65
    soft_block: 0.50

confidence_thresholds:
  high: 0.85
  medium: 0.60
  icc_minimum: 0.70
```
