import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    watch: {
      ignored: [
        '**/data/**',
        '**/workers/**',
        '**/dist/**',
        '**/*.json',
        '**/*.tsv',
        '**/*.ods',
        '**/*.csv',
        '**/*.log'
      ]
    }
  },
  plugins: [
    tailwindcss(),
    react()
  ],
})
