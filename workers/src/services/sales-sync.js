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
            const apiKeys = [
                '93a34e75123e47b897e390f31ecfa4cb', // Main Sushi Master / Roll Master / Poki Woki (24 orgs)
                '124d0880f4b44717b69ee21d45fc2656', // Smash Me Cluj & Constanta
                '78a2206d3b9c4e93b9b5a5ee774f69aa'  // SM Brasov
            ];
            for (const r of restaurants) {
                const k = r.iiko_config?.api_login || r.iiko_config?.apiLogin;
                if (k && !apiKeys.includes(k)) apiKeys.push(k);
            }
            for (const k of apiKeys) {
                try {
                    const resAuth = await fetch('https://api-eu.syrve.live/api/1/access_token', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ apiLogin: k })
                    })
                    if (resAuth.ok) {
                        const json = await resAuth.json();
                        if (json.token) tokens[k] = json.token;
                    }
                } catch(e) {}
            }

            // Fetch nomenclature for each unique organization to build a product -> topLevelCategory map
            const orgProductCategoryMap = {}; // orgId -> { productId -> categoryName }
            
            for (const r of restaurants) {
                const orgId = r.iiko_restaurant_id || r.iiko_config?.organizationId || r.iiko_config?.organization_id;
                const apiKey = r.iiko_config?.api_login || '93a34e75123e47b897e390f31ecfa4cb';
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
                const orgId = r.iiko_restaurant_id || r.iiko_config?.organizationId || r.iiko_config?.organization_id;
                if (orgId) validRests++;
            }
            // we chunk by 1 day at a time
            this.progress.total = validRests * daysBack;

            for (const r of restaurants) {
                const orgId = r.iiko_restaurant_id || r.iiko_config?.organizationId || r.iiko_config?.organization_id;
                if (!orgId) continue;
                
                let apiKey = r.iiko_config?.api_login || r.iiko_config?.apiLogin || '93a34e75123e47b897e390f31ecfa4cb';
                const filterCategories = r.iiko_config?.categories || null;

                const token = tokens[apiKey];
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

                                const rawSource = (o.order.sourceKey || '').toLowerCase()
                                const orderTypeName = (o.order.orderType?.name || '').toLowerCase()
                                const operatorName = (o.order.operator?.name || '').toLowerCase()
                                const conceptionName = (o.order.conception?.name || '').toLowerCase()
                                const customerName = (o.order.customer?.name || '').toLowerCase()

                                const isKiosk = rawSource.includes('kiosk') ||
                                    orderTypeName.includes('kiosk') ||
                                    operatorName.includes('kiosk') ||
                                    conceptionName.includes('kiosk') ||
                                    customerName.includes('kiosk') ||
                                    (o.order.externalNumber && String(o.order.externalNumber).toLowerCase().startsWith('kiosk'))

                                let platform = 'casierie'
                                if (rawSource.includes('glovo')) platform = 'glovo'
                                else if (rawSource.includes('wolt')) platform = 'wolt'
                                else if (rawSource.includes('bolt')) platform = 'bolt'
                                else if (isKiosk) platform = 'kiosk'
                                else platform = 'casierie'

                                const total_amount = o.order.sum || 0
                                
                                let placed_at = null
                                try {
                                    let ds = o.order.whenCreated || o.order.whenClosed
                                    if (ds) placed_at = new Date(ds.replace(' ', 'T') + 'Z').toISOString()
                                } catch(e) {}
                                if (!placed_at) placed_at = new Date().toISOString()
                                    
                                const baseId = o.order.id || o.id
                                const uniqueOrderId = baseId + '_' + r.id

                                const rawCustName = [o.order.customer?.name, o.order.customer?.surname].filter(Boolean).join(' ').trim() || null
                                const custComment = o.order.customer?.comment || ''
                                const phoneFromComment = custComment.match(/Phone:\s*([^;]+)/i)?.[1]?.trim() || null
                                const pickUpCode = custComment.match(/Pick Up Code:\s*([^;]+)/i)?.[1]?.trim() || null
                                const extOrderId = custComment.match(/OrderId:\s*([^;]+)/i)?.[1]?.trim() || o.order.externalNumber || null
                                const courierPhoneFromComment = custComment.match(/Courier Phone:\s*([^;]+)/i)?.[1]?.trim() || null
                                const rawCourierFromComment = custComment.match(/Courier:\s*([^;]+)/i)?.[1]?.trim() || null
                                const cleanCourierFromComment = (rawCourierFromComment && !rawCourierFromComment.includes('IikoMiddleware')) ? rawCourierFromComment : null

                                const custPhone = o.order.phone || o.order.customer?.phone || phoneFromComment || null
                                const custAddress = o.order.deliveryPoint?.comment || o.order.deliveryPoint?.address?.line1 || o.order.deliveryPoint?.address?.street?.name || null
                                const rawCourierObj = o.order.courierInfo?.courier || null
                                const courierName = rawCourierObj?.name || cleanCourierFromComment || null
                                const courierPhone = rawCourierObj?.phone || courierPhoneFromComment || null

                                const extractedCourier = courierName ? {
                                    name: courierName,
                                    phone: courierPhone || '',
                                    company: platform === 'glovo' ? 'Glovo' : platform === 'wolt' ? 'Wolt' : platform === 'bolt' ? 'Bolt Food' : 'Livrator Propriu',
                                    isManual: Boolean(o.order.courierInfo?.isCourierSelectedManually)
                                } : null

                                const extractedCustomer = (rawCustName || custPhone || custAddress) ? {
                                    name: rawCustName || 'Client',
                                    phone: custPhone,
                                    address: custAddress,
                                    pickUpCode,
                                    externalOrderId: extOrderId
                                } : null

                                const extractedTimings = {
                                    whenCreated: o.order.whenCreated || null,
                                    whenConfirmed: o.order.whenConfirmed || null,
                                    whenPrinted: o.order.whenPrinted || null,
                                    whenCookingCompleted: o.order.whenCookingCompleted || null,
                                    whenSended: o.order.whenSended || null,
                                    whenDelivered: o.order.whenDelivered || null,
                                    whenClosed: o.order.whenClosed || null,
                                    completeBefore: o.order.completeBefore || null
                                }

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
                                            const rName = (r.name || '').toLowerCase();
                                            const isRollMaster = rName.includes('roll master');
                                            const isPokiWoki = rName.includes('poki woki');
                                            const isCrunch = rName.includes('crunch');
                                            const isSmashMe = rName.includes('smash me') && !isCrunch;

                                            let matchesCategory = false;

                                            if (isRollMaster) {
                                                if (prodCategory.includes('POKI') || prodCategory.includes('WOKI')) {
                                                    matchesCategory = false;
                                                } else if (prodCategory.includes('MENIU') || prodCategory.includes('SUSHI') || prodCategory.includes('ROLL')) {
                                                    matchesCategory = true;
                                                } else if (filterCategories && filterCategories.some(c => prodCategory.includes(c.toUpperCase()) || pName.includes(c.toLowerCase()))) {
                                                    matchesCategory = true;
                                                } else {
                                                    matchesCategory = true;
                                                }
                                            } else if (isPokiWoki) {
                                                matchesCategory = prodCategory.includes('POKI') || prodCategory.includes('WOKI') || pName.includes('poki') || pName.includes('wok') || pName.includes('ramen');
                                            } else if (isCrunch) {
                                                matchesCategory = prodCategory.includes('CRUNCH') || pName.includes('wings') || pName.includes('tenders') || (pName.includes('crunch') && !pName.includes('oklahoma'));
                                            } else if (isSmashMe) {
                                                matchesCategory = !pName.includes('wings') && !pName.includes('tenders') && (!prodCategory.includes('CRUNCH') || pName.includes('oklahoma')) && (!pName.includes('crunch') || pName.includes('oklahoma'));
                                            } else if (filterCategories && filterCategories.length > 0) {
                                                matchesCategory = filterCategories.some(c => prodCategory.includes(c.toUpperCase()) || pName.includes(c.toLowerCase()));
                                            } else {
                                                matchesCategory = true;
                                            }

                                            if (!matchesCategory) {
                                                continue; // Skip this product, it belongs to another Virtual Brand
                                            }

                                            const itemSum = it.resultSum || it.price || 0
                                            orderSum += itemSum

                                            items.push({
                                                product_name: it.product.name,
                                                price: it.price,
                                                amount: it.amount,
                                                resultSum: it.resultSum,
                                                sum: itemSum,
                                                quantity: it.amount || 1,
                                                _order_meta: items.length === 0 ? {
                                                    orderNumber: o.order.number ? String(o.order.number) : (o.order.externalNumber || null),
                                                    customer: extractedCustomer,
                                                    customerName: rawCustName,
                                                    customerPhone: custPhone,
                                                    customerAddress: custAddress,
                                                    courier: extractedCourier,
                                                    courierName: courierName,
                                                    courierPhone: courierPhone,
                                                    pickUpCode,
                                                    externalOrderId: extOrderId,
                                                    operator: o.order.operator?.name || null,
                                                    conception: o.order.conception?.name || null,
                                                    comment: o.order.comment || null,
                                                    kioskId: customerName.includes('cj-1') ? 'Kiosk Cluj 1' : customerName.includes('cj-2') ? 'Kiosk Cluj 2' : customerName.includes('ct') ? 'Kiosk Constanța' : (isKiosk ? 'Smart Kiosk' : null),
                                                    orderType: o.order.orderType?.name || (isKiosk ? 'Smart Kiosk' : (platform === 'casierie' ? 'Casierie (POS)' : 'Livrare')),
                                                    status: o.order.status || 'delivered',
                                                    stage: o.order.status || 'delivered',
                                                    timings: extractedTimings
                                                } : undefined
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

    async syncLiveKiosksToday() {
        try {
            const apiKey = '124d0880f4b44717b69ee21d45fc2656';
            const resAuth = await fetch('https://api-eu.syrve.live/api/1/access_token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiLogin: apiKey })
            });
            if (!resAuth.ok) return { success: false, error: 'Auth failed' };
            const { token } = await resAuth.json();
            if (!token) return { success: false, error: 'No token' };

            const { data: rests } = await supabase
                .from('restaurants')
                .select('id, name, city, is_active, brand_id, iiko_restaurant_id, iiko_config, brands(name)')
                .in('id', [
                    '098d725e-5667-49e2-8e22-cff5db135584', // Smash Me Cluj (Smash Me)
                    '93adc853-0aa8-4659-8156-8e4ebe1a04ee', // Smash Me Cluj (Crunch)
                    '55e49e60-2395-4b5b-ad24-6c9248e80234', // Smash Me Constanta (Smash Me)
                    '279e862d-9036-4843-9bcc-69580afe97e0'  // Smash Me Constanta (Crunch)
                ]);

            if (!rests || rests.length === 0) return { success: false, error: 'No restaurants' };

            const now = new Date();
            const roDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' });
            const startToday = `${roDateStr} 00:00:00.000`;
            const endToday = `${roDateStr} 23:59:59.999`;

            const resDeliv = await fetch('https://api-eu.syrve.live/api/1/deliveries/by_delivery_date_and_status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    organizationIds: [
                        '9c63cff6-1d66-442d-a98d-2302656e3943', // Cluj
                        '8308e796-8780-4d18-ae66-4e430178c778'  // Constanta
                    ],
                    deliveryDateFrom: startToday,
                    deliveryDateTo: endToday
                })
            });

            if (!resDeliv.ok) return { success: false, error: 'Failed to fetch deliveries' };
            const delivData = await resDeliv.json();
            const orgOrdersArray = delivData.ordersByOrganizations || [];

            const dbRows = [];

            for (const r of rests) {
                const orgId = r.iiko_restaurant_id || r.iiko_config?.organizationId;
                const orgOrders = orgOrdersArray.find(o => o.organizationId === orgId);
                if (!orgOrders) continue;

                const rName = (r.name || '').toLowerCase();
                const isCrunch = rName.includes('crunch');
                const isSmashMe = rName.includes('smash me') && !isCrunch;

                for (const o of (orgOrders.orders || [])) {
                    const ord = o.order;
                    if (!ord) continue;

                    const rawSource = (ord.sourceKey || '').toLowerCase();
                    const orderTypeName = (ord.orderType?.name || '').toLowerCase();
                    const customerName = (ord.customer?.name || '').toLowerCase();
                    const isKiosk = rawSource.includes('kiosk') || orderTypeName.includes('kiosk') || customerName.includes('kiosk');

                    let platform = 'casierie';
                    if (rawSource.includes('glovo')) platform = 'glovo';
                    else if (rawSource.includes('wolt')) platform = 'wolt';
                    else if (rawSource.includes('bolt')) platform = 'bolt';
                    else if (isKiosk) platform = 'kiosk';

                    let placed_at = ord.whenCreated || ord.whenClosed || o.timestamp || new Date().toISOString();
                    if (typeof placed_at === 'string' && placed_at.includes(' ') && !placed_at.includes('T')) {
                        placed_at = placed_at.replace(' ', 'T') + 'Z';
                    }

                    const rawCustName = [ord.customer?.name, ord.customer?.surname].filter(Boolean).join(' ').trim() || null;
                    const custComment = ord.customer?.comment || '';
                    const phoneFromComment = custComment.match(/Phone:\s*([^;]+)/i)?.[1]?.trim() || null;
                    const pickUpCode = custComment.match(/Pick Up Code:\s*([^;]+)/i)?.[1]?.trim() || null;
                    const extOrderId = custComment.match(/OrderId:\s*([^;]+)/i)?.[1]?.trim() || ord.externalNumber || null;
                    const courierPhoneFromComment = custComment.match(/Courier Phone:\s*([^;]+)/i)?.[1]?.trim() || null;
                    const rawCourierFromComment = custComment.match(/Courier:\s*([^;]+)/i)?.[1]?.trim() || null;
                    const cleanCourierFromComment = (rawCourierFromComment && !rawCourierFromComment.includes('IikoMiddleware')) ? rawCourierFromComment : null;

                    const custPhone = ord.phone || ord.customer?.phone || phoneFromComment || null;
                    const custAddress = ord.deliveryPoint?.comment || ord.deliveryPoint?.address?.line1 || ord.deliveryPoint?.address?.street?.name || null;
                    const rawCourierObj = ord.courierInfo?.courier || null;
                    const courierName = rawCourierObj?.name || cleanCourierFromComment || null;
                    const courierPhone = rawCourierObj?.phone || courierPhoneFromComment || null;

                    const extractedCourier = courierName ? {
                        name: courierName,
                        phone: courierPhone || '',
                        company: platform === 'glovo' ? 'Glovo' : platform === 'wolt' ? 'Wolt' : platform === 'bolt' ? 'Bolt Food' : 'Livrator Propriu',
                        isManual: Boolean(ord.courierInfo?.isCourierSelectedManually)
                    } : null;

                    const extractedCustomer = (rawCustName || custPhone || custAddress) ? {
                        name: rawCustName || 'Client',
                        phone: custPhone,
                        address: custAddress,
                        pickUpCode,
                        externalOrderId: extOrderId
                    } : null;

                    const extractedTimings = {
                        whenCreated: ord.whenCreated || null,
                        whenConfirmed: ord.whenConfirmed || null,
                        whenPrinted: ord.whenPrinted || null,
                        whenCookingCompleted: ord.whenCookingCompleted || null,
                        whenSended: ord.whenSended || null,
                        whenDelivered: ord.whenDelivered || null,
                        whenClosed: ord.whenClosed || null,
                        completeBefore: ord.completeBefore || null
                    };

                    const baseId = o.id || ord.id || `ord_${ord.number}`;
                    const uniqueOrderId = `${baseId}_${r.id}`;

                    const items = [];
                    let orderSum = 0;

                    // Kiosk hardware belongs 100% to the Smash Me primary brand for this city.
                    // Do NOT split/duplicate kiosk orders under Crunch!
                    if (isKiosk && isCrunch) {
                        continue;
                    }

                    const commentStr = (ord.comment || '').trim();
                    let kioskTicket = null;
                    const ticketMatch = commentStr.match(/Comanda\s+#([A-Za-z0-9\-_]+)/i);
                    if (ticketMatch) {
                        kioskTicket = ticketMatch[1];
                    }
                    const humanOrderNumber = kioskTicket || (ord.number ? String(ord.number) : (ord.externalNumber || null));

                    let kioskId = null;
                    const cUpper = commentStr.toUpperCase();
                    if (customerName.includes('cj-1') || cUpper.includes('CJ-1') || cUpper.includes('CJ1A')) {
                        kioskId = 'Kiosk Cluj 1';
                    } else if (customerName.includes('cj-2') || cUpper.includes('CJ-2') || cUpper.includes('CJ2A')) {
                        kioskId = 'Kiosk Cluj 2';
                    } else if (customerName.includes('ct') || cUpper.includes('SMARTKIOSK CT') || cUpper.includes('CT-A')) {
                        kioskId = 'Kiosk Constanța';
                    } else if (isKiosk) {
                        kioskId = 'Smart Kiosk';
                    }

                    const diningOption = cUpper.includes('LA MASĂ') || cUpper.includes('LA MASA') ? 'La Masă' : cUpper.includes('LA PACHET') ? 'La Pachet' : (isKiosk ? 'La Masă' : null);

                    const hasCardPayment = (ord.payments || []).some(p => {
                        const k = (p.paymentType?.kind || '').toLowerCase();
                        const n = (p.paymentType?.name || '').toLowerCase();
                        return k === 'card' || n.includes('card');
                    });
                    const hasCashPayment = (ord.payments || []).some(p => {
                        const k = (p.paymentType?.kind || '').toLowerCase();
                        const n = (p.paymentType?.name || '').toLowerCase();
                        return k === 'cash' || n.includes('cash') || n.includes('numerar');
                    });

                    let isCard = false;
                    let isCash = false;
                    let paymentMethod = 'Card';

                    if (cUpper.includes('NEPLĂTIT (CASH)') || cUpper.includes('NEPLATIT (CASH)') || hasCashPayment) {
                        isCash = true;
                        paymentMethod = 'Cash';
                    } else if (cUpper.includes('PLĂTIT') || cUpper.includes('PLATIT') || hasCardPayment) {
                        isCard = true;
                        paymentMethod = 'Card';
                    } else if (isKiosk) {
                        isCard = true;
                        paymentMethod = 'Card';
                    }

                    for (const it of (ord.items || [])) {
                        const pName = (it.product?.name || '').toLowerCase();
                        let matchesCategory = false;
                        if (isKiosk) {
                            // All products ordered on the kiosk belong to this kiosk ticket
                            matchesCategory = true;
                        } else if (isCrunch) {
                            matchesCategory = pName.includes('wings') || pName.includes('tenders') || (pName.includes('crunch') && !pName.includes('oklahoma'));
                        } else if (isSmashMe) {
                            matchesCategory = !pName.includes('wings') && !pName.includes('tenders') && (!pName.includes('crunch') || pName.includes('oklahoma'));
                        }

                        if (matchesCategory) {
                            let itemSum = it.resultSum || it.price || 0;
                            if (Array.isArray(it.modifiers)) {
                                for (const m of it.modifiers) {
                                    itemSum += (m.resultSum || m.price || 0);
                                }
                            }
                            itemSum = Math.round(itemSum * 100) / 100;
                            orderSum += itemSum;
                            items.push({
                                product_name: it.product?.name,
                                price: it.price,
                                amount: it.amount,
                                quantity: it.amount || 1,
                                sum: itemSum,
                                _order_meta: items.length === 0 ? {
                                    orderNumber: humanOrderNumber,
                                    customer: extractedCustomer,
                                    customerName: rawCustName,
                                    customerPhone: custPhone,
                                    customerAddress: custAddress,
                                    courier: extractedCourier,
                                    courierName: courierName,
                                    courierPhone: courierPhone,
                                    pickUpCode,
                                    externalOrderId: extOrderId,
                                    kioskId,
                                    diningOption,
                                    paymentMethod,
                                    isCard,
                                    isCash,
                                    orderType: isKiosk ? (diningOption || 'Smart Kiosk') : (platform === 'casierie' ? 'Casierie (POS)' : 'Livrare'),
                                    status: ord.status || 'delivered',
                                    stage: ord.status || 'delivered',
                                    comment: ord.comment || null,
                                    timings: extractedTimings
                                } : undefined
                            });
                        }
                    }

                    if (isKiosk && ord.sum) {
                        orderSum = Math.round(ord.sum * 100) / 100;
                    } else if (ord.items && ord.items.length === items.length && ord.sum) {
                        orderSum = Math.round(ord.sum * 100) / 100;
                    } else {
                        orderSum = Math.round(orderSum * 100) / 100;
                    }

                    if (items.length > 0) {
                        dbRows.push({
                            restaurant_id: r.id,
                            order_id: uniqueOrderId,
                            platform,
                            total_amount: orderSum,
                            placed_at,
                            items
                        });
                    }
                }
            }

            if (dbRows.length > 0) {
                const uniqueMap = new Map();
                for (const row of dbRows) {
                    uniqueMap.set(row.order_id, row);
                }
                const uniqueRows = Array.from(uniqueMap.values());
                const { error: insErr } = await supabase.from('platform_sales').upsert(uniqueRows, { onConflict: 'order_id' });
                if (insErr) {
                    console.error('[SalesSync] Fast Kiosk sync error:', insErr.message);
                } else {
                    console.log(`[SalesSync] Fast Kiosk sync: ${uniqueRows.length} orders updated for Cluj & Constanta.`);
                }
            }

            // Enrich any recent today orders missing timings/customer/courier or still active in kitchen
            await this.enrichRecentTodayOrders(startToday, endToday);

            return { success: true, count: dbRows.length };
        } catch (e) {
            console.error('[SalesSync] Fast Kiosk sync exception:', e.message);
            return { success: false, error: e.message };
        }
    }

    async enrichRecentTodayOrders(startToday, endToday) {
        try {
            const sinceIso = `${startToday.slice(0, 10)}T00:00:00.000Z`;
            const { data: recentSales } = await supabase
                .from('platform_sales')
                .select('id, order_id, platform, restaurant_id, total_amount, placed_at, items')
                .gte('placed_at', sinceIso)
                .limit(1000);

            const needsEnrich = (recentSales || []).filter(r => {
                const meta = r.items?.[0]?._order_meta;
                if (!meta) return false;
                if (!meta.timings || !meta.timings.whenCreated) return true;
                const st = (meta.status || meta.stage || '').toLowerCase();
                if (st && st !== 'closed' && st !== 'delivered' && st !== 'cancelled') return true;
                return false;
            });

            if (needsEnrich.length === 0) return;

            const { data: allRests } = await supabase
                .from('restaurants')
                .select('id, name, iiko_restaurant_id, iiko_config')
                .eq('is_active', true);

            const restById = {};
            for (const r of (allRests || [])) restById[r.id] = r;

            const keyToOrgs = {};
            for (const row of needsEnrich) {
                const r = restById[row.restaurant_id];
                if (!r) continue;
                const orgId = r.iiko_restaurant_id || r.iiko_config?.organizationId;
                const k = r.iiko_config?.api_login || '93a34e75123e47b897e390f31ecfa4cb';
                if (orgId) {
                    if (!keyToOrgs[k]) keyToOrgs[k] = [];
                    if (!keyToOrgs[k].includes(orgId)) keyToOrgs[k].push(orgId);
                }
            }

            const syrveOrderMap = new Map();
            for (const [k, orgs] of Object.entries(keyToOrgs)) {
                const resAuth = await fetch('https://api-eu.syrve.live/api/1/access_token', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiLogin: k })
                });
                if (!resAuth.ok) continue;
                const { token } = await resAuth.json();
                if (!token) continue;

                const res = await fetch('https://api-eu.syrve.live/api/1/deliveries/by_delivery_date_and_status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        organizationIds: orgs,
                        deliveryDateFrom: startToday,
                        deliveryDateTo: endToday
                    })
                });
                if (!res.ok) continue;
                const data = await res.json();
                for (const grp of (data.ordersByOrganizations || [])) {
                    for (const item of (grp.orders || [])) {
                        if (item.id && item.order) {
                            syrveOrderMap.set(item.id, item.order);
                        }
                    }
                }
            }

            const updates = [];
            for (const row of needsEnrich) {
                const baseId = (row.order_id || '').split('_')[0];
                const so = syrveOrderMap.get(baseId);
                if (!so || !Array.isArray(row.items) || row.items.length === 0) continue;

                const newItems = [...row.items];
                const meta = { ...(newItems[0]._order_meta || {}) };
                const ds = so.whenCreated || so.whenClosed;
                const fixedPlacedAt = ds ? new Date(ds.replace(' ', 'T') + 'Z').toISOString() : row.placed_at;

                const rawCustName = [so.customer?.name, so.customer?.surname].filter(Boolean).join(' ').trim() || null;
                const custComment = so.customer?.comment || '';
                const phoneFromComment = custComment.match(/Phone:\s*([^;]+)/i)?.[1]?.trim() || null;
                const pickUpCode = custComment.match(/Pick Up Code:\s*([^;]+)/i)?.[1]?.trim() || null;
                const extOrderId = custComment.match(/OrderId:\s*([^;]+)/i)?.[1]?.trim() || so.externalNumber || null;
                const courierPhoneFromComment = custComment.match(/Courier Phone:\s*([^;]+)/i)?.[1]?.trim() || null;
                const rawCourierFromComment = custComment.match(/Courier:\s*([^;]+)/i)?.[1]?.trim() || null;
                const cleanCourierFromComment = (rawCourierFromComment && !rawCourierFromComment.includes('IikoMiddleware')) ? rawCourierFromComment : null;

                const custPhone = so.phone || so.customer?.phone || phoneFromComment || null;
                const custAddress = so.deliveryPoint?.comment || so.deliveryPoint?.address?.line1 || so.deliveryPoint?.address?.street?.name || null;
                const rawCourierObj = so.courierInfo?.courier || null;
                const courierName = rawCourierObj?.name || cleanCourierFromComment || null;
                const courierPhone = rawCourierObj?.phone || courierPhoneFromComment || null;

                meta.status = so.status || meta.status || 'Closed';
                meta.stage = so.status || meta.stage || 'Closed';
                if (rawCustName || custPhone || custAddress) {
                    meta.customer = {
                        name: rawCustName || 'Client',
                        phone: custPhone,
                        address: custAddress,
                        pickUpCode,
                        externalOrderId: extOrderId
                    };
                    meta.customerName = rawCustName;
                    meta.customerPhone = custPhone;
                    meta.customerAddress = custAddress;
                }
                if (courierName) {
                    meta.courier = {
                        name: courierName,
                        phone: courierPhone || '',
                        company: row.platform === 'glovo' ? 'Glovo' : row.platform === 'wolt' ? 'Wolt' : row.platform === 'bolt' ? 'Bolt Food' : 'Livrator Propriu',
                        isManual: Boolean(so.courierInfo?.isCourierSelectedManually)
                    };
                    meta.courierName = courierName;
                    meta.courierPhone = courierPhone;
                }
                meta.pickUpCode = pickUpCode;
                meta.externalOrderId = extOrderId;
                meta.timings = {
                    whenCreated: so.whenCreated || null,
                    whenConfirmed: so.whenConfirmed || null,
                    whenPrinted: so.whenPrinted || null,
                    whenCookingCompleted: so.whenCookingCompleted || null,
                    whenSended: so.whenSended || null,
                    whenDelivered: so.whenDelivered || null,
                    whenClosed: so.whenClosed || null,
                    completeBefore: so.completeBefore || null
                };

                newItems[0] = { ...newItems[0], _order_meta: meta };
                updates.push({
                    id: row.id,
                    order_id: row.order_id,
                    platform: row.platform,
                    restaurant_id: row.restaurant_id,
                    total_amount: row.total_amount,
                    placed_at: fixedPlacedAt,
                    items: newItems
                });
            }

            if (updates.length > 0) {
                await supabase.from('platform_sales').upsert(updates, { onConflict: 'order_id' });
                console.log(`[SalesSync] Auto-enriched ${updates.length} live orders with Syrve customer, courier & timings.`);
            }
        } catch (err) {
            console.warn('[SalesSync] enrichRecentTodayOrders warning:', err.message);
        }
    }
}

export const salesSync = new SalesSync()
