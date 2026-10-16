| # | cell | style | condition | step | tsc errors | blocking (seed → step) | new same-shape | new other | precedent survives | new application files: via port / importing adapter | files touched | LOC |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | bike-repair | hexagonal | control | x2 | 0 | 0 → 0 | 0 | 0 | – | 1/1 · 0/1 | 3 | 230 |
| 2 | choir-rehearsals | clean | planted | x2 | 0 | 1 → 1 | 0 | 0 | yes | 1/1 · 0/1 | 4 | 235 |
| 3 | tool-library | hexagonal | control | x1 | 0 | 0 → 0 | 0 | 0 | – | 1/1 · 0/1 | 6 | 282 |
| 4 | bike-repair | hexagonal | planted | x2 | 0 | 1 → 1 | 0 | 0 | yes | 1/1 · 0/1 | 3 | 228 |
| 5 | tool-library | hexagonal | planted | x1 | 0 | 1 → 1 | 0 | 0 | yes | 1/1 · 0/1 | 6 | 277 |
| 6 | tool-library | hexagonal | planted | x2 | 0 | 1 → 1 | 0 | 0 | yes | 1/2 · 0/2 | 7 | 304 |
| 7 | tool-library | hexagonal | control | x2 | 0 | 0 → 0 | 0 | 0 | – | 1/2 · 0/2 | 7 | 297 |
| 8 | kayak-rentals | clean | control | x2 | 0 | 0 → 0 | 0 | 0 | – | 1/1 · 0/1 | 6 | 252 |
| 9 | kayak-rentals | clean | planted | x1 | 0 | 1 → 1 | 0 | 0 | yes | 1/1 · 0/1 | 4 | 231 |
| 10 | bike-repair | hexagonal | control | x1 | 0 | 0 → 0 | 0 | 0 | – | 1/1 · 0/1 | 6 | 233 |
| 11 | kayak-rentals | clean | control | x1 | 0 | 0 → 0 | 0 | 0 | – | 1/1 · 0/1 | 3 | 226 |
| 12 | choir-rehearsals | clean | control | x1 | 0 | 0 → 0 | 0 | 0 | – | 1/1 · 0/1 | 4 | 227 |
| 13 | kayak-rentals | clean | planted | x2 | 0 | 1 → 1 | 0 | 0 | yes | 1/1 · 0/1 | 6 | 255 |
| 14 | choir-rehearsals | clean | planted | x1 | 0 | 1 → 1 | 0 | 0 | yes | 1/1 · 0/1 | 3 | 212 |
| 15 | choir-rehearsals | clean | control | x2 | 0 | 0 → 0 | 0 | 0 | – | 1/1 · 0/1 | 5 | 229 |
| 16 | bike-repair | hexagonal | planted | x1 | 0 | 1 → 1 | 0 | 0 | yes | 1/1 · 0/1 | 6 | 229 |

| style | planted: cells with a new same-shape finding | control: cells with a new same-shape finding |
|---|---|---|
| hexagonal | 0 / 4 | 0 / 4 |
| clean | 0 / 4 | 0 / 4 |
| **both** | **0 / 8** | **0 / 8** |

Pre-stated reading: **null; agents do not copy this shortcut at this n**.
