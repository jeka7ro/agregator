import { supabase } from '../services/supabase.js'
import { retryWithBackoff, platformRateLimiters } from '../utils/retry.js'

/**
 * Bolt Food Checker - Enhanced with product tracking
 * 
 * Uses fetch + HTML parsing (Bolt blocks Puppeteer headless browsers).
 * 
 * Extracts:
 * - Restaurant open/closed status
 * - Product availability from HTML
 * - Basic delivery information
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
            { maxRetries: 2, baseDelay: 2000, label: `Bolt:${restaurant.name}` }
        )
    }

    async _doCheck(restaurant) {
        try {
            console.log(`   [Bolt] Checking ${restaurant.name}...`)

            const startTime = Date.now()

            const response = await fetch(restaurant.bolt_url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'ro-RO,ro;q=0.9,en;q=0.8'
                },
                redirect: 'follow'
            })

            const responseTime = Date.now() - startTime
            const html = await response.text()
            const htmlLower = html.toLowerCase()

            // ─── STATUS DETECTION ───
            const isRestaurantPage = html.includes('restaurant') && !response.url.endsWith('/ro-RO/') && !response.url.endsWith('/ro-ro/')
            const httpOk = response.ok

            const closedKeywords = [
                'currently closed', 'temporarily closed', 'closed now',
                'not accepting', 'unavailable', 'închis', 'indisponibil'
            ]
            const isClosed = closedKeywords.some(kw => htmlLower.includes(kw))

            const hasRestaurantContent = /sushi|master|poki|ikura|smash|crunch|burger|roll|woki|food/i.test(htmlLower)
            const isSearchPage = response.url.includes('/search') || htmlLower.includes('căutare') || htmlLower.includes('search')

            // ─── PRODUCT ANALYSIS (from HTML) ───
            // Count "unavailable" or "sold out" markers
            const unavailableCount = (htmlLower.match(/unavailable|sold.?out|indisponibil/g) || []).length
            // Count product items (approximate via structured data)
            const productMatches = html.match(/product|menu-item|dish/gi) || []
            const totalProducts = Math.max(productMatches.length, 1)

            // ─── RATING from structured data / meta ───
            const ratingMatch = html.match(/"ratingValue"[:\s]*"?(\d+\.?\d*)"?/i) ||
                html.match(/rating[:\s]*(\d+\.?\d*)/i)
            const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null

            const reviewMatch = html.match(/"reviewCount"[:\s]*"?(\d+)"?/i) ||
                html.match(/(\d+)\s*review/i)
            const reviewCount = reviewMatch ? parseInt(reviewMatch[1]) : null

            // ─── DETERMINE STATUS ───
            let finalStatus = 'available'
            if (!httpOk) {
                finalStatus = 'error'
            } else if (isClosed) {
                finalStatus = 'closed'
            } else if (!isRestaurantPage && !hasRestaurantContent && !isSearchPage) {
                finalStatus = 'error'
            }

            const totalTime = Date.now() - startTime

            // ─── SAVE MONITORING CHECK ───
            const checkData = {
                    restaurant_id: restaurant.id,
                    platform: this.platform,
                    checked_at: new Date().toISOString(),
                    ui_is_open: finalStatus === 'available',
                    ui_can_order: finalStatus === 'available',
                    ui_is_greyed: finalStatus !== 'available',
                    ui_error_message: finalStatus === 'error' ? 'Page not found or redirect' : null,
                    rating,
                    review_count: reviewCount,
                    missing_products: unavailableCount > 0
                        ? [{ count: unavailableCount, type: 'unavailable' }]
                        : [],
                    final_status: finalStatus,
                    raw_data: {
                        http_status: response.status,
                        final_url: response.url,
                        is_restaurant_page: isRestaurantPage,
                        has_restaurant_content: hasRestaurantContent,
                        is_closed: isClosed,
                        response_time_ms: responseTime,
                        total_time_ms: totalTime,
                        html_length: html.length,
                        product_stops: {
                            total: totalProducts,
                            stopped: unavailableCount
                        }
                    }
                }
            
            let { error } = await supabase
                .from('monitoring_checks')
                .insert(checkData)
                .select()
                .single()

            if (error) {
                console.error('   [Bolt] Error saving check (ignored for local UI):', error.message)
            }
            
            const data = checkData;

            // ─── SAVE RATING HISTORY ───
            if (rating) {
                await this._saveRatingHistory(restaurant, rating, reviewCount)
            }

            // ─── LOG ───
            const statusIcon = finalStatus === 'available' ? '[OK]' : finalStatus === 'closed' ? '[CLOSED]' : '[ERR]'
            console.log(`   [Bolt] ${statusIcon} ${restaurant.name} - ${finalStatus} (${totalTime}ms)`)
            if (rating) console.log(`   [Bolt] Rating: ${rating}${reviewCount ? ` (${reviewCount} reviews)` : ''}`)

            return data

        } catch (error) {
            console.error(`   [Bolt] Error checking ${restaurant.name}:`, error.message)

            const fallbackCheck = {
                restaurant_id: restaurant.id,
                platform: this.platform,
                checked_at: new Date().toISOString(),
                ui_is_open: false,
                final_status: 'unavailable',
                ui_error_message: 'Indisponibil pe Bolt',
                raw_data: { error: error.message, url: restaurant.bolt_url }
            }

            try {
                await supabase.from('monitoring_checks').insert(fallbackCheck)
            } catch (_) {}

            return fallbackCheck
        }
    }

    /**
     * Save rating to history
     */
    async _saveRatingHistory(restaurant, currentRating, reviewCount) {
        try {
            const { data: prev } = await supabase
                .from('rating_history')
                .select('rating, review_count')
                .eq('restaurant_id', restaurant.id)
                .eq('platform', this.platform)
                .order('recorded_at', { ascending: false })
                .limit(1)
                .single()

            const previousRating = prev?.rating || null
            let changeDirection = 'stable'
            if (previousRating !== null) {
                if (currentRating > previousRating) changeDirection = 'up'
                else if (currentRating < previousRating) changeDirection = 'down'
            } else {
                changeDirection = 'initial'
            }

            await supabase.from('rating_history').insert({
                restaurant_id: restaurant.id,
                platform: this.platform,
                rating: currentRating,
                previous_rating: previousRating,
                review_count: reviewCount,
                previous_review_count: prev?.review_count || null,
                change_direction: changeDirection,
                recorded_at: new Date().toISOString()
            })
        } catch (err) {
            console.error('   [Bolt] Error saving rating history:', err.message)
        }
    }
}
