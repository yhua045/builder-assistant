Feature: Manual project creation flow

  Scenario: Successful save moves to task suggestion step with selected project type and state
    Given I open the manual project entry form
    And I enter project name "Kitchen Renovation"
    And I enter address "123 Test Street"
    And I choose project type "Renovation"
    And I choose state "VIC"
    And create project succeeds with project id "proj-100"
    When I press "Save Project"
    Then create project should be called with projectType "renovation" and state "VIC"
    And the critical path suggestion should be requested with project_type "renovation" and state "VIC"
    And the task suggestion step should be visible for project "proj-100"
