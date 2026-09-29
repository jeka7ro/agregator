import { launchBrowser } from '../utils/puppeteer-launch.js'
import { supabase } from '../services/supabase.js'
import { retryWithBackoff, platformRateLimiters } from '../utils/retry.js'

/**
 * Glovo Checker - Enhanced with product stops, radius, and position tracking
 * 
 * Uses Puppeteer for real browser scraping.
 * 
 * Extracts:
 * - Restaurant open/closed status
 * - Rating (percentage-based)
 * - Product/category availability
 * - Delivery info (time, fee)
 * - Schedule information
 */
export class GlovoChecker {
    constructor() {
        this.platform = 'glovo'
        this.browser = null
    }

    async check(restaurant) {
        if (!restaurant.glovo_url) {
            console.log(`   [Glovo] No URL for ${restaurant.name}`)
            return null
        }

        await platformRateLimiters.glovo.wait()

        return retryWithBackoff(
            () => this._doCheck(restaurant),
            { maxRetries: 2, baseDelay: 2000, label: `Glovo:${restaurant.name}` }
        )
    }

    async _doCheck(restaurant) {
        console.log(`   [Glovo] Checking ${restaurant.name}...`)

        try {
            this.browser = await launchBrowser()

            const page = await this.browser.newPage()
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

            const startTime = Date.now()

            await page.goto(restaurant.glovo_url, {
                waitUntil: 'networkidle2',
                timeout: 30000
            })

            const responseTime = Date.now() - startTime
            await new Promise(resolve => setTimeout(resolve, 2000))

            const pageData = await page.evaluate(() => {
                const rawText = document.body.innerText
                const bodyText = rawText.toLowerCase()

                // ─── OPEN/CLOSED DETECTION ───
                const hasMenu = bodyText.includes('ron') || bodyText.includes('lei')
                const hasSushiContent = bodyText.includes('sushi') || bodyText.includes('rolls') || bodyText.includes('maki')
                const hasCategories = bodyText.includes('promoții') || bodyText.includes('cele mai vândute') || bodyText.includes('california')
                const hasDeliveryTime = /\d+[–-]\d+\s*min/i.test(bodyText) || /livrare.*\d+.*min/i.test(bodyText)
                const hasDisponibil = bodyText.includes('disponibil') && !bodyText.includes('indisponibil')
                const hasLivrare = bodyText.includes('livrare') || bodyText.includes('livrate')

                const hasExplicitClosed = bodyText.includes('momentan, acest magazin este închis') ||
                    bodyText.includes('magazin închis') ||
                    bodyText.includes('temporarily closed') ||
                    bodyText.includes('restaurant closed')
                const hasScheduleOnly = /se deschide (mâine|la \d)/i.test(bodyText)

                const hasRealMenu = hasMenu && (hasSushiContent || hasCategories)
                const isOpen = hasRealMenu || hasDeliveryTime || (hasDisponibil && hasLivrare)
                const isClosed = hasExplicitClosed || (hasScheduleOnly && !hasRealMenu)

                // ─── RATING ───
                const percentMatch = rawText.match(/(?:^|\n)\s*(9\d|100)%/m)
                const percentRating = percentMatch ? parseInt(percentMatch[1]) : null

                // ─── DELIVERY INFO ───
                const deliveryTimeMatch = rawText.match(/(\d+)[–-](\d+)\s*min/i)
                const deliveryTime = deliveryTimeMatch
                    ? { min: parseInt(deliveryTimeMatch[1]), max: parseInt(deliveryTimeMatch[2]) }
                    : null

                const deliveryFeeMatch = rawText.match(/livrare[:\s]*(\d+[.,]\d+)\s*(ron|lei)/i)
                const deliveryFee = deliveryFeeMatch
                    ? parseFloat(deliveryFeeMatch[1].replace(',', '.'))
                    : null

                // ─── PRODUCT/CATEGORY ANALYSIS ───
                // Look for "indisponibil" markers on products
                const indisponibilCount = (bodyText.match(/indisponibil/g) || []).length

                // Detect category sections and check for disabled ones
                const categoryHeaders = []
                const allElements = document.querySelectorAll('h2, h3, [data-testid*="category"]')
                allElements.forEach(el => {
                    const text = el.innerText?.trim()
                    if (text && text.length > 1 && text.length < 50) {
                        categoryHeaders.push(text)
                    }
                })

                // Count visible product items (approximate)
                const productElements = document.querySelectorAll('[data-testid*="product"], [class*="product"], [class*="item"]')
                const totalVisibleProducts = productElements.length

                // Check for greyed-out or disabled product sections
                const disabledCategories = []
                const greyedElements = document.querySelectorAll('[class*="disabled"], [class*="grey"], [class*="unavailable"], [class*="closed"]')
                greyedElements.forEach(el => {
                    const text = el.innerText?.trim()
                    if (text && text.length > 1 && text.length < 50) {
                        disabledCategories.push(text)
                    }
                })

                // ─── SCHEDULE ───
                const scheduleMatch = rawText.match(/se deschide[^.\n]+/i)
                const scheduleInfo = scheduleMatch ? scheduleMatch[0].trim() : null

                // Page not found vs WAF
                const isWaf = bodyText.includes("problem, but we're working on it") ||
                    bodyText.includes('waf courtesy page') ||
                    bodyText.includes('datadog-logs') ||
                    bodyText.includes("we're always improving our platform")

                const notFound = !isWaf && (bodyText.includes('această pagină nu există') || bodyText.includes('page not found') ||
                    bodyText.includes('nu a fost găsit'))

                return {
                    isOpen: isWaf ? true : isOpen,
                    isClosed,
                    isWaf,
                    hasMenu: hasRealMenu,
                    hasCategories,
                    hasDisponibil,
                    percentRating,
                    deliveryTime,
                    deliveryFee,
                    scheduleInfo,
                    notFound,
                    // Product analysis
                    product_stops: {
                        total: totalVisibleProducts,
                        stopped: indisponibilCount,
                        stop_percent: totalVisibleProducts > 0 ? (indisponibilCount / totalVisibleProducts) * 100 : 0
                    },
                    categories: categoryHeaders,
                    disabled_categories: disabledCategories,
                    bodyText: bodyText.substring(0, 500)
                }
            })

            await this.browser.close()
            this.browser = null

            // ─── DETERMINE STATUS ───
            let finalStatus = 'unavailable'
            let uiErrorMessage = null

            if (pageData.notFound) {
                finalStatus = 'unavailable'
                uiErrorMessage = 'Nelistat pe Glovo'
            } else if (pageData.isWaf || pageData.isOpen) {
                finalStatus = 'available'
            } else if (pageData.isClosed) {
                finalStatus = 'closed'
                uiErrorMessage = pageData.scheduleInfo || 'Închis conform program'
            }

            const totalTime = Date.now() - startTime
            // Cap at 9.9 to avoid NUMERIC(3,2) overflow when Glovo shows 100%
            const rawRating = pageData.percentRating ? parseFloat((pageData.percentRating / 10).toFixed(1)) : null
            const rating = rawRating !== null ? Math.min(rawRating, 9.9) : null


            // ─── SAVE MONITORING CHECK ───
            const checkData = {
                restaurant_id: restaurant.id,
                platform: this.platform,
                checked_at: new Date().toISOString(),
                ui_is_open: pageData.isOpen,
                ui_can_order: pageData.isOpen,
                ui_is_greyed: !pageData.isOpen,
                ui_error_message: pageData.scheduleInfo || null,
                rating,
                missing_products: pageData.product_stops?.stopped > 0
                    ? [{ count: pageData.product_stops.stopped, type: 'indisponibil' }]
                    : [],
                disabled_categories: pageData.disabled_categories || [],
                final_status: finalStatus,
                raw_data: {
                    ...pageData,
                    response_time_ms: responseTime,
                    total_time_ms: totalTime,
                    url: restaurant.glovo_url
                }
            }

            let { data, error } = await supabase
                .from('monitoring_checks')
                .insert(checkData)
                .select()
                .single()

            if (error) {
                console.error('   [Glovo] Error saving check (ignored for local UI):', error.message)
                data = checkData
            }

            // ─── SAVE RATING HISTORY ───
            if (rating) {
                await this._saveRatingHistory(restaurant, rating)
            }

            // ─── LOG ───
            const statusIcon = finalStatus === 'available' ? '[OK]' : finalStatus === 'closed' ? '[CLOSED]' : '[ERR]'
            console.log(`   [Glovo] ${statusIcon} ${restaurant.name} - ${finalStatus} (${totalTime}ms)`)
            if (pageData.percentRating) console.log(`   [Glovo] Rating: ${pageData.percentRating}%`)
            if (pageData.product_stops?.stopped > 0) {
                console.log(`   [Glovo] Products stopped: ${pageData.product_stops.stopped}/${pageData.product_stops.total}`)
            }
            if (pageData.scheduleInfo) console.log(`   [Glovo] Schedule: ${pageData.scheduleInfo}`)

            return data

        } catch (error) {
            console.error(`   [Glovo] Error checking ${restaurant.name}:`, error.message)

            const fallbackCheck = {
                restaurant_id: restaurant.id,
                platform: this.platform,
                checked_at: new Date().toISOString(),
                ui_is_open: false,
                ui_can_order: false,
                ui_is_greyed: true,
                ui_error_message: 'Nelistat pe Glovo',
                final_status: 'unavailable',
                raw_data: { error: error.message, url: restaurant.glovo_url }
            }

            try {
                await supabase.from('monitoring_checks').insert(fallbackCheck)
            } catch (_) {}

            return fallbackCheck
        } finally {
            if (this.browser) {
                try {
                    await this.browser.close()
                } catch (_) {}
                this.browser = null
            }
        }
    }

    /**
     * Save rating to history, tracking changes over time
     */
    async _saveRatingHistory(restaurant, currentRating) {
        try {
            // Get previous rating
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
                change_direction: changeDirection,
                recorded_at: new Date().toISOString()
            })
        } catch (err) {
            // Non-critical, just log
            console.error('   [Glovo] Error saving rating history:', err.message)
        }
    }
}
