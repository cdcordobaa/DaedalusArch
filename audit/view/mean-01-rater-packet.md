# Is this finding worth fixing? Rater packet (MEAN-01)

**For the rater.** Thank you for doing this. You will read 60 short findings from real, human-written TypeScript backends and answer two questions about each. There are no trick items, and there is no "right score" we hope for. Your honest reading is the data.

> **Resumen en español.** Va a leer 60 hallazgos de proyectos TypeScript reales, escritos por personas antes de 2023. En cada uno responde dos preguntas: **A**, si un desarrollador competente de ese estilo pediría cambiarlo en una revisión de código; **B**, si rompe un principio que la literatura del estilo establece, no solo una convención de carpetas del repositorio. Respuestas: `yes`, `no` o `unsure` (en inglés, porque la hoja se procesa automáticamente). Si responde `no`, añada un código de razón (§3). Tiempo: unos 90 segundos por ítem, unas 2 horas en total con la calibración. No consulte la herramienta, el repositorio DaedalusArch, la hoja de muestra ni las respuestas de otra persona.

## 0. Before you start

- **Do first:** the 5 calibration items in `mean-01-calibration.md` (about 15 minutes), then the short discussion with the author (about 20 minutes). Calibration answers are never counted.
- **Do not look up** anything about the tool that produced these findings, the DaedalusArch repository, the sample file, or anyone else's answers. You may open the linked source file on GitHub when the excerpt is not enough.
- **Do not change** an answer after you have moved on, and never after the calibration discussion.
- **Write your answers** in the boxes below each item, or in `mean-01-answers.csv` (one row per item). Use the exact words `yes`, `no`, `unsure`.
- **Order:** the items are in a fixed random order, and each one is independent. Do not let the previous answer steer the next.
- **Time:** aim for about 90 seconds per item. Cycles and DDD items take longer, import-direction items less. Take a break after item M30.

## 1. What every item shows you

- the **style** the repository claims (from its README or layout);
- the **rule, in plain words**;
- **the finding**: the import (or class, or cycle) the rule flagged, with the layers the study's layer map gave both ends;
- a **short code excerpt**, with `>>` on the flagged line;
- a **link** to the full file at the pinned commit.

Every finding has already been checked mechanically: the import exists at that line and resolves to that target, and both ends sit in those layers under the layer map. **You are not checking whether it is true. You are judging whether it matters.**

The layer maps (§L at the end) were written by the study from each repository's README and folders. They can be wrong for a file. If the file's real role does not fit the layer it was given, say so with code `M`.

## 2. The two questions

Answer both, in this order, for every item.

**A. Practitioner.** *Would a competent developer who works in this style ask for this to be changed in a code review?*
Picture a pull request that adds exactly this import (or class, or cycle) to this repository. You review it as an experienced developer of the claimed style, who respects how the style is usually practised. Answer `yes` if you would ask for a change (a different dependency, a moved file, an interface, a port). Answer `no` if you would approve it as it is, even if you would mention it in passing.

**B. Style fidelity.** *Does it break a principle that the style's literature states, and not only this repository's folder convention?*
Answer from what the style's sources say (§4), not from habit. Answer `yes` if the code, read for what it really does, breaks a stated principle. Answer `no` if the sources allow it, are silent about it (§4, reading R1), or if the "violation" exists only because of how the folders were mapped.

**`unsure`** is allowed for both, but only when the code you can see (excerpt plus the linked file) does not let you decide, or when the style's sources are genuinely split. Write a one-line note.

A and B can differ. "The literature says no, but every team does it" is A = `no`, B = `yes`. "Nothing in the books forbids it, but I'd still ask" is A = `yes`, B = `no`.

## 3. Why not? (only when A or B is `no`)

Give the **one** code that fits best:

| Code | Meaning | Typical case |
|---|---|---|
| `T` | test, mock or fixture code, not production architecture | a test file imports a fixture |
| `W` | wiring: the composition root, DI container or module registration, where dependencies are meant to be assembled | a router file imports controller factories from `main/` |
| `F` | an accepted framework idiom in this style | ORM decorators on an entity, `@Injectable()` on a service, a Nest module file |
| `M` | mapping artefact: the file's real role does not fit the layer or context it was given | an Express request handler that the map put in a "business" layer |
| `C` | harmless cycle: through a barrel `index.ts`, type-only, an ORM two-way relation, or inside one layer and one module | two entities that reference each other |
| `X` | other (write a note) | |

## 4. What each style requires

From the style sources the study uses (Martin for Clean; Buschmann et al. for Layered; Cockburn for Hexagonal; Evans and Vernon for DDD; the NestJS documentation):

- **Clean:** source dependencies point only inward. Entities and use cases know nothing of frameworks, databases or the UI. Data-access interfaces belong to the inner layer and their implementations to the outer one. No dependency cycles between components. The `main` / composition component is the outermost one: it may depend on everything, and nothing should depend on it.
- **Layered:** upper layers use lower ones, never the reverse. Strict layering also forbids skipping a layer. No cycles between layers.
- **Hexagonal:** the core (domain and its ports) talks to the outside only through ports, and does not depend on adapters, UI or databases. Driven adapters implement ports the core defines. Hexagonal does **not** require strict layering: an adapter may use domain types that a port speaks.
- **DDD:** outside code holds references only to an aggregate's root. Repositories exist only for aggregate roots. Value objects are immutable. The domain is free of UI, application and infrastructure code. Each bounded context is explicit, and other contexts reach it only through its published interface or an anti-corruption layer (or an explicitly declared shared kernel).
- **NestJS:** the Clean rules, plus module encapsulation: other modules use only what a module exports.

**Readings fixed for this packet:**
- **R1.** Where a style's sources are silent, the constraint does not apply in that style (B = `no`). Do not import a constraint from another style, for example strict layering into Hexagonal.
- **R2.** Judge the claim as stated. If the same import also breaks something else, that does not make this claim `yes`.
- **R3.** Test, mock and fixture code: B = `no` (the sources constrain production code). For A, answer as a reviewer would.
- **R4.** Cycles: B = `yes` only when the cycle crosses a boundary the style names (two layers, two modules or two contexts). A cycle among files inside one layer and one module is B = `no` (the acyclic-dependencies principle is stated for components). For A, answer as a reviewer would.
- **R5.** Read the file for what it does, not for its folder name. If the map put it in the wrong layer, answer B for its real role, and use code `M`.

## 5. The 60 items

### M01

- **Style claimed by the repo:** NestJS (Clean rules + module encapsulation)
- **Repository:** `innei-template/nest-http-boilerplate` at `2c95a15c` (layer map: §L, `innei-nest-http`)
- **Rule, in plain words:** No dependency cycles: these files import each other in a loop.
- **The finding:** Cycle: `src/modules/auth/auth.module.ts` → `src/modules/auth/jwt.strategy.ts` → `src/modules/auth/auth.module.ts`
- **Excerpt** (each step of the cycle; `>>` marks the import):

```ts
// src/modules/auth/auth.module.ts
    8 | import { AuthService } from './auth.service'
>>  9 | import { JwtStrategy } from './jwt.strategy'
   10 | 
// src/modules/auth/jwt.strategy.ts
   5 | 
>> 6 | import { __secret } from './auth.module'
   7 | import { AuthService } from './auth.service'
```
- **Open the full file:** https://github.com/innei-template/nest-http-boilerplate/blob/2c95a15c312cb7ba1b159bd722b4f68853d596ed/src/modules/auth/auth.module.ts

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M02

- **Style claimed by the repo:** Hexagonal (ports and adapters)
- **Repository:** `Nalhin/Movies` at `ce48add4` (layer map: §L, `nalhin-movies`)
- **Rule, in plain words:** An adapter must implement a port (an interface declared in the domain or application). This adapter class implements none.
- **The finding:** `src/movie/adapter/out/persistance/movie/movie.repository.ts`: MovieRepository implements no interface declared in domain or application.
- **Excerpt** (`src/movie/adapter/out/persistance/movie/movie.repository.ts`; `>>` marks the flagged line):

```ts
    6 |   userRating: number | null;
    7 |   isFavourite: boolean;
    8 |   averageRating: number | null;
    9 |   id: number;
   10 | }
   11 | 
>> 12 | @EntityRepository(MovieEntity)
   13 | export class MovieRepository extends Repository<MovieEntity> {
   14 |   async getMovieDetails(
   15 |     movieId: number,
   16 |     userId?: number,
   17 |   ): Promise<MoviePersonalDetails | undefined> {
   18 |     let query = this.createQueryBuilder('movies')
```
- **Open the full file:** https://github.com/Nalhin/Movies/blob/ce48add48ce071b7bb8f0953b53fc162c9c3d4f4/backend/src/movie/adapter/out/persistance/movie/movie.repository.ts

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M03

- **Style claimed by the repo:** NestJS (Clean rules + module encapsulation)
- **Repository:** `neoteric-eu/nestjs-auth` at `dc294e4c` (layer map: §L, `neoteric-nestjs-auth`)
- **Rule, in plain words:** The domain must not depend on any outer layer (application, infrastructure, presentation). This domain file imports one.
- **The finding:** `src/app/user/entity/user.entity.ts` (layer **domain**) imports `src/app/user/user.validator.ts` (layer **application**) at line 5.
- **Excerpt** (`src/app/user/entity/user.entity.ts`; `>>` marks the flagged line):

```ts
    1 | import {ApiModelProperty} from '@nestjs/swagger';
    2 | import {IsEmail, IsOptional, IsString, IsUrl, MinLength, Validate, ValidateIf} from 'class-validator';
    3 | import {DateTime} from 'luxon';
    4 | import {ExtendedEntity, passwordHash} from '../../_helpers';
>>  5 | import {IsUserAlreadyExist} from '../user.validator';
    6 | import {config} from '../../../config';
    7 | import {Column, Entity, ObjectIdColumn} from 'typeorm';
    8 | 
    9 | @Entity()
   10 | export class UserEntity extends ExtendedEntity {
   11 | 
```
- **Open the full file:** https://github.com/neoteric-eu/nestjs-auth/blob/dc294e4ce2436579dea9958e24b90c0cc0ef2569/src/app/user/entity/user.entity.ts#L5

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M04

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `LucasHang/ddd-payday` at `252a816c` (layer map: §L, `lucashang-ddd-payday`)
- **Rule, in plain words:** Dependencies between layers must follow the allowed edges of this style (toward the core). This import is not one of the allowed edges.
- **The finding:** `src/modules/accounts/useCases/createAccount/CreateAccountUseCase.ts` (layer **application**) imports `src/modules/accounts/mappers/accountMap.ts` (layer **infrastructure**) at line 7.
- **Excerpt** (`src/modules/accounts/useCases/createAccount/CreateAccountUseCase.ts`; `>>` marks the flagged line):

```ts
    1 | import UseCase from '@core/domain/UseCase';
    2 | import { InvalidParam } from '@core/logic/GenericErrors';
    3 | import { Result, right, left } from '@core/logic/Result';
    4 | import Account from '@modules/accounts/domain/account';
    5 | import AccountBalance from '@modules/accounts/domain/accountBalance';
    6 | import AccountDTO from '@modules/accounts/dtos/accountDTO';
>>  7 | import { AccountMap } from '@modules/accounts/mappers/accountMap';
    8 | import IAccountRepository from '@modules/accounts/repositories/IAccountRepository';
    9 | import IUserRepository from '@modules/users/repositories/IUserRepository';
   10 | import CreateAccountDTO from './CreateAccountDTO';
   11 | 
   12 | type Response = Result<InvalidParam, AccountDTO>;
   13 | 
```
- **Open the full file:** https://github.com/LucasHang/ddd-payday/blob/252a816c3567965669596e2fbb7f686f46973379/src/modules/accounts/useCases/createAccount/CreateAccountUseCase.ts#L7

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M05

- **Style claimed by the repo:** NestJS (Clean rules + module encapsulation)
- **Repository:** `pietrzakadrian/bank-server` at `c1ca5b22` (layer map: §L, `bank-server`)
- **Rule, in plain words:** Domain code must stay free of frameworks and infrastructure libraries. This domain file imports such a package.
- **The finding:** `src/modules/user/entities/user.entity.ts` (layer **domain**) imports `typeorm` (package) at line 5.
- **Excerpt** (`src/modules/user/entities/user.entity.ts`; `>>` marks the flagged line):

```ts
    1 | import { AbstractEntity } from 'common/entities';
    2 | import { BillEntity } from 'modules/bill/entities/bill.entity';
    3 | import { UserDto } from 'modules/user/dtos';
    4 | import { UserAuthEntity, UserConfigEntity } from 'modules/user/entities';
>>  5 | import {
    6 |   Column,
    7 |   CreateDateColumn,
    8 |   Entity,
    9 |   OneToMany,
   10 |   OneToOne,
   11 |   UpdateDateColumn,
```
- **Open the full file:** https://github.com/pietrzakadrian/bank-server/blob/c1ca5b229b566b1e5adfd037502dbcb3574967a0/src/modules/user/entities/user.entity.ts#L5

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M06

- **Style claimed by the repo:** NestJS (Clean rules + module encapsulation)
- **Repository:** `neoteric-eu/nestjs-auth` at `dc294e4c` (layer map: §L, `neoteric-nestjs-auth`)
- **Rule, in plain words:** Domain code must stay free of frameworks and infrastructure libraries. This domain file imports such a package.
- **The finding:** `src/app/home/entity/home-pdf.entity.ts` (layer **domain**) imports `typeorm` (package) at line 4.
- **Excerpt** (`src/app/home/entity/home-pdf.entity.ts`; `>>` marks the flagged line):

```ts
    1 | import {ApiModelProperty} from '@nestjs/swagger';
    2 | import {IsString} from 'class-validator';
    3 | import {ExtendedEntity} from '../../_helpers';
>>  4 | import {Column, Entity, ObjectIdColumn} from 'typeorm';
    5 | 
    6 | @Entity()
    7 | export class HomePdfEntity extends ExtendedEntity {
    8 | 
    9 | 	@ApiModelProperty()
   10 | 	@ObjectIdColumn()
```
- **Open the full file:** https://github.com/neoteric-eu/nestjs-auth/blob/dc294e4ce2436579dea9958e24b90c0cc0ef2569/src/app/home/entity/home-pdf.entity.ts#L4

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M07

