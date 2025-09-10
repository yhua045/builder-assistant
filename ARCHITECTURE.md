# Builder Assistant - Clean Architecture Guide

## 📋 Overview

This React Native project implements a **Clean Architecture** pattern that separates business logic from UI and platform-specific code. The architecture ensures maintainability, testability, and scalability for the Builder Assistant application.

## 🏗️ Architecture Structure

```
/builder-assistant
│
├── /android                    # Android-specific code & configuration
├── /ios                       # iOS-specific code & configuration
├── /src                       # Shared application source code
│   ├── /domain                # 🔵 Domain Layer (Business Logic)
│   │   ├── /entities          # Business entities and rules
│   │   ├── /repositories      # Data access interfaces
│   │   └── /services          # Domain services
│   ├── /application           # 🟢 Application Layer (Use Cases)
│   │   ├── /usecases          # Application-specific business rules
│   │   └── /interfaces        # Application interfaces
│   ├── /components            # 🟡 UI Components
│   ├── /hooks                 # React hooks for state management
│   ├── /services              # 🔴 Infrastructure services
│   └── /utils                 # Utility functions
├── /assets                    # Static assets (images, fonts)
├── App.tsx                    # Main application entry point
└── package.json               # Dependencies and scripts
```

## 🎯 Architecture Layers

### 🔵 Domain Layer (`/src/domain`)
**Contains the core business logic and rules**

- **Entities** (`/entities`): Core business objects with validation and business rules
  - `Project.ts`: Project entity with status management, budget validation, and progress calculation
  
- **Repositories** (`/repositories`): Interfaces for data persistence
  - `ProjectRepository.ts`: Contract for project data operations
  
- **Services** (`/services`): Domain-specific business logic
  - `ProjectValidationService.ts`: Timeline validation, resource efficiency analysis

**Key Principles:**
- ✅ Independent of frameworks, UI, and external dependencies
- ✅ Contains business rules and validation logic
- ✅ No imports from outer layers

### 🟢 Application Layer (`/src/application`)
**Orchestrates use cases and coordinates between domain and UI**

- **Use Cases** (`/usecases`): Application-specific business rules
  - `CreateProjectUseCase.ts`: Handles project creation workflow
  - `GetProjectAnalysisUseCase.ts`: Provides comprehensive project analysis

**Key Principles:**
- ✅ Implements application-specific business rules
- ✅ Coordinates between domain entities and external systems
- ✅ Handles use case orchestration

### 🟡 UI Layer (`/src/components`, `/src/hooks`)
**Handles user interface and presentation logic**

- **Components**: Reusable UI elements
  - `ProjectCard.tsx`: Displays project information in card format
  - `ProjectList.tsx`: Manages list display with loading states
  
- **Hooks**: React hooks for state management
  - `useProjects.ts`: Manages project data and operations

**Key Principles:**
- ✅ Handles user interaction and presentation
- ✅ Calls application use cases
- ✅ No direct access to domain entities

### 🔴 Infrastructure Layer (`/src/services`)
**Implements external dependencies and data persistence**

- `LocalStorageProjectRepository.ts`: AsyncStorage implementation of ProjectRepository

**Key Principles:**
- ✅ Implements interfaces defined in domain layer
- ✅ Handles external dependencies (storage, APIs, etc.)
- ✅ Platform-specific implementations

## 🔄 Data Flow

```
UI Component → Hook → Use Case → Domain Entity
                ↓
           Repository Interface
                ↓
          Infrastructure Service
```

1. **User Interaction**: User interacts with UI components
2. **State Management**: Hooks manage state and call use cases
3. **Use Case Execution**: Use cases coordinate business operations
4. **Domain Logic**: Entities apply business rules and validation
5. **Data Persistence**: Repository implementations handle data storage

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- React Native development environment
- iOS Simulator or Android Emulator

### Installation
```bash
# Install dependencies
npm install

# iOS setup (macOS only)
cd ios && pod install && cd ..

# Start Metro bundler
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## 🧪 Testing Strategy

### Unit Tests
- **Domain Layer**: Test business rules and validation logic
- **Application Layer**: Test use case orchestration
- **UI Layer**: Test component rendering and user interactions

### Integration Tests
- Test complete workflows from UI to data persistence
- Test repository implementations

### Example Test Structure
```typescript
// Domain entity test
describe('ProjectEntity', () => {
  it('should validate project data correctly', () => {
    // Test business rules
  });
});

// Use case test
describe('CreateProjectUseCase', () => {
  it('should create project successfully', async () => {
    // Test use case execution
  });
});
```

## 📝 Development Guidelines

### Adding New Features

1. **Start with Domain**: Define entities and business rules
2. **Create Use Cases**: Implement application logic
3. **Build UI**: Create components and hooks
4. **Implement Infrastructure**: Add external dependencies

### Dependency Rules
- ✅ Domain layer has no dependencies on outer layers
- ✅ Application layer depends only on domain layer
- ✅ UI layer depends on application and domain layers
- ✅ Infrastructure layer implements domain interfaces

### Best Practices
- Keep domain entities pure and testable
- Use dependency injection for repositories
- Implement interfaces before concrete classes
- Separate platform-specific code in `/android` and `/ios`
- Use TypeScript for type safety throughout

## 🔧 Configuration

### TypeScript Configuration
The project uses TypeScript with strict type checking enabled. See `tsconfig.json` for configuration details.

### ESLint & Prettier
Code formatting and linting rules are configured in `.eslintrc.js` and `.prettierrc.js`.

### Metro Configuration
React Native bundler configuration in `metro.config.js`.

## 📱 Platform-Specific Code

### iOS (`/ios`)
- Native iOS configuration and dependencies
- Platform-specific implementations when needed

### Android (`/android`)  
- Native Android configuration and dependencies
- Platform-specific implementations when needed

## 🔍 Example Usage

### Creating a New Project
```typescript
const { createProject } = useProjects();

const newProject = {
  name: 'New Construction Project',
  description: 'Modern residential building',
  budget: 500000,
  startDate: new Date(),
  expectedEndDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
};

const result = await createProject(newProject);
```

### Analyzing a Project
```typescript
const { getProjectAnalysis } = useProjects();

const analysis = await getProjectAnalysis(projectId);
if (analysis.success) {
  console.log('Project Analysis:', analysis.analysis);
}
```

## 🤝 Contributing

1. Follow the clean architecture principles
2. Write tests for new features
3. Maintain separation of concerns
4. Update documentation for significant changes

## 📚 Further Reading

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)