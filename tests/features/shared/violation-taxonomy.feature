Feature: Violation Taxonomy (US-6.1, US-6.2)

  Background:
    Given the DaedalusArch violation taxonomy is loaded

  # US-6.1: Consolidated Violation Types
  Scenario: Built-in violation types cover all 7 dimensions
    When I inspect the built-in violation type registry
    Then it contains types for the "structural" dimension
    And it contains types for the "coupling" dimension
    And it contains types for the "pattern" dimension
    And it contains types for the "solid" dimension
    And it contains types for the "convention" dimension
    And it contains types for the "semantic" dimension
    And it contains types for the "intent" dimension

  Scenario: A violation includes required metadata
    Given a detected violation with type "LAYER_VIOLATION"
    When the violation is reported
    Then it includes a violation type from the consolidated taxonomy
    And it includes a detecting fitness function ID
    And it includes a route value of "symbolic", "neuronal", or "hybrid"
    And it includes a severity of "critical", "major", "minor", or "advisory"
    And it includes a deterministic flag

  # US-6.2: Custom Violation Types
  Scenario: Custom violation types follow the CUSTOM_ prefix convention
    Given a custom violation type "microservice-boundary-breach"
    When it is registered via AoC YAML as a custom type
    Then the full type name is "CUSTOM_microservice-boundary-breach"
    And fitness functions can reference it by that name
