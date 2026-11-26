import { supabase } from '../services/supabase.js'
import { retryWithBackoff, platformRateLimiters } from '../utils/retry.js'
import { checkGlovoLive } from '../../../lib/live-platform-checkers.js'

/**
 * Glovo Checker — Real-time zero-Puppeteer HTTP checker (Glovo SSR JSON + Glovo v3/stores API).
 * Reads live `"open": true|false` and `closedStatusMessage` directly without browser timeouts.
 * NEVER marks WAF or 404 pages as 'available'.
 */
export class GlovoChecker {
    constructor() {
        this.platform = 'glovo'
    }

    async check(restaurant) {
        if (!restaurant.glovo_url) {
            console.log(`   [Glovo] No URL for ${restaurant.name}`)
            return null
        }

        await platformRateLimiters.glovo.wait()

        return retryWithBackoff(
            () => this._doCheck(restaurant),
            { maxRetries: 2, baseDelay: 1000, label: `Glovo:${restaurant.name}` }
        )
    }

    async _doCheck(restaurant) {
        const result = await checkGlovoLive(restaurant)
        const isErr = result.final_status === 'error' || result.raw_data?.is_scraper_error === true

        try {
            await supabase.from('monitoring_checks').insert({
                restaurant_id: result.restaurant_id,
                platform: this.platform,
                checked_at: result.checked_at,
                ui_is_open: result.ui_is_open,
                ui_can_order: result.ui_can_order,
                ui_is_greyed: result.ui_is_greyed,
                ui_error_message: result.ui_error_message,
                final_status: result.final_status,
                raw_data: result.raw_data
            })
        } catch (err) {
            console.error('   [Glovo] Error saving check:', err.message)
        }

        const icon = result.final_status === 'available' ? '[OK]' : isErr ? '[ERR]' : '[STOP]'
        console.log(`   [Glovo] ${icon} ${restaurant.name} - ${result.final_status} (${result.raw_data?.response_time_ms || 0}ms)${result.ui_error_message ? ` | ${result.ui_error_message}` : ''}`)
        return result
    }
}
