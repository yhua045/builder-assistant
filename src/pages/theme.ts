// theme.ts
import { vars } from "nativewind";

// ============================================================================
// FONT CONFIGURATION
// ============================================================================
// Each theme can define its own font families. Fonts are loaded in _layout.tsx
// using expo-font and referenced via CSS variables in tailwind.config.js.
//
// Font families:
// - heading: Used for h1-h4 headings
// - body: Used for body text, labels, captions
// - mono: Used for code snippets
// ============================================================================

export interface ThemeFonts {
  heading: {
    family: string;
    weights: Record<string, string>; // weight name -> font file key
  };
  body: {
    family: string;
    weights: Record<string, string>;
  };
  mono: {
    family: string;
    weights: Record<string, string>;
  };
}

// Professional theme fonts: Inter for clean, business-focused typography
export const themeFonts: ThemeFonts = {
  heading: {
    family: 'Inter',
    weights: {
      normal: 'Inter_400Regular',
      medium: 'Inter_500Medium',
      semibold: 'Inter_600SemiBold',
      bold: 'Inter_700Bold',
    },
  },
  body: {
    family: 'Inter',
    weights: {
      normal: 'Inter_400Regular',
      medium: 'Inter_500Medium',
      semibold: 'Inter_600SemiBold',
    },
  },
  mono: {
    family: 'JetBrainsMono',
    weights: {
      normal: 'JetBrainsMono_400Regular',
      medium: 'JetBrainsMono_500Medium',
    },
  },
};


// Professional Blue theme for finance/business app
export const lightTheme = vars({
  "--radius": "12", // Slightly more rounded for modern feel

  // Core semantic colors - Professional blue palette
  "--background": "250 251 252", // Very light blue-gray
  "--foreground": "15 23 42", // Dark slate

  "--card": "255 255 255", // Pure white cards
  "--card-foreground": "15 23 42", // Dark slate

  "--popover": "255 255 255",
  "--popover-foreground": "15 23 42",

  "--primary": "37 99 235", // Professional blue (#2563EB)
  "--primary-foreground": "255 255 255", // White text

  "--secondary": "241 245 249", // Light slate
  "--secondary-foreground": "30 41 59", // Slate

  "--muted": "241 245 249", // Light slate
  "--muted-foreground": "100 116 139", // Medium slate

  "--accent": "219 234 254", // Light blue
  "--accent-foreground": "30 58 138", // Dark blue

  "--destructive": "220 38 38", // Red for errors/alerts

  "--border": "226 232 240", // Light border
  "--input": "226 232 240",
  "--ring": "59 130 246", // Blue ring

  // Chart colors - Professional palette
  "--chart-1": "59 130 246", // Blue
  "--chart-2": "34 197 94", // Green
  "--chart-3": "251 146 60", // Orange
  "--chart-4": "168 85 247", // Purple
  "--chart-5": "236 72 153", // Pink

  // Sidebar colors
  "--sidebar": "248 250 252",
  "--sidebar-foreground": "15 23 42",
  "--sidebar-primary": "37 99 235",
  "--sidebar-primary-foreground": "255 255 255",
  "--sidebar-accent": "241 245 249",
  "--sidebar-accent-foreground": "30 41 59",
  "--sidebar-border": "226 232 240",
  "--sidebar-ring": "59 130 246",
});

export const darkTheme = vars({
  "--radius": "12",

  // Core semantic colors - Dark professional theme
  "--background": "15 23 42", // Dark slate
  "--foreground": "248 250 252", // Very light slate

  "--card": "30 41 59", // Slate card
  "--card-foreground": "248 250 252",

  "--popover": "30 41 59",
  "--popover-foreground": "248 250 252",

  "--primary": "59 130 246", // Bright blue (#3B82F6)
  "--primary-foreground": "255 255 255",

  "--secondary": "51 65 85", // Dark slate
  "--secondary-foreground": "226 232 240",

  "--muted": "51 65 85",
  "--muted-foreground": "148 163 184",

  "--accent": "30 58 138", // Deep blue
  "--accent-foreground": "219 234 254",

  "--destructive": "239 68 68", // Lighter red for dark mode

  "--border": "51 65 85",
  "--input": "51 65 85",
  "--ring": "96 165 250",

  // Chart colors - Vibrant for dark mode
  "--chart-1": "96 165 250", // Light blue
  "--chart-2": "74 222 128", // Light green
  "--chart-3": "251 146 60", // Orange
  "--chart-4": "192 132 252", // Light purple
  "--chart-5": "244 114 182", // Light pink

  // Sidebar colors
  "--sidebar": "30 41 59",
  "--sidebar-foreground": "248 250 252",
  "--sidebar-primary": "59 130 246",
  "--sidebar-primary-foreground": "255 255 255",
  "--sidebar-accent": "51 65 85",
  "--sidebar-accent-foreground": "226 232 240",
  "--sidebar-border": "51 65 85",
  "--sidebar-ring": "96 165 250",
});