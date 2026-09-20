import { defineConfig, globalIgnores } from 'eslint/config'
import nextPlugin from '@next/eslint-plugin-next'
import reactHooks from 'eslint-plugin-react-hooks'
import typescript from 'typescript-eslint'

const config = defineConfig([
  globalIgnores(['.next/**', 'out/**', 'build/**', 'node_modules/**', 'next-env.d.ts']),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ...nextPlugin.configs['core-web-vitals'],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ...reactHooks.configs.flat.recommended,
  },
  ...typescript.configs.recommended,
])

export default config
