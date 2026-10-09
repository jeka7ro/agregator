import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function getBuildInfo() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const date = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`
  return {
    version: '2.0',
    buildNumber: '#249',
    date,
    time,
    formatted: `${date} • ${time}`
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_BUILD_INFO__: JSON.stringify(getBuildInfo()),
  },
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