- **Style claimed by the repo:** Hexagonal (ports and adapters)
- **Repository:** `fmcarrero/nest-js-products-api` at `c809e70c` (layer map: §L, `nest-products-hexagonal`)
- **Rule, in plain words:** Dependencies between layers must follow the allowed edges of this style (toward the core). This import is not one of the allowed edges.
- **The finding:** `src/application/application.module.ts` (layer **application**) imports `src/infrastructure/adapters/repository/product.repository.mongo.ts` (layer **adapters-outbound**) at line 3.
- **Excerpt** (`src/application/application.module.ts`; `>>` marks the flagged line):

```ts
   1 | import { Module } from '@nestjs/common';
   2 | import { MongooseModule } from '@nestjs/mongoose';
>> 3 | import ProductRepositoryMongo from '../infrastructure/adapters/repository/product.repository.mongo';
   4 | import ProductSchema from '../infrastructure/adapters/repository/schema/product.schema';
   5 | import GetAllProductsUseCase from './getAllProducts.usecase';
   6 | import DomainModule from '../domain/domain.module';
   7 | import GetProductUseCase from './getProduct.usecase';
   8 | import CreateProductUseCase from './createProduct.usecase';
   9 | import DeleteProductUseCase from './deleteProduct.usecase';
```
- **Open the full file:** https://github.com/fmcarrero/nest-js-products-api/blob/c809e70c8efec173509cbed726993f0afb01528c/src/application/application.module.ts#L3

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M08

- **Style claimed by the repo:** Hexagonal (ports and adapters)
- **Repository:** `auxdevelopment/hexagonal-banking-ts` at `7fe5cb9b` (layer map: §L, `hexagonal-banking`)
- **Rule, in plain words:** The core (domain) must not depend on the layers around it. This domain file imports one.
- **The finding:** `src/core/domain/account/account-service.adapter.ts` (layer **domain**) imports `src/core/use-case/account/open-account.port.ts` (layer **application**) at line 2.
- **Excerpt** (`src/core/domain/account/account-service.adapter.ts`; `>>` marks the flagged line):

```ts
   1 | import { CloseAccount } from "../../use-case/account/close-account.port";
>> 2 | import { OpenAccount, OpenAccountCommand } from "../../use-case/account/open-account.port";
   3 | import { PerformDebit } from "../../use-case/account/perform-debit.port";
   4 | import { ViewCurrentBalance } from "../../use-case/account/view-current-balance";
   5 | import { AccountId } from "./account-id.value";
   6 | import { AccountRepository } from "./account-repository.port";
   7 | import { Account } from "./account.aggregate";
   8 | import { Balance } from "./balance.value";
```
- **Open the full file:** https://github.com/auxdevelopment/hexagonal-banking-ts/blob/7fe5cb9b36c17aec127bde8b2b67eb7c2fab425d/src/core/domain/account/account-service.adapter.ts#L2

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M09

- **Style claimed by the repo:** NestJS (Clean rules + module encapsulation)
- **Repository:** `Vivify-Ideas/nestjs-boilerplate` at `e148f3d7` (layer map: §L, `vivify-nestjs-boilerplate`)
- **Rule, in plain words:** No dependency cycles: these files import each other in a loop.
- **The finding:** Cycle: `src/modules/auth/auth.controller.ts` → `src/modules/auth/index.ts` → `src/modules/auth/auth.module.ts` → `src/modules/auth/auth.controller.ts`
- **Excerpt** (each step of the cycle; `>>` marks the import):

```ts
// src/modules/auth/auth.controller.ts
   3 | import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
>> 4 | import { AuthService, LoginPayload, RegisterPayload } from './';
   5 | import { CurrentUser } from './../common/decorator/current-user.decorator';
// src/modules/auth/index.ts
   4 | export * from './jwt.strategy';
>> 5 | export * from './auth.module';
   6 | export * from './auth.controller';
// src/modules/auth/auth.module.ts
   7 | import { JwtStrategy } from './jwt.strategy';
>> 8 | import { AuthController } from './auth.controller';
   9 | 
```
- **Open the full file:** https://github.com/Vivify-Ideas/nestjs-boilerplate/blob/e148f3d7bcac20c969259c33bfd73604fa7704bd/src/modules/auth/auth.controller.ts

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M10

- **Style claimed by the repo:** Hexagonal (ports and adapters)
- **Repository:** `Canario0/hexagonal-express` at `361c2d81` (layer map: §L, `canario-hexagonal-express`)
- **Rule, in plain words:** The core (domain) must not depend on the layers around it. This domain file imports one.
- **The finding:** `src/contexts/cartsMs/shared/domain/existsChecker/cartExistsChecker.ts` (layer **domain**) imports `src/contexts/cartsMs/cart/application/read/countById/cartCountByIdQuery.ts` (layer **application**) at line 2.
- **Excerpt** (`src/contexts/cartsMs/shared/domain/existsChecker/cartExistsChecker.ts`; `>>` marks the flagged line):

```ts
   1 | import QueryBus from "../../../../shared/domain/queryBus/queryBus";
>> 2 | import CartCountByIdQuery from "../../../cart/application/read/countById/cartCountByIdQuery";
   3 | import CartCountByIdResponse from "../../../cart/application/read/countById/cartCountByIdResponse";
   4 | import CartNotFoundError from "../../../cart/domain/cartNotFoundError";
   5 | import CartId from "../../../cart/domain/valueObject/cartId";
   6 | 
   7 | export default class CartExistsChecker {
   8 |   constructor(private queryBus: QueryBus) {}
```
- **Open the full file:** https://github.com/Canario0/hexagonal-express/blob/361c2d81453c00e1ea8c3a9b4dcddd90a9a2775c/src/contexts/cartsMs/shared/domain/existsChecker/cartExistsChecker.ts#L2

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M11

- **Style claimed by the repo:** Layered
- **Repository:** `GeekyAnts/express-typescript` at `3c19835f` (layer map: §L, `geekyants-express`)
- **Rule, in plain words:** Dependencies between layers must point only in the allowed direction (in this style: toward the inner / lower layers). This import points the other way.
- **The finding:** `src/services/strategies/Local.ts` (layer **business**) imports `src/middlewares/Log.ts` (layer **presentation**) at line 9.
- **Excerpt** (`src/services/strategies/Local.ts`; `>>` marks the flagged line):

```ts
    3 |  *
    4 |  * @author Faiz A. Farooqui <faiz@geekyants.com>
    5 |  */
    6 | 
    7 | import { Strategy } from 'passport-local';
    8 | import User from '../../models/User';
>>  9 | import Log from '../../middlewares/Log';
   10 | 
   11 | class Local {
   12 | 	public static init (_passport: any): any {
   13 | 		_passport.use(new Strategy({ usernameField: 'email' }, (email, password, done) => {
   14 | 			Log.info(`Email is ${email}`);
   15 | 			Log.info(`Password is ${password}`);
```
- **Open the full file:** https://github.com/GeekyAnts/express-typescript/blob/3c19835fded8008edc93bd14ed3fa50c2b9e7120/src/services/strategies/Local.ts#L9

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M12

- **Style claimed by the repo:** Layered
- **Repository:** `steve-lebleu/typeplate` at `bdd0350b` (layer map: §L, `typeplate`)
- **Rule, in plain words:** Dependencies between layers must point only in the allowed direction (in this style: toward the inner / lower layers). This import points the other way.
- **The finding:** `src/api/core/subscribers/user.subscriber.ts` (layer **persistence**) imports `src/api/core/services/cache.service.ts` (layer **business**) at line 7.
- **Excerpt** (`src/api/core/subscribers/user.subscriber.ts`; `>>` marks the flagged line):

```ts
    1 | require('module-alias/register');
    2 | 
    3 | import * as Dayjs from 'dayjs';
    4 | import { EventSubscriber, EntitySubscriberInterface, InsertEvent, UpdateEvent, RemoveEvent } from 'typeorm';
    5 | import { User } from '@models/user.model';
    6 | import { encrypt } from '@utils/string.util';
>>  7 | import { CacheService } from '@services/cache.service';
    8 | import { STATUS } from '@enums';
    9 | import { EmailEmitter } from '@events';
   10 | 
   11 | /**
   12 |  *
   13 |  */
```
- **Open the full file:** https://github.com/steve-lebleu/typeplate/blob/bdd0350b6cb96748fdb3ed41aea6be3446800388/src/api/core/subscribers/user.subscriber.ts#L7

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M13

- **Style claimed by the repo:** NestJS (Clean rules + module encapsulation)
- **Repository:** `ruslanguns/nestjs-starter` at `2d115220` (layer map: §L, `ruslanguns-nestjs-starter`)
- **Rule, in plain words:** No dependency cycles: these files import each other in a loop.
- **The finding:** Cycle: `src/modules/users/dto/index.ts` → `src/modules/users/dto/update-user-metadata.dto.ts` → `src/modules/users/dto/index.ts`
- **Excerpt** (each step of the cycle; `>>` marks the import):

```ts
// src/modules/users/dto/index.ts
    8 | export * from './update-contact-phone.dto';
>>  9 | export * from './update-user-metadata.dto';
   10 | 
// src/modules/users/dto/update-user-metadata.dto.ts
   1 | import { PartialType } from '@nestjs/swagger';
>> 2 | import { CreateUserMetadataDto } from '.';
   3 | 
```
- **Open the full file:** https://github.com/ruslanguns/nestjs-starter/blob/2d1152204251371ca5f043926648f0f3dd1bb583/src/modules/users/dto/index.ts

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M14

- **Style claimed by the repo:** Layered
- **Repository:** `Talento90/typescript-node` at `0bf9796f` (layer map: §L, `talento90-typescript-node`)
- **Rule, in plain words:** Strict layering: a layer may use only the layer directly below it. This import skips a layer.
- **The finding:** `src/repositories/user-repository.ts` (layer **persistence**) imports `src/entities/index.ts` (layer **business**) at line 1.
- **Excerpt** (`src/repositories/user-repository.ts`; `>>` marks the flagged line):

```ts
>> 1 | import { User } from '../entities'
   2 | import { NotFoundError, ValidationError } from '../errors'
   3 | import { MySql } from '../lib/database'
   4 | 
   5 | export class UserRepository {
   6 |   private readonly TABLE: string = 'user'
   7 |   private db: MySql
```
- **Open the full file:** https://github.com/Talento90/typescript-node/blob/0bf9796f8a739cf9cc5d51202bbf05b899fe740c/src/repositories/user-repository.ts#L1

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M15

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `dlydiard/ddd-cqrs-es-aws-sam` at `77a95f23` (layer map: §L, `dlydiard-ddd-cqrs-es`)
- **Rule, in plain words:** Domain code must stay free of frameworks and infrastructure libraries. This domain file imports such a package.
- **The finding:** `src/iam/user/models/user.validator.ts` (layer **domain**) imports `class-validator` (package) at line 2.
- **Excerpt** (`src/iam/user/models/user.validator.ts`; `>>` marks the flagged line):

```ts
   1 | import { Uuid } from '@node-ts/ddd-types';
>> 2 | import { Equals, IsAlpha, IsEmail, IsUUID, Length, MaxLength, ValidateIf, ValidationError } from 'class-validator';
   3 | 
   4 | import { DomainValidator } from '../../../app/validation/domain-validator';
   5 | 
   6 | export class UserRegisterValidator extends DomainValidator {
   7 |   @IsEmail()
   8 |   @MaxLength(255)
```
- **Open the full file:** https://github.com/dlydiard/ddd-cqrs-es-aws-sam/blob/77a95f2342b04ace9bea7db77ea1505a9ff03c08/src/iam/user/models/user.validator.ts#L2

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M16

- **Style claimed by the repo:** Layered
- **Repository:** `ngduc/node-rem` at `d488838e` (layer map: §L, `ngduc-node-rem`)
- **Rule, in plain words:** Strict layering: a layer may use only the layer directly below it. This import skips a layer.
- **The finding:** `src/api/middlewares/auth.ts` (layer **presentation**) imports `src/api/models/index.ts` (layer **persistence**) at line 4.
- **Excerpt** (`src/api/middlewares/auth.ts`; `>>` marks the flagged line):

```ts
    1 | export {};
    2 | const httpStatus = require('http-status');
    3 | const passport = require('passport');
>>  4 | import { User } from '../../api/models';
    5 | const APIError = require('../utils/APIError');
    6 | 
    7 | const ADMIN = 'admin';
    8 | const LOGGED_USER = '_loggedUser';
    9 | 
   10 | import * as Bluebird from 'bluebird';
```
- **Open the full file:** https://github.com/ngduc/node-rem/blob/d488838e41ed039eda497826ab6d637490a622d5/src/api/middlewares/auth.ts#L4

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M17

- **Style claimed by the repo:** Layered
- **Repository:** `Q00/api_server_boilerplate` at `80f18f59` (layer map: §L, `q00-api-server`)
- **Rule, in plain words:** Strict layering: a layer may use only the layer directly below it. This import skips a layer.
- **The finding:** `src/middleware/WriteLog.ts` (layer **presentation**) imports `src/model/Enum.ts` (layer **persistence**) at line 6.
- **Excerpt** (`src/middleware/WriteLog.ts`; `>>` marks the flagged line):

```ts
    1 | import { ExpressMiddlewareInterface, Middleware } from 'routing-controllers';
    2 | 
    3 | import { NextFunction, Request, Response } from 'express';
    4 | import { ApiLogService } from '../service';
    5 | import Container from 'typedi';
>>  6 | import { Method } from '../model/Enum';
    7 | 
    8 | @Middleware({ type: 'before' })
    9 | export class StartTimerMiddleware implements ExpressMiddlewareInterface {
   10 |   use(request: Request, _: Response, next: NextFunction): void {
   11 |     request.query.startTime = String(new Date().getTime());
   12 |     next();
```
- **Open the full file:** https://github.com/Q00/api_server_boilerplate/blob/80f18f59d07fb5a52fc51e33e1ef89d0ae38afe5/src/middleware/WriteLog.ts#L6

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M18

