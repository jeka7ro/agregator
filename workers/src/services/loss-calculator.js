import { supabase } from './supabase.js'

/**
 * Loss Calculator
 * 
 * Estimates financial impact of:
 * - Restaurant STOP events (full downtime)
 * - Partial stops (product/category unavailability)
 * - Delivery radius reductions
 * 
 * Calculation methods:
 * 1. Simple: revenue_per_hour × duration_hours
 * 2. Proportional: for partial stops, weighted by % of menu affected
 * 3. Area-based: for radius reductions, proportional to area lost
 * 4. Historical: based on actual past sales data (when available)
 */
export class LossCalculator {

    /**
     * Calculate loss for a full restaurant stop event
     * @param {Object} restaurant - restaurant record (needs revenue_per_hour)
     * @param {Object} stopEvent - { stopped_at, resumed_at, platform }
     * @returns {Object} - { estimatedLoss, method, details }
     */
    calculateStopLoss(restaurant, stopEvent) {
        const revenuePerHour = restaurant.revenue_per_hour || 100.00
        const stoppedAt = new Date(stopEvent.stopped_at)
        const resumedAt = stopEvent.resumed_at ? new Date(stopEvent.resumed_at) : new Date()
        const durationMinutes = (resumedAt - stoppedAt) / (1000 * 60)
        const durationHours = durationMinutes / 60

        const estimatedLoss = revenuePerHour * durationHours

        return {
            estimatedLoss: parseFloat(estimatedLoss.toFixed(2)),
            method: 'revenue_per_hour',
            currency: 'RON',
            details: {
                revenue_per_hour: revenuePerHour,
                duration_minutes: Math.round(durationMinutes),
                duration_hours: parseFloat(durationHours.toFixed(2)),
                platform: stopEvent.platform,
                stopped_at: stopEvent.stopped_at,
                resumed_at: stopEvent.resumed_at || 'ongoing'
            }
        }
    }

    /**
     * Calculate loss for partial stop (some products/categories unavailable)
     * @param {Object} restaurant - restaurant record
     * @param {number} stoppedPercent - percentage of menu stopped (0-100)
     * @param {number} durationMinutes - duration in minutes
     * @returns {Object} - { estimatedLoss, method, details }
     */
    calculatePartialStopLoss(restaurant, stoppedPercent, durationMinutes) {
        const revenuePerHour = restaurant.revenue_per_hour || 100.00
        const durationHours = durationMinutes / 60
        const impactFactor = stoppedPercent / 100

        // Partial loss: proportional to menu percentage affected
        const estimatedLoss = revenuePerHour * durationHours * impactFactor

        return {
            estimatedLoss: parseFloat(estimatedLoss.toFixed(2)),
            method: 'proportional_menu',
            currency: 'RON',
            details: {
                revenue_per_hour: revenuePerHour,
                stopped_percent: stoppedPercent,
                impact_factor: impactFactor,
                duration_minutes: Math.round(durationMinutes),
                duration_hours: parseFloat(durationHours.toFixed(2))
            }
        }
    }

    /**
     * Calculate loss from delivery radius reduction
     * Uses area-based calculation: lost_area / normal_area × revenue
     * 
     * @param {Object} restaurant - restaurant record (needs normal_radius_km, revenue_per_hour)
     * @param {number} currentRadius - current radius in km
     * @param {number} durationMinutes - duration of reduction
     * @returns {Object} - { estimatedLoss, method, details }
     */
    calculateRadiusLoss(restaurant, currentRadius, durationMinutes) {
        const normalRadius = restaurant.normal_radius_km || 5.0
        const revenuePerHour = restaurant.revenue_per_hour || 100.00
        const durationHours = durationMinutes / 60

        // Area calculation: π × r²
        const normalArea = Math.PI * normalRadius * normalRadius
        const currentArea = Math.PI * currentRadius * currentRadius
        const lostArea = normalArea - currentArea
        const lostPercent = (lostArea / normalArea) * 100

        // Loss proportional to area lost
        const estimatedLoss = revenuePerHour * durationHours * (lostArea / normalArea)

        return {
            estimatedLoss: Math.max(0, parseFloat(estimatedLoss.toFixed(2))),
            method: 'area_proportional',
            currency: 'RON',
            details: {
                normal_radius_km: normalRadius,
                current_radius_km: currentRadius,
                normal_area_km2: parseFloat(normalArea.toFixed(2)),
                current_area_km2: parseFloat(currentArea.toFixed(2)),
                lost_area_km2: parseFloat(lostArea.toFixed(2)),
                lost_percent: parseFloat(lostPercent.toFixed(1)),
                duration_minutes: Math.round(durationMinutes),
                revenue_per_hour: revenuePerHour
            }
        }
    }

