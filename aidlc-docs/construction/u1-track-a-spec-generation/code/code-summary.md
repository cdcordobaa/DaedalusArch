# U1 Code Summary — Track A Spec Generation & Baseline

## New Files (12 source + 5 test)

| File | Component | Purpose |
|------|-----------|---------|
| `presets/clean-architecture.yaml` | Preset | 26 fitness functions, 3 layers, empirical thresholds |
| `presets/nestjs.yaml` | Preset | 26 fitness functions, 4 layers incl. presentation |
| `src/spec-parser/preset-loader.ts` | C3 | loadPreset, mergeSpecs, listPresets |
| `src/baseline/baseline-manager.ts` | C12 | Full baseline lifecycle: create, load, save, compare |
| `src/baseline/index.ts` | C12 | Barrel exports |
| `src/pipeline/commands/validate-spec-command.ts` | S1 | ValidateSpecCommand pipeline command |
| `src/pipeline/commands/create-baseline-command.ts` | S1 | CreateBaselineCommand pipeline command |
| `src/pipeline/commands/compare-baseline-command.ts` | S1 | CompareBaselineCommand + SharedBaselineState |
| `.claude/commands/firewall-init.md` | Skill | 10-step init workflow + APG mining queries |

## Modified Files (4)

| File | Change |
|------|--------|
| `src/spec-parser/index.ts` | Added exports: validateSpecAgainstProject, loadPreset, mergeSpecs, listPresets, SpecOverrides |
| `src/pipeline/commands/index.ts` | Added exports: ValidateSpecCommand, CreateBaselineCommand, CompareBaselineCommand |
| `src/cli/cli.ts` | Added: validate command, baseline command, --baseline flag on evaluate |

## Test Results

- **38 suites, 376 tests, 0 failures**
- New tests: 35 (9 preset + 16 baseline + 2 validate-cmd + 3 baseline-cmd + 5 CLI)
- v1.0 backward compatibility: all 341 original tests pass
- TypeScript: 0 type errors
