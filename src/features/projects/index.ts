// Navigation entry point (consumed by src/pages/tabs/index.tsx)
export { default as ProjectsNavigator } from './screens/ProjectsNavigator';

// Screens consumed cross-feature
export { default as QuotationDetail } from './screens/QuotationDetail';

// Components consumed cross-feature (dashboard)
export { default as ManualProjectEntry } from './components/ManualProjectEntry';
export { ManualProjectEntryButton } from './components/ManualProjectEntryButton';

// Hooks consumed cross-feature
export { useProjects } from './hooks/useProjects';

// Types needed by callers
export type { ProjectsPageViewModel } from './hooks/useProjectsPage';
