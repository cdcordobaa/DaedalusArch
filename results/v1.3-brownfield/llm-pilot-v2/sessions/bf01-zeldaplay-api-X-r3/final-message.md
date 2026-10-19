```yaml
architecture:
  style: nestjs
  layers:
    - name: domain
      kind: domain
      directories:
        - src/app/models/**
        - src/app/**/models/**
        - src/app/validators/**
      file_patterns:
        - "**/*.model.ts"
        - "**/*.graphql.ts"
      roles:
        - entity
        - value-object
        - domain-service
        - repository-interface

    - name: infrastructure
      kind: infrastructure
      directories:
        - src/app/database/**
        - src/app/redis/**
        - src/app/config/**
        - src/app/cookie/**
        - src/app/options/**
      file_patterns:
        - "**/*.repository.ts"
        - "**/*.provider.ts"
      roles:
        - repository-impl
        - orm-entity
        - external-service
        - middleware
        - worker

    - name: application
      kind: application
      directories: []
      file_patterns:
        - "**/*.service.ts"
        - "**/*.processor.ts"
        - "**/*.dto.ts"
      roles:
        - use-case
        - dto
        - application-service
        - processor

    - name: presentation
      kind: presentation
      directories:
        - src/app/guards/**
      file_patterns:
        - "**/*.controller.ts"
        - "**/*.module.ts"
        - "**/*.guard.ts"
        - "**/*.interceptor.ts"
        - "**/*.gateway.ts"
      roles:
        - controller
        - module
        - gateway
        - guard
        - interceptor
      decorators:
        - "@Controller"
        - "@Module"

```

