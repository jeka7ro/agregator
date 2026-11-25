// On-demand Leaflet CSS + JS loader so non-map pages (/login, /dashboard, /dispatch, etc.)
// never pay for external unpkg.com render-blocking CSS or JS downloads.

let leafletLoadPromise = null

export function loadLeaflet() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.L) return Promise.resolve(window.L)
  if (leafletLoadPromise) return leafletLoadPromise

  leafletLoadPromise = new Promise((resolve, reject) => {
    const cssId = 'ag-leaflet-css'
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link')
      link.id = cssId
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.crossOrigin = ''
      document.head.appendChild(link)
    }

    const existingScript = document.getElementById('ag-leaflet-js')
    if (existingScript) {
      if (window.L) {
        resolve(window.L)
        return
      }
      existingScript.addEventListener('load', () => resolve(window.L || null), { once: true })
      existingScript.addEventListener('error', (err) => {
        leafletLoadPromise = null
        reject(err)
      }, { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = 'ag-leaflet-js'
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.crossOrigin = ''
    script.async = true
    script.onload = () => resolve(window.L || null)
    script.onerror = (err) => {
      leafletLoadPromise = null
      reject(err)
    }
    document.head.appendChild(script)
  })

  return leafletLoadPromise
}