- **Style claimed by the repo:** Clean Architecture
- **Repository:** `devNica/NodeJSBackendAppWithCleanCode` at `2ef1c4a9` (layer map: §L, `devnica-clean-backend`)
- **Rule, in plain words:** Dependencies between layers must point only in the allowed direction (in this style: toward the inner / lower layers). This import points the other way.
- **The finding:** `src/infrastructure/express/api/routes/auth.router.ts` (layer **infrastructure**) imports `src/factories/middlewares/request-parser-middleware-factory.ts` (layer **main**) at line 3.
- **Excerpt** (`src/infrastructure/express/api/routes/auth.router.ts`; `>>` marks the flagged line):

```ts
   1 | /* eslint-disable @typescript-eslint/no-misused-promises */
   2 | import { authControllerFactory } from '@factories/auth/auth-controller-factory'
>> 3 | import { requestParserMiddlewareFactory } from '@factories/middlewares/request-parser-middleware-factory'
   4 | import { expressMiddlewareAdapter } from '@infrastructure/express/adapters/express-middleware-adapter'
   5 | import { expressRouterAdapter } from '@infrastructure/express/adapters/express-route-adapter'
   6 | import { authSchema } from '@interface/validator/auth.schema'
   7 | import { Router } from 'express'
   8 | 
   9 | const { userRegisterController, userLoginController } = authControllerFactory()
```
- **Open the full file:** https://github.com/devNica/NodeJSBackendAppWithCleanCode/blob/2ef1c4a9b79a831e89b1b60eba98e11651cc19b4/src/infrastructure/express/api/routes/auth.router.ts#L3

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M19

- **Style claimed by the repo:** Hexagonal (ports and adapters)
- **Repository:** `cecric/hexapinod` at `bdc74dee` (layer map: §L, `hexapinod`)
- **Rule, in plain words:** No dependency cycles: these files import each other in a loop.
- **The finding:** Cycle: `src/application/api/wsserver.ts` → `src/core/example/eventslisteners/websocketslistener.event.ts` → `src/application/api/wsserver.ts`
- **Excerpt** (each step of the cycle; `>>` marks the import):

```ts
// src/application/api/wsserver.ts
   6 | import { EventsManager } from '@dependencies/hexapinod-framework/events/eventsmanager';
>> 7 | import { WebSocketsListener } from '@core/example/eventslisteners/websocketslistener.event';
   8 | import { createClient } from 'redis';
// src/core/example/eventslisteners/websocketslistener.event.ts
   2 | import { BaseEventListener } from '@dependencies/hexapinod-framework/events/baseeventlistener';
>> 3 | import { WebSocketServer } from '@application/api/wsserver';
   4 | 
```
- **Open the full file:** https://github.com/cecric/hexapinod/blob/bdc74deedc99479ea92e545a1254ef92a47c9132/src/application/api/wsserver.ts

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M20

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `talyssonoc/node-api-boilerplate` at `7e6ae0e9` (layer map: §L, `talyssonoc-node-api`)
- **Rule, in plain words:** A bounded context may use another context only through that context's public API or an anti-corruption layer. This import reaches inside another context.
- **The finding:** `src/article/infrastructure/MongoFindArticles.ts` (context **article**) imports `src/comment/infrastructure/CommentCollection.ts` (context **comment**), which is not in the public API of comment.
- **Excerpt** (`src/article/infrastructure/MongoFindArticles.ts`; `>>` marks the flagged line):

```ts
    1 | import { ArticleCollection, ArticleSchema } from '@/article/infrastructure/ArticleCollection';
    2 | import MUUID from 'uuid-mongodb';
    3 | import { FindArticles } from '@/article/application/query/FindArticles';
>>  4 | import { CommentSchema } from '@/comment/infrastructure/CommentCollection';
    5 | import { Filter } from 'mongodb';
    6 | 
    7 | type Dependencies = {
    8 |   articleCollection: ArticleCollection;
    9 | };
   10 | 
```
- **Open the full file:** https://github.com/talyssonoc/node-api-boilerplate/blob/7e6ae0e968e032b92baf262622d6075260332b28/src/article/infrastructure/MongoFindArticles.ts#L4

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M21

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `stemmlerjs/ddd-forum` at `3aa0b8d3` (layer map: §L, `ddd-forum`)
- **Rule, in plain words:** Code outside an aggregate may reference only the aggregate root, never its inner entities. This file references an inner entity.
- **The finding:** `src/modules/forum/repos/implementations/sequelizeCommentVotesRepo.ts`: src/modules/forum/repos/implementations/sequelizeCommentVotesRepo.ts, outside aggregate Post, references its inner entity src/modules/forum/domain/commentVote.ts.
- **Excerpt** (`src/modules/forum/repos/implementations/sequelizeCommentVotesRepo.ts`; `>>` marks the flagged line):

```ts
   1 | 
   2 | import { ICommentVotesRepo } from "../commentVotesRepo";
>> 3 | import { CommentVote } from "../../domain/commentVote";
   4 | import { MemberId } from "../../domain/memberId";
   5 | import { CommentId } from "../../domain/commentId";
   6 | import { CommentVoteMap } from "../../mappers/commentVoteMap";
   7 | import { CommentVotes } from "../../domain/commentVotes";
   8 | import { VoteType } from "../../domain/vote";
   9 | import { PostId } from "../../domain/postId";
```
- **Open the full file:** https://github.com/stemmlerjs/ddd-forum/blob/3aa0b8d3ad3b58c111c57974fb321ddb230bde73/src/modules/forum/repos/implementations/sequelizeCommentVotesRepo.ts#L3

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M22

- **Style claimed by the repo:** Clean Architecture
- **Repository:** `nutes-uepb/template-base-ts` at `49f99666` (layer map: §L, `nutes-template-base`)
- **Rule, in plain words:** No dependency cycles: these files import each other in a loop.
- **The finding:** Cycle: `example/activity-tracking/src/app.ts` → `example/activity-tracking/src/di/di.ts` → `example/activity-tracking/src/app.ts`
- **Excerpt** (each step of the cycle; `>>` marks the import):

```ts
// example/activity-tracking/src/app.ts
   13 | import { Default } from './utils/default'
>> 14 | import { DI } from './di/di'
   15 | import { Identifier } from './di/identifiers'
// example/activity-tracking/src/di/di.ts
   33 | import { BackgroundService } from '../background/background.service'
>> 34 | import { App } from '../app'
   35 | import { CustomLogger, ILogger } from '../utils/custom.logger'
```
- **Open the full file:** https://github.com/nutes-uepb/template-base-ts/blob/49f99666a979c2c8aa6ea3adb7ed52e7c1f91227/example/activity-tracking/src/app.ts

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M23

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `stemmlerjs/ddd-forum` at `3aa0b8d3` (layer map: §L, `ddd-forum`)
- **Rule, in plain words:** Code outside an aggregate may reference only the aggregate root, never its inner entities. This file references an inner entity.
- **The finding:** `src/modules/forum/mappers/postDetailsMap.ts`: src/modules/forum/mappers/postDetailsMap.ts, outside aggregate Post, references its inner entity src/modules/forum/domain/postVote.ts.
- **Excerpt** (`src/modules/forum/mappers/postDetailsMap.ts`; `>>` marks the flagged line):

```ts
    6 | import { PostTitle } from "../domain/postTitle";
    7 | import { MemberDetailsMap } from "./memberDetailsMap";
    8 | import { PostType } from "../domain/postType";
    9 | import { PostText } from "../domain/postText";
   10 | import { PostLink } from "../domain/postLink";
   11 | import { PostVoteMap } from "./postVoteMap";
>> 12 | import { PostVote } from "../domain/postVote";
   13 | 
   14 | export class PostDetailsMap implements Mapper<PostDetails> {
   15 | 
   16 |   public static toDomain (raw: any): PostDetails {
   17 |     const slug = PostSlug.createFromExisting(raw.slug).getValue();
   18 |     const title = PostTitle.create({ value: raw.title }).getValue();
```
- **Open the full file:** https://github.com/stemmlerjs/ddd-forum/blob/3aa0b8d3ad3b58c111c57974fb321ddb230bde73/src/modules/forum/mappers/postDetailsMap.ts#L12

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M24

- **Style claimed by the repo:** NestJS (Clean rules + module encapsulation)
- **Repository:** `neoteric-eu/nestjs-auth` at `dc294e4c` (layer map: §L, `neoteric-nestjs-auth`)
- **Rule, in plain words:** No dependency cycles: these files import each other in a loop.
- **The finding:** Cycle: `src/app/_helpers/graphql/gql-config.service.ts` → `src/app/user/online.service.ts` → `src/app/user/entity/index.ts` → `src/app/user/entity/user.entity.ts` → `src/app/user/user.validator.ts` → `src/app/user/user.service.ts` → `src/app/user/user-subscription.service.ts` → `src/app/user/entity/user-subscription.entity.ts` → `src/app/_helpers/index.ts` → `src/app/_helpers/graphql/index.ts` → `src/app/_helpers/graphql/gql-config.service.ts`
- **Excerpt** (each step of the cycle; `>>` marks the import):

```ts
// src/app/_helpers/graphql/gql-config.service.ts
    9 | import {verifyToken} from '../../auth/jwt';
>> 10 | import {OnlineService} from '../../user/online.service';
   11 | import {UserService} from '../../user/user.service';
// src/app/user/online.service.ts
   2 | import {DateTime} from 'luxon';
>> 3 | import {UserEntity} from './entity';
   4 | import {UserService} from './user.service';
// src/app/user/entity/index.ts
>> 1 | export * from './user.entity';
   2 | export * from './user-email.entity';
// src/app/user/entity/user.entity.ts
   4 | import {ExtendedEntity, passwordHash} from '../../_helpers';
>> 5 | import {IsUserAlreadyExist} from '../user.validator';
   6 | import {config} from '../../../config';
// src/app/user/user.validator.ts
   1 | import {ValidatorConstraint, ValidatorConstraintInterface} from 'class-validator';
>> 2 | import {UserService} from './user.service';
   3 | import {Injectable} from '@nestjs/common';
// src/app/user/user.service.ts
    9 | import {UserErrorEnum} from './user-error.enum';
>> 10 | import {UserSubscriptionService} from './user-subscription.service';
   11 | import {USER_EMAIL_TOKEN, USER_TOKEN} from './user.constants';
// src/app/user/user-subscription.service.ts
   3 | import {MongoRepository, Repository} from 'typeorm';
>> 4 | import {UserSubscriptionEntity} from './entity/user-subscription.entity';
   5 | import {USER_SUBSCRIPTION_TOKEN} from './user.constants';
// src/app/user/entity/user-subscription.entity.ts
   2 | import {IsBoolean, IsOptional, IsString} from 'class-validator';
>> 3 | import {ExtendedEntity} from '../../_helpers';
   4 | import {Column, Entity, ObjectIdColumn} from 'typeorm';
// src/app/_helpers/index.ts
    9 | export * from './database';
>> 10 | export * from './graphql';
   11 | export * from './rest.exception';
// src/app/_helpers/graphql/index.ts
   2 | export * from './user.decorator';
>> 3 | export * from './gql-config.service';
   4 | 
```
- **Open the full file:** https://github.com/neoteric-eu/nestjs-auth/blob/dc294e4ce2436579dea9958e24b90c0cc0ef2569/src/app/_helpers/graphql/gql-config.service.ts

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M25

- **Style claimed by the repo:** Hexagonal (ports and adapters)
- **Repository:** `Nalhin/Movies` at `ce48add4` (layer map: §L, `nalhin-movies`)
- **Rule, in plain words:** No dependency cycles: these files import each other in a loop.
- **The finding:** Cycle: `src/movie/adapter/out/persistance/movie-rating/movie-rating.entity.ts` → `src/movie/adapter/out/persistance/movie/movie.entity.ts` → `src/movie/adapter/out/persistance/movie-rating/movie-rating.entity.ts`
- **Excerpt** (each step of the cycle; `>>` marks the import):

```ts
// src/movie/adapter/out/persistance/movie-rating/movie-rating.entity.ts
   10 | import { UserEntity } from '../../../../../user/adapter/out/persistance/database/user.entity';
>> 11 | import { MovieEntity } from '../movie/movie.entity';
   12 | 
// src/movie/adapter/out/persistance/movie/movie.entity.ts
   1 | import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
>> 2 | import { MovieRatingEntity } from '../movie-rating/movie-rating.entity';
   3 | import { MovieFavouriteByUserEntity } from '../movie-favourite-by-user/movie-favourite-by-user.entity';
```
- **Open the full file:** https://github.com/Nalhin/Movies/blob/ce48add48ce071b7bb8f0953b53fc162c9c3d4f4/backend/src/movie/adapter/out/persistance/movie-rating/movie-rating.entity.ts

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M26

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `Arvinje/meetinger` at `b13f141b` (layer map: §L, `meetinger`)
- **Rule, in plain words:** A bounded context may use another context only through that context's public API or an anti-corruption layer. This import reaches inside another context.
- **The finding:** `src/modules/meetings/usecase/persistAttendee/index.ts` (context **meetings**) imports `src/modules/users/repos/implementations/DynamoDBUserRepo.ts` (context **users**), which is not in the public API of users.
- **Excerpt** (`src/modules/meetings/usecase/persistAttendee/index.ts`; `>>` marks the flagged line):