```json
{"units":[{"citations":[{"file":"README.md","line":11,"quote":"The tabletop companion is a multi-use tool for Dungeon/Game Masters and players alike with features such as campaign, attribute, stat, skill, enemy, and party tracking, die/dice rolling, character creation, manual references (if available), homebrew set up, and many more features to come. Currently the tool is [hosted on Heroku](https://zeldaplay.herokuapp.com) and is available to use for free. This project is still in early phases of development and is backed by a single developer, so it will take a long time to get this into a ready state for stable use. If you would like to know more about the project [you can email me here](mailto://jmcdo29@gmail.com). This project is written using [NestJS](https://docs.nestjs.com) for the server and [Angular](https://angular.io) as the front end service while using [Nx](https://nx.dev) as a tool for development.","type":"doc"},{"count":3,"glob":"src/app/models/**","type":"pattern"},{"count":25,"glob":"src/app/**/models/**","type":"pattern"},{"count":6,"glob":"src/app/validators/**","type":"pattern"},{"count":4,"glob":"**/*.model.ts","type":"pattern"},{"count":4,"glob":"**/*.graphql.ts","type":"pattern"}],"claim":"The domain layer comprises shared and feature-scoped model directories, GraphQL/model types, and domain validation rules.","id":"layer:domain","origin":"proposed"},{"citations":[{"file":"README.md","line":11,"quote":"The tabletop companion is a multi-use tool for Dungeon/Game Masters and players alike with features such as campaign, attribute, stat, skill, enemy, and party tracking, die/dice rolling, character creation, manual references (if available), homebrew set up, and many more features to come. Currently the tool is [hosted on Heroku](https://zeldaplay.herokuapp.com) and is available to use for free. This project is still in early phases of development and is backed by a single developer, so it will take a long time to get this into a ready state for stable use. If you would like to know more about the project [you can email me here](mailto://jmcdo29@gmail.com). This project is written using [NestJS](https://docs.nestjs.com) for the server and [Angular](https://angular.io) as the front end service while using [Nx](https://nx.dev) as a tool for development.","type":"doc"},{"count":10,"glob":"src/app/database/**","type":"pattern"},{"count":5,"glob":"src/app/redis/**","type":"pattern"},{"count":6,"glob":"src/app/config/**","type":"pattern"},{"count":3,"glob":"src/app/cookie/**","type":"pattern"},{"count":6,"glob":"src/app/options/**","type":"pattern"},{"count":1,"glob":"**/*.provider.ts","type":"pattern"}],"claim":"The infrastructure layer contains data persistence, cache, environment configuration, cookie handling, and dynamic module option providers under src/app/database, src/app/redis, src/app/config, src/app/cookie, and src/app/options.","id":"layer:infrastructure","origin":"proposed"},{"citations":[{"file":"README.md","line":11,"quote":"The tabletop companion is a multi-use tool for Dungeon/Game Masters and players alike with features such as campaign, attribute, stat, skill, enemy, and party tracking, die/dice rolling, character creation, manual references (if available), homebrew set up, and many more features to come. Currently the tool is [hosted on Heroku](https://zeldaplay.herokuapp.com) and is available to use for free. This project is still in early phases of development and is backed by a single developer, so it will take a long time to get this into a ready state for stable use. If you would like to know more about the project [you can email me here](mailto://jmcdo29@gmail.com). This project is written using [NestJS](https://docs.nestjs.com) for the server and [Angular](https://angular.io) as the front end service while using [Nx](https://nx.dev) as a tool for development.","type":"doc"},{"count":12,"glob":"**/*.service.ts","type":"pattern"},{"count":8,"glob":"**/*.dto.ts","type":"pattern"}],"claim":"The application layer consists of co-located feature services (*.service.ts) orchestrating domain logic across ability-score, auth, character, spell, and app modules.","id":"layer:application","origin":"proposed"},{"citations":[{"file":"README.md","line":11,"quote":"The tabletop companion is a multi-use tool for Dungeon/Game Masters and players alike with features such as campaign, attribute, stat, skill, enemy, and party tracking, die/dice rolling, character creation, manual references (if available), homebrew set up, and many more features to come. Currently the tool is [hosted on Heroku](https://zeldaplay.herokuapp.com) and is available to use for free. This project is still in early phases of development and is backed by a single developer, so it will take a long time to get this into a ready state for stable use. If you would like to know more about the project [you can email me here](mailto://jmcdo29@gmail.com). This project is written using [NestJS](https://docs.nestjs.com) for the server and [Angular](https://angular.io) as the front end service while using [Nx](https://nx.dev) as a tool for development.","type":"doc"},{"count":2,"glob":"src/app/guards/**","type":"pattern"},{"count":6,"glob":"**/*.controller.ts","type":"pattern"},{"count":14,"glob":"**/*.module.ts","type":"pattern"},{"count":1,"glob":"**/*.guard.ts","type":"pattern"}],"claim":"The presentation layer contains HTTP controllers, request guards, and NestJS DI modules wiring the application.","id":"layer:presentation","origin":"proposed"},{"citations":[{"file":"README.md","line":11,"quote":"The tabletop companion is a multi-use tool for Dungeon/Game Masters and players alike with features such as campaign, attribute, stat, skill, enemy, and party tracking, die/dice rolling, character creation, manual references (if available), homebrew set up, and many more features to come. Currently the tool is [hosted on Heroku](https://zeldaplay.herokuapp.com) and is available to use for free. This project is still in early phases of development and is backed by a single developer, so it will take a long time to get this into a ready state for stable use. If you would like to know more about the project [you can email me here](mailto://jmcdo29@gmail.com). This project is written using [NestJS](https://docs.nestjs.com) for the server and [Angular](https://angular.io) as the front end service while using [Nx](https://nx.dev) as a tool for development.","type":"doc"},{"count":6,"glob":"**/*.controller.ts","type":"pattern"},{"count":12,"glob":"**/*.service.ts","type":"pattern"},{"count":10,"glob":"src/app/database/**","type":"pattern"},{"count":25,"glob":"src/app/**/models/**","type":"pattern"}],"claim":"The layer order from inner to outer is domain, infrastructure, application, presentation following NestJS dependency flow where controllers call application services, which call infrastructure services and domain models.","id":"order","origin":"proposed"}]}
```
