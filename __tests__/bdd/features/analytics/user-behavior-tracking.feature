Feature: User behavior tracking
  As a product team
  I want user interactions to be recorded via the analytics adapter
  So that I can analyse feature usage, user funnels, and drop-off points

  Background:
    Given the user has not opted out of analytics

  Scenario: Screen view is tracked when user navigates to a screen
    Given the analytics adapter is initialised
    When the user navigates to the "Invoices" screen
    Then a screen view event "Invoices" is recorded

  Scenario: Feature event is tracked when user creates a task
    Given the analytics adapter is initialised
    When the user successfully creates a task
    Then a "task_created" event is tracked

  Scenario: Invoice creation funnel tracks start and completion
    Given the analytics adapter is initialised
    When the user opens the invoice creation form
    Then an "invoice_creation_started" event is tracked
    When the user submits the invoice form
    Then an "invoice_creation_completed" event is tracked

  Scenario: Invoice creation funnel tracks abandonment
    Given the analytics adapter is initialised
    When the user opens the invoice creation form
    And the user navigates away without submitting
    Then an "invoice_creation_abandoned" event is tracked

  Scenario: No events are sent when the user has opted out
    Given the user has opted out of analytics
    And the analytics adapter is initialised
    When the user navigates to the "Dashboard" screen
    And the user creates a task
    Then no analytics events are recorded

  Scenario: Errors are reported to the error reporting adapter
    Given an error reporting adapter is initialised
    When an unhandled error occurs in the app
    Then the error reporting adapter captures the exception
