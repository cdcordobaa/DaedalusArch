# PUZZLE-01 case bank (DEV split)

One YAML card per puzzle and per observed agent error (format: `ops/notes/puzzle-01-design.md` §8). Every card here
is **dev**: the puzzles and the HEXDDD-01 trees are public. A held-out card needs a freshly authored, sealed case.

Observation cards come from the HEXDDD-01 blind hand-read log at commit c18053641 (one row, s1 step 5 H4, is the
planted debt being fixed and is not a violation, so it has no card). Their instrument verdicts were read from the
pilot's step scores **after** the log existed.

| Card | Kind | Family | Where | Judge confidence | Instrument |
|---|---|---|---|---|---|
| `puzzle-p1-transfers` | puzzle | D4, D5 | `puzzles/p1-transfers` | high (oracle) | invisible |
| `puzzle-p2-loyalty` | puzzle | D6, D10, D4 | `puzzles/p2-loyalty` | high (oracle) | partial |
| `puzzle-p3-shipping-quotes` | puzzle | H5, H2 | `puzzles/p3-shipping-quotes` | high (oracle) | invisible |
| `puzzle-p4-library-holds` | puzzle | H7 | `puzzles/p4-library-holds` | high (oracle) | visible |
| `hexddd-01-s1-step2-d5` | observation | D5 | s1/2 | low | invisible |
| `hexddd-01-s1-step3-d4` | observation | D4 | s1/3 | medium | invisible |
| `hexddd-01-s1-step4-d3` | observation | D3 | s1/4 | low | invisible |
| `hexddd-01-s1-step5-h5` | observation | H5 | s1/5 | low | invisible |
| `hexddd-01-s2-step1-d4` | observation | D4 | s2/1 | medium | invisible |
| `hexddd-01-s2-step2-d5` | observation | D5 | s2/2 | medium | invisible |
| `hexddd-01-s2-step4-d5` | observation | D5 | s2/4 | low | invisible |
| `hexddd-01-s2-step5-d4` | observation | D4 | s2/5 | medium | invisible |
| `hexddd-01-s2-step5-d9` | observation | D9 | s2/5 | low | invisible |
