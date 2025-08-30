const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
        ecmaVersion: 2021,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // Enforce semicolons
      semi: ['error', 'always'],

      // Use single quotes unless avoiding escape
      quotes: ['error', 'single', { avoidEscape: true }],

      // Warn on unused variables but allow unused function args starting with _
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // Allow 'any' temporarily
      '@typescript-eslint/no-explicit-any': 'off',

      // Warn on console statements
      'no-console': 'warn',

      // Enforce consistent brace style (1tbs with allowance for single line)
      'brace-style': ['error', '1tbs', { allowSingleLine: true }],

      // Add other custom rules as needed
    },
    // Ignore common folders
    ignores: ['node_modules', 'dist', 'out', 'build']
  }
];
