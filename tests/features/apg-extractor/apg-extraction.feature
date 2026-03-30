Feature: APG Extraction (US-1.1, US-1.2, US-1.3, US-1.5)

  Background:
    Given the APG Extractor is configured with lenient mode enabled

  # US-1.1: Parse TypeScript Project
  Scenario: Parse TypeScript project without crashing on missing dependencies
    Given a TypeScript project at the "correct-reference" fixture path
    When the APG extractor runs with lenient mode enabled
    Then the project is parsed without throwing an exception
    And unresolvable imports are recorded as warnings, not errors

  # US-1.2: Extract Node Types
  Scenario: Extracted nodes contain exactly the 5 permitted types
    Given a TypeScript project at the "correct-reference" fixture path
    When the APG extractor runs
    Then all nodes have a type of exactly one of: File, Class, Interface, Method, Function
    And no node has a type outside those 5 types

  # US-1.2: Node completeness
  Scenario: File node created for each source file
    Given a TypeScript project with 2 source files
    When the APG extractor runs
    Then it produces at least 2 File nodes

  # US-1.3: Extract Edge Types
  Scenario: Extracted edges contain exactly the 7 permitted types
    Given a TypeScript project at the "correct-reference" fixture path
    When the APG extractor runs
    Then all edges have a type of exactly one of: IMPORTS, IMPLEMENTS, EXTENDS, CONSTRUCTOR_INJECTS, CALLS, DECLARES, CONTAINS
    And no edge has a type outside those 7 types

  # US-1.5: Output APG as JSON
  Scenario: APG result has nodes and edges arrays
    Given a TypeScript project at the "correct-reference" fixture path
    When the APG extractor runs
    Then the result contains a "nodes" array
    And the result contains an "edges" array
    And the JSON conforms to the APG schema (5 node types, 7 edge types)
