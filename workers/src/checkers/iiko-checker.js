import { supabase } from '../services/supabase.js'
import { IikoClient } from '../services/iiko-client.js'

export class IikoChecker {
    constructor() {
        this.platform = 'iiko'
    }

    async check(restaurant) {
        console.log(`🔍 Checking ${restaurant.name} on ${this.platform}...`)

        const client = new IikoClient(restaurant)
        
        if (!client.isConfigured()) {
            console.log(`⚠️  No iiko configuration for ${restaurant.name}`)
            return null
        }

        try {
            const startTime = Date.now()
            
            // Verificăm dacă ne putem autentifica la iiko
            const isAuthenticated = await client.authenticate()
            let activeProductsCount = 0
            let missingProducts = []

            if (isAuthenticated) {
                try {
                    const products = await client.getProducts()
                    missingProducts = await client.getStopList()
                    activeProductsCount = products.length - missingProducts.length
                } catch (e) {
                    console.error(`   [iiko] Could not fetch products/stoplist for ${restaurant.name}:`, e.message)
                }
            }
            
            const responseTime = Date.now() - startTime

            console.log(`${isAuthenticated ? '✅' : '❌'} ${restaurant.name} - ${this.platform} (${responseTime}ms)`)

            const checkData = {
                restaurant_id: restaurant.id,
                platform: this.platform,
                checked_at: new Date().toISOString(),
                ui_is_open: isAuthenticated,
                ui_can_order: isAuthenticated,
                ui_is_greyed: !isAuthenticated,
                backend_is_open: isAuthenticated,
                backend_status: isAuthenticated ? 'online' : 'offline',
                final_status: isAuthenticated ? 'available' : 'error',
                missing_products: missingProducts,
                raw_data: {
                    response_time_ms: responseTime,
                    api_url: client.apiUrl,
                    is_configured: true,
                    active_products_count: activeProductsCount
                }
            }

            const { data, error } = await supabase
                .from('monitoring_checks')
                .insert(checkData)
                .select()
                .single()

            if (error) {
                console.error('❌ Error saving iiko check:', error)
                return checkData // Return anyway so UI updates!
            }

            console.log('💾 iiko check saved to database')
            return data

        } catch (error) {
            console.error(`❌ Error checking iiko for ${restaurant.name}:`, error.message)

            const errorCheckData = {
                restaurant_id: restaurant.id,
                platform: this.platform,
                checked_at: new Date().toISOString(),
                ui_is_open: false,
                ui_can_order: false,
                final_status: 'error',
                raw_data: {
                    error: error.message
                }
            }

            const { data, error: err2 } = await supabase
                .from('monitoring_checks')
                .insert(errorCheckData)
                .select()
                .single()

            if (err2) {
                console.error(`   [iiko] Error saving check (ignored for local UI):`, err2.message)
                return errorCheckData
            }

            return data
        }
    }
}
