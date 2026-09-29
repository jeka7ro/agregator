/**
 * Central puppeteer launch config.
 * Reads PUPPETEER_EXECUTABLE_PATH from env,
 * falls back to system Chrome on macOS.
 */
import puppeteer from 'puppeteer'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env from workers/ folder (two levels up from utils/)
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') })

import os from 'os'

let CHROME_PATH = (process.env.PUPPETEER_EXECUTABLE_PATH || '').replace(/^"|"$/g, '').trim()

export const PUPPETEER_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu'
]

export async function launchBrowser(extraArgs = []) {
    const profileDir = '--user-data-dir=/tmp/puppeteer_profile_' + Date.now() + '_' + Math.random().toString(36).substring(7)
    
    const opts = {
        headless: true,
        args: [...PUPPETEER_ARGS, profileDir, ...(extraArgs.args || extraArgs)],
    }
    if (CHROME_PATH) {
        opts.executablePath = CHROME_PATH
    }
    console.log(`[Puppeteer] Chrome: ${CHROME_PATH || 'bundled'}`)
    return puppeteer.launch(opts)
}
