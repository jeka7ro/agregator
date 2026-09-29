import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_FILE = path.resolve(__dirname, '..', '..', '..', 'data', 'live-checks-cache.json')

export function loadLiveChecksCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const data = fs.readFileSync(CACHE_FILE, 'utf8')
            return JSON.parse(data)
        }
    } catch (err) {
        console.error('[CACHE] Error loading live checks cache:', err)
    }
    return []
}

export function saveLiveChecksCache(checks) {
    try {
        fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
        fs.writeFileSync(CACHE_FILE, JSON.stringify(checks, null, 2))
    } catch (err) {
        console.error('[CACHE] Error saving live checks cache:', err)
    }
}

const STOP_EVENTS_CACHE_FILE = path.resolve(__dirname, '..', '..', '..', 'data', 'stop-events-cache.json')
const VIOLATIONS_CACHE_FILE = path.resolve(__dirname, '..', '..', '..', 'data', 'violations-cache.json')

export function loadStopEventsCache() {
    try {
        if (fs.existsSync(STOP_EVENTS_CACHE_FILE)) {
            const data = fs.readFileSync(STOP_EVENTS_CACHE_FILE, 'utf8')
            return JSON.parse(data)
        }
    } catch (err) {
        console.error('[CACHE] Error loading stop events cache:', err)
    }
    return []
}

export function saveStopEventsCache(events) {
    try {
        fs.mkdirSync(path.dirname(STOP_EVENTS_CACHE_FILE), { recursive: true })
        fs.writeFileSync(STOP_EVENTS_CACHE_FILE, JSON.stringify(events, null, 2))
    } catch (err) {
        console.error('[CACHE] Error saving stop events cache:', err)
    }
}

export function loadViolationsCache() {
    try {
        if (fs.existsSync(VIOLATIONS_CACHE_FILE)) {
            const data = fs.readFileSync(VIOLATIONS_CACHE_FILE, 'utf8')
            return JSON.parse(data)
        }
    } catch (err) {
        console.error('[CACHE] Error loading violations cache:', err)
    }
    return []
}

export function saveViolationsCache(violations) {
    try {
        fs.mkdirSync(path.dirname(VIOLATIONS_CACHE_FILE), { recursive: true })
        fs.writeFileSync(VIOLATIONS_CACHE_FILE, JSON.stringify(violations, null, 2))
    } catch (err) {
        console.error('[CACHE] Error saving violations cache:', err)
    }
}
