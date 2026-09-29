import { supabase } from './supabase.js'

/**
 * Agreghează vânzările din platform_sales pe zile şi salvează în daily_sales_summary.
 * Se apelează automat după fiecare syncSales().
 *
 * @param {Date} fromDate  - ziua de start (se truncheaza la 00:00)
 * @param {Date} toDate    - ziua de final  (se truncheaza la 23:59)
 */
export async function aggregateDailySummary(fromDate, toDate) {
    const from = new Date(fromDate)
    from.setHours(0, 0, 0, 0)
    const to = new Date(toDate)
    to.setHours(23, 59, 59, 999)

    console.log(`[DailyAgg] Agregare ${from.toLocaleDateString('ro-RO')} → ${to.toLocaleDateString('ro-RO')}...`)

    try {
        // Citim toate comenzile din fereastra de timp în batch-uri de 5000
        const allRows = []
        let offset = 0
        const CHUNK = 5000
        while (true) {
            const { data, error } = await supabase
                .from('platform_sales')
                .select('placed_at, total_amount, platform, restaurant_id')
                .gte('placed_at', from.toISOString())
                .lte('placed_at', to.toISOString())
                .range(offset, offset + CHUNK - 1)

            if (error) {
                console.error('[DailyAgg] Eroare fetch:', error.message)
                break
            }
            if (!data || data.length === 0) break
            allRows.push(...data)
            if (data.length < CHUNK) break
            offset += CHUNK
        }

        if (allRows.length === 0) {
            console.log('[DailyAgg] Nicio comandă de agregat în fereastra dată.')
            return { success: true, upserted: 0 }
        }

        console.log(`[DailyAgg] ${allRows.length} comenzi citite. Calculăm...`)

        // Grupare: sale_date + restaurant_id + platform
        const map = {}
        for (const row of allRows) {
            const d = new Date(row.placed_at)
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const platform = (row.platform || 'unknown').toLowerCase().trim()
            const restId = row.restaurant_id || 'unknown'
            const key = `${dateStr}|${restId}|${platform}`

            if (!map[key]) {
                map[key] = {
                    sale_date: dateStr,
                    restaurant_id: restId === 'unknown' ? null : restId,
                    platform,
                    total_revenue: 0,
                    total_orders: 0
                }
            }
            map[key].total_revenue += parseFloat(row.total_amount) || 0
            map[key].total_orders += 1
        }

        const rows = Object.values(map).map(r => ({
            ...r,
            total_revenue: Math.round(r.total_revenue * 100) / 100,
            updated_at: new Date().toISOString()
        }))

        // Upsert în batch-uri de 500
        const BATCH = 500
        let upserted = 0
        for (let i = 0; i < rows.length; i += BATCH) {
            const batch = rows.slice(i, i + BATCH)
            const { error } = await supabase
                .from('daily_sales_summary')
                .upsert(batch, { onConflict: 'sale_date,restaurant_id,platform' })
            if (error) {
                console.error('[DailyAgg] Eroare upsert:', error.message)
            } else {
                upserted += batch.length
            }
        }

        console.log(`[DailyAgg] ✅ ${upserted} rânduri salvate în daily_sales_summary.`)
        return { success: true, upserted }

    } catch (err) {
        console.error('[DailyAgg] Eroare critică:', err.message)
        return { success: false, error: err.message }
    }
}
