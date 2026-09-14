module.exports = {
  root: true,
  ignorePatterns: [
    "worktrees/**",
    ".eslintrc.js", // not covered by tsconfig.json; excluded from type-aware parsing
  ],
  extends: [
    '@react-native',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  rules: {
    // React Native specific guards
    'react-native/no-raw-text': 'error',          // Prevents raw strings outside <Text>
    'react-native/no-inline-styles': 'warn',       // Warns on inline style objects
    'react-hooks/rules-of-hooks': 'error',         // Strict hook execution order
    'react-hooks/exhaustive-deps': 'warn',         // Prevents stale closure bugs
  },
  overrides: [
    {
      // scope type-aware linting to files actually covered by tsconfig.json
      files: ['*.ts', '*.tsx'],
      parserOptions: {
        project: './tsconfig.json',
      },
      rules: {
        '@typescript-eslint/naming-convention': [
          'error',
          { selector: 'typeLike', format: ['PascalCase'] },
          { selector: 'interface', format: ['PascalCase'], custom: { regex: '^I[A-Z]', match: false } },
          { selector: 'variable', types: ['boolean'], format: ['PascalCase'], prefix: ['is', 'has', 'should'] },
          { selector: 'variable', modifiers: ['global', 'const'], format: ['UPPER_CASE', 'camelCase', 'PascalCase'] },
        ],
      },
    },
  ],
};
