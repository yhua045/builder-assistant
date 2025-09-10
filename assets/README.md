# Assets Directory

This directory contains static assets for the Builder Assistant app:

## Images (`/images`)
- App icons and logos
- UI illustrations and graphics
- Project-related images

## Fonts (`/fonts`)
- Custom font files (TTF, OTF)
- Typography assets

## Usage

Import assets in your components:

```typescript
// For images
import logo from '../assets/images/logo.png';

// Use in component
<Image source={logo} style={styles.logo} />
```

## Organization

- Keep image files optimized for mobile (WebP when possible)
- Use consistent naming conventions (kebab-case)
- Organize by feature or component when the directory grows
- Consider using different resolutions (@2x, @3x) for iOS