```ts
    1 | import 'source-map-support/register';
    2 | import DDBConfig from '@src/shared/infra/dynamodb/dynamodb';
    3 | import { DynamoDBMeetingRepo } from '@meetings/repos/implementations/DynamoDBMeetingRepo';
    4 | import { DynamoDBAttendeeRepo } from '@meetings/repos/implementations/DynamoDBAttendeeRepo';
    5 | import { SNSHandler } from 'aws-lambda';
>>  6 | import { DynamoDBUserRepo } from '@users/repos/implementations/DynamoDBUserRepo';
    7 | import { PersistAttendeeUseCase } from './PersistAttendeeUseCase';
    8 | import { PersistAttendeeController } from './PersistAttendeeController';
    9 | 
   10 | // Repositories
   11 | const meetingRepo = new DynamoDBMeetingRepo(DDBConfig);
   12 | const userRepo = new DynamoDBUserRepo(DDBConfig);
```
- **Open the full file:** https://github.com/Arvinje/meetinger/blob/b13f141b1db7e1f9ccc418a6039aead9f272c4e5/backend/src/modules/meetings/usecase/persistAttendee/index.ts#L6

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M27

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `talyssonoc/node-api-boilerplate` at `7e6ae0e9` (layer map: §L, `talyssonoc-node-api`)
- **Rule, in plain words:** Every module must belong to a declared bounded context (or a declared shared area). This file belongs to none.
- **The finding:** `src/__tests__/TestControls.ts` lies in no declared bounded context and in no declared shared area.
- **Excerpt** (`src/__tests__/TestControls.ts`; `>>` marks the flagged line):

```ts
>>  1 | import { Container, container } from '@/container';
    2 | import { withContext } from '@/context';
    3 | import { main } from '@/_boot';
    4 | import { Db } from 'mongodb';
    5 | import supertest, { SuperTest, Test } from 'supertest';
    6 | 
    7 | type Dependencies = {
    8 |   mongo: Db;
    9 | };
   10 | 
   11 | type TestControls = Readonly<{
   12 |   request: () => SuperTest<Test>;
```
- **Open the full file:** https://github.com/talyssonoc/node-api-boilerplate/blob/7e6ae0e968e032b92baf262622d6075260332b28/src/__tests__/TestControls.ts

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M28

- **Style claimed by the repo:** Clean Architecture
- **Repository:** `leal32b/webapi-nodejs` at `5b3916f2` (layer map: §L, `leal32b-webapi`)
- **Rule, in plain words:** No dependency cycles: these files import each other in a loop.
- **The finding:** Cycle: `src/core/4.main/setup/fixtures/index.ts` → `src/core/4.main/setup/fixtures/make-mongodb-fixtures.ts` → `src/core/4.main/setup/fixtures/index.ts`
- **Excerpt** (each step of the cycle; `>>` marks the import):

```ts
// src/core/4.main/setup/fixtures/index.ts
   2 | import { DatabaseFixture } from '@/core/3.infra/persistence/database-fixture'
>> 3 | import { makeMongodbFixtures } from '@/core/4.main/setup/fixtures/make-mongodb-fixtures'
   4 | import { makePostgresFixtures } from '@/core/4.main/setup/fixtures/make-postgres-fixtures'
// src/core/4.main/setup/fixtures/make-mongodb-fixtures.ts
>> 1 | import { DatabaseFixtures } from '@/core/4.main/setup/fixtures'
   2 | import { MongodbUserFixture } from '@/user/3.infra/persistence/mongodb/fixtures/mongodb-user-fixture'
```
- **Open the full file:** https://github.com/leal32b/webapi-nodejs/blob/5b3916f2e4ae12bafff19b266a4e753c2e31a9a8/src/core/4.main/setup/fixtures/index.ts

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M29

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `4lessandrodev/finance-project-ddd` at `9f0725a8` (layer map: §L, `finance-project-ddd`)
- **Rule, in plain words:** Dependencies between layers must follow the allowed edges of this style (toward the core). This import is not one of the allowed edges.
- **The finding:** `src/modules/transaction/domain/tests/mock/transaction.mock.ts` (layer **domain**) imports `src/config/env.ts` (layer **composition**) at line 8.
- **Excerpt** (`src/modules/transaction/domain/tests/mock/transaction.mock.ts`; `>>` marks the flagged line):

```ts
    2 | import { TransactionStatusValueObject } from "@modules/transaction/domain/transaction-status.value-object";
    3 | import { TransactionTypeValueObject } from "@modules/transaction/domain/transaction-type.value-object";
    4 | import { TransactionNoteValueObject } from "@modules/transaction/domain/transaction-note.value-object";
    5 | import { TransactionAggregate } from "@modules/transaction/domain/transaction.aggregate";
    6 | import { ITransaction, IMockEntity } from "@shared/index";
    7 | import { ChangesObserver, CurrencyValueObject, DateValueObject, DomainId, Result } from "types-ddd";
>>  8 | import { CURRENCY } from "@config/env";
    9 | import TransactionBudgetBoxNameValueObject from "@modules/transaction/domain/budget-box-name.value-object";
   10 | import TransactionReasonDescriptionValueObject from "@modules/transaction/domain/transaction-reason.value-object";
   11 | 
   12 | export class TransactionMock implements IMockEntity<TransactionAggregate, ITransaction>{
   13 | 	domain (props?: Partial<ITransaction>): Result<TransactionAggregate, string> {
   14 | 		
```
- **Open the full file:** https://github.com/4lessandrodev/finance-project-ddd/blob/9f0725a83be4863db3da230e3bf9c5fa3f6c9a7d/src/modules/transaction/domain/tests/mock/transaction.mock.ts#L8

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M30

- **Style claimed by the repo:** NestJS (Clean rules + module encapsulation)
- **Repository:** `Vivify-Ideas/nestjs-boilerplate` at `e148f3d7` (layer map: §L, `vivify-nestjs-boilerplate`)
- **Rule, in plain words:** The domain must not depend on any outer layer (application, infrastructure, presentation). This domain file imports one.
- **The finding:** `src/modules/user/user.entity.ts` (layer **domain**) imports `src/modules/user/password.transformer.ts` (layer **infrastructure**) at line 6.
- **Excerpt** (`src/modules/user/user.entity.ts`; `>>` marks the flagged line):

```ts
    1 | import {
    2 |   Entity,
    3 |   Column,
    4 |   PrimaryGeneratedColumn,
    5 | } from 'typeorm';
>>  6 | import { PasswordTransformer } from './password.transformer';
    7 | 
    8 | @Entity({
    9 |   name: 'users',
   10 | })
   11 | export class User {
   12 |   @PrimaryGeneratedColumn()
```
- **Open the full file:** https://github.com/Vivify-Ideas/nestjs-boilerplate/blob/e148f3d7bcac20c969259c33bfd73604fa7704bd/src/modules/user/user.entity.ts#L6

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M31

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `dlydiard/ddd-cqrs-es-aws-sam` at `77a95f23` (layer map: §L, `dlydiard-ddd-cqrs-es`)
- **Rule, in plain words:** Dependencies between layers must follow the allowed edges of this style (toward the core). This import is not one of the allowed edges.
- **The finding:** `src/app/application.controller.ts` (layer **api**) imports `src/app/application-container.ts` (layer **composition**) at line 3.
- **Excerpt** (`src/app/application.controller.ts`; `>>` marks the flagged line):

```ts
   1 | import HttpStatus = require('http-status-codes');
   2 | 
>> 3 | import { ApplicationContainer } from './application-container';
   4 | import { ApplicationError, ApplicationErrorNumber } from './application-error';
   5 | 
   6 | export class ApplicationController {
   7 |   /**
   8 |    * Handle application error output.
   9 |    * @param applicationContainer
```
- **Open the full file:** https://github.com/dlydiard/ddd-cqrs-es-aws-sam/blob/77a95f2342b04ace9bea7db77ea1505a9ff03c08/src/app/application.controller.ts#L3

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M32

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `4lessandrodev/finance-project-ddd` at `9f0725a8` (layer map: §L, `finance-project-ddd`)
- **Rule, in plain words:** Code outside an aggregate may reference only the aggregate root, never its inner entities. This file references an inner entity.
- **The finding:** `src/modules/budget-box/application/use-cases/add-reason-to-budget-box/add-reason-to-budget-box.use-case.ts`: src/modules/budget-box/application/use-cases/add-reason-to-budget-box/add-reason-to-budget-box.use-case.ts, outside aggregate BudgetBox, references its inner entity src/modules/budget-box/domain/reason.domain-entity.ts.
- **Excerpt** (`src/modules/budget-box/application/use-cases/add-reason-to-budget-box/add-reason-to-budget-box.use-case.ts`; `>>` marks the flagged line):

```ts
   1 | import { IBudgetBoxRepository } from "@modules/budget-box/domain/interfaces/budget-box.repository.interface";
   2 | import ReasonDescriptionValueObject from "@modules/budget-box/domain/reason-description.value-object";
>> 3 | import ReasonDomainEntity from "@modules/budget-box/domain/reason.domain-entity";
   4 | import { Inject, Injectable } from "@nestjs/common";
   5 | import { DomainId, IUseCase, Result } from "types-ddd";
   6 | import Dto from './add-reason-to-budget-box.dto';
   7 | 
   8 | @Injectable()
   9 | export class AddReasonToBudgetBoxUseCase implements IUseCase<Dto, Result<void>>{
```
- **Open the full file:** https://github.com/4lessandrodev/finance-project-ddd/blob/9f0725a83be4863db3da230e3bf9c5fa3f6c9a7d/src/modules/budget-box/application/use-cases/add-reason-to-budget-box/add-reason-to-budget-box.use-case.ts#L3

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M33

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `pezzetti/base-app-nestjs` at `83c6ccf1` (layer map: §L, `pezzetti-base-app`)
- **Rule, in plain words:** A bounded context may use another context only through that context's public API or an anti-corruption layer. This import reaches inside another context.
- **The finding:** `src/modules/auth/shared/local.strategy.ts` (context **auth**) imports `src/modules/users/domain/user.domain.ts` (context **users**), which is not in the public API of users.
- **Excerpt** (`src/modules/auth/shared/local.strategy.ts`; `>>` marks the flagged line):

```ts
    1 | import { Strategy } from 'passport-local';
    2 | import { PassportStrategy } from '@nestjs/passport';
    3 | import { Injectable, UnauthorizedException } from '@nestjs/common';
>>  4 | import { UserDomain } from 'src/modules/users/domain/user.domain';
    5 | import { AuthService } from './auth.service';
    6 | 
    7 | @Injectable()
    8 | export class LocalStrategy extends PassportStrategy(Strategy) {
    9 |     constructor(private authService: AuthService) {
   10 |         super({
```
- **Open the full file:** https://github.com/pezzetti/base-app-nestjs/blob/83c6ccf16ec4c782c0b13ce6f7edffc206dcbbe8/src/modules/auth/shared/local.strategy.ts#L4

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M34

- **Style claimed by the repo:** Clean Architecture
- **Repository:** `leonardocartaxo/nodejs-ts-boilerplate` at `32afa6d9` (layer map: §L, `cartaxo-ts-boilerplate`)
- **Rule, in plain words:** A repository implementation must implement a repository interface (a contract owned by an inner layer). This repository class implements none.
- **The finding:** `src/utils/base/repositories/base-repository.ts`: BaseRepository implements no interface.
- **Excerpt** (`src/utils/base/repositories/base-repository.ts`; `>>` marks the flagged line):

```ts
    1 | import {
    2 |   Pagination, PAGINATION_DEFAULT_LIMIT, PAGINATION_DEFAULT_PAGE,
    3 |   PaginationOptions
    4 | } from '../../helpers/pagination';
    5 | 
>>  6 | export abstract class BaseRepository<Entity> {
    7 |   async create (entity: Entity): Promise<Entity> {
    8 |     return null;
    9 |   }
   10 | 
   11 |   async getById (id: string): Promise<Entity> {
   12 |     return null;
```
- **Open the full file:** https://github.com/leonardocartaxo/nodejs-ts-boilerplate/blob/32afa6d9b746f4699b25b3fa29c0ed974c372a91/src/utils/base/repositories/base-repository.ts

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M35

- **Style claimed by the repo:** Clean Architecture
- **Repository:** `pvarentsov/typescript-clean-architecture` at `b6e0518e` (layer map: §L, `pvarentsov-clean`)
- **Rule, in plain words:** Dependencies between layers must point only in the allowed direction (in this style: toward the inner / lower layers). This import points the other way.
- **The finding:** `src/application/api/http-rest/controller/PostController.ts` (layer **presentation**) imports `src/infrastructure/adapter/usecase/post/CreatePostAdapter.ts` (layer **infrastructure**) at line 20.
- **Excerpt** (`src/application/api/http-rest/controller/PostController.ts`; `>>` marks the flagged line):

```ts
   14 | import { PostUseCaseDto } from '@core/domain/post/usecase/dto/PostUseCaseDto';
   15 | import { EditPostUseCase } from '@core/domain/post/usecase/EditPostUseCase';
   16 | import { GetPostListUseCase } from '@core/domain/post/usecase/GetPostListUseCase';
   17 | import { GetPostUseCase } from '@core/domain/post/usecase/GetPostUseCase';
   18 | import { PublishPostUseCase } from '@core/domain/post/usecase/PublishPostUseCase';
   19 | import { RemovePostUseCase } from '@core/domain/post/usecase/RemovePostUseCase';
>> 20 | import { CreatePostAdapter } from '@infrastructure/adapter/usecase/post/CreatePostAdapter';
   21 | import { EditPostAdapter } from '@infrastructure/adapter/usecase/post/EditPostAdapter';
   22 | import { GetPostAdapter } from '@infrastructure/adapter/usecase/post/GetPostAdapter';
   23 | import { GetPostListAdapter } from '@infrastructure/adapter/usecase/post/GetPostListAdapter';
   24 | import { PublishPostAdapter } from '@infrastructure/adapter/usecase/post/PublishPostAdapter';
   25 | import { RemovePostAdapter } from '@infrastructure/adapter/usecase/post/RemovePostAdapter';
   26 | import { FileStorageConfig } from '@infrastructure/config/FileStorageConfig';
```
- **Open the full file:** https://github.com/pvarentsov/typescript-clean-architecture/blob/b6e0518ee4e092917015f4d448ad7fccd404e12e/src/application/api/http-rest/controller/PostController.ts#L20

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M36

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `pezzetti/base-app-nestjs` at `83c6ccf1` (layer map: §L, `pezzetti-base-app`)
- **Rule, in plain words:** Domain code must stay free of frameworks and infrastructure libraries. This domain file imports such a package.
- **The finding:** `src/modules/users/domain/user.domain.ts` (layer **domain**) imports `@nestjs/swagger` (package) at line 3.
- **Excerpt** (`src/modules/users/domain/user.domain.ts`; `>>` marks the flagged line):

