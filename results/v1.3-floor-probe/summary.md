| task | style | step | pressure | none: blocking (rules) | new after step 1 | none: advisory | tool pre-fix blocking | tool post-fix blocking | tool post: advisory | none files/LOC | tool files/LOC |
|---|---|---|---|---|---|---|---|---|---|---|---|
| shelter-adoptions | hexagonal | 1 adoptions | first adapter | 0 (–) | 0 | 9 | 0 | 0 | 9 | 10/268 | 10/268 |
| shelter-adoptions | hexagonal | 2 fostering | cross-module | 0 (–) | 0 | 12 | 0 | 0 | 12 | 12/414 | 12/414 |
| shelter-adoptions | hexagonal | 3 sms | second adapter | 0 (–) | 0 | 17 | 0 | 0 | 17 | 15/578 | 15/578 |
| shelter-adoptions | hexagonal | 4 audit-trail | across every layer | 0 (–) | 0 | 26 | 0 | 0 | 26 | 18/782 | 18/782 |
| garden-plots | hexagonal | 1 plots | first adapter | 0 (–) | 0 | 8 | 0 | 0 | 8 | 8/288 | 8/288 |
| garden-plots | hexagonal | 2 water | second inbound adapter + notification | 0 (–) | 0 | 11 | 0 | 0 | 11 | 11/416 | 11/416 |
| garden-plots | hexagonal | 3 work-days | cross-feature reuse | 0 (–) | 0 | 14 | 0 | 0 | 14 | 14/554 | 14/554 |
| garden-plots | hexagonal | 4 dashboard | reporting endpoint that tempts a shortcut to the store | 0 (–) | 0 | 16 | 0 | 0 | 16 | 15/634 | 15/634 |
| garden-plots | hexagonal | 5 hotfix-failed-payments | quick fix under time pressure | 0 (–) | 0 | 16 | 0 | 0 | 16 | 15/641 | 15/641 |
| food-bank | hexagonal | 1 pickups | core + first use cases | 0 (–) | 0 | 8 | 0 | 0 | 8 | 9/232 | 9/232 |
| food-bank | hexagonal | 2 donations-feed | new adapter (polling) | 0 (–) | 0 | 13 | 0 | 0 | 13 | 14/400 | 14/400 |
| food-bank | hexagonal | 3 reminders | new use case + second adapter | 0 (–) | 0 | 16 | 0 | 0 | 16 | 17/531 | 17/531 |
| food-bank | hexagonal | 4 network-report | reporting endpoint that tempts a shortcut to the store | 0 (–) | 0 | 20 | 0 | 0 | 20 | 19/630 | 19/630 |
| food-bank | hexagonal | 5 hotfix-allergens | quick fix under time pressure | 0 (–) | 0 | 20 | 0 | 0 | 20 | 19/643 | 19/643 |
| market-vendors | layered | 1 stalls | first adapter | 4 (FF-S01×2, FF-S03×2) | 0 | 8 | 4 | 0 | 9 | 7/234 | 8/236 |
| market-vendors | layered | 2 fees-and-settlement | cross-module | 4 (FF-S01×2, FF-S03×2) | 0 | 9 | 0 | 0 | 10 | 8/374 | 9/376 |
| market-vendors | layered | 3 second-provider | second adapter | 4 (FF-S01×2, FF-S03×2) | 0 | 10 | 0 | 0 | 11 | 9/486 | 10/488 |
| market-vendors | layered | 4 audit-and-statements | across every layer | 6 (FF-S01×3, FF-S03×3) | 2 | 14 | 0 | 0 | 15 | 12/682 | 13/684 |
| youth-league | layered | 1 teams-fixtures | core + first use cases | 3 (FF-S01×1, FF-S03×2) | 0 | 8 | 3 | 0 | 10 | 7/203 | 9/214 |
| youth-league | layered | 2 weather | first external adapter | 5 (FF-S01×1, FF-S03×4) | 2 | 11 | 0 | 0 | 14 | 10/324 | 12/337 |
| youth-league | layered | 3 referees | cross-feature reuse | 5 (FF-S01×1, FF-S03×4) | 0 | 13 | 0 | 0 | 16 | 11/409 | 13/423 |
| youth-league | layered | 4 tables | reporting endpoint that tempts a shortcut to the store | 5 (FF-S01×1, FF-S03×4) | 0 | 14 | 0 | 0 | 17 | 12/490 | 14/505 |
| youth-league | layered | 5 hotfix-correct-result | quick fix under time pressure | 5 (FF-S01×1, FF-S03×4) | 0 | 14 | 0 | 0 | 17 | 12/506 | 14/521 |
| hive-health | layered | 1 inspections | core + first use cases | 6 (FF-S01×2, FF-S03×4) | 0 | 7 | 6 | 0 | 9 | 6/210 | 8/219 |
| hive-health | layered | 2 smart-scales | first external adapters (inbound webhook + outbound SMS) | 10 (FF-S01×3, FF-S03×7) | 4 | 10 | 0 | 0 | 13 | 9/324 | 11/333 |
| hive-health | layered | 3 treatments-harvests | cross-feature reuse | 13 (FF-S01×4, FF-S03×9) | 3 | 12 | 0 | 0 | 15 | 11/475 | 13/484 |
| hive-health | layered | 4 health-report | reporting endpoint that tempts a shortcut to the store | 13 (FF-S01×4, FF-S03×9) | 0 | 15 | 0 | 0 | 18 | 12/541 | 14/550 |
| hive-health | layered | 5 hotfix-false-swarms | quick fix under time pressure | 13 (FF-S01×4, FF-S03×9) | 0 | 15 | 0 | 0 | 18 | 12/570 | 14/579 |
