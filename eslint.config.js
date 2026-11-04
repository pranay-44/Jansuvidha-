import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['android/**', '.openai/**', 'node_modules/**', 'dist/vendor/**'] },
  js.configs.recommended,
  { files: ['*.js', '*.mjs'], languageOptions: { globals: globals.node } },
  { files: ['dist/*.js'], languageOptions: { globals: globals.browser } },
];
