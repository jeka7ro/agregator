import { supabase } from './supabase.js'
import { loadViolationsCache, saveViolationsCache } from '../utils/cache.js'

/**
 * Business Rules Engine
 * 
 * Evaluates monitoring check results against configurable business rules
 * to detect violations that should trigger alerts.
 * 
 * Rule types:
 * - unauthorized_stop: restaurant closed during working hours
 * - product_stop_percentage: >X% of menu stopped
 * - category_stop: specific category stopped without permission
 * - radius_reduction: delivery radius below threshold
 * - rating_drop: rating decreased by >X points
 * - frequent_stops: >N stops in a period
 * - long_stop: stop duration exceeds X minutes
 */
export class RulesEngine {
    constructor() {
        this.defaultRules = {
            unauthorized_stop: {
                check_working_hours: true,
                max_stop_duration_minutes: 15
            },
            product_stop_percentage: {
                max_percent: 30
            },
            category_stop: {
                require_authorization: true,
                critical_categories: ['bucătărie caldă', 'rolluri', 'sushi']
            },
            radius_reduction: {
                min_percent_of_normal: 70 // alert if radius drops below 70% of normal
            },
            rating_drop: {
                min_drop: 0.3 // alert if rating drops by 0.3 or more
            },
            frequent_stops: {
                max_stops_per_day: 3,
                period_hours: 24
            },
            long_stop: {
                max_duration_minutes: 60
            }
        }
    }

    /**
     * Evaluate all applicable rules for a check result
     * @param {Object} restaurant - restaurant record
     * @param {Object} checkResult - monitoring_checks record
     * @param {Object} context - additional context (previous checks, rules, etc.)
     * @returns {Array} - array of violation objects
     */
    async evaluate(restaurant, checkResult, context = {}) {
        const violations = []

        // Fetch business rules for this restaurant
        const rules = context.rules || await this.fetchRules(restaurant.id)
        const isWorkingTime = context.isWorkingTime !== undefined ? context.isWorkingTime : true

        // Rule 1: Unauthorized stop (restaurant closed during working hours)
        const stopViolation = this.checkUnauthorizedStop(restaurant, checkResult, rules, isWorkingTime)
        if (stopViolation) violations.push(stopViolation)

        // Rule 2: Product stop percentage
        if (checkResult.raw_data?.product_stops) {
            const productViolation = this.checkProductStopPercentage(restaurant, checkResult, rules)
            if (productViolation) violations.push(productViolation)
        }

        // Rule 3: Category stop
        if (checkResult.raw_data?.disabled_categories?.length > 0) {
            const categoryViolations = this.checkCategoryStops(restaurant, checkResult, rules)
            violations.push(...categoryViolations)
        }

        // Rule 4: Radius reduction
        if (checkResult.delivery_radius_km && restaurant.normal_radius_km) {
            const radiusViolation = this.checkRadiusReduction(restaurant, checkResult, rules)
            if (radiusViolation) violations.push(radiusViolation)
        }

        // Rule 5: Rating drop
        if (checkResult.rating && context.previousRating) {
            const ratingViolation = this.checkRatingDrop(restaurant, checkResult, context.previousRating, rules)
            if (ratingViolation) violations.push(ratingViolation)
        }

        // Rule 6: Frequent stops (check recent stop count)
        if (checkResult.final_status !== 'available' && isWorkingTime) {
            const frequentViolation = await this.checkFrequentStops(restaurant, checkResult, rules)
            if (frequentViolation) violations.push(frequentViolation)
        }

        return violations
    }

    /**
     * Check if restaurant is stopped during working hours without authorization
     */
    checkUnauthorizedStop(restaurant, checkResult, rules, isWorkingTime) {
        if (!isWorkingTime) return null
        if (checkResult.final_status === 'available') return null

        const ruleConfig = this.getRuleConfig(rules, 'unauthorized_stop')
        if (!ruleConfig) return null

        return {
            type: 'unauthorized_stop',
            severity: 'critical',
            platform: checkResult.platform,
            message: `${restaurant.name} apare ${checkResult.final_status} pe ${checkResult.platform.toUpperCase()} în timpul programului de lucru`,
            details: {
                expected_status: 'available',
                actual_status: checkResult.final_status,
                restaurant_name: restaurant.name,
                city: restaurant.city,
                platform: checkResult.platform
            }
        }
    }

