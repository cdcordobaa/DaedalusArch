#!/usr/bin/env tsx
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("GEMINI_API_KEY not set");
  process.exit(1);
}

const MODEL = "gemini-3-pro-image-preview";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

type Slide = {
  slug: string;
  label: string;
  prompt: string;
  aspectRatio: "16:9" | "4:3" | "3:4" | "1:1" | "9:16";
};

const SLIDES: Slide[] = [
  {
    slug: "slide-02-before-after-split",
    label: "Before / After Split",
    aspectRatio: "1:1",
    prompt: `Left half: a clean-looking directory tree (src/domain, src/application, src/infrastructure) with green checkmarks — everything "looks fine."
Right half: the SAME code as a dependency graph with red violation arrows crossing layer boundaries — domain→prisma, circular cycles, concrete instantiation.
Split by a vertical divider labeled "What tools see vs. what's actually happening."
Dark bg (#0d1117), violet/blue/teal palette. No text artifacts, crisp typography.`,
  },
  {
    slug: "slide-04-code-as-text-vs-system",
    label: "Code as Text vs. Code as System",
    aspectRatio: "16:9",
    prompt: `Full-width diagram. Left side: a flat horizontal sequence of code tokens with a cursor moving left-to-right — monochrome, flat, linear. Label: "How the model sees it."
Right side: the same code as an interconnected system with nodes (classes) and directed edges (imports, calls, implements). Layered top-to-bottom: domain (violet), application (blue), infrastructure (lavender). Label: "What architecture actually is."
A vertical divider in the middle. The left side is intentionally boring/flat. The right side is rich with structure.
Dark bg (#0d1117), violet/blue/lavender palette. Crisp typography.`,
  },
  {
    slug: "slide-06-embedding-vs-graph-space",
    label: "Embedding Space vs. Graph Space",
    aspectRatio: "16:9",
    prompt: `Full-width split diagram. LEFT: 2D scatter plot showing embedding clusters. UserService, OrderService, PaymentService cluster together (semantically similar). IUserRepository is far away in a different cluster. Label: "Embedding search finds the wrong neighbors."
RIGHT: Dependency graph. UserService has a thick directed edge to IUserRepository (structurally coupled). OrderService is disconnected from UserService. Label: "Graph search finds the real dependencies."
Highlight: UserService→IUserRepository edge in green/teal. UserService→OrderService proximity in the embedding space crossed out in red.
Bottom caption: "Embeddings encode what code means. Graphs encode how code connects. Architecture lives in the connections."
Dark bg (#0d1117), violet/blue/teal palette. Yasunaga et al. (2024) style academic figure.`,
  },
  {
    slug: "slide-08-independent-vs-coordinated",
    label: "Independent Tasks vs. Coordinated System",
    aspectRatio: "4:3",
    prompt: `TOP half: 5 isolated file cards (UserService.ts, OrderService.ts, AuthMiddleware.ts, UserRepo.ts, Logger.ts) each in its own bubble, no connections between them. Each labeled "Task N of N." Gray/dim tone. Label: "How the agent generates."
BOTTOM half: The same 5 components connected by directed edges forming a coherent architecture with layers. Shared concerns (auth, logging) shown as cross-cutting horizontal bands. Colorful, structured. Label: "What the system needs."
Arrow between top and bottom labeled "The gap."
Dark bg (#0d1117), violet/blue/lavender palette. Crisp typography.`,
  },
  {
    slug: "slide-12d-verification-timeline",
    label: "The Verification Timeline",
    aspectRatio: "16:9",
    prompt: `A horizontal timeline flowing left to right, like a road with milestones. The road gets wider and more uncertain as it moves right — from well-paved (mature) to unpaved (frontier).

Milestone 1 (1970s-2000s) — FUNCTIONAL CORRECTNESS — solid green road. "Does it produce the right output?" Signpost icons: JUnit, pytest, TDD, HumanEval. Status badge: SOLVED.

Milestone 2 (2020s) — SECURITY CORRECTNESS — yellow road, under construction. "Is it safe from exploits?" Signpost icons: BaxBench, Snyk, SAST. Status badge: IN PROGRESS.

Milestone 3 (2025+) — ARCHITECTURAL CORRECTNESS — red/violet unpaved road with a single vehicle (DaedalusArch). "Does it respect boundaries, patterns, abstractions?" Signpost: SonarQube AoC (deprecated), ArchUnit (Java only). Status badge: YOU ARE HERE (pin marker).

Milestone 4 (future) — SYSTEM COMMUNICATION — dashed road disappearing into fog. "Do services communicate correctly?" Signpost: Pact (partial). Status badge: NEXT FRONTIER.

Above the timeline, banner: "The more we automate generation, the more properties we need to verify."

Below the timeline, a parallel bar showing GENERATION SPEED increasing exponentially left to right — the gap between what we generate and what we can verify grows unless new verification layers are added. The gap is biggest at Milestone 3.

Dark bg (#0d1117), violet/blue/teal/green palette. Crisp typography.`,
  },
  {
    slug: "slide-12b-verification-hourglass",
    label: "The Verification Hourglass",
    aspectRatio: "3:4",
    prompt: `Dark cinematic vertical hourglass/funnel infographic. Top-to-bottom flow:

TOP SECTION — "Upstream: Prevent" (violet/purple glow):
A glowing shield icon at the top. Below it, three items stacked:
- "spec.yaml" (document icon)
- "ADRs" (document icon)
- "Architectural Rules" (graph icon)
Label: "Upstream — Specs, Constraints, Constitution"
Arrows flowing DOWN into the center. Color: violet (#7C6AEF) glow.

CENTER — "AI CODE GENERATION" (bright, energetic):
A glowing cube or orb labeled "AI CODE GENERATION" — this is the focal point. Bright, radiant, emitting energy in both directions. Use lavender/white glow.

BOTTOM SECTION — "Downstream: Verify" (blue glow):
Arrows flowing DOWN from center into three verification layers:
- "Unit Tests" (test tube icon)
- "Code Review" (people icon)
- "Security Scanner" (shield icon)
Label: "Downstream — Tests, Review, Scanning"
Color: blue (#4361EE) glow.

CRITICAL — THE GAP:
Between the center cube and the bottom section, there is a VISIBLE GAP with a dashed border and a label: "ARCHITECTURAL VERIFICATION — Missing" in red/orange. This gap is where DaedalusArch fits. Optionally show a faint DaedalusArch shield icon with "?" inside the gap.

Style: Dark background (#0d1117), cinematic lighting, depth effects, subtle glow halos around each section. Violet for upstream, lavender/white for center, blue for downstream. The gap should feel like a void — something clearly missing. No Globant branding. No external logos.`,
  },
  {
    slug: "slide-20-neuro-symbolic-pipeline",
    label: "Neuro-Symbolic Pipeline",
    aspectRatio: "16:9",
    prompt: `Flow diagram, left to right. Start: "Generated Code" box → "APG Construction" (ts-morph + Neo4j) → the graph FORKS into two paths:
TOP PATH (80%+): "Symbolic" — Cypher queries on Neo4j. Badge: "Deterministic, <1s, reproducible." Show 24 function icons. Color: violet/blue.
BOTTOM PATH (20%): "Neural" — LLM-as-judge with structured rubrics. Badge: "Calibrated, confidence-weighted." Show 2 function icons. Color: lavender.
Both paths MERGE into "Scoring Engine" → AVR per dimension → AHS aggregate → Verdict shield (pass/warning/soft-block/hard-block).
Key design principle callout: "The LLM never has veto power over deterministic checks."
Dark bg (#0d1117), violet/blue/lavender/teal palette. Crisp typography.`,
  },
  {
    slug: "slide-21-apg-self-duality",
    label: "APG Self-Duality",
    aspectRatio: "4:3",
    prompt: `Center: a single graph/cylinder icon labeled "APG (Layers 1-3)".
Arrow going RIGHT labeled "Forward — Enforcement": Spec annotates Layer 4 → fitness functions compute Layer 5 → violations. Color: violet.
Arrow going LEFT labeled "Reverse — Discovery (firewall init)": Mine Layers 1-3 for patterns → LLM classifies style → generates AoC YAML. Color: blue.
Both arrows start from the same central graph.
Key insight label below: "The graph is identical. Only the direction of Layer 4 changes."
Dark bg (#0d1117), violet/blue palette. Crisp typography.`,
  },
];