```ts
   1 | import { IsString, IsEmail } from 'class-validator';
   2 | import { Field, InputType } from '@nestjs/graphql';
>> 3 | import { ApiProperty } from '@nestjs/swagger';
   4 | 
   5 | @InputType()
   6 | export class UserDomain {
   7 |     @Field()
   8 |     @IsString()
   9 |     @ApiProperty()
```
- **Open the full file:** https://github.com/pezzetti/base-app-nestjs/blob/83c6ccf16ec4c782c0b13ce6f7edffc206dcbbe8/src/modules/users/domain/user.domain.ts#L3

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M37

- **Style claimed by the repo:** Clean Architecture
- **Repository:** `felixle236/node-core` at `23b7d8eb` (layer map: §L, `felixle-node-core`)
- **Rule, in plain words:** Dependencies between layers must point only in the allowed direction (in this style: toward the inner / lower layers). This import points the other way.
- **The finding:** `src/exposes/api/mobile/ApiService.ts` (layer **presentation**) imports `src/infras/servers/http/HttpServer.ts` (layer **infrastructure**) at line 7.
- **Excerpt** (`src/exposes/api/mobile/ApiService.ts`; `>>` marks the flagged line):

```ts
    1 | import { Server } from 'http';
    2 | import path from 'path';
    3 | import { ILogService } from 'application/interfaces/services/ILogService';
    4 | import { ENVIRONMENT } from 'config/Configuration';
    5 | import express from 'express';
    6 | import helmet from 'helmet';
>>  7 | import { HttpServer } from 'infras/servers/http/HttpServer';
    8 | import { RoutingControllersOptions } from 'routing-controllers';
    9 | import { i18n } from 'shared/localization/Localization';
   10 | import { HttpHeaderKey } from 'shared/types/Common';
   11 | import { Environment } from 'shared/types/Environment';
   12 | import { InjectService } from 'shared/types/Injection';
   13 | import Container from 'typedi';
```
- **Open the full file:** https://github.com/felixle236/node-core/blob/23b7d8eb00bc198d09b8ce2bd3613cf1f1a68e23/src/exposes/api/mobile/ApiService.ts#L7

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M38

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `4lessandrodev/finance-project-ddd` at `9f0725a8` (layer map: §L, `finance-project-ddd`)
- **Rule, in plain words:** A bounded context may use another context only through that context's public API or an anti-corruption layer. This import reaches inside another context.
- **The finding:** `src/modules/transaction/infra/resolver/transaction.resolver.ts` (context **transaction**) imports `src/modules/user/infra/services/guards/jwt-auth.guard.ts` (context **user**), which is not in the public API of user.
- **Excerpt** (`src/modules/transaction/infra/resolver/transaction.resolver.ts`; `>>` marks the flagged line):

```ts
    1 | import { Inject, UseGuards } from "@nestjs/common";
    2 | import { Args, Query, Mutation, Resolver } from "@nestjs/graphql";
    3 | import TransactionService from "@modules/transaction/infra/transaction.service";
    4 | import BoxTransactionType from "@modules/transaction/infra/types/transaction.types";
    5 | import PercentageCapitalInflowPostingInput from "@modules/transaction/infra/inputs/percentage-capital-inflow-posting.input";
>>  6 | import { JwtAuthGuard } from "@modules/user/infra/services/guards/jwt-auth.guard";
    7 | import { GetUserId } from "@modules/user/infra/services/decorators/get-user.decorator";
    8 | import { ITransaction } from "@modules/shared";
    9 | import PostingToBenefitInput from "@modules/transaction/infra/inputs/posting-to-benefit.input";
   10 | import CreateExpenseInput from "@modules/transaction/infra/inputs/create-expense.input";
   11 | import GetTransactionByIdInput from "@modules/transaction/infra/inputs/get-transaction-by-id.input";
   12 | import BalanceTransferenceInput from "@modules/transaction/infra/inputs/balance-transference.input";
```
- **Open the full file:** https://github.com/4lessandrodev/finance-project-ddd/blob/9f0725a83be4863db3da230e3bf9c5fa3f6c9a7d/src/modules/transaction/infra/resolver/transaction.resolver.ts#L6

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M39

- **Style claimed by the repo:** Layered
- **Repository:** `steve-lebleu/typeplate` at `bdd0350b` (layer map: §L, `typeplate`)
- **Rule, in plain words:** Strict layering: a layer may use only the layer directly below it. This import skips a layer.
- **The finding:** `src/api/core/controllers/auth.controller.ts` (layer **presentation**) imports `src/api/core/models/refresh-token.model.ts` (layer **persistence**) at line 10.
- **Excerpt** (`src/api/core/controllers/auth.controller.ts`; `>>` marks the flagged line):

```ts
    4 | 
    5 | import * as Jwt from 'jwt-simple';
    6 | 
    7 | import { ACCESS_TOKEN } from '@config/environment.config';
    8 | import { IResponse, IUserRequest, ITokenOptions } from '@interfaces';
    9 | import { User } from '@models/user.model';
>> 10 | import { RefreshToken } from '@models/refresh-token.model';
   11 | import { UserRepository } from '@repositories/user.repository';
   12 | import { AuthService } from '@services/auth.service';
   13 | import { Safe } from '@decorators/safe.decorator';
   14 | import { ROLE, STATUS } from '@enums';
   15 | import { EmailEmitter } from '@events';
   16 | 
```
- **Open the full file:** https://github.com/steve-lebleu/typeplate/blob/bdd0350b6cb96748fdb3ed41aea6be3446800388/src/api/core/controllers/auth.controller.ts#L10

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M40

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `libellis/DDD-Libellis` at `29ef6636` (layer map: §L, `ddd-libellis`)
- **Rule, in plain words:** Code outside an aggregate may reference only the aggregate root, never its inner entities. This file references an inner entity.
- **The finding:** `src/election-system/tests/core/application/factories/TestUpdateMasterBallotDataFactory.model.ts`: src/election-system/tests/core/application/factories/TestUpdateMasterBallotDataFactory.model.ts, outside aggregate MasterBallot, references its inner entity src/election-system/core/domain/model/master-ballot-aggregate/Choice.model.ts.
- **Excerpt** (`src/election-system/tests/core/application/factories/TestUpdateMasterBallotDataFactory.model.ts`; `>>` marks the flagged line):

```ts
    1 | import {UpdateMasterBallot} from "../../../../core/application/models/input/UpdateMasterBallot";
    2 | import * as faker from 'faker';
    3 | import {MasterBallot} from "../../../../core/domain/model/master-ballot-aggregate/MasterBallot.model";
    4 | import {Question} from "../../../../core/domain/model/master-ballot-aggregate/Question.model";
>>  5 | import {Choice} from "../../../../core/domain/model/master-ballot-aggregate/Choice.model";
    6 | import {TestTokenFactory} from "../../../../../shared-kernel/test-factories/TestTokenFactory.model";
    7 | 
    8 | export class TestUpdateMasterBallotDataFactory {
    9 | 	static createTestUpdateMasterBallotData(masterBallot: MasterBallot): UpdateMasterBallot {
   10 | 		return {
   11 | 			title: faker.random.word(),
```
- **Open the full file:** https://github.com/libellis/DDD-Libellis/blob/29ef6636ae62e1cb238b78de77bf1d93a32213d3/application/src/election-system/tests/core/application/factories/TestUpdateMasterBallotDataFactory.model.ts#L5

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M41

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `victormonserrat/mustodon` at `5dd06ad7` (layer map: §L, `mustodon`)
- **Rule, in plain words:** Domain code must stay free of frameworks and infrastructure libraries. This domain file imports such a package.
- **The finding:** `src/todos/domain/events/RemovedTodo.ts` (layer **domain**) imports `@nestjs/cqrs` (package) at line 1.
- **Excerpt** (`src/todos/domain/events/RemovedTodo.ts`; `>>` marks the flagged line):

```ts
>> 1 | import { IEvent } from '@nestjs/cqrs';
   2 | 
   3 | export class RemovedTodo implements IEvent {
   4 |   static withId(id: string): RemovedTodo {
   5 |     return new this(id);
   6 |   }
   7 | 
```
- **Open the full file:** https://github.com/victormonserrat/mustodon/blob/5dd06ad7bf0d3af469478d54bf993bd01f9b4b34/src/todos/domain/events/RemovedTodo.ts#L1

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M42

- **Style claimed by the repo:** Layered
- **Repository:** `bymi15/express-typeorm-rest-boilerplate` at `cb90f2c5` (layer map: §L, `bymi15-express-typeorm`)
- **Rule, in plain words:** Domain code must stay free of frameworks and infrastructure libraries. This domain file imports such a package.
- **The finding:** `src/api/services/JobApplicationService.ts` (layer **business**) imports `typeorm` (package) at line 3.
- **Excerpt** (`src/api/services/JobApplicationService.ts`; `>>` marks the flagged line):

```ts
   1 | import Container, { Inject, Service } from 'typedi';
   2 | import { JobApplication } from '../entities/JobApplication';
>> 3 | import { MongoRepository, ObjectID } from 'typeorm';
   4 | import { InjectRepository } from 'typeorm-typedi-extensions';
   5 | import { Logger } from 'winston';
   6 | import CRUD from './CRUD';
   7 | import UserService from './UserService';
   8 | import CompanyService from './CompanyService';
   9 | 
```
- **Open the full file:** https://github.com/bymi15/express-typeorm-rest-boilerplate/blob/cb90f2c53c4126c9dc2e8f4890050fd7edfe334d/src/api/services/JobApplicationService.ts#L3

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M43

- **Style claimed by the repo:** NestJS (Clean rules + module encapsulation)
- **Repository:** `monstar-lab-oss/nestjs-starter-rest-api` at `cf93559e` (layer map: §L, `monstarlab-nestjs-starter`)
- **Rule, in plain words:** No dependency cycles: these files import each other in a loop.
- **The finding:** Cycle: `src/article/entities/article.entity.ts` → `src/user/entities/user.entity.ts` → `src/article/entities/article.entity.ts`
- **Excerpt** (each step of the cycle; `>>` marks the import):

```ts
// src/article/entities/article.entity.ts
    9 | 
>> 10 | import { User } from '../../user/entities/user.entity';
   11 | 
// src/user/entities/user.entity.ts
   10 | 
>> 11 | import { Article } from '../../article/entities/article.entity';
   12 | 
```
- **Open the full file:** https://github.com/monstar-lab-oss/nestjs-starter-rest-api/blob/cf93559e486dbbbef8e546cb01ceb1d7fb9181b7/src/article/entities/article.entity.ts

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M44

- **Style claimed by the repo:** Hexagonal (ports and adapters)
- **Repository:** `somosphi/ts-seed-hexagonal` at `d82f9433` (layer map: §L, `ts-seed-hexagonal`)
- **Rule, in plain words:** An adapter must implement a port (an interface declared in the domain or application). This adapter class implements none.
- **The finding:** `src/infrastructure/adapter/mysql.ts`: MysqlAdapter implements no interface declared in domain or application.
- **Excerpt** (`src/infrastructure/adapter/mysql.ts`; `>>` marks the flagged line):

```ts
    3 | import {
    4 |   MysqlDatabase,
    5 |   IMysqlAdapter,
    6 |   MysqlAdapterConfig,
    7 | } from '../../types/infrastructure';
    8 | 
>>  9 | export class MysqlAdapter implements IMysqlAdapter {
   10 |   private _tbName: string;
   11 |   private database: MysqlDatabase;
   12 | 
   13 |   constructor(config?: MysqlAdapterConfig) {
   14 |     this.database = config?.dbConn || database();
   15 |     this._tbName = '';
```
- **Open the full file:** https://github.com/somosphi/ts-seed-hexagonal/blob/d82f9433d62a41caf6bd02d406f190f5ded9f7bf/src/infrastructure/adapter/mysql.ts

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M45

- **Style claimed by the repo:** Layered
- **Repository:** `w3tecch/express-typescript-boilerplate` at `17727010` (layer map: §L, `w3tec-express-boilerplate`)
- **Rule, in plain words:** No dependency cycles: these files import each other in a loop.
- **The finding:** Cycle: `src/api/controllers/PetController.ts` → `src/api/controllers/UserController.ts` → `src/api/controllers/PetController.ts`
- **Excerpt** (each step of the cycle; `>>` marks the import):

```ts
// src/api/controllers/PetController.ts
    9 | import { PetService } from '../services/PetService';
>> 10 | import { UserResponse } from './UserController';
   11 | 
// src/api/controllers/UserController.ts
   10 | import { UserService } from '../services/UserService';
>> 11 | import { PetResponse } from './PetController';
   12 | 
```
- **Open the full file:** https://github.com/w3tecch/express-typescript-boilerplate/blob/17727010f7f098d8ca8b78da0a5b3c7297659381/src/api/controllers/PetController.ts

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M46

- **Style claimed by the repo:** NestJS (Clean rules + module encapsulation)
- **Repository:** `surgeharb/nestjs-boilerplate` at `d5ad7467` (layer map: §L, `surgeharb-nestjs`)
- **Rule, in plain words:** Dependencies between layers must point only in the allowed direction (in this style: toward the inner / lower layers). This import points the other way.
- **The finding:** `src/auth/jwt.strategy.ts` (layer **infrastructure**) imports `src/auth/auth.service.ts` (layer **application**) at line 2.
- **Excerpt** (`src/auth/jwt.strategy.ts`; `>>` marks the flagged line):