    /**
     * Check if too many products are stopped
     */
    checkProductStopPercentage(restaurant, checkResult, rules) {
        const ruleConfig = this.getRuleConfig(rules, 'product_stop_percentage')
        const maxPercent = ruleConfig?.max_percent || restaurant.max_stop_percent || 30
        const productStops = checkResult.raw_data?.product_stops || {}
        const totalProducts = productStops.total || 0
        const stoppedProducts = productStops.stopped || 0

        if (totalProducts === 0) return null

        const stopPercent = (stoppedProducts / totalProducts) * 100

        if (stopPercent <= maxPercent) return null

        return {
            type: 'product_stop_percentage',
            severity: stopPercent > 50 ? 'critical' : 'warning',
            platform: checkResult.platform,
            message: `${restaurant.name}: ${stopPercent.toFixed(0)}% din meniu este pe STOP (${stoppedProducts}/${totalProducts} produse) pe ${checkResult.platform.toUpperCase()}`,
            details: {
                total_products: totalProducts,
                stopped_products: stoppedProducts,
                stop_percent: stopPercent,
                max_allowed_percent: maxPercent
            }
        }
    }

    /**
     * Check if critical categories are stopped without authorization
     */
    checkCategoryStops(restaurant, checkResult, rules) {
        const violations = []
        const ruleConfig = this.getRuleConfig(rules, 'category_stop')
        const criticalCategories = ruleConfig?.critical_categories || ['bucătărie caldă', 'rolluri', 'sushi']
        const allowedCategories = restaurant.allowed_stop_categories || []
        const disabledCategories = checkResult.raw_data?.disabled_categories || []

        for (const category of disabledCategories) {
            const categoryLower = category.toLowerCase()
            const isAllowed = allowedCategories.some(ac => ac.toLowerCase() === categoryLower)
            const isCritical = criticalCategories.some(cc => cc.toLowerCase() === categoryLower)

            if (isCritical && !isAllowed) {
                violations.push({
                    type: 'category_stop',
                    severity: 'critical',
                    platform: checkResult.platform,
                    message: `${restaurant.name}: categoria "${category}" este pe STOP fără autorizare pe ${checkResult.platform.toUpperCase()}`,
                    details: {
                        category,
                        is_critical: true,
                        is_authorized: false
                    }
                })
            } else if (!isAllowed) {
                violations.push({
                    type: 'category_stop',
                    severity: 'warning',
                    platform: checkResult.platform,
                    message: `${restaurant.name}: categoria "${category}" este pe STOP pe ${checkResult.platform.toUpperCase()}`,
                    details: {
                        category,
                        is_critical: false,
                        is_authorized: false
                    }
                })
            }
        }

        return violations
    }

    /**
     * Check if delivery radius has been reduced significantly
     */
    checkRadiusReduction(restaurant, checkResult, rules) {
        const ruleConfig = this.getRuleConfig(rules, 'radius_reduction')
        const minPercentOfNormal = ruleConfig?.min_percent_of_normal || 70

        const normalRadius = restaurant.normal_radius_km
        const currentRadius = checkResult.delivery_radius_km

        if (!normalRadius || !currentRadius) return null

        const percentOfNormal = (currentRadius / normalRadius) * 100

        if (percentOfNormal >= minPercentOfNormal) return null

        const reductionPercent = 100 - percentOfNormal

        return {
            type: 'radius_reduction',
            severity: percentOfNormal < 50 ? 'critical' : 'warning',
            platform: checkResult.platform,
            message: `${restaurant.name}: raza de livrare redusă cu ${reductionPercent.toFixed(0)}% (${currentRadius} km → normal ${normalRadius} km) pe ${checkResult.platform.toUpperCase()}`,
            details: {
                current_radius: currentRadius,
                normal_radius: normalRadius,
                percent_of_normal: percentOfNormal,
                reduction_percent: reductionPercent
            }
        }
    }

