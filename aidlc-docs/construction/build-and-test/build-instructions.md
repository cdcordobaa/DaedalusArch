# Build Instructions — DaedalusArch (Architectural Firewall)

## Prerequisites

- **Runtime**: Node.js >= 22.x (LTS)
- **Package Manager**: npm >= 10.x
- **Database**: Neo4j Community Edition 5.26+ with APOC plugin
- **Container Runtime**: Docker + Docker Compose (for Neo4j)
- **TypeScript**: 5.x (installed via devDependencies)
- **Disk Space**: ~500MB (node_modules + Neo4j data)
- **Memory**: 4GB minimum (Neo4j requires ~2GB heap)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEO4J_URI` | No | `bolt://localhost:7687` | Neo4j Bolt protocol URI |
| `NEO4J_USER` | No | `neo4j` | Neo4j username |
| `NEO4J_PASSWORD` | Yes (for integration) | — | Neo4j password |
| `ANTHROPIC_API_KEY` | For neuronal/full mode | — | Anthropic Claude API key |
| `OPENAI_API_KEY` | Alternative to above | — | OpenAI API key |
| `LLM_PROVIDER` | No | `claude` | `claude` or `openai` |
| `APG_STORE_PATH` | No | `.apg-store` | Snapshot storage directory |
| `PIPELINE_MODE` | No | `stateless` | `stateless` or `persistent` |
| `EVALUATION_MODE` | No | `full` | `full`, `symbolic-only`, or `neuronal-only` |

## Build Steps

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd DaedalusArch
npm ci
```

**Expected**: 13 production + 11 dev dependencies installed, 0 vulnerabilities.

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Neo4j password and (optional) LLM API keys
```

### 3. Start Neo4j

```bash
docker-compose up -d
```

**Expected**: Neo4j 5.26-community with APOC plugin running on ports 7474 (HTTP) and 7687 (Bolt).

Wait for health check:
```bash
# Verify Neo4j is ready
curl -s http://localhost:7474 > /dev/null && echo "Neo4j ready" || echo "Still starting..."
```

### 4. Type Check

```bash
npm run typecheck
```

**Expected**: `npx tsc --noEmit` completes with 0 errors across 84 source files.

### 5. Lint

```bash
npm run lint
```

### 6. Build (Compile TypeScript)

```bash
npm run build
```

**Expected**: TypeScript compiles to `dist/` directory. All `.ts` files produce corresponding `.js` + `.d.ts` outputs.

### 7. Verify CLI

```bash
# Using tsx (development)
npx tsx src/cli/cli.ts --help

# Using compiled output (production)
node dist/cli/index.js --help
```

**Expected**: Displays `firewall` CLI with `evaluate`, `batch`, `drift` commands.

## Build Artifacts

| Artifact | Location | Description |
|----------|----------|-------------|
| Compiled JS | `dist/` | Production-ready JavaScript |
| Type declarations | `dist/**/*.d.ts` | TypeScript declaration files |
| CLI binary | `dist/cli/index.js` | CLI entry point |
| Docker Compose | `docker-compose.yml` | Neo4j service definition |
| GitHub Action | `.github/actions/firewall/` | Composite action for CI |
| Sample specs | `specs/` | AoC YAML templates |
| Fixture projects | `fixtures/` | Golden test data |

## Troubleshooting

### Neo4j fails to start
- **Cause**: Port conflict or Docker not running
- **Fix**: `docker-compose down && docker-compose up -d`, or check `docker ps`

### TypeScript compilation errors
- **Cause**: Missing dependencies or Node version mismatch
- **Fix**: `rm -rf node_modules && npm ci`, verify `node --version` >= 22

### APOC plugin not loaded
- **Cause**: Neo4j plugin directory not mounted correctly
- **Fix**: Check `docker-compose.yml` NEO4J_PLUGINS env var is `["apoc"]`