```ts
   1 | import { ExtractJwt, Strategy } from 'passport-jwt';
>> 2 | import { AuthService } from './auth.service';
   3 | import { PassportStrategy } from '@nestjs/passport';
   4 | import { Injectable, UnauthorizedException } from '@nestjs/common';
   5 | import { IJwtPayload } from './interfaces/jwt-payload.interface';
   6 | import { to } from 'await-to-js';
   7 | import * as fs from 'fs';
   8 | 
```
- **Open the full file:** https://github.com/surgeharb/nestjs-boilerplate/blob/d5ad7467d33a8ea722556a5ea0ae250c321e7409/src/auth/jwt.strategy.ts#L2

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M47

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `stemmlerjs/ddd-forum` at `3aa0b8d3` (layer map: §L, `ddd-forum`)
- **Rule, in plain words:** Repositories exist only for aggregate roots. This repository handles an inner entity of an aggregate.
- **The finding:** `src/modules/forum/repos/postVotesRepo.ts`: repository src/modules/forum/repos/postVotesRepo.ts references inner entity src/modules/forum/domain/postVote.ts of Post.
- **Excerpt** (`src/modules/forum/repos/postVotesRepo.ts`; `>>` marks the flagged line):

```ts
   1 | 
>> 2 | import { PostVote } from "../domain/postVote";
   3 | import { MemberId } from "../domain/memberId";
   4 | import { PostId } from "../domain/postId";
   5 | import { VoteType } from "../domain/vote";
   6 | import { PostVotes } from "../domain/postVotes";
   7 | 
   8 | export interface IPostVotesRepo {
```
- **Open the full file:** https://github.com/stemmlerjs/ddd-forum/blob/3aa0b8d3ad3b58c111c57974fb321ddb230bde73/src/modules/forum/repos/postVotesRepo.ts#L2

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M48

- **Style claimed by the repo:** NestJS (Clean rules + module encapsulation)
- **Repository:** `Neosoft-Private-Limited/rest-node-nestjs` at `1ec5af9f` (layer map: §L, `neosoft-rest-nestjs`)
- **Rule, in plain words:** Dependencies between layers must point only in the allowed direction (in this style: toward the inner / lower layers). This import points the other way.
- **The finding:** `src/feature/users/repository/db/user.repository.ts` (layer **infrastructure**) imports `src/feature/users/dto/create.user.dto.ts` (layer **application**) at line 4.
- **Excerpt** (`src/feature/users/repository/db/user.repository.ts`; `>>` marks the flagged line):

```ts
    1 | import { Injectable, NotFoundException } from '@nestjs/common';
    2 | import { EntityRepository, Repository, UpdateResult } from 'typeorm';
    3 | 
>>  4 | import { CreateUserDto } from '@app/feature/users/dto/create.user.dto';
    5 | import { UpdateUserDto } from '@app/feature/users/dto/update.user.dto';
    6 | import { User } from '@app/feature/users/entities/user.entity';
    7 | import { UserRepository } from '@app/feature/users/repository/user.repository';
    8 | @Injectable()
    9 | @EntityRepository(User)
   10 | export class UserDbRepository extends Repository<User> implements UserRepository {
```
- **Open the full file:** https://github.com/Neosoft-Private-Limited/rest-node-nestjs/blob/1ec5af9f9febf82a200bb3fe5118d0b09872412b/src/feature/users/repository/db/user.repository.ts#L4

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M49

- **Style claimed by the repo:** NestJS (Clean rules + module encapsulation)
- **Repository:** `Neosoft-Private-Limited/rest-node-nestjs` at `1ec5af9f` (layer map: §L, `neosoft-rest-nestjs`)
- **Rule, in plain words:** Domain code must stay free of frameworks and infrastructure libraries. This domain file imports such a package.
- **The finding:** `src/feature/users/entities/user.entity.ts` (layer **domain**) imports `typeorm` (package) at line 2.
- **Excerpt** (`src/feature/users/entities/user.entity.ts`; `>>` marks the flagged line):

```ts
   1 | import { IsEmail } from 'class-validator';
>> 2 | import { Column, Entity, ObjectIdColumn, PrimaryGeneratedColumn } from 'typeorm';
   3 | 
   4 | @Entity()
   5 | export class User {
   6 |   @PrimaryGeneratedColumn()
   7 |   @ObjectIdColumn()
   8 |   id: string;
```
- **Open the full file:** https://github.com/Neosoft-Private-Limited/rest-node-nestjs/blob/1ec5af9f9febf82a200bb3fe5118d0b09872412b/src/feature/users/entities/user.entity.ts#L2

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M50

- **Style claimed by the repo:** Layered
- **Repository:** `Q00/api_server_boilerplate` at `80f18f59` (layer map: §L, `q00-api-server`)
- **Rule, in plain words:** No dependency cycles: these files import each other in a loop.
- **The finding:** Cycle: `src/model/UserAccounts.ts` → `src/model/Users.ts` → `src/model/UserAccounts.ts`
- **Excerpt** (each step of the cycle; `>>` marks the import):

```ts
// src/model/UserAccounts.ts
   2 | import { IsEnum, IsString, IsObject } from 'class-validator';
>> 3 | import { User } from './Users';
   4 | import { BaseModel } from './BaseModel';
// src/model/Users.ts
   10 | import { BaseModel } from './BaseModel';
>> 11 | import { UserAccount } from './UserAccounts';
   12 | import { ExampleBoard, ExampleBoardComment, ExampleBoardDepthComment } from '.';
```
- **Open the full file:** https://github.com/Q00/api_server_boilerplate/blob/80f18f59d07fb5a52fc51e33e1ef89d0ae38afe5/src/model/UserAccounts.ts

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M51

- **Style claimed by the repo:** Hexagonal (ports and adapters)
- **Repository:** `antoinechalifour/remix-hexagonal-architecture` at `df94d98b` (layer map: §L, `remix-hexagonal`)
- **Rule, in plain words:** An adapter must implement a port (an interface declared in the domain or application). This adapter class implements none.
- **The finding:** `src/shared/database/PrismaRepository.ts`: PrismaRepository implements no interface declared in domain or application.
- **Excerpt** (`src/shared/database/PrismaRepository.ts`; `>>` marks the flagged line):

```ts
    5 | 
    6 | export type PrismaQueryRunner = Omit<
    7 |   PrismaClient,
    8 |   "$connect" | "$disconnect" | "$on" | "$transaction" | "$use"
    9 | >;
   10 | 
>> 11 | export abstract class PrismaRepository {
   12 |   constructor(@Inject(PRISMA) protected readonly prisma: PrismaQueryRunner) {}
   13 | 
   14 |   protected isUniqueConstraintFailed(
   15 |     e: unknown
   16 |   ): e is PrismaClientKnownRequestError {
   17 |     return e instanceof PrismaClientKnownRequestError && e.code === "P2002";
```
- **Open the full file:** https://github.com/antoinechalifour/remix-hexagonal-architecture/blob/df94d98bcccf5b4d87aa5792ac8642e7b3816f5d/src/shared/database/PrismaRepository.ts

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M52

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `4lessandrodev/finance-project-ddd` at `9f0725a8` (layer map: §L, `finance-project-ddd`)
- **Rule, in plain words:** A bounded context may use another context only through that context's public API or an anti-corruption layer. This import reaches inside another context.
- **The finding:** `src/modules/transaction/application/use-cases/percentage-capital-inflow-posting/percentage-capital-inflow-posting.use-case.ts` (context **transaction**) imports `src/modules/budget-box/domain/reason-description.value-object.ts` (context **budget-box**), which is not in the public API of budget-box.
- **Excerpt** (`src/modules/transaction/application/use-cases/percentage-capital-inflow-posting/percentage-capital-inflow-posting.use-case.ts`; `>>` marks the flagged line):

```ts
    1 | import { Inject } from "@nestjs/common";
    2 | import { ChangesObserver, CurrencyValueObject, DateValueObject, DomainId, IUseCase, Result } from "types-ddd";
    3 | import ITransactionRepository from "@modules/transaction/domain/interfaces/transaction.repository.interface";
    4 | import TransactionAggregate from "@modules/transaction/domain/transaction.aggregate";
>>  5 | import ReasonDescriptionValueObject from "@modules/budget-box/domain/reason-description.value-object";
    6 | import AttachmentPathValueObject from "@modules/transaction/domain/attachment-path.value-object";
    7 | import TransactionStatusValueObject from "@modules/transaction/domain/transaction-status.value-object";
    8 | import TransactionNoteValueObject from "@modules/transaction/domain/transaction-note.value-object";
    9 | import TransactionTypeValueObject from "@modules/transaction/domain/transaction-type.value-object";
   10 | import { IDomainService } from "@modules/shared";
   11 | import TransactionCalculationValueObject from "@modules/transaction/domain/transaction-calculations.value-object";
```
- **Open the full file:** https://github.com/4lessandrodev/finance-project-ddd/blob/9f0725a83be4863db3da230e3bf9c5fa3f6c9a7d/src/modules/transaction/application/use-cases/percentage-capital-inflow-posting/percentage-capital-inflow-posting.use-case.ts#L5

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M53

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `yerinadler/typescript-event-sourcing-sample-app` at `55fa9ef3` (layer map: §L, `event-sourcing-ddd`)
- **Rule, in plain words:** Dependencies between layers must follow the allowed edges of this style (toward the core). This import is not one of the allowed edges.
- **The finding:** `src/eventHandlers/book/BookCreatedEventHandler.ts` (layer **application**) imports `src/projection/book/ReadModel.ts` (layer **infrastructure**) at line 8.
- **Excerpt** (`src/eventHandlers/book/BookCreatedEventHandler.ts`; `>>` marks the flagged line):

```ts
    2 | import { IEventHandler } from '@core/IEventHandler';
    3 | import { BookEvent } from '@domain/book/events';
    4 | import { inject, injectable } from 'inversify';
    5 | import Event from 'events';
    6 | import Redis from 'ioredis';
    7 | import { BookCreated } from '@domain/book/events/BookCreated';
>>  8 | import { IBookReadModelFacade } from '../../projection/book/ReadModel';
    9 | import { IAuthorReadModelFacade } from 'projection/author/ReadModel';
   10 | 
   11 | @injectable()
   12 | export class BookCreatedEventHandler implements IEventHandler<BookEvent> {
   13 |   constructor(
   14 |     @inject(TYPES.EventBus) private readonly eventBus: Event.EventEmitter,
```
- **Open the full file:** https://github.com/yerinadler/typescript-event-sourcing-sample-app/blob/55fa9ef395594911feaa9051e07b3a21a87f3abd/src/eventHandlers/book/BookCreatedEventHandler.ts#L8

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M54

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `victormonserrat/mustodon` at `5dd06ad7` (layer map: §L, `mustodon`)
- **Rule, in plain words:** Domain code must stay free of frameworks and infrastructure libraries. This domain file imports such a package.
- **The finding:** `src/todos/domain/events/RetitledTodo.ts` (layer **domain**) imports `@nestjs/cqrs` (package) at line 1.
- **Excerpt** (`src/todos/domain/events/RetitledTodo.ts`; `>>` marks the flagged line):

```ts
>> 1 | import { IEvent } from '@nestjs/cqrs';
   2 | 
   3 | export class RetitledTodo implements IEvent {
   4 |   static with(id: string, title: string): RetitledTodo {
   5 |     return new this(id, title);
   6 |   }
   7 | 
```
- **Open the full file:** https://github.com/victormonserrat/mustodon/blob/5dd06ad7bf0d3af469478d54bf993bd01f9b4b34/src/todos/domain/events/RetitledTodo.ts#L1

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M55

- **Style claimed by the repo:** Hexagonal (ports and adapters)
- **Repository:** `auxdevelopment/hexagonal-banking-ts` at `7fe5cb9b` (layer map: §L, `hexagonal-banking`)
- **Rule, in plain words:** Dependencies between layers must follow the allowed edges of this style (toward the core). This import is not one of the allowed edges.
- **The finding:** `src/core/domain/account/account-service.adapter.ts` (layer **domain**) imports `src/core/use-case/account/perform-debit.port.ts` (layer **application**) at line 3.
- **Excerpt** (`src/core/domain/account/account-service.adapter.ts`; `>>` marks the flagged line):

```ts
   1 | import { CloseAccount } from "../../use-case/account/close-account.port";
   2 | import { OpenAccount, OpenAccountCommand } from "../../use-case/account/open-account.port";
>> 3 | import { PerformDebit } from "../../use-case/account/perform-debit.port";
   4 | import { ViewCurrentBalance } from "../../use-case/account/view-current-balance";
   5 | import { AccountId } from "./account-id.value";
   6 | import { AccountRepository } from "./account-repository.port";
   7 | import { Account } from "./account.aggregate";
   8 | import { Balance } from "./balance.value";
   9 | 
```
- **Open the full file:** https://github.com/auxdevelopment/hexagonal-banking-ts/blob/7fe5cb9b36c17aec127bde8b2b67eb7c2fab425d/src/core/domain/account/account-service.adapter.ts#L3

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M56

- **Style claimed by the repo:** Layered
- **Repository:** `w3tecch/express-typescript-boilerplate` at `17727010` (layer map: §L, `w3tec-express-boilerplate`)
- **Rule, in plain words:** Strict layering: a layer may use only the layer directly below it. This import skips a layer.
- **The finding:** `src/api/resolvers/UserResolver.ts` (layer **presentation**) imports `src/api/models/User.ts` (layer **persistence**) at line 4.
- **Excerpt** (`src/api/resolvers/UserResolver.ts`; `>>` marks the flagged line):

```ts
    1 | import { FieldResolver, Query, Resolver, Root } from 'type-graphql';
    2 | import { Service } from 'typedi';
    3 | 
>>  4 | import { User as UserModel } from '../models/User';
    5 | import { PetService } from '../services/PetService';
    6 | import { UserService } from '../services/UserService';
    7 | import { User } from '../types/User';
    8 | 
    9 | @Service()
   10 | @Resolver(of => User)
```
- **Open the full file:** https://github.com/w3tecch/express-typescript-boilerplate/blob/17727010f7f098d8ca8b78da0a5b3c7297659381/src/api/resolvers/UserResolver.ts#L4

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M57

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `stemmlerjs/ddd-forum` at `3aa0b8d3` (layer map: §L, `ddd-forum`)
- **Rule, in plain words:** Repositories exist only for aggregate roots. This repository handles an inner entity of an aggregate.
- **The finding:** `src/modules/forum/repos/implementations/sequelizePostVotesRepo.ts`: repository src/modules/forum/repos/implementations/sequelizePostVotesRepo.ts references inner entity src/modules/forum/domain/postVote.ts of Post.
- **Excerpt** (`src/modules/forum/repos/implementations/sequelizePostVotesRepo.ts`; `>>` marks the flagged line):

