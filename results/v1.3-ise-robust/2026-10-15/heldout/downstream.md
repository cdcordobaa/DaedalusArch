# ISE prototype: downstream findings (d), inferred spec vs true spec

| Target | True style | Inferred style | Verdict agrees | Blocking set identical | Mean blocking Jaccard | Planted detected (true spec) | Planted detected (inferred spec) | Planted touched (true / inferred) | Expected findings matched (true / inferred) |
|---|---|---|---|---|---|---|---|---|---|
| N1-clean-architecture | clean-architecture | clean-architecture | 14/14 | 14/14 | 1.00 | 9/10 | 9/10 | 9/10 / 9/10 | 15/16 / 15/16 |
| N1-layered | layered | layered | 13/13 | 13/13 | 1.00 | 9/9 | 9/9 | 9/9 / 9/9 | 11/11 / 11/11 |
| N1-nestjs | nestjs | nestjs | 14/14 | 14/14 | 1.00 | 9/10 | 9/10 | 9/10 / 9/10 | 12/13 / 12/13 |
| N1-hexagonal | hexagonal | hexagonal | 15/15 | 15/15 | 1.00 | 11/11 | 11/11 | 11/11 / 11/11 | 16/16 / 16/16 |
| N1-ddd | ddd | ddd | 15/15 | 15/15 | 1.00 | 12/12 | 12/12 | 12/12 / 12/12 | 12/12 / 12/12 |
| N2-clean-architecture | clean-architecture | clean-architecture | 14/14 | 14/14 | 1.00 | 9/10 | 9/10 | 9/10 / 9/10 | 15/16 / 15/16 |
| N2-layered | layered | layered | 13/13 | 13/13 | 1.00 | 9/9 | 9/9 | 9/9 / 9/9 | 11/11 / 11/11 |
| N2-nestjs | nestjs | nestjs | 14/14 | 14/14 | 1.00 | 9/10 | 9/10 | 9/10 / 9/10 | 12/13 / 12/13 |
| N2-hexagonal | hexagonal | hexagonal | 15/15 | 15/15 | 1.00 | 11/11 | 11/11 | 11/11 / 11/11 | 16/16 / 16/16 |
| N2-ddd | ddd | ddd | 15/15 | 15/15 | 1.00 | 12/12 | 12/12 | 12/12 / 12/12 | 12/12 / 12/12 |
| S-clean-architecture-scrambled | clean-architecture | clean-architecture | 14/14 | 14/14 | 1.00 | 8/10 | 8/10 | 8/10 / 8/10 | 13/16 / 13/16 |
| S-layered-scrambled | layered | layered | 13/13 | 13/13 | 1.00 | 9/9 | 9/9 | 9/9 / 9/9 | 11/11 / 11/11 |
| S-nestjs-scrambled | nestjs | nestjs | 7/14 | 0/14 | 0.07 | 8/10 | 6/10 | 8/10 / 8/10 | 11/13 / 9/13 |
| S-hexagonal-scrambled | hexagonal | hexagonal | 15/15 | 15/15 | 1.00 | 9/11 | 9/11 | 9/11 / 9/11 | 14/16 / 14/16 |
| S-ddd-scrambled | ddd | ddd | inferred spec rejected | inferred spec rejected | - | 12/12 | inferred spec rejected | 12/12 / - | 12/12 / - |

## N1-clean-architecture

Every variant: identical blocking findings and the same planted-rule outcome.

## N1-layered

Every variant: identical blocking findings and the same planted-rule outcome.

## N1-nestjs

Every variant: identical blocking findings and the same planted-rule outcome.

## N1-hexagonal

Every variant: identical blocking findings and the same planted-rule outcome.

## N1-ddd

Every variant: identical blocking findings and the same planted-rule outcome.

## N2-clean-architecture

Every variant: identical blocking findings and the same planted-rule outcome.

## N2-layered

Every variant: identical blocking findings and the same planted-rule outcome.

## N2-nestjs

Every variant: identical blocking findings and the same planted-rule outcome.

## N2-hexagonal

Every variant: identical blocking findings and the same planted-rule outcome.

## N2-ddd

Every variant: identical blocking findings and the same planted-rule outcome.

## S-clean-architecture-scrambled

