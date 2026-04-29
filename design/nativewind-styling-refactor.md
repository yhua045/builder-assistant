# Design Doc: NativeWind Styling Refactor

## 1. Context & Goal

Currently, the UI layer mixes two styling approaches:
- **`StyleSheet.create` / Inline `style` props** (The standard React Native approach)
- **NativeWind `className` props** (Tailwind CSS utility classes)

**Goal:** Standardize the styling convention across the application. We will migrate all applicable static styling to NativeWind (`className`). Dynamic styles (e.g., calculated progress bar widths, Animated value bindings) will remain in inline `style` props.

**Benefits:**
- **Consistency**: A single source of truth for design tokens (Tailwind config).
- **Maintainability**: Utility classes keep components concise and eliminate the need to jump between the JSX and the `StyleSheet` definitions at the bottom of the file.
- **Responsiveness**: NativeWind natively supports styling responsive breakpoints, dark mode, and pseudo-states.

---

## 2. Refactoring Guidelines

1. **Static Styles -> `className`**: 
   Convert all static `StyleSheet` definitions (e.g., paddings, margins, flex layouts, colors, typography) to Tailwind classes.
   *Example:* `styles.container` (`{ flex: 1, padding: 16, backgroundColor: '#fff' }`) becomes `className="flex-1 p-4 bg-background"`.

2. **Inline Static Styles -> `className`**: 
   Convert inline objects like `style={{ flexDirection: 'row', alignItems: 'center' }}` to `className="flex-row items-center"`.

3. **Dynamic Styles -> `style`**: 
   Preserve inline `style="..."` only when styling depends on JS runtime calculations that can't be easily mapped to Tailwind tokens.
   *Example:* `style={{ width: \`${progressPercentage}%\` }}` or passed down `Animated.View` styles.

4. **Prop Types**: 
   For components accepting custom styles, support `className` (via `string`) in their props instead of, or alongside, `styleProp`.

5. **Clean Up**: 
   Remove the `StyleSheet` import from React Native if it's no longer used in the file.

---

## 3. Scope of Migration (Target Files)

Through our review, we identified the following files actively using `StyleSheet.create` that need to be migrated. We'll group the work into three logical phases:

### Phase 1: Shared Components & Inputs
- `src/components/shared/ProjectPickerModal.tsx`
- `src/components/inputs/QuickAddContractorModal.tsx`
- `src/components/inputs/TeamSelector.tsx`
- `src/components/inputs/DatePickerInput.tsx`
- `src/components/inputs/ContactSelector.tsx`

### Phase 2: Feature Components
- **Invoices**: `InvoiceForm.tsx`, `InvoiceLifecycleActions.tsx`
- **Payments**: `PaymentCard.tsx`, `GlobalQuotationCard.tsx`, `PaymentTypeFilterChips.tsx`
- **Tasks**: `StatusPriorityRow.tsx`, `BlockerCarousel.tsx`, `TaskPhotoPreview.tsx`, `FocusList.tsx`
- **Projects**: `ProjectList.tsx`, `CriticalPathPreview/CriticalPathPreview.tsx`, `CriticalPathPreview/CriticalPathTaskRow.tsx`, `ProjectsList.tsx`, `ManualProjectEntryForm.tsx`
- **Dashboard**: `ActiveTasks.tsx`, `HeroSection.tsx`

### Phase 3: Screens & Pages
- **Invoices**: `InvoiceListPage.tsx`, `InvoiceDetailPage.tsx`
- **Payments**: `PaymentDetails.tsx`, `PaymentsScreen.tsx`
- **Tasks**: `src/features/tasks/screens/index.tsx`
- **Projects**: `ProjectsPage.tsx`
- **Dashboard**: `DashboardScreen.tsx`
- **Profile**: `src/pages/profile/index.tsx`

 *(Note: Tests containing stubbed `StyleSheet` usages will also be updated to prevent linting or type errors).*

---

## 4. Example Transformation

**Before:**
```tsx
const Header = () => (
  <View style={styles.header}>
    <Text style={styles.title}>Title</Text>
  </View>
);

const styles = StyleSheet.create({
  header: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 20, fontWeight: 'bold' },
});
```

**After:**
```tsx
const Header = () => (
  <View className="p-4 border-b border-border">
    <Text className="text-xl font-bold text-foreground">Title</Text>
  </View>
);
```

---

## 5. Execution Plan

If approved, the AI assistant will automatically chunk the work into these phases, executing the refactoring, running the TypeScript compiler (`npm run typecheck` equivalent) after each phase to ensure nothing breaks, and committing the changes logically.