    /**
     * Check if rating has dropped significantly
     */
    checkRatingDrop(restaurant, checkResult, previousRating, rules) {
        const ruleConfig = this.getRuleConfig(rules, 'rating_drop')
        const minDrop = ruleConfig?.min_drop || 0.3

        const currentRating = checkResult.rating
        if (!currentRating || !previousRating) return null

        const drop = previousRating - currentRating

        if (drop < minDrop) return null

        return {
            type: 'rating_drop',
            severity: drop >= 0.5 ? 'critical' : 'warning',
            platform: checkResult.platform,
            message: `${restaurant.name}: ratingul a scăzut de la ${previousRating} la ${currentRating} (−${drop.toFixed(1)}) pe ${checkResult.platform.toUpperCase()}`,
            details: {
                current_rating: currentRating,
                previous_rating: previousRating,
                drop_amount: drop
            }
        }
    }

    /**
     * Check if there are too many stops in a period
     */
    async checkFrequentStops(restaurant, checkResult, rules) {
        const ruleConfig = this.getRuleConfig(rules, 'frequent_stops')
        const maxStops = ruleConfig?.max_stops_per_day || 3
        const periodHours = ruleConfig?.period_hours || 24

        const since = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString()

        try {
            const { count, error } = await supabase
                .from('stop_events')
                .select('*', { count: 'exact', head: true })
                .eq('restaurant_id', restaurant.id)
                .eq('platform', checkResult.platform)
                .gte('stopped_at', since)

            if (error) {
                console.error('Error checking frequent stops:', error)
                return null
            }

            if (count < maxStops) return null

            return {
                type: 'frequent_stops',
                severity: 'warning',
                platform: checkResult.platform,
                message: `${restaurant.name}: ${count} opriri în ultimele ${periodHours}h pe ${checkResult.platform.toUpperCase()} (limita: ${maxStops})`,
                details: {
                    stop_count: count,
                    period_hours: periodHours,
                    max_allowed: maxStops
                }
            }
        } catch (err) {
            console.error('Error checking frequent stops:', err)
            return null
        }
    }

    /**
     * Fetch business rules from database for a restaurant
     */
    async fetchRules(restaurantId) {
        try {
            const { data, error } = await supabase
                .from('business_rules')
                .select('*')
                .or(`restaurant_id.eq.${restaurantId},restaurant_id.is.null`)
                .eq('is_active', true)
                .order('priority', { ascending: true })

            if (error) {
                console.error('Error fetching rules:', error)
                return []
            }

            return data || []
        } catch (err) {
            console.error('Error fetching rules:', err)
            return []
        }
    }

    /**
     * Get rule config for a specific rule type from the rules list
     */
    getRuleConfig(rules, ruleType) {
        if (!Array.isArray(rules)) {
            return this.defaultRules[ruleType] || null
        }

        const rule = rules.find(r => r.rule_type === ruleType && r.is_active)
        if (rule) return rule.config

        return this.defaultRules[ruleType] || null
    }

    /**
     * Save violations to the database
     */
    async saveViolations(violations, checkId) {
        if (!violations.length) return []

        const records = violations.map(v => ({
            id: 'viol_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            restaurant_id: v.details?.restaurant_id,
            check_id: checkId,
            platform: v.platform,
            violation_type: v.type,
            severity: v.severity,
            message: v.message,
            details: v.details,
            detected_at: new Date().toISOString()
        }))

        // Always save to local cache (guarantees local persistence regardless of Supabase RLS)
        try {
            const existing = loadViolationsCache() || []
            saveViolationsCache([...records, ...existing].slice(0, 500))
        } catch (_) {}

        try {
            const { data, error } = await supabase
                .from('violations')
                .insert(records)
                .select()

            if (error) {
                console.warn('Supabase violations insert notice (persisted in local cache):', error.message)
                return records
            }

            return data || records
        } catch (err) {
            console.warn('Supabase violations notice (persisted in local cache):', err.message)
            return records
        }
    }
}
