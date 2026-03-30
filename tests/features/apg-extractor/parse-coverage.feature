Feature: Parse Coverage Reporting (US-1.6)

  Background:
    Given the APG Extractor is configured with lenient mode enabled

  # US-1.6: Coverage percentage
  Scenario: Parse coverage reports the percentage of successfully parsed files
    Given a TypeScript project with 10 source files, 2 of which cause parse errors
    When the APG extractor runs in lenient mode
    Then it reports parse coverage as 80% (8 out of 10)
    And the parseCoverage.total equals 10
    And the parseCoverage.parsed equals 8

  # US-1.6: Skipped file listing
  Scenario: Skipped files are listed with reasons
    Given a TypeScript project with a file that throws during parsing
    When the APG extractor runs in lenient mode
    Then the parseCoverage.skipped array contains the failing file's path
    And each skipped entry includes a non-empty reason string

  # US-1.6: Files with unresolvable imports are NOT counted as skipped
  Scenario: Files with missing imports count as parsed, not skipped
    Given a TypeScript file that imports from a module that cannot be resolved
    When the APG extractor runs in lenient mode
    Then the file is counted in parseCoverage.parsed
    And a warning is emitted for the unresolvable import

  # US-1.6: Clean project has 100% coverage
  Scenario: Clean project reports 100% parse coverage
    Given a TypeScript project at the "correct-reference" fixture path
    When the APG extractor runs
    Then the parseCoverage.percentage equals 100
    And parseCoverage.skipped is empty
