import eslint from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import perfectionist from 'eslint-plugin-perfectionist'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  perfectionist.configs['recommended-natural'],
  eslintConfigPrettier,
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/.prettierrc.cjs', '**/tsdown.config.ts']
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'perfectionist/sort-imports': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          newlinesBetween: 'always',
          order: 'asc',
          type: 'natural'
        }
      ]
    }
  }
)
