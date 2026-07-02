import globals from 'globals'
import pluginReact from 'eslint-plugin-react'
import pluginReactHooks from 'eslint-plugin-react-hooks'

export default [
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        React: 'readonly',
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: { react: pluginReact, 'react-hooks': pluginReactHooks },
    settings: { react: { version: '18' } },
    rules: {
      'no-undef': 'error',
      'react/jsx-no-undef': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]
