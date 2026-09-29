/**
 * Retry utility with exponential backoff
 * Used by checkers to retry failed scraping attempts
 */

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - async function to retry
 * @param {Object} options - retry options
 * @param {number} options.maxRetries - maximum number of retries (default: 3)
 * @param {number} options.baseDelay - base delay in ms (default: 1000)
 * @param {number} options.maxDelay - maximum delay in ms (default: 30000)
 * @param {string} options.label - label for logging
 * @returns {Promise<any>} - result of the function
 */
export async function retryWithBackoff(fn, options = {}) {
    const {
        maxRetries = 3,
        baseDelay = 1000,
        maxDelay = 30000,
        label = 'operation'
    } = options

    let lastError = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error

            if (attempt === maxRetries) {
                console.error(`❌ ${label}: All ${maxRetries + 1} attempts failed. Last error: ${error.message}`)
                throw error
            }

            // Exponential backoff with jitter
            const delay = Math.min(
                baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
                maxDelay
            )

            console.warn(`⚠️  ${label}: Attempt ${attempt + 1} failed (${error.message}). Retrying in ${Math.round(delay)}ms...`)
            await new Promise(resolve => setTimeout(resolve, delay))
        }
    }

    throw lastError
}

/**
 * Simple rate limiter
 * Ensures minimum delay between calls
 */
export class RateLimiter {
    constructor(minDelayMs = 2000) {
        this.minDelay = minDelayMs
        this.lastCallTime = 0
    }

    async wait() {
        const now = Date.now()
        const elapsed = now - this.lastCallTime
        const waitTime = Math.max(0, this.minDelay - elapsed)

        if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime))
        }

        this.lastCallTime = Date.now()
    }
}

// Platform-specific rate limiters (shared across checkers)
export const platformRateLimiters = {
    glovo: new RateLimiter(3000),  // 3 seconds between Glovo checks
    wolt: new RateLimiter(2000),   // 2 seconds between Wolt checks
    bolt: new RateLimiter(2000)    // 2 seconds between Bolt checks
}
