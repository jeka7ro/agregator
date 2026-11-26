import { supabase } from '../services/supabase.js'
import { retryWithBackoff, platformRateLimiters } from '../utils/retry.js'
import { checkWoltLive } from '../../../lib/live-platform-checkers.js'

/**
 * Wolt Checker — Real-time public Wolt Dynamic JSON API (~150ms, zero Puppeteer).
 * Extracts live online/offline status, delivery_open_status, and real opening schedule.
 * NEVER fabricates 'available' on HTTP errors or missing slugs.
 */
export class WoltChecker {
    constructor() {
        this.platform = 'wolt'
    }

    async check(restaurant) {
        if (!restaurant.wolt_url) {
            console.log(`   [Wolt] No URL for ${restaurant.name}`)
            return null
        }

        await platformRateLimiters.wolt.wait()

        return retryWithBackoff(
            () => this._doCheck(restaurant),
            { maxRetries: 2, baseDelay: 1000, label: `Wolt:${restaurant.name}` }
        )
    }

    async _doCheck(restaurant) {
        const result = await checkWoltLive(restaurant)
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
            console.error('   [Wolt] Error saving check:', err.message)
        }

        const icon = result.final_status === 'available' ? '[OK]' : isErr ? '[ERR]' : '[STOP]'
        console.log(`   [Wolt] ${icon} ${restaurant.name} - ${result.final_status} (${result.raw_data?.response_time_ms || 0}ms)${result.ui_error_message ? ` | ${result.ui_error_message}` : ''}`)
        return result
    }
}
