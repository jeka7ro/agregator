// Build metadata injected during Vite compilation or dev server
const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const fallbackDate = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`
const fallbackTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`

const fallbackInfo = {
  version: '2.0',
  buildNumber: '#249',
  date: fallbackDate,
  time: fallbackTime,
  formatted: `${fallbackDate} • ${fallbackTime}`
}

export const BUILD_INFO = typeof __APP_BUILD_INFO__ !== 'undefined' 
  ? __APP_BUILD_INFO__ 
  : fallbackInfo
