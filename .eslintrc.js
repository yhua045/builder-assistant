module.exports = {
  root: true,
  // ignore git worktree folders (they contain other branches and tests)
  ignorePatterns: [
    "worktrees/**"
  ],
  extends: [
    '@react-native',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  rules: {
    // Enforce naming conventions deterministically
    '@typescript-eslint/naming-convention': [
      'error',
      // Components, Types, Interfaces -> PascalCase
      { selector: 'typeLike', format: ['PascalCase'] },
      // Interfaces must NOT have 'I' prefix
      { selector: 'interface', format: ['PascalCase'], custom: { regex: '^I[A-Z]', match: false } },
      // Booleans -> is/has/should prefix
      { selector: 'variable', types: ['boolean'], format: ['PascalCase'], prefix: ['is', 'has', 'should'] },
      // Global Constants -> UPPER_SNAKE_CASE
      { selector: 'variable', modifiers: ['global', 'const'], format: ['UPPER_SNAKE_CASE', 'camelCase', 'PascalCase'] },
    ],

    // React Native specific guards
    'react-native/no-raw-text': 'error',          // Prevents raw strings outside <Text>
    'react-native/no-inline-styles': 'warn',       // Warns on inline style objects
    'react-hooks/rules-of-hooks': 'error',         // Strict hook execution order
    'react-hooks/exhaustive-deps': 'warn',         // Prevents stale closure bugs
  },
};
