import { supabase } from '../services/supabase.js'
import { retryWithBackoff, platformRateLimiters } from '../utils/retry.js'
import { checkBoltLive } from '../../../lib/live-platform-checkers.js'

/**
 * Bolt Food Checker — Real-time public Bolt Availability API (~120ms, zero Puppeteer).
 * Reads real `is_available_for_delivery` and `provider_overlay_text` from Bolt's live API.
 * NEVER marks empty SPA shells as 'available'.
 */
export class BoltChecker {
    constructor() {
        this.platform = 'bolt'
    }

    async check(restaurant) {
        if (!restaurant.bolt_url) {
            console.log(`   [Bolt] No URL for ${restaurant.name}`)
            return null
        }

        await platformRateLimiters.bolt.wait()

        return retryWithBackoff(
            () => this._doCheck(restaurant),
            { maxRetries: 2, baseDelay: 1000, label: `Bolt:${restaurant.name}` }
        )
    }

    async _doCheck(restaurant) {
        const result = await checkBoltLive(restaurant)
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
            console.error('   [Bolt] Error saving check:', err.message)
        }

        const icon = result.final_status === 'available' ? '[OK]' : isErr ? '[ERR]' : '[STOP]'
        console.log(`   [Bolt] ${icon} ${restaurant.name} - ${result.final_status} (${result.raw_data?.response_time_ms || 0}ms)${result.ui_error_message ? ` | ${result.ui_error_message}` : ''}`)
        return result
    }
}
