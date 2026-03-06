# Task Details Re-design Plan

## Overview
Update `TaskDetailsPage` to match the designs defined in `TaskDetailsPage.Mock.tsx`.

## Proposed Solution

1. **Page Layout Structure**:
   - Update `TaskDetailsPage.tsx` container view. Add the sticky bottom "Mark as Completed" button.
   - Update the top navigation header: use the mock layout with "Task Details" title, Back arrow, and Edit button. Keep the Trash icon available, perhaps right next to the Edit button or we can move it inside the edit page later.

2. **Task Details Sections**:
   - **Header Card**: Show Avatar/Placeholder, Task Title, Vendor Name (derived from subcontractor), Status, and Project Name (could be placeholder or fetched projectId).
   - **Schedule**: Make a two-column card layout displaying "Start Date" and "Due Date".
   - **Notes**: Wrap task notes in the new bordered card with the `FileText` icon.

3. **Sub-components Redesign**:
   - I will update `TaskDetailsPage.tsx` directly with the new layout structure, and update existing sub-components to use the styling from the mock.
     - `TaskSubcontractorSection`
     - `TaskDependencySection`
     - `TaskDocumentSection`
     - `TaskDelaySection`

4. **Progress Logs**:
   - Progress logs are hardcoded in the mock, I will extract it into a `TaskProgressSection` component with the dummy data until real data is available, appending it to the UI layout.

Please review this plan. I am ready to implement it.
