# MEAN-01 calibration items (5): answer these first, then open the worked answers

Read §0–§4 of the rater packet (`mean-01-rater-packet.md`) first; the layer maps (§L) are at its end. Answer each item on your own. Then the author shows you the worked answers and you discuss them together (about 20 minutes). Calibration answers are never counted, and the discussion settles how the codebook is read, never an answer to one of the 60 items.

### C1

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `dlydiard/ddd-cqrs-es-aws-sam` at `77a95f23` (layer map: §L, `dlydiard-ddd-cqrs-es`)
- **Rule, in plain words:** Dependencies between layers must follow the allowed edges of this style (toward the core). This import is not one of the allowed edges.
- **The finding:** `src/iam/user/services/user.service.ts` (layer **application**) imports `src/event-store/publisher/dynamo-event-publisher.ts` (layer **infrastructure**) at line 8.
- **Excerpt** (`src/iam/user/services/user.service.ts`; `>>` marks the flagged line):

```ts
    2 | import { inject, injectable } from 'inversify';
    3 | 
    4 | import { ApplicationError, ApplicationErrorNumber } from '../../../app/application-error';
    5 | import { DynamoSetValidationRepository } from '../../../app/repository/dynamo-set-validation.repository';
    6 | import { SetValidationRepository } from '../../../app/repository/set-validation-repository.interface';
    7 | import { Service } from '../../../app/service/service.interface';
>>  8 | import { DynamoEventPublisher } from '../../../event-store/publisher/dynamo-event-publisher';
    9 | import { EventPublisher } from '../../../event-store/publisher/event-publisher.interface';
   10 | import { Role } from '../../role/models/role';
   11 | import { RoleService } from '../../role/services/role.service';
   12 | import { AddUserRole } from '../commands/add-user-role.command';
   13 | import { DisableUser } from '../commands/disable-user.command';
   14 | import { RegisterUser } from '../commands/register-user.command';
```
- **Open the full file:** https://github.com/dlydiard/ddd-cqrs-es-aws-sam/blob/77a95f2342b04ace9bea7db77ea1505a9ff03c08/src/iam/user/services/user.service.ts#L8

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### C2

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `stemmlerjs/ddd-forum` at `3aa0b8d3` (layer map: §L, `ddd-forum`)
- **Rule, in plain words:** A bounded context may use another context only through that context's public API or an anti-corruption layer. This import reaches inside another context.
- **The finding:** `src/modules/forum/domain/member.ts` (context **forum**) imports `src/modules/users/domain/userId.ts` (context **users**), which is not in the public API of users.
- **Excerpt** (`src/modules/forum/domain/member.ts`; `>>` marks the flagged line):

```ts
    1 | 
    2 | import { AggregateRoot } from "../../../shared/domain/AggregateRoot";
    3 | import { UniqueEntityID } from "../../../shared/domain/UniqueEntityID";
    4 | import { Result } from "../../../shared/core/Result";
>>  5 | import { UserId } from "../../users/domain/userId";
    6 | import { UserName } from "../../users/domain/userName";
    7 | import { Guard } from "../../../shared/core/Guard";
    8 | import { MemberCreated } from "./events/memberCreated";
    9 | import { MemberId } from "./memberId";
   10 | 
   11 | interface MemberProps {
```
- **Open the full file:** https://github.com/stemmlerjs/ddd-forum/blob/3aa0b8d3ad3b58c111c57974fb321ddb230bde73/src/modules/forum/domain/member.ts#L5

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### C3

- **Style claimed by the repo:** Layered
- **Repository:** `pallavi-shekhar/twitter-clone-backend` at `7b8e0a6d` (layer map: §L, `pallavi-twitter-backend`)
- **Rule, in plain words:** Strict layering: a layer may use only the layer directly below it. This import skips a layer.
- **The finding:** `src/controllers/access/login.controller.ts` (layer **business**) imports `src/middlewares/asyncHandler.ts` (layer **presentation**) at line 7.
- **Excerpt** (`src/controllers/access/login.controller.ts`; `>>` marks the flagged line):

```ts
    1 | import bcrypt from 'bcrypt';
    2 | import _ from 'lodash';
    3 | import { AuthFailureError, BadRequestError } from "../../core/ApiError";
    4 | import { SuccessResponse } from '../../core/ApiResponse';
    5 | import UserRepo from '../../database/repository/UserRepo';
    6 | import { createTokens } from '../../core/authUtils';
>>  7 | import asyncHandler from '../../middlewares/asyncHandler';
    8 | 
    9 | const login = asyncHandler(async (req,res) => {
   10 |     const user = await UserRepo.findByEmail(req.body.email);
   11 |     if(!user) 
   12 |         throw new BadRequestError('User not registered');
   13 | 
```
- **Open the full file:** https://github.com/pallavi-shekhar/twitter-clone-backend/blob/7b8e0a6d22f00cff54fcc8b3d9e51f4478f57f77/src/controllers/access/login.controller.ts#L7

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### C4

- **Style claimed by the repo:** Layered
- **Repository:** `Q00/api_server_boilerplate` at `80f18f59` (layer map: §L, `q00-api-server`)
- **Rule, in plain words:** No dependency cycles: these files import each other in a loop.
- **The finding:** Cycle: `src/model/ExampleBoardComments.ts` → `src/model/ExampleBoards.ts` → `src/model/ExampleBoardComments.ts`
- **Excerpt** (each step of the cycle; `>>` marks the import):

```ts
// src/model/ExampleBoardComments.ts
   2 | import { BaseComment } from './BaseComment';
>> 3 | import { ExampleBoard } from './ExampleBoards';
   4 | import { User } from './Users';
// src/model/ExampleBoards.ts
   2 | import { BaseBoard } from './BaseBoard';
>> 3 | import { ExampleBoardComment } from './ExampleBoardComments';
   4 | import { User } from './Users';
```
- **Open the full file:** https://github.com/Q00/api_server_boilerplate/blob/80f18f59d07fb5a52fc51e33e1ef89d0ae38afe5/src/model/ExampleBoardComments.ts

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

### C5

- **Style claimed by the repo:** Domain-Driven Design
- **Repository:** `4lessandrodev/finance-project-ddd` at `9f0725a8` (layer map: §L, `finance-project-ddd`)
- **Rule, in plain words:** Domain code must stay free of frameworks and infrastructure libraries. This domain file imports such a package.
- **The finding:** `src/modules/budget-box/domain/services/can-allocate-percentage-to-budget-box.domain-service.ts` (layer **domain**) imports `@nestjs/common` (package) at line 1.
- **Excerpt** (`src/modules/budget-box/domain/services/can-allocate-percentage-to-budget-box.domain-service.ts`; `>>` marks the flagged line):

```ts
>> 1 | import { Inject } from "@nestjs/common";
   2 | import { Result } from "types-ddd";
   3 | import { IDomainService } from "@modules/shared/interfaces/domain-service.interface";
   4 | import { IBudgetBoxQueryService } from "@modules/budget-box/infra/services/queries/budget-box-query.interface";
   5 | 
   6 | interface Dto {
   7 | 	ownerId: string;
```
- **Open the full file:** https://github.com/4lessandrodev/finance-project-ddd/blob/9f0725a83be4863db3da230e3bf9c5fa3f6c9a7d/src/modules/budget-box/domain/services/can-allocate-percentage-to-budget-box.domain-service.ts#L1

| Field | Your answer |
|---|---|
| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |
| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |
| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |
| Note (optional, one line) | |

---

