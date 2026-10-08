import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // Security: API data (toots, display names) must never be rendered as HTML.
      'vue/no-v-html': 'error',
      // Errors are logged with src/utils/logError.ts only: DEV only, and never a request's headers (the token).
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      // Single-word names (App, Send) are an existing convention in this project.
      'vue/multi-word-component-names': 'off',
    },
  },
  // Config files run in Node, not in the browser.
  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
)
