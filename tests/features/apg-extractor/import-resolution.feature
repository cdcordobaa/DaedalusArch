Feature: Complex Import Resolution (US-1.4)

  Background:
    Given the APG Extractor is configured with lenient mode enabled

  # US-1.4: Barrel import resolution
  Scenario: Barrel imports are resolved transitively to the original source file
    Given a project using barrel imports where "index.ts" re-exports from sub-modules
    When the APG extractor runs
    Then IMPORTS edges point to the actual declaring file, not the barrel
    And the barrel file still receives a File node with isBarrel=true

  # US-1.4: External imports skipped
  Scenario: External node_modules imports do not produce IMPORTS edges
    Given a TypeScript file that imports from "lodash"
    When the APG extractor runs
    Then no IMPORTS edge is created for the "lodash" import
    And a warning with code EXTRACTOR_001 is recorded

  # US-1.4: Decorator metadata extracted
  Scenario: Class decorators are captured in the node's decorators array
    Given a TypeScript class annotated with "@Injectable()"
    When the APG extractor runs
    Then the Class node's decorators array contains "Injectable"

  # US-1.4: Constructor injection types resolved
  Scenario: Constructor parameters typed with interfaces produce CONSTRUCTOR_INJECTS edges
    Given a class with a constructor parameter typed as an interface "ITaskRepository"
    And the interface "ITaskRepository" is defined in the same project
    When the APG extractor runs
    Then a CONSTRUCTOR_INJECTS edge exists from the class to "ITaskRepository"
    And the edge properties include parameterName

  # US-1.4: Primitive constructor params excluded
  Scenario: Constructor parameters typed with primitives do NOT produce CONSTRUCTOR_INJECTS edges
    Given a class with constructor parameters typed as "string" and "number"
    When the APG extractor runs
    Then no CONSTRUCTOR_INJECTS edges are created for those parameters
