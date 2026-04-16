# Daedalus Arch — Visual Identity & Color System

Reference for all slides, diagrams, poster assets, and generated images.

---

## Backgrounds

| Token        | Hex       | RGB             | Usage                                    |
|--------------|-----------|-----------------|------------------------------------------|
| `--bg`       | `#0d1117` | `13, 17, 23`    | Primary dark background (slides, panels) |
| `--surface`  | `#161b22` | `22, 27, 34`    | Cards, code blocks, elevated surfaces    |
| `--border`   | `#30363d` | `48, 54, 61`    | Borders, dividers, grid lines            |

## Primary Palette

| Token       | Hex       | RGB              | Usage                                        |
|-------------|-----------|------------------|----------------------------------------------|
| `--violet`  | `#7C6AEF` | `124, 106, 239`  | **Primary accent.** Headlines, labels, links, emphasis text, progress bars, section dividers. The brand color. |
| `--blue`    | `#4361EE` | `67, 97, 238`    | **Secondary accent.** Graph edges (valid deps), application-layer nodes, secondary highlights. |
| `--lavender`| `#A78BFA` | `167, 139, 250`  | **Tertiary / light accent.** Infrastructure-layer nodes, subtle badges, hover states, neuronal-route indicators. |

## Green Scale (from poster assets)

A four-step ramp extracted from the poster's teal-to-mint gradient. Use these for positive states, progress indicators, success surfaces, and pipeline phase cards.

| Token          | Hex       | RGB              | Usage                                        |
|----------------|-----------|------------------|----------------------------------------------|
| `--green-900`  | `#147D62` | `20, 125, 98`    | **Deep teal.** Dark backgrounds for success panels, dark-mode section fills, pipeline phase 1 cards. |
| `--green-700`  | `#1B9E77` | `27, 158, 119`   | **Emerald (primary green).** PASS verdict, checkmarks, healthy bars, shield icons, graph pass-edges. The default success color. |
| `--green-500`  | `#2AB573` | `42, 181, 115`   | **Forest green.** Secondary success surfaces, pipeline phase 3, "architecture preserved" blocks, progress bar fills. |
| `--green-300`  | `#34D399` | `52, 211, 153`   | **Mint.** Gradient endpoints, highlights on hover, bright callouts, terminal pass-text on dark backgrounds. |

**Gradient usage:** for poster-style gradient fills, sweep from `--green-900` to `--green-300` (left-to-right or top-to-bottom). For a teal-to-emerald feel, use `--green-900` to `--green-500`.

```css
/* Poster-style gradient */
background: linear-gradient(135deg, #147D62, #34D399);

/* Subtler teal sweep */
background: linear-gradient(135deg, #147D62, #2AB573);
```

## Semantic Colors

| Token       | Hex       | RGB              | Usage                                        |
|-------------|-----------|------------------|----------------------------------------------|
| `--teal`    | `#1B9E77` | `27, 158, 119`   | **Pass / success.** Alias for `--green-700`. PASS verdict, green checks, healthy bars. |
| `--yellow`  | `#d29922` | `210, 153, 34`   | **Warning.** WARNING verdict, caution states. |
| `--orange`  | `#db6d28` | `219, 109, 40`   | **Soft-block.** SOFT-BLOCK verdict, degraded scores. |
| `--red`     | `#f85149` | `248, 81, 73`    | **Hard-block / error.** HARD-BLOCK verdict, violation markers, actual errors **only**. Never for emphasis text. |

## Text

| Token       | Hex       | Usage                                        |
|-------------|-----------|----------------------------------------------|
| `--text`    | `#e6edf3` | Primary body text                            |
| `--white`   | `#ffffff` | Headlines, bold emphasis                     |
| `--dim`     | `#8b949e` | Secondary text, captions, metadata           |

## Terminal / Code Block Tokens

For code snippets, terminal output, and monospace content inside the dark terminal windows.

| Role          | Hex       | Maps to          |
|---------------|-----------|------------------|
| Keyword       | `#e06c75` | Red (syntax)     |
| String / Pass | `#34B896` | Teal             |
| Identifier    | `#8B7CF7` | Soft violet      |
| Function      | `#4361EE` | Royal blue       |
| Number        | `#d19a66` | Warm orange      |
| Punctuation   | `#A78BFA` | Lavender         |
| Comment       | `#5c6370` | Dark gray        |
| White/Bold    | `#eff0f1` | Near-white       |
| Dim           | `#5c6370` | Muted gray       |
| Error         | `#e06c75` | Muted red        |

## Graph / Diagram Layers

When rendering architecture diagrams (SVG, Neo4j, or generated images):

| Layer           | Stroke/Fill   | Label Color | Background (10% opacity)   |
|-----------------|---------------|-------------|----------------------------|
| Domain          | `#7C6AEF`     | `#7C6AEF`   | `rgba(124,106,239, 0.06)` |
| Application     | `#4361EE`     | `#4361EE`   | `rgba(67,97,238, 0.06)`   |
| Infrastructure  | `#A78BFA`     | `#A78BFA`   | `rgba(167,139,250, 0.06)` |
| Valid edge      | `#4361EE`     | --          | Dashed stroke              |
| Violation edge  | `#f85149`     | --          | Solid stroke               |
| Implements edge | `#7C6AEF`     | --          | Dotted stroke              |

## Verdict Badges

| Verdict    | Background                    | Text Color | Border     |
|------------|-------------------------------|------------|------------|
| PASS       | `rgba(27,158,119, 0.12)`     | `#1B9E77`  | `#1B9E77`  |
| WARNING    | `rgba(210,153,34, 0.12)`     | `#d29922`  | `#d29922`  |
| SOFT-BLOCK | `rgba(219,109,40, 0.12)`     | `#db6d28`  | `#db6d28`  |
| HARD-BLOCK | `rgba(248,81,73, 0.12)`      | `#f85149`  | `#f85149`  |

## Usage Rules

1. **Red is for data, not decoration.** Only use `--red` for actual violations, errors, HARD-BLOCK verdicts, and negative metrics. Never for emphasis headlines or decorative dashes.
2. **Violet is the brand voice.** Use `--violet` wherever you would instinctively reach for "accent color" — section labels, emphasis words, links, highlighted keywords.
3. **Blue/lavender for depth.** Use `--blue` and `--lavender` to create hierarchy within the purple family (primary > secondary > tertiary).
4. **Teal replaces green.** All positive/pass states use `--teal` (`#1B9E77`), not bright green.
5. **Dark-first.** All diagrams assume a dark background (`#0d1117`). Light-background variants (poster) should invert text to dark and keep the same accent palette.
6. **Monospace for data.** Terminal windows, code blocks, Cypher queries, and metric values always use `'SF Mono', 'Fira Code', 'Consolas', monospace`.

## CSS Variables (copy-paste)

```css
:root {
  --bg:       #0d1117;
  --surface:  #161b22;
  --border:   #30363d;
  --text:     #e6edf3;
  --dim:      #8b949e;

  --violet:   #7C6AEF;   /* primary accent   */
  --blue:     #4361EE;   /* secondary accent  */
  --lavender: #A78BFA;   /* tertiary accent   */

  --teal:     #1B9E77;   /* pass / success    */
  --yellow:   #d29922;   /* warning           */
  --orange:   #db6d28;   /* soft-block        */
  --red:      #f85149;   /* hard-block / error — data only, not decoration */
}
```