```ts
   1 | 
   2 | import { IPostVotesRepo } from "../postVotesRepo";
>> 3 | import { PostVote } from "../../domain/postVote";
   4 | import { MemberId } from "../../domain/memberId";
   5 | import { PostId } from "../../domain/postId";
   6 | import { PostVoteMap } from "../../mappers/postVoteMap";
   7 | import { VoteType } from "../../domain/vote";
   8 | import { PostVotes } from "../../domain/postVotes";
   9 | 
```
- **Open the full file:** https://github.com/stemmlerjs/ddd-forum/blob/3aa0b8d3ad3b58c111c57974fb321ddb230bde73/src/modules/forum/repos/implementations/sequelizePostVotesRepo.ts#L3

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M58

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `LucasHang/ddd-payday` at `252a816c` (layer map: §L, `lucashang-ddd-payday`)
- **Rule, in plain words:** A bounded context may use another context only through that context's public API or an anti-corruption layer. This import reaches inside another context.
- **The finding:** `src/modules/accounts/useCases/createAccount/index.ts` (context **accounts**) imports `src/modules/users/repositories/implementations/fake/fakeUserRepository.ts` (context **users**), which is not in the public API of users.
- **Excerpt** (`src/modules/accounts/useCases/createAccount/index.ts`; `>>` marks the flagged line):

```ts
   1 | import FakeAccountRepository from '@modules/accounts/repositories/implementations/fake/fakeAccountRepository';
>> 2 | import FakeUserRepository from '@modules/users/repositories/implementations/fake/fakeUserRepository';
   3 | import CreateAccountUseCase from './CreateAccountUseCase';
   4 | 
   5 | const createAccountUseCase = new CreateAccountUseCase(new FakeAccountRepository(), new FakeUserRepository());
   6 | 
   7 | export { createAccountUseCase };
   8 | 
```
- **Open the full file:** https://github.com/LucasHang/ddd-payday/blob/252a816c3567965669596e2fbb7f686f46973379/src/modules/accounts/useCases/createAccount/index.ts#L2

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M59

- **Style claimed by the repo:** Layered
- **Repository:** `bymi15/express-typeorm-rest-boilerplate` at `cb90f2c5` (layer map: §L, `bymi15-express-typeorm`)
- **Rule, in plain words:** Strict layering: a layer may use only the layer directly below it. This import skips a layer.
- **The finding:** `src/api/routes/jobApplication.ts` (layer **presentation**) imports `src/api/entities/User.ts` (layer **persistence**) at line 8.
- **Excerpt** (`src/api/routes/jobApplication.ts`; `>>` marks the flagged line):

```ts
    2 | import { Container } from 'typedi';
    3 | import { celebrate, Joi } from 'celebrate';
    4 | import JobApplicationService from '../services/JobApplicationService';
    5 | import { Logger } from 'winston';
    6 | import { JobApplication } from '../entities/JobApplication';
    7 | import { attachUser, isAuth } from '../middlewares';
>>  8 | import { User } from '../entities/User';
    9 | import CompanyService from '../services/CompanyService';
   10 | import { ObjectID } from 'typeorm';
   11 | 
   12 | const route = Router();
   13 | 
   14 | route.get('/', isAuth, async (req, res, next) => {
```
- **Open the full file:** https://github.com/bymi15/express-typeorm-rest-boilerplate/blob/cb90f2c53c4126c9dc2e8f4890050fd7edfe334d/src/api/routes/jobApplication.ts#L8

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### M60

- **Style claimed by the repo:** Layered
- **Repository:** `steve-lebleu/typeplate` at `bdd0350b` (layer map: §L, `typeplate`)
- **Rule, in plain words:** Domain code must stay free of frameworks and infrastructure libraries. This domain file imports such a package.
- **The finding:** `src/api/core/services/cache.service.ts` (layer **business**) imports `express` (package) at line 1.
- **Excerpt** (`src/api/core/services/cache.service.ts`; `>>` marks the flagged line):

```ts
>> 1 | import { Request } from 'express';
   2 | 
   3 | import { ICache } from '@interfaces';
   4 | 
   5 | import { CacheConfiguration } from '@config/cache.config';
   6 | import { encrypt } from '@utils/string.util';
   7 | 
```
- **Open the full file:** https://github.com/steve-lebleu/typeplate/blob/bdd0350b6cb96748fdb3ed41aea6be3446800388/src/api/core/services/cache.service.ts#L1

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

## L. Layer maps of the repositories (how the study mapped each repo's folders)

The study wrote one layer map per repository from its README and folders, before running the tool. Order is as declared (Clean, Hexagonal, DDD: inner first; Layered: lowest first). If a map puts a file in a layer its real role does not fit, that is reason code `M`.

### `bank-server`: pietrzakadrian/bank-server (nestjs)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain |  | `src/common/entities/**`, `src/modules/*/entities/**` |
| infrastructure |  | `src/migrations/**`, `src/middlewares/**`, `src/filters/**`, `src/modules/*/repositories/**`, `src/modules/*/subscribers/**`, `src/modules/*/strategies/**`, `src/utils/strategies/**`, `src/utils/ormconfig.ts` |
| application |  | `src/common/dtos/**`, `src/modules/*/dtos/**`, `src/modules/*/services/**`, `src/modules/*/crons/**`, `src/utils/services/**` |
| presentation |  | `src/modules/*/controllers/**`, `src/guards/**`, `src/interceptors/**`, `src/decorators/**` |

### `bymi15-express-typeorm`: bymi15/express-typeorm-rest-boilerplate (layered)

| Layer | Kind | Folders (globs) |
|---|---|---|
| persistence | infrastructure | `src/api/entities/**` |
| business | domain | `src/api/services/**` |
| presentation | presentation | `src/api/routes/**`, `src/api/middlewares/**` |

### `canario-hexagonal-express`: Canario0/hexagonal-express (hexagonal)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain | domain | `src/contexts/**/domain/**` |
| application | application | `src/contexts/**/application/**` |
| adapters-inbound | presentation | `src/apps/*/back/controllers/**`, `src/apps/*/back/routes/**` |
| adapters-outbound | infrastructure | `src/contexts/**/infrastructure/**` |
| config | application | `src/apps/*/back/dependencyInjection/**`, `src/apps/*/back/command/**`, `src/apps/*/back/*BackendApp.ts`, `src/apps/*/back/server.ts`, `src/apps/*/back/start.ts` |

### `cartaxo-ts-boilerplate`: leonardocartaxo/nodejs-ts-boilerplate (clean-architecture)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain |  | `src/microservices/*/entities/**`, `src/utils/base/entities/**` |
| application |  | `src/microservices/*/services/**`, `src/microservices/*/dtos/**`, `src/utils/base/services/**` |
| presentation |  | `src/microservices/*/controllers/**`, `src/utils/base/controllers/**` |
| infrastructure |  | `src/microservices/*/repositories/**`, `src/microservices/*/models/**`, `src/utils/base/repositories/**` |
| main | application | `src/main/**`, `src/microservices/*/index.ts` |

### `ddd-forum`: stemmlerjs/ddd-forum (ddd)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain | domain | `src/modules/*/domain/**`, `src/modules/*/repos/*.ts`, `src/shared/domain/**`, `src/shared/core/**` |
| application | application | `src/modules/*/useCases/**/!(*Controller).ts`, `src/modules/*/subscriptions/**`, `src/modules/*/dtos/**`, `src/modules/*/services/*.ts` |
| infrastructure | infrastructure | `src/modules/*/repos/implementations/**`, `src/modules/*/mappers/**`, `src/modules/*/services/redis/**`, `src/shared/infra/database/**`, `src/shared/infra/*.ts` |
| api | presentation | `src/modules/*/infra/http/**`, `src/modules/*/useCases/**/*Controller.ts`, `src/shared/infra/http/**` |
| composition | application | `src/index.ts`, `src/config/**` |

### `ddd-libellis`: libellis/DDD-Libellis (ddd)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain | domain | `src/*/core/domain/**`, `src/shared-kernel/*.ts`, `src/shared-kernel/event-streams/**`, `src/shared-kernel/exceptions/**`, `src/shared-kernel/interfaces/**`, `src/shared-kernel/value-objects/**` |
| application | application | `src/*/core/application/**`, `src/shared-kernel/services/**`, `src/shared-kernel/models/**` |
| infrastructure | infrastructure | `src/*/infrastructure/**` |
| api | presentation | `src/*/api/**` |
| composition | application | `src/index.ts` |

### `devnica-clean-backend`: devNica/NodeJSBackendAppWithCleanCode (clean-architecture)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain |  | `src/core/domain/**` |
| application |  | `src/core/application/**` |
| presentation |  | `src/interface/**` |
| infrastructure |  | `src/infrastructure/db/**`, `src/infrastructure/repositories/**`, `src/infrastructure/sequelize/**`, `src/infrastructure/express/adapters/**`, `src/infrastructure/express/api/**`, `src/infrastructure/express/setup/**` |
| main | application | `src/factories/**`, `src/infrastructure/express/server.ts` |

### `dlydiard-ddd-cqrs-es`: dlydiard/ddd-cqrs-es-aws-sam (ddd)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain | domain | `src/iam/*/models/**`, `src/iam/*/events/!(*.handler\|*.enricher).ts`, `src/event-store/events/event.ts`, `src/app/validation/**` |
| application | application | `src/iam/*/commands/**`, `src/iam/*/services/**`, `src/iam/*/events/*.enricher.ts`, `src/app/service/**`, `src/app/repository/*.interface.ts`, `src/event-store/**/*.interface.ts` |
| infrastructure | infrastructure | `src/iam/*/events/*.handler.ts`, `src/iam/*/projections/**`, `src/app/repository/dynamo*.ts`, `src/event-store/publisher/dynamo-event-publisher.ts`, `src/event-store/projections/projection.ts`, `src/event-store/projections/repository/dynamo-projection.repository.ts`, `src/event-store/handler/!(*.interface).ts` |
| api | presentation | `src/iam/*/controllers/**`, `src/iam/*/dtos/**`, `src/app/application.controller.ts`, `src/app/dto/**`, `src/event-store/brokers/**`, `src/event-store/dynamo-kinesis-adaptor.ts` |
| composition | application | `src/app/application-container.ts` |

### `event-sourcing-ddd`: yerinadler/typescript-event-sourcing-sample-app (ddd)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain | domain | `src/domain/**`, `src/core/**` |
| application | application | `src/commands/**`, `src/commandHandlers/**`, `src/eventHandlers/**` |
| infrastructure | infrastructure | `src/infrastructure/**`, `src/projection/**` |
| api | presentation | `src/interfaces/http/**` |
| composition | application | `src/entrypoint.ts`, `src/index.ts`, `src/config/**`, `src/constants/**` |

### `felixle-node-core`: felixle236/node-core (clean-architecture)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain |  | `src/domain/**` |
| application |  | `src/application/**` |
| presentation |  | `src/exposes/**` |
| infrastructure |  | `src/infras/**` |
| main | application | `src/app.ts` |

### `finance-project-ddd`: 4lessandrodev/finance-project-ddd (ddd)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain | domain | `src/modules/*/domain/**` |
| application | application | `src/modules/*/application/**` |
| infrastructure | infrastructure | `src/modules/*/infra/repo/**`, `src/modules/*/infra/entities/**`, `src/modules/*/infra/services/queries/**`, `src/modules/shared/infra/connections/**` |
| api | presentation | `src/modules/*/infra/resolver/**`, `src/modules/*/infra/inputs/**`, `src/modules/*/infra/types/**`, `src/modules/*/infra/services/guards/**`, `src/modules/*/infra/services/strategies/**`, `src/modules/*/infra/services/decorators/**` |
| composition | application | `src/main.ts`, `src/app.module.ts`, `src/config/**`, `src/modules/*/infra/*.ts` |

### `geekyants-express`: GeekyAnts/express-typescript (layered)

| Layer | Kind | Folders (globs) |
|---|---|---|
| persistence | infrastructure | `src/models/**` |
| business | domain | `src/services/**` |
| presentation | presentation | `src/controllers/**`, `src/routes/**`, `src/middlewares/**` |

### `hexagonal-banking`: auxdevelopment/hexagonal-banking-ts (hexagonal)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain | domain | `src/core/domain/**` |
| application | application | `src/core/use-case/**` |
| adapters-inbound | presentation | `src/infrastructure/rest-api/controller/**`, `src/infrastructure/rest-api/controller.ts` |
| adapters-outbound | infrastructure | `src/infrastructure/repository/**`, `src/infrastructure/knex/**` |
| config | application | `src/infrastructure/rest-api/server.ts`, `src/main.ts` |

### `hexapinod`: cecric/hexapinod (hexagonal)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain | domain | `src/core/*/models/**`, `src/core/*/interfaces/**`, `src/core/*/services/**`, `src/core/*/exceptions/**` |
| application | application | `src/core/*/usecases/**`, `src/core/*/eventslisteners/**` |
| adapters-inbound | presentation | `src/application/api/rest/**`, `src/application/api/apicallwrapper.ts`, `src/application/cli/**` |
| adapters-outbound | infrastructure | `src/infrastructure/**` |
| config | application | `src/application/api/server.ts`, `src/application/api/wsserver.ts` |

