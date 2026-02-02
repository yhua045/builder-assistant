# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Builder Assistant is a React Native application for construction project management, built with Clean Architecture principles. The app helps project managers track building projects, detect design flaws, estimate materials, and manage timelines.

## Common Commands

### Development Commands
- `npm start` - Start Metro bundler
- `npm run ios` - Run on iOS simulator
- `npm run android` - Run on Android emulator
- `npm run lint` - Run ESLint
- `npm test` - Run Jest tests

### Testing & Validation
- `npx tsc --noEmit` - Run TypeScript type checking
- Always run `npm run lint` and TypeScript checks before submitting code

## Architecture

This project implements Clean Architecture with strict separation of concerns:

### Layer Structure
```
/src
├── /domain         # Business entities and rules (Project, Material, etc.)
├── /application    # Use cases orchestrating domain logic
├── /components     # React Native UI components
├── /hooks          # React hooks connecting UI to application layer
├── /services       # Infrastructure implementations (AsyncStorage, etc.)
└── /utils          # Pure utility functions (currency, date formatting)
```

### Key Architectural Principles
- **Domain Layer**: Contains `Project` entity with business validation rules. Domain entities are immutable and contain business logic methods like `getTotalMaterialCost()`, `isOverBudget()`, `getProgressPercentage()`
- **Application Layer**: Use cases like `CreateProjectUseCase` and `GetProjectAnalysisUseCase` orchestrate domain entities and handle application-specific logic
- **Repository Pattern**: `ProjectRepository` interface in domain, implemented by `LocalStorageProjectRepository` in services
- **Dependency Flow**: UI → Hooks → Use Cases → Domain Entities. Dependencies point inward only

### Domain Entities
- `Project`: Main entity with `ProjectStatus` enum, contains materials and phases
- `Material`: Tracks building materials with costs and delivery dates  
- `ProjectPhase`: Represents construction phases with dependencies
- `ProjectEntity`: Wrapper class with validation and business methods

### Key Components
- `useProjects` hook: Manages project state and connects UI to use cases
- `ProjectList` and `ProjectCard`: UI components for displaying projects
- Use cases handle all business operations and validation
- AsyncStorage for local data persistence

## Development Guidelines

### Creating New Features
1. Start with domain entities and business rules in `/domain/entities`
2. Define repository interfaces in `/domain/repositories` 
3. Create use cases in `/application/usecases`
4. Build UI components in `/components`
5. Connect with custom hooks in `/hooks`
6. Implement infrastructure in `/services`

### Code Conventions
- Use TypeScript with strict typing
- Domain entities should be immutable (return new instances for updates)
- Use dependency injection in use cases (constructor injection)
- React hooks should use `useMemo` and `useCallback` for performance
- Follow existing patterns for error handling and validation
- Use explicit type annotations for StyleSheet styles (e.g., `as ViewStyle`)

### State Management
- Custom hooks handle state management
- No external state management library - uses React's built-in state
- Repository pattern abstracts data persistence
- Use cases handle complex business logic

### Key Dependencies
- React Native 0.81.1 with React 19.1.0
- Safe Area Context for proper device handling
- TypeScript for type safety
- Jest for testing

The codebase demonstrates clean architecture with complete separation of business logic from UI and infrastructure concerns.