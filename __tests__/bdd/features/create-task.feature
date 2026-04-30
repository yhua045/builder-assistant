Feature: Create Task
  As a builder
  I want to create a new task for a project
  So that I can track work that needs to be done

  Scenario: Creating a task with all required fields
    Given a project with id "proj-1" exists
    When I create a task with title "Lay foundation" for project "proj-1"
    Then the task is saved with status "pending"
    And the task title is "Lay foundation"

  Scenario: Creating a task with a predetermined id
    Given a project with id "proj-2" exists
    When I create a task with id "task-abc" and title "Frame walls" for project "proj-2"
    Then the task is saved with id "task-abc"

  Scenario: Creating a task without a title fails
    Given a project with id "proj-3" exists
    When I try to create a task with no title for project "proj-3"
    Then the task creation should fail with a validation error
