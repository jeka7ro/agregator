import { supabase } from '../services/supabase.js'

/**
 * Simple Checker - Faza 2
 * 
 * Acest checker SIMPLU verifică doar dacă URL-ul răspunde.
 * NU folosește Puppeteer încă - doar fetch simplu.
 * 
 * Scopul: să testăm că totul funcționează (Supabase, salvare date, etc)
 */
export class SimpleChecker {
    constructor(platform) {
        this.platform = platform
    }

    /**
     * Verifică un restaurant
     * @param {Object} restaurant - Restaurant object din Supabase
     * @returns {Object} Check result
     */
    async check(restaurant) {
        console.log(`🔍 Checking ${restaurant.name} on ${this.platform}...`)

        const url = this.getRestaurantUrl(restaurant)

        if (!url) {
            console.log(`⚠️  No ${this.platform} URL configured for ${restaurant.name}`)
            return null
        }

        try {
            // Verificare simplă - doar dacă URL-ul răspunde
            const startTime = Date.now()
            const response = await fetch(url, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            })
            const responseTime = Date.now() - startTime

            const isAvailable = response.ok

            console.log(`${isAvailable ? '✅' : '❌'} ${restaurant.name} - ${this.platform} - ${response.status} (${responseTime}ms)`)

            // Salvăm check-ul în Supabase
            const checkData = {
                restaurant_id: restaurant.id,
                platform: this.platform,
                checked_at: new Date().toISOString(),

                // UI Status (simplificat pentru început)
                ui_is_open: isAvailable,
                ui_can_order: isAvailable,
                ui_is_greyed: !isAvailable,

                // Backend status (vom completa mai târziu cu Puppeteer)
                backend_is_open: null,
                backend_status: null,

                // Final status
                final_status: isAvailable ? 'available' : 'error',

                // Raw data
                raw_data: {
                    http_status: response.status,
                    response_time_ms: responseTime,
                    url: url
                }
            }

            const { data, error } = await supabase
                .from('monitoring_checks')
                .insert(checkData)
                .select()
                .single()

            if (error) {
                console.error('❌ Error saving check:', error)
                throw error
            }

            console.log('💾 Check saved to database')
            return data

        } catch (error) {
            console.error(`❌ Error checking ${restaurant.name}:`, error.message)

            // Salvăm și erorile
            const errorCheckData = {
                restaurant_id: restaurant.id,
                platform: this.platform,
                checked_at: new Date().toISOString(),
                ui_is_open: false,
                ui_can_order: false,
                final_status: 'error',
                raw_data: {
                    error: error.message,
                    url: url
                }
            }

            await supabase
                .from('monitoring_checks')
                .insert(errorCheckData)

            return null
        }
    }

    /**
     * Obține URL-ul platformei pentru restaurant
     */
    getRestaurantUrl(restaurant) {
        switch (this.platform) {
            case 'glovo':
                return restaurant.glovo_url
            case 'wolt':
                return restaurant.wolt_url
            case 'bolt':
                return restaurant.bolt_url
            default:
                return null
        }
    }
}