Every variant: identical blocking findings and the same planted-rule outcome.

## S-layered-scrambled

Every variant: identical blocking findings and the same planted-rule outcome.

## S-nestjs-scrambled

| Variant | Kind | Blocking only under inferred | Blocking only under true | Planted (true / inferred) |
|---|---|---|---|---|
| clean | clean | FF-S01|src/meadow/attendees/attendees.endpoint.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/attendees/attendees.handler.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/create-workshop.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/workshop-response.payload.ts<br>(+2) |  | - / - |
| n01-controller-catches-domain-error | near-miss | FF-S01|src/meadow/attendees/attendees.endpoint.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/attendees/attendees.handler.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/create-workshop.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/workshop-response.payload.ts<br>(+2) |  | - / - |
| n02-domain-port-named-dot-repository | near-miss | FF-S01|src/meadow/attendees/attendees.endpoint.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/attendees/attendees.handler.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/create-workshop.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/workshop-response.payload.ts<br>(+2) |  | - / - |
| n03-service-injects-sibling-service | near-miss | FF-S01|src/meadow/attendees/attendees.endpoint.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/attendees/attendees.handler.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/create-workshop.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/workshop-response.payload.ts<br>(+2) |  | - / - |
| v01-domain-entity-imports-dto | violation | FF-S01|src/meadow/attendees/attendees.endpoint.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/attendees/attendees.handler.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/create-workshop.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/workshop-response.payload.ts<br>(+2) |  | yes / yes |
| v02-repository-builds-response-dto | violation | FF-S01|src/meadow/attendees/attendees.endpoint.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/attendees/attendees.handler.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/create-workshop.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/workshop-response.payload.ts<br>(+2) |  | yes / yes |
| v03-service-imports-guard | violation | FF-S01|src/meadow/attendees/attendees.endpoint.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/attendees/attendees.handler.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/create-workshop.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/workshop-response.payload.ts<br>(+2) | FF-S01|src/meadow/registrations/registrations.handler.ts|src/meadow/willow/guards/api-key.sentry.ts | yes / no |
| v04-response-dto-cycle | violation | FF-S01|src/meadow/attendees/attendees.endpoint.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/attendees/attendees.handler.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/create-workshop.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/workshop-response.payload.ts<br>(+2) |  | yes / yes |
| v05-domain-entity-typeorm-decorator | violation | FF-S01|src/meadow/attendees/attendees.endpoint.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/attendees/attendees.handler.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/create-workshop.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/workshop-response.payload.ts<br>(+2) |  | yes / yes |
| v06-domain-entity-type-imports-express | violation | FF-S01|src/meadow/attendees/attendees.endpoint.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/attendees/attendees.handler.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/create-workshop.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/workshop-response.payload.ts<br>(+2) |  | yes / yes |
| v07-service-injects-concrete-repository | violation | FF-S01|src/meadow/attendees/attendees.endpoint.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/attendees/attendees.handler.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/create-workshop.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/workshop-response.payload.ts<br>(+2) |  | yes / yes |
| v08-repository-without-port | violation | FF-S01|src/meadow/attendees/attendees.endpoint.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/attendees/attendees.handler.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/create-workshop.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/workshop-response.payload.ts<br>(+2) |  | no / no |
| v09-controller-returns-entity | violation | FF-S01|src/meadow/attendees/attendees.endpoint.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/attendees/attendees.handler.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/create-workshop.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/workshop-response.payload.ts<br>(+2) |  | no / no |
| v10-domain-policy-holds-repository | violation | FF-S01|src/meadow/attendees/attendees.endpoint.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/attendees/attendees.handler.ts|src/meadow/attendees/dto/create-attendee.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/create-workshop.payload.ts<br>FF-S01|src/meadow/workshops/workshops.endpoint.ts|src/meadow/workshops/dto/workshop-response.payload.ts<br>(+2) | FF-P06|src/meadow/prairie/registration-policy.ts|src/meadow/registrations/in-memory-registration.store.ts | yes / no |

## S-hexagonal-scrambled

Every variant: identical blocking findings and the same planted-rule outcome.

## S-ddd-scrambled

The firewall refused every evaluation under the inferred spec: `evaluation printed no JSON object`.