### `innei-nest-http`: innei-template/nest-http-boilerplate (nestjs)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain |  | `src/shared/model/**` |
| infrastructure |  | `src/processors/**/!(*.module).ts`, `src/common/filters/**`, `src/common/middlewares/**`, `src/common/adapt/**`, `src/transformers/model.transformer.ts` |
| application |  | `src/shared/dto/**` |
| presentation |  | `src/common/decorator/**`, `src/common/guard/**`, `src/common/interceptors/**` |

### `leal32b-webapi`: leal32b/webapi-nodejs (clean-architecture)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain |  | `src/core/0.domain/**`, `src/modules/*/0.domain/**` |
| application |  | `src/core/1.application/**`, `src/modules/*/1.application/**` |
| presentation |  | `src/core/2.presentation/**`, `src/modules/*/2.presentation/**` |
| infrastructure |  | `src/core/3.infra/**`, `src/modules/*/3.infra/**` |
| main | application | `src/core/4.main/**`, `src/modules/*/4.main/**` |

### `lucashang-ddd-payday`: LucasHang/ddd-payday (ddd)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain | domain | `src/modules/*/domain/!(index).ts`, `src/modules/*/repositories/I*Repository.ts`, `src/core/domain/**` |
| application | application | `src/modules/*/useCases/*/*UseCase.ts`, `src/modules/*/useCases/*/*DTO.ts`, `src/modules/*/useCases/*/*DTOValidation.ts`, `src/modules/*/dtos/**`, `src/shared/validators/IValidator.ts` |
| infrastructure | infrastructure | `src/modules/*/repositories/implementations/**`, `src/modules/*/mappers/**`, `src/infra/database/**`, `src/core/infra/BaseFakeRepository.ts`, `src/shared/infra/**`, `src/shared/validators/implementations/**` |
| api | presentation | `src/modules/*/useCases/*/*Controller.ts`, `src/modules/*/infra/http/**`, `src/infra/http/api/**`, `src/infra/http/app.ts`, `src/core/infra/BaseController.ts` |
| composition | application | `src/modules/*/useCases/*/index.ts`, `src/infra/http/server.ts`, `src/index.ts` |

### `meetinger`: Arvinje/meetinger (ddd)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain | domain | `src/modules/*/domain/**`, `src/modules/*/errors/**`, `src/modules/*/repos/*Repo.ts`, `src/shared/domain/**` |
| application | application | `src/modules/*/usecase/*/*UseCase.ts`, `src/modules/*/usecase/*/*Request.ts`, `src/modules/*/usecase/*/*Response.ts`, `src/modules/*/dtos/**`, `src/modules/*/integrationEvents/**`, `src/modules/*/emails/**`, `src/modules/*/listeners/**` |
| infrastructure | infrastructure | `src/modules/*/repos/implementations/**`, `src/modules/*/mappers/**`, `src/shared/infra/brokers/**`, `src/shared/infra/dynamodb/**`, `src/shared/infra/emailService/**`, `src/shared/infra/queues/**` |
| api | presentation | `src/modules/*/usecase/*/*Controller.ts`, `src/shared/infra/http/**` |
| composition | application | `src/modules/*/usecase/*/index.ts` |

### `monstarlab-nestjs-starter`: monstar-lab-oss/nestjs-starter-rest-api (nestjs)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain |  | `src/*/entities/**` |
| infrastructure |  | `src/*/repositories/**`, `src/*/strategies/**`, `src/shared/filters/**`, `src/shared/middlewares/**`, `src/shared/logger/!(*.module).ts` |
| application |  | `src/*/services/**`, `src/*/dtos/**`, `src/shared/acl/**`, `src/shared/request-context/**` |
| presentation |  | `src/*/controllers/**`, `src/*/guards/**`, `src/*/decorators/**`, `src/shared/interceptors/**` |

### `mustodon`: victormonserrat/mustodon (ddd)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain | domain | `src/*/domain/**`, `src/common/domain/**` |
| application | application | `src/*/application/**` |
| infrastructure | infrastructure | `src/todos/infrastructure/repositories/**`, `src/todos/infrastructure/events/**`, `src/todos/infrastructure/models/MongooseTodoView.ts` |
| api | presentation | `src/todos/infrastructure/controllers/**`, `src/todos/infrastructure/models/PostTodoDTO.ts`, `src/todos/infrastructure/models/PutTodoDTO.ts`, `src/todos/infrastructure/models/SwaggerTodoView.ts` |
| composition | application | `src/main.ts`, `config/**` |

### `nalhin-movies`: Nalhin/Movies (hexagonal)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain | domain | `src/*/domain/**` |
| application | application | `src/*/application/**` |
| adapters-inbound | presentation | `src/*/adapter/in/**` |
| adapters-outbound | infrastructure | `src/*/adapter/out/**` |
| config | application | `src/main.ts`, `src/app.module.ts`, `src/movie/movie.module.ts`, `src/user/user.module.ts` |

### `neosoft-rest-nestjs`: Neosoft-Private-Limited/rest-node-nestjs (nestjs)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain |  | `src/feature/*/entities/**` |
| infrastructure |  | `src/feature/*/repository/**`, `src/core/db/typeorm.config.ts`, `src/core/middleware/!(index).ts`, `src/core/logger/AppLogger.ts`, `src/core/hashing/**`, `src/core/crypto/**`, `src/shared/mailer/mailer.service.ts`, `src/shared/mailer/mailer-interfaces/interfaces.ts` |
| application |  | `src/feature/*/services/**`, `src/feature/*/dto/**` |
| presentation |  | `src/core/module.ts` |

### `neoteric-nestjs-auth`: neoteric-eu/nestjs-auth (nestjs)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain |  | `src/domain/**`, `src/entities/**`, `src/app/*/entity/**`, `src/app/_helpers/entity/**` |
| infrastructure |  | `src/infrastructure/**`, `src/app/_helpers/database/**`, `src/app/_helpers/mail/**`, `src/app/_helpers/sms/**`, `src/app/_helpers/push/**`, `src/app/_helpers/middleware/**`, `src/app/_helpers/filters/**`, `src/app/database/**/!(*.module).ts`, `src/migrations/**` |
| application |  | `src/app/security/**`, `src/app/*/security/**`, `src/app/*/services/**` |
| presentation |  | `src/app/*/resolvers/**`, `src/app/_helpers/graphql/**`, `src/app/_helpers/decorators/**` |

### `nest-products-hexagonal`: fmcarrero/nest-js-products-api (hexagonal)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain | domain | `src/domain/**` |
| application | application | `src/application/**` |
| adapters-inbound | presentation | `src/infrastructure/controllers/**`, `src/infrastructure/exceptions/**` |
| adapters-outbound | infrastructure | `src/infrastructure/adapters/**`, `src/infrastructure/mapper/**` |
| config | application | `src/infrastructure/*.ts`, `src/app.module.ts`, `src/main.ts` |

### `ngduc-node-rem`: ngduc/node-rem (layered)

| Layer | Kind | Folders (globs) |
|---|---|---|
| persistence | infrastructure | `src/api/models/**` |
| business | domain | `src/api/services/**` |
| presentation | presentation | `src/api/controllers/**`, `src/api/routes/**`, `src/api/validations/**`, `src/api/middlewares/**` |

### `nutes-template-base`: nutes-uepb/template-base-ts (clean-architecture)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain |  | `src/application/domain/**` |
| application |  | `src/application/port/**`, `src/application/integration-event/**` |
| presentation |  | `src/ui/**` |
| infrastructure |  | `src/infrastructure/**` |
| main | application | `src/di/**`, `src/background/**`, `src/app.ts` |

### `pallavi-twitter-backend`: pallavi-shekhar/twitter-clone-backend (layered)

| Layer | Kind | Folders (globs) |
|---|---|---|
| persistence | infrastructure | `src/database/**` |
| business | domain | `src/controllers/**` |
| presentation | presentation | `src/routes/**`, `src/middlewares/**` |

### `pezzetti-base-app`: pezzetti/base-app-nestjs (ddd)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain | domain | `src/modules/*/domain/**` |
| application | application | `src/modules/*/applications/**`, `src/modules/*/interfaces/**`, `src/modules/auth/shared/auth.service.ts`, `src/modules/auth/shared/token.ts`, `src/modules/auth/shared/user.interface.ts` |
| infrastructure | infrastructure | `src/modules/*/services/**`, `src/modules/auth/shared/*.strategy.ts` |
| api | presentation | `src/modules/*/controller/**`, `src/modules/*/resolver/**`, `src/modules/*/*.controller.ts`, `src/modules/auth/shared/*.guard.ts`, `src/common/**` |
| composition | application | `src/main.ts`, `src/app.module.ts`, `src/ormconfig.ts`, `src/config/**`, `src/modules/*/*.module.ts` |

### `pvarentsov-clean`: pvarentsov/typescript-clean-architecture (clean-architecture)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain |  | `src/core/domain/**`, `src/core/common/**` |
| application |  | `src/core/service/**` |
| presentation |  | `src/application/api/**` |
| infrastructure |  | `src/infrastructure/**` |
| main | application | `src/application/di/**`, `src/application/*.ts`, `src/Main.ts` |

### `q00-api-server`: Q00/api_server_boilerplate (layered)

| Layer | Kind | Folders (globs) |
|---|---|---|
| persistence | infrastructure | `src/model/**`, `src/database/**` |
| business | domain | `src/service/**`, `src/provider/**` |
| presentation | presentation | `src/controller/**`, `src/middleware/**`, `src/interceptor/**`, `src/dto/**` |

### `remix-hexagonal`: antoinechalifour/remix-hexagonal-architecture (hexagonal)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain | domain | `src/*/domain/**` |
| application | application | `src/*/usecase/**`, `src/*/application/**` |
| adapters-inbound | presentation | `src/web/authenticator/**`, `src/web/controllers/**`, `src/web/remix/**` |
| adapters-outbound | infrastructure | `src/*/infrastructure/**`, `src/shared/database/**` |
| config | application | `src/web/ApplicationModule.ts`, `src/web/index.ts`, `src/main.ts`, `src/keys.ts` |

### `ruslanguns-nestjs-starter`: ruslanguns/nestjs-starter (nestjs)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain |  | `src/modules/*/entities/!(index).ts`, `src/common/abstracts/entities/!(index).ts` |
| infrastructure |  | `src/common/filters/!(index).ts`, `src/common/pipes/**`, `src/core/scheduler/task.service.ts` |
| application |  | `src/modules/*/services/!(index).ts`, `src/modules/*/dto/!(index).ts`, `src/modules/*/dtos/!(index).ts`, `src/common/validators/!(index).ts` |
| presentation |  | `src/common/interceptors/**` |

### `surgeharb-nestjs`: surgeharb/nestjs-boilerplate (nestjs)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain |  | `src/*/schemas/**`, `src/users/interfaces/**`, `src/posts/interfaces/**`, `src/@schemas/**` |
| infrastructure |  | `src/@core/services/**` |
| application |  | `src/*/dtos/**`, `src/@core/ui-components/**` |
| presentation |  | `src/@core/decorators/**`, `src/app.routes.ts` |

### `talento90-typescript-node`: Talento90/typescript-node (layered)

| Layer | Kind | Folders (globs) |
|---|---|---|
| persistence | infrastructure | `src/repositories/**`, `src/lib/database/**` |
| business | domain | `src/managers/**`, `src/entities/**` |
| presentation | presentation | `src/server/**` |

### `talyssonoc-node-api`: talyssonoc/node-api-boilerplate (ddd)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain | domain | `src/*/domain/**`, `src/_sharedKernel/domain/**` |
| application | application | `src/*/application/**` |
| infrastructure | infrastructure | `src/*/infrastructure/**`, `src/_sharedKernel/infrastructure/**` |
| api | presentation | `src/*/interface/**`, `src/_sharedKernel/interface/**` |
| composition | application | `src/article/index.ts`, `src/comment/index.ts`, `src/_boot/**`, `src/index.ts`, `src/container.ts`, `src/context.ts`, `src/config.ts` |

### `ts-seed-hexagonal`: somosphi/ts-seed-hexagonal (hexagonal)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain | domain | `src/core/service/**` |
| application | application | `src/core/useCase/**` |
| adapters-inbound | presentation | `src/interface/http/**`, `src/interface/amqp/**` |
| adapters-outbound | infrastructure | `src/infrastructure/adapter/**`, `src/infrastructure/repository/**` |
| config | application | `src/core/container.ts`, `src/infrastructure/container.ts`, `src/interface/container.ts`, `src/index.ts` |

### `typeplate`: steve-lebleu/typeplate (layered)

| Layer | Kind | Folders (globs) |
|---|---|---|
| persistence | infrastructure | `src/api/core/repositories/**`, `src/api/core/models/**`, `src/api/core/subscribers/**` |
| business | domain | `src/api/core/services/**`, `src/api/shared/services/**` |
| presentation | presentation | `src/api/core/controllers/**`, `src/api/core/routes/**`, `src/api/core/middlewares/**`, `src/api/core/validations/**` |

### `vivify-nestjs-boilerplate`: Vivify-Ideas/nestjs-boilerplate (nestjs)

| Layer | Kind | Folders (globs) |
|---|---|---|
| domain |  | `src/domain/**`, `src/entities/**` |
| infrastructure |  | `src/migrations/**`, `src/modules/config/!(*.module).ts` |
| application |  | `src/modules/common/validator/**` |
| presentation |  | `src/swagger/**`, `src/modules/common/decorator/**`, `src/modules/common/transformer/**` |

### `w3tec-express-boilerplate`: w3tecch/express-typescript-boilerplate (layered)

| Layer | Kind | Folders (globs) |
|---|---|---|
| persistence | infrastructure | `src/api/repositories/**`, `src/api/models/**`, `src/database/**` |
| business | domain | `src/api/services/**`, `src/api/subscribers/**` |
| presentation | presentation | `src/api/controllers/**`, `src/api/resolvers/**`, `src/api/middlewares/**`, `src/api/types/**` |

## Licences

Excerpts are short quotations from public repositories under permissive licences (MIT, ISC, BSD, Apache-2.0), at the pinned commits listed above, for research review. Attribution and licence per repository: `results/v1.3-external*/NOTICE.md` and `selection.json`.
