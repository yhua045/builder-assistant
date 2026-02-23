# Builder Assistant

A comprehensive React Native application for building project management, designed with clean architecture principles to support construction project managers and owners throughout the building process.

## 🚀 Features

### Core Functionality
- **Project Management**: Create and track building projects with timeline and budget management
- **Design Flaw Detection**: Identifies potential structural and design issues early in the planning phase
- **Material Estimation**: Calculates accurate material quantities and cost estimates
- **Timeline Management**: Manages project phases with dependency tracking
- **Resource Planning**: Assists in coordinating materials and workforce scheduling

### Technical Features
- **Clean Architecture**: Separates domain logic from UI and platform-specific code
- **Cross-Platform**: Runs on both iOS and Android with shared business logic
- **TypeScript**: Full type safety and enhanced development experience
- **Offline Storage**: Local data persistence using AsyncStorage
- **Real-time Analysis**: Provides instant project analysis and recommendations

## 🏗️ Architecture

This project implements Clean Architecture with clear separation of concerns:

```
├── /src
│   ├── /domain         # Business logic and entities
│   ├── /application    # Use cases and application logic  
│   ├── /components     # UI components
│   ├── /hooks          # React hooks for state management
│   ├── /services       # External services and infrastructure
│   └── /utils          # Utility functions
├── /android           # Android-specific code
├── /ios              # iOS-specific code
└── /assets           # Static assets
```

For detailed architecture documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## 🛠️ Installation

### Prerequisites
- Node.js 18 or higher
- React Native development environment
- iOS Simulator (macOS) or Android Emulator

### Setup
```bash
# Clone the repository
git clone https://github.com/yhua045/builder-assistant.git
cd builder-assistant

# Install dependencies
npm install

# iOS setup (macOS only)
cd ios && pod install && cd ..
```

### Running the App
```bash
# Start Metro bundler
npm start

# Run on iOS
npm run ios

# Run on Android  
npm run android
```

## 📱 Usage

1. **Create a Demo Project**: Tap "Create Demo Project" to see the app in action
2. **View Project Details**: Tap on any project card to see comprehensive analysis
3. **Architecture Demo**: Tap "Show Architecture Info" to see clean architecture principles

## 🧪 Testing

```bash
# Run tests
npm test

# Run linting
npm run lint

# Type checking
npx tsc --noEmit
```

## 🔧 Development

### Adding New Features
1. Start with domain entities and business rules
2. Create application use cases
3. Build UI components and hooks
4. Implement infrastructure services

### Key Principles
- Domain layer is independent of frameworks and UI
- Application layer orchestrates use cases
- UI layer handles presentation only
- Infrastructure implements external dependencies

## 📂 Project Structure

```
/builder-assistant
├── android/                # Android platform code
├── ios/                    # iOS platform code
├── src/
│   ├── domain/
│   │   ├── entities/       # Business entities (Project, Material, etc.)
│   │   ├── repositories/   # Data access interfaces
│   │   └── services/       # Domain services
│   ├── application/
│   │   └── usecases/       # Application use cases
│   ├── components/         # React components
│   ├── hooks/              # Custom React hooks
│   ├── services/           # Infrastructure implementations
│   └── utils/              # Utility functions
├── assets/                 # Static assets
├── App.tsx                 # Main application component
└── package.json            # Dependencies and scripts
```

## 🎯 Core Use Cases

- **Create Project**: Initialize new building projects with validation
- **Project Analysis**: Comprehensive analysis including design flaw detection
- **Material Management**: Track materials with cost and delivery estimates
- **Timeline Validation**: Detect scheduling conflicts and dependencies
- **Progress Tracking**: Monitor project completion and milestones

## 🔄 Clean Architecture Benefits

- **Testability**: Business logic is easily unit testable
- **Maintainability**: Clear separation of concerns
- **Scalability**: Easy to add new features and platforms
- **Independence**: UI and frameworks can be changed without affecting business logic

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow clean architecture principles
4. Write tests for new functionality
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Resources

- [Architecture Documentation](./ARCHITECTURE.md)
- [React Native Documentation](https://reactnative.dev/)
- [Clean Architecture Principles](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

## iOS & Voice Setup Notes

- After a fresh clone or when adding native dependencies run:

```bash
cd ios && pod install && cd ..
```

- For the Groq-based voice adapters configure a `GROQ_API_KEY` in your `.env` (use `react-native-config` or your preferred env loader). Do not commit `.env` to source control.
