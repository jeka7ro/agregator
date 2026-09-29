import { supabase } from './supabase.js'

export class SalesSync {

    constructor() {
        this.progress = {
            isSyncing: false,
            total: 0,
            current: 0,
            message: '',
            percent: 0
        };
    }

    async syncSales(daysBack = 30) {
        if (this.progress.isSyncing) return { success: false, error: "Already syncing" };

        this.progress.isSyncing = true;
        this.progress.current = 0;
        this.progress.total = 0;
        this.progress.percent = 0;
        this.progress.message = `Inițializare verificare pentru ultimele ${daysBack} zile...`;

        console.log(`[SalesSync] Starting sales sync for last ${daysBack} days...`)
        
        try {
            const { data: restaurants, error: fetchErr } = await supabase
                .from('restaurants')
                .select('*, brands(name)')
                .eq('is_active', true)
            
            if (fetchErr) {
                console.error('[SalesSync] Failed to fetch restaurants:', fetchErr)
                throw new Error(fetchErr.message)
            }

            const formatIikoDate = (d) => {
                return d.getFullYear() + '-' + 
                    String(d.getMonth()+1).padStart(2,'0') + '-' + 
                    String(d.getDate()).padStart(2,'0') + ' ' +
                    String(d.getHours()).padStart(2,'0') + ':' +
                    String(d.getMinutes()).padStart(2,'0') + ':' +
                    String(d.getSeconds()).padStart(2,'0') + '.000'
            }

            let totalUpserted = 0

            // Authenticate keys once
            const tokens = {}
            const apiKeys = ['a1fe30cdeb934aa0af01b6a35244b7f0', '124d0880f4b44717b69ee21d45fc2656', '56597d13165c49c49c10e351b5eac617', '78a2206d3b9c4e93b9b5a5ee774f69aa']
            for (const k of apiKeys) {
                try {
                    const resAuth = await fetch('https://api-eu.syrve.live/api/1/access_token', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ apiLogin: k })
                    })
                    if (resAuth.ok) tokens[k] = (await resAuth.json()).token
                } catch(e) {}
            }

            // Fetch nomenclature for each unique organization to build a product -> topLevelCategory map
            const orgProductCategoryMap = {}; // orgId -> { productId -> categoryName }
            
            for (const r of restaurants) {
                const orgId = r.iiko_restaurant_id || r.iiko_config?.organizationId || r.iiko_config?.organization_id;
                const apiKey = r.iiko_config?.api_login || 'a1fe30cdeb934aa0af01b6a35244b7f0';
                const token = tokens[apiKey];
                
                if (orgId && token && !orgProductCategoryMap[orgId]) {
                    try {
                        const nRes = await fetch('https://api-eu.syrve.live/api/1/nomenclature', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ organizationId: orgId })
                        });
                        if (nRes.ok) {
                            const nData = await nRes.json();
                            const groups = nData.groups || [];
                            const products = nData.products || [];
                            
                            // Build group hierarchy map
                            const groupMap = {};
                            for (const g of groups) groupMap[g.id] = g;
                            
                            const getTopLevelGroup = (groupId) => {
                                let curr = groupMap[groupId];
                                while (curr && curr.parentGroup) {
                                    curr = groupMap[curr.parentGroup];
                                }
                                return curr ? curr.name : '';
                            };
                            
                            const productMap = {};
                            for (const p of products) {
                                productMap[p.id] = getTopLevelGroup(p.parentGroup);
                            }
                            orgProductCategoryMap[orgId] = productMap;
                        }
                    } catch(e) { console.error("Error fetching nomenclature for org", orgId, e.message); }
                }
            }

            // Calculate total iterations
            let validRests = 0;
            for (const r of restaurants) {
                const orgId = r.iiko_restaurant_id || r.iiko_config?.organization_id
                if (orgId) validRests++;
            }
            // we chunk by 1 day at a time
            this.progress.total = validRests * daysBack;

            for (const r of restaurants) {
                const orgId = r.iiko_restaurant_id || r.iiko_config?.organizationId || r.iiko_config?.organization_id
                if (!orgId) continue
                
                let apiKey = r.iiko_config?.api_login || 'a1fe30cdeb934aa0af01b6a35244b7f0'
                const filterCategories = r.iiko_config?.categories || null;

                const token = tokens[apiKey]
                if (!token) {
                    this.progress.current += daysBack; // skip silently
                    continue;
                }

                let currentDaysBack = daysBack;
                while (currentDaysBack > 0) {
                    let chunkDays = Math.min(currentDaysBack, 1);
                    
                    const toDate = new Date()
                    toDate.setDate(toDate.getDate() - (daysBack - currentDaysBack))
                    toDate.setHours(23, 59, 59, 999)

                    const fromDate = new Date(toDate)
                    fromDate.setDate(fromDate.getDate() - chunkDays + 1)
                    fromDate.setHours(0, 0, 0, 0)

                    currentDaysBack -= chunkDays;

                    // Update UI 
                    const simpleDate = fromDate.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    this.progress.message = `[${r.name}] ⏳ Se trage ziua ${simpleDate} ...`;
                    this.progress.percent = Math.floor((this.progress.current / (this.progress.total || 1)) * 100);

                    const deliveryDateFrom = formatIikoDate(fromDate)
                    const deliveryDateTo = formatIikoDate(toDate)

                    try {
                        const reqBody = {
                            organizationIds: [orgId],
                            deliveryDateFrom,
                            deliveryDateTo,
                            statuses: ["Closed"]
                        }
                        
                        let res;
                        let retries = 3;
                        let fatalError = false;
                        while(retries > 0) {
                            res = await fetch(`https://api-eu.syrve.live/api/1/deliveries/by_delivery_date_and_status`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                body: JSON.stringify(reqBody)
                            });
                            if (res.ok) break;
                            const errTxt = await res.text().catch(() => 'no text');
                            if (res.status === 403 || res.status === 400 || errTxt.includes('ORGANIZATION_DENIED')) {
                                console.log(`[Sync] FATAL Iiko API Error (HTTP ${res.status}): ${errTxt} | Skipping restaurant entirely.`);
                                fatalError = true;
                                break;
                            }
                            console.log(`[Sync] Rate limited or error from iiko (HTTP ${res.status}): ${errTxt} | Retrying in 5s...`);
                            await new Promise(r => setTimeout(r, 6000));
                            retries--;
                        }
                        
                        if (fatalError) {
                            break; // break the 'while (currentDaysBack > 0)' loop for this restaurant
                        }

                        if (!res || !res.ok) {
                            console.error('[Sync] Abandoning chunk after 3 failed retries.');
                            continue; // skip this day, but try next day
                        }
                        
                        // Safety delay between successful requests to prevent future rate limits
                        await new Promise(r => setTimeout(r, 800));

                        const resData = await res.json()
                        const orgOrdersArray = resData.ordersByOrganizations || []

                        for (const orgOrders of orgOrdersArray) {
                            const orders = orgOrders.orders || []
                            if (orders.length === 0) continue

                            const dbRows = []
                            for (const o of orders) {
                                if (!o.order) continue

                                const rawSource = o.order.sourceKey || ''
                                let platform = rawSource.trim()
                                if (!platform) platform = 'IN-STORE'
                                else if (platform.toLowerCase().includes('glovo')) platform = 'glovo'
                                else if (platform.toLowerCase().includes('wolt')) platform = 'wolt'
                                else if (platform.toLowerCase().includes('bolt')) platform = 'bolt'

                                const total_amount = o.order.sum || 0
                                
                                let placed_at = null
                                try {
                                    let ds = o.order.whenClosed || o.order.whenCreated
                                    if (ds) placed_at = new Date(ds.replace(' ', 'T')).toISOString()
                                } catch(e) {}
                                if (!placed_at) placed_at = new Date().toISOString()
                                    
                                const baseId = o.order.id || o.id
                                const uniqueOrderId = baseId + '_' + r.id

                                const items = []
                                let orderSum = 0

                                if (o.order.items) {
                                    for (const it of o.order.items) {
                                        if (it.type === 'Product' && it.product) {
                                            const pName = (it.product.name || '').toLowerCase()
                                            const productId = it.product.id;
                                            
                                            // Get top level category for this product
                                            const prodCategory = (orgProductCategoryMap[orgId]?.[productId] || '').toUpperCase();
                                            
                                            // Filter by Virtual Brand category if a filter is configured
                                            if (filterCategories && filterCategories.length > 0) {
                                                const matchesCategory = filterCategories.some(c => prodCategory.includes(c.toUpperCase()));
                                                // Fallback: If category matching failed (e.g. missing nomenclature), string-match on name (last resort)
                                                const fallbackMatch = filterCategories.some(c => pName.includes(c.toLowerCase()));
                                                
                                                if (!matchesCategory && !fallbackMatch) {
                                                    continue; // Skip this product, it belongs to another Virtual Brand
                                                }
                                            }

                                            const itemSum = it.resultSum || it.price || 0
                                            orderSum += itemSum

                                            items.push({
                                                product_name: it.product.name,
                                                price: it.price,
                                                amount: it.amount,
                                                resultSum: it.resultSum,
                                                sum: itemSum,
                                                quantity: it.amount || 1
                                            })
                                        }
                                    }
                                }

                                if (items.length === 0) continue

                                dbRows.push({
                                    restaurant_id: r.id,
                                    order_id: uniqueOrderId,
                                    platform: platform,
                                    total_amount: orderSum,
                                    placed_at: placed_at,
                                    items: items
                                })
                            }

                            // Deduplicate before upsert
                            const uniqueRowsMap = new Map()
                            for (const row of dbRows) {
                                uniqueRowsMap.set(row.order_id, row)
                            }
                            const uniqueDbRows = Array.from(uniqueRowsMap.values())

                            if (uniqueDbRows.length > 0) {
                                const { error: insErr } = await supabase
                                    .from('platform_sales')
                                    .upsert(uniqueDbRows, { onConflict: 'order_id' })
                                
                                if (!insErr) {
                                    totalUpserted += uniqueDbRows.length
                                } else {
                                    console.error('[Sync] Upsert error:', insErr)
                                }
                            }
                        }
                    } catch (err) {
                        // ignore and proceed to not break the whole chain
                    }

                    this.progress.current += chunkDays;
                    this.progress.percent = Math.floor((this.progress.current / (this.progress.total || 1)) * 100);
                }
            }

            console.log(`[SalesSync] Completed! Total orders synced: ${totalUpserted}`)
            this.progress.message = `Sincronizare finalizată! ${totalUpserted} comenzi procesate istorice.`;
            return { success: true, count: totalUpserted }
        } catch (e) {
            this.progress.message = `Eroare proces: ${e.message}`;
            return { success: false, error: e.message }
        } finally {
            // Keep isSyncing true for 2 more seconds so UI sees 100% completion
            setTimeout(() => {
                this.progress.isSyncing = false;
            }, 3000);
        }
    }
}

export const salesSync = new SalesSync()