const OUT_DIR = resolve("demo/tech-talk-deck/images");

async function generate(slide: Slide): Promise<void> {
  const outPath = resolve(OUT_DIR, `${slide.slug}.png`);
  if (existsSync(outPath) && !process.env.FORCE) {
    console.log(`  skip (exists): ${slide.slug}.png`);
    return;
  }
  console.log(`  → ${slide.slug} [${slide.aspectRatio}]`);

  const body = {
    contents: [{ parts: [{ text: slide.prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: slide.aspectRatio },
    },
  };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${slide.slug}: HTTP ${res.status} ${err.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
    }>;
  };

  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new Error(`${slide.slug}: no image in response — ${JSON.stringify(json).slice(0, 500)}`);
  }

  writeFileSync(outPath, Buffer.from(imagePart.inlineData.data, "base64"));
  console.log(`    wrote ${outPath}`);
}

async function main() {
  const only = process.argv[2];
  const targets = only ? SLIDES.filter((s) => s.slug.includes(only)) : SLIDES;
  if (targets.length === 0) {
    console.error(`no slides match "${only}"`);
    process.exit(1);
  }
  console.log(`Generating ${targets.length} image(s) with ${MODEL}`);
  for (const slide of targets) {
    try {
      await generate(slide);
    } catch (e) {
      console.error(`FAIL ${slide.slug}:`, (e as Error).message);
    }
  }
  console.log("done.");
}

main();
