```yaml
architecture:
  style: clean-architecture

  layers:
    - name: domain
      kind: domain
      directories:
        - src/domain/**
      roles:
        - entity
        - value-object
        - domain-service

    - name: application
      kind: application
      directories:
        - src/application/**
      roles:
        - use-case
        - dto
        - application-service
        - repository-interface

    - name: presentation
      kind: presentation
      directories:
        - src/presentation/**
      roles:
        - controller
        - middleware

    - name: infrastructure
      kind: infrastructure
      directories:
        - src/infrastructure/**
      roles:
        - repository-impl
        - orm-entity

    - name: main
      directories:
        - src/main/**
      roles:
        - factory

fitness_overrides:
  - id: FF-P01
    enabled: true
    reason: "Add knex to forbidden_imports in domain-purity as Knex is the persistence query builder used in infrastructure alongside Express."
    params:
      forbidden_imports:
        - "@nestjs/*"
        - typeorm
        - express
        - knex
        - prisma
        - "@prisma/*"
        - sequelize

```

```json
{"units":[{"citations":[{"file":"README.md","line":17,"quote":"### domain layer","type":"doc"},{"file":"README.md","line":19,"quote":"This is the \"domain\" or \"entities\" layer. Here's the description by Uncle Bob:","type":"doc"},{"count":16,"glob":"src/domain/**","type":"pattern"},{"count":9,"glob":"src/domain/models/**","type":"pattern"},{"count":7,"glob":"src/domain/use-cases/**","type":"pattern"}],"claim":"The domain layer lives under src/domain/** and holds domain models and use-case interfaces.","id":"layer:domain","origin":"proposed"},{"citations":[{"file":"README.md","line":25,"quote":"### application layer","type":"doc"},{"file":"README.md","line":27,"quote":"This is the **\"Use Cases\"** layer. Here you may add the application **Use cases**. Here's the description by Uncle Bob:","type":"doc"},{"count":76,"glob":"src/application/**","type":"pattern"},{"count":23,"glob":"src/application/ports/**","type":"pattern"},{"count":14,"glob":"src/application/use-cases/**","type":"pattern"}],"claim":"The application layer lives under src/application/** and contains concrete use cases, ports (including repository interfaces), validations, and application errors.","id":"layer:application","origin":"proposed"},{"citations":[{"file":"README.md","line":35,"quote":"### adapters (presentation) layer","type":"doc"},{"file":"README.md","line":39,"quote":"I'm using the name **\"Presentation\"** for this layer.","type":"doc"},{"count":26,"glob":"src/presentation/**","type":"pattern"},{"count":14,"glob":"src/presentation/controllers/**","type":"pattern"},{"count":4,"glob":"src/presentation/middlewares/**","type":"pattern"}],"claim":"The presentation layer lives under src/presentation/** and contains concrete controllers, application-specific middlewares, and response classes.","id":"layer:presentation","origin":"proposed"},{"citations":[{"file":"README.md","line":49,"quote":"### infrastructure layer","type":"doc"},{"file":"README.md","line":51,"quote":"This folder (layer) is where we add everything related to external \"**Frameworks and Drivers**\". Here you can add the repositories, external frameworks, web and so on.","type":"doc"},{"count":33,"glob":"src/infrastructure/**","type":"pattern"},{"count":15,"glob":"src/infrastructure/express/**","type":"pattern"},{"count":9,"glob":"src/infrastructure/knex/**","type":"pattern"},{"count":9,"glob":"src/infrastructure/repositories/**","type":"pattern"}],"claim":"The infrastructure layer lives under src/infrastructure/** and houses Express setup/routes/adapters, Knex configuration/migrations/seeds, and repository implementations, while src/common/** is left out of every layer as a cross-cutting concern folder.","id":"layer:infrastructure","origin":"proposed"},{"citations":[{"file":"README.md","line":59,"quote":"### main layer","type":"doc"},{"file":"README.md","line":61,"quote":"This layer is where we put everything together. It's the \"dirty layer\", because most factories will be here. It may depend on all other layers in the system.","type":"doc"},{"count":9,"glob":"src/main/**","type":"pattern"}],"claim":"The main layer lives under src/main/** and contains composition-root factories that wire controllers and middlewares across all other layers.","id":"layer:main","origin":"proposed"},{"citations":[{"file":"README.md","line":74,"quote":">The overriding rule that makes this architecture work is The Dependency Rule. This rule says that source code dependencies can only point inwards. Nothing in an inner circle can know anything at all about something in an outer circle. In particular, the name of something declared in an outer circle must not be mentioned by the code in the an inner circle. That includes, functions, classes. variables, or any other named software entity.","type":"doc"},{"file":"README.md","line":78,"quote":"In our case, data enter the system via \"express routes\" (infrastructure layer) to the \"controllers\" (adapters layer), to the \"use cases\" (application layer), to the \"domain\" (domain/entities layer). Then the system outputs via \"domain\" -> \"use cases\" -> \"presentation\" -> \"infrastructure\". I'm using the \"main\" layer to create factories for \"middlewares\", and \"controllers\" (and possibly other factories).","type":"doc"},{"file":"README.md","line":61,"quote":"This layer is where we put everything together. It's the \"dirty layer\", because most factories will be here. It may depend on all other layers in the system.","type":"doc"}],"claim":"Layers are ordered from innermost to outermost as domain, application, presentation, infrastructure, and main, with dependencies pointing inward.","id":"order","origin":"proposed"},{"citations":[{"file":"README.md","line":5,"quote":"This is my attempt to create an API with [node.js](https://nodejs.org/en/) and [typescript](https://www.typescriptlang.org/) following the principles of [clean architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html). I'm using [express.js](https://expressjs.com/pt-br/), but the idea is that you can replace it with any framework you want.","type":"doc"},{"file":"README.md","line":7,"quote":"For data storage, I'm using [knex query builder](http://knexjs.org/), so you can use Postgres, MSSQL, MySQL, MariaDB, SQLite3, Oracle, and Amazon Redshift. Again, you can change the data storage with anything you want. You can create new repositories in `src/infrastructure/repositories`. You can add NoSQL too if needed, but you'll have to create your own repository (I might create an example in the future).","type":"doc"},{"count":9,"glob":"src/infrastructure/knex/**","type":"pattern"}],"claim":"FF-P01 (domain-purity) adds knex to forbidden_imports because Knex is the persistence query builder used in infrastructure alongside Express.","id":"ff:FF-P01","origin":"proposed"}]}
```