    /**
     * Get aggregated loss summary for a restaurant over a period
     * @param {string} restaurantId - restaurant UUID
     * @param {string} startDate - ISO date string
     * @param {string} endDate - ISO date string
     * @returns {Object} - { totalLoss, byPlatform, byType, events }
     */
    async getLossSummary(restaurantId, startDate, endDate) {
        try {
            // Fetch restaurant for revenue_per_hour
            const { data: restaurant } = await supabase
                .from('restaurants')
                .select('*')
                .eq('id', restaurantId)
                .single()

            if (!restaurant) {
                return { totalLoss: 0, byPlatform: {}, byType: {}, events: [] }
            }

            // Fetch stop events in period
            const { data: stopEvents, error } = await supabase
                .from('stop_events')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .gte('stopped_at', startDate)
                .lte('stopped_at', endDate)
                .order('stopped_at', { ascending: false })

            if (error) {
                console.error('Error fetching stop events:', error)
                return { totalLoss: 0, byPlatform: {}, byType: {}, events: [] }
            }

            let totalLoss = 0
            const byPlatform = {}
            const byType = {}
            const events = []

            for (const event of (stopEvents || [])) {
                const loss = this.calculateStopLoss(restaurant, event)

                totalLoss += loss.estimatedLoss

                // By platform
                if (!byPlatform[event.platform]) {
                    byPlatform[event.platform] = { loss: 0, events: 0, totalMinutes: 0 }
                }
                byPlatform[event.platform].loss += loss.estimatedLoss
                byPlatform[event.platform].events += 1
                byPlatform[event.platform].totalMinutes += loss.details.duration_minutes

                // By type
                const stopType = event.stop_type || 'full'
                if (!byType[stopType]) {
                    byType[stopType] = { loss: 0, events: 0 }
                }
                byType[stopType].loss += loss.estimatedLoss
                byType[stopType].events += 1

                events.push({
                    ...event,
                    calculated_loss: loss
                })
            }

            // Also fetch radius reductions for loss calculation
            const { data: radiusData } = await supabase
                .from('radius_history')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .eq('change_type', 'decrease')
                .gte('recorded_at', startDate)
                .lte('recorded_at', endDate)

            let radiusLoss = 0
            if (radiusData?.length) {
                for (const entry of radiusData) {
                    // Estimate ~60 min per recorded decrease (until next check)
                    const loss = this.calculateRadiusLoss(restaurant, entry.radius_km, 60)
                    radiusLoss += loss.estimatedLoss
                }
            }

            return {
                totalLoss: parseFloat((totalLoss + radiusLoss).toFixed(2)),
                stopLoss: parseFloat(totalLoss.toFixed(2)),
                radiusLoss: parseFloat(radiusLoss.toFixed(2)),
                byPlatform,
                byType,
                events,
                period: { start: startDate, end: endDate },
                currency: 'RON'
            }
        } catch (err) {
            console.error('Error calculating loss summary:', err)
            return { totalLoss: 0, byPlatform: {}, byType: {}, events: [] }
        }
    }

    /**
     * Format loss amount for display
     */
    formatLoss(amount, currency = 'RON') {
        return `${amount.toFixed(2)} ${currency}`
    }

    /**
     * Format duration for display
     */
    formatDuration(minutes) {
        if (minutes < 60) {
            return `${Math.round(minutes)} min`
        }
        const hours = Math.floor(minutes / 60)
        const mins = Math.round(minutes % 60)
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
}
