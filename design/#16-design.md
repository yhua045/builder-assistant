# UI Design - Payments, Tasks, Profile (Issue #16)

## Overview
This design document implements the UI for the Payments, Tasks, and Profile screens as requested in Issue #16. The implementation uses React Native with NativeWind for styling and Lucide icons.

## File Structure

```
src/
  pages/
    payments/
      index.tsx       # Payments Screen
    tasks/
      index.tsx       # Tasks/Schedule Screen
    profile/
      index.tsx       # User Profile Screen
  components/
    ThemeToggle.tsx   # (Missing) Theme switcher component
```

## Screen Details

### 1. Payments Screen (`src/pages/payments/index.tsx`)
**Purpose**: Manage and view project payments (invoices).

**Key Features**:
- **Header**: Title and Theme Toggle.
- **Summary Cards**:
  - Total Pending amount.
  - Overdue count.
- **Filters**: Scrollable tabs (All, Overdue, Upcoming, Paid).
- **List**:
  - Displays payment cards with:
    - Vendor info (Image, Name).
    - Project name.
    - Status badge (Overdue, Upcoming, Paid).
    - Amount, Due Date, Invoice Number.
    - "Pay Now" action button for unpaid items.

### 2. Tasks Screen (`src/pages/tasks/index.tsx`)
**Purpose**: View scheduled maintenance and construction tasks.

**Key Features**:
- **Summary**:
  - Count of tasks for "Today" and "Tomorrow".
- **Filters**: All, Today, Tomorrow.
- **Task Cards**:
  - Title, Vendor, Priority Badge (High, Medium, Low).
  - Date, Time, Location.
  - Status (Scheduled, In-Progress, Completed, Overdue).
  - Actions: "View Details" or "Mark as Completed".

### 3. Profile Screen (`src/pages/profile/index.tsx`)
**Purpose**: User account management and settings.

**Key Features**:
- **Profile Header**: Avatar, Name, Role, stats (Active Projects, Expenses, Pending Payments).
- **Menu Sections**:
  - **Personal Information**: Email, Phone, Role, Company, Location.
  - **Account Settings**: General, Notifications, Privacy, Payment Methods.
  - **Support**: Help & Support.
- **Logout**: Distinct logout button.

## Missing Dependencies & Components
To make the current implementation work, the following need to be addressed:

1.  **Dependencies**:
    - `nativewind` (for `className` styling)
    - `tailwindcss`
    - `lucide-react-native` (for icons)
    - `react-native-svg` (peer dependency for icons)

2.  **Components**:
    - `src/components/ThemeToggle.tsx`: Referenced but not implemented.
