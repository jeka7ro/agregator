// ============================================================
// ANTIGRAVITY — Render Worker
// ============================================================

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { processAndNotify, notifyStopResolved } from './notifications/telegram.js'
import cron from 'node-cron'
import { salesSync } from './services/sales-sync.js'

import { GlovoChecker } from './checkers/glovo-checker.js'
import { WoltChecker } from './checkers/wolt-checker.js'
import { BoltChecker } from './checkers/bolt-checker.js'

dotenv.config({ path: path.resolve(process.cwd(), "..", ".env.local") })

import { supabase } from './services/supabase.js'

// const supabase = createClient(...) removed

const WORKER_TICK_MS = 15000 // 15 secunde

const INTERVAL_BY_PLAN = {
  basic:   600, // 10 minute
  premium: 180, // 3 minute
}

const MENU_STOP_PERCENT_THRESHOLD = 0.30
const RADIUS_REDUCTION_THRESHOLD = 0.25

const checkers = {
    glovo: new GlovoChecker(),
    wolt: new WoltChecker(),
    bolt_food: new BoltChecker(),
    bolt: new BoltChecker()
}


async function fetchDueJobs() {
  const now = new Date().toISOString()
  
  // Încercăm să citim din tabela aggregator_jobs propusă (dacă clientul a generat-o)
  const { data, error } = await supabase
    .from('aggregator_jobs')
    .select('*')
    .eq('is_enabled', true)
    .or(`next_run_at.is.null,next_run_at.lte.${now}`)
    .order('next_run_at', { ascending: true })
    .limit(1)

  if (error) {
    // Daca tabela aggregator_jobs nu exista, nu generam joburi virtuale inutile care sa consume CPU si sa dea erori de schema
    return []
  }

  return data || []
}


async function runScraper(platform, restaurantUrl, restaurantId) {
  try {
    const checker = checkers[platform];
    if (!checker) {
        console.warn(`[Worker] Nu exista checker local pentru ${platform}`)
        return null;
    }
    
    // Fake restaurant obj so checker can work
    const restMock = { id: restaurantId, [platform.replace('_food', '') + '_url']: restaurantUrl, name: `Job ` + restaurantId }
    console.log(`[Scraper] ${platform} → ${restaurantUrl}`)
    
    const checkResult = await checker.check(restMock)
    if (!checkResult) return null

    const isOpen = checkResult.ui_is_open || false
    const rawData = checkResult.raw_data || {}
    const productStops = rawData.product_stops || {}

    return {
      is_open: isOpen,
      can_order: isOpen,
      is_greyed: checkResult.ui_is_greyed || false,
      status_message: checkResult.ui_error_message || null,
      delivery_radius_km: rawData.delivery_radius_km || null,
      ranking_category_pos: null,
      ranking_overall_pos: null,
      rating_value: checkResult.rating || null,
      reviews_count: null,
      products: [], // Vechile scrapere nu extrag inca items distinct, fallback pe total stops
      raw_json: rawData,
      // Pass totals for saveSnapshot
      _legacy_stats: productStops
    }
  } catch (err) {
    console.error(`[Scraper] Eroare ${platform}:`, err)
    return null
  }
}


async function saveSnapshot(restaurantId, platform, result) {
  let totalItems = result.products.length
  let availableItems = result.products.filter((p) => p.is_available).length
  
  if (totalItems === 0 && result._legacy_stats && result._legacy_stats.total > 0) {
      totalItems = result._legacy_stats.total;
      availableItems = totalItems - (result._legacy_stats.stopped || 0);
  }

  const stopPercent = totalItems > 0 ? (totalItems - availableItems) / totalItems : 0

  const { data, error } = await supabase
    .from('aggregator_snapshots')
    .insert({
      restaurant_id:         restaurantId,
      platform,
      checked_at:            new Date().toISOString(),
      ui_source:             'ui_robot',
      confidence:            0.85,

      // Status restaurant
      ui_is_open:            result.is_open,
      ui_can_order:          result.can_order,
      ui_is_greyed:          result.is_greyed,
      ui_status_message:     result.status_message,

      // Status final (hybrid)
      final_is_open:         result.is_open,
      final_can_order:       result.can_order,
      final_stop_total:      !result.is_open || !result.can_order,

      // Produse
      menu_total_items:      totalItems,
      menu_available_items:  availableItems,
      menu_stop_percent:     stopPercent,

      // Marketing
      delivery_radius_km:    result.delivery_radius_km,
      ranking_category_pos:  result.ranking_category_pos,
      ranking_overall_pos:   result.ranking_overall_pos,
      rating_value:          result.rating_value,
      reviews_count:         result.reviews_count,

      // Debug
      raw_ui_json:           result.raw_json,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[Worker] Eroare saveSnapshot:', error)
    return null
  }

  if (result.products.length > 0) {
    const menuItems = result.products.map((p) => ({
      snapshot_id:       data.id,
      platform_item_id:  p.platform_item_id,
      platform_item_name: p.name,
      is_available:      p.is_available,
    }))

    await supabase.from('aggregator_snapshot_menu_items').insert(menuItems)
  }

  return data.id
}


async function getIikoProducts(restaurantId) {
  // Modificat pentru a lua iiko_catalog
  const { data, error } = await supabase
    .from('iiko_catalog') 
    .select('iiko_id, name, parent_category')

  if (error) {
    console.error('[Worker] Eroare getIikoProducts:', error)
    return []
  }

  return (data || []).map(p => ({
     iiko_item_id: p.iiko_id,
     name: p.name,
     category: p.parent_category,
     is_active: true
  }))
}

async function compareAndDetect(
  restaurantId, platform, snapshotId, scraperResult, iikoProducts
) {

  // 1. STOP TOTAL
  if (!scraperResult.is_open || !scraperResult.can_order) {
    const isInWorkingHours = await checkWorkingHours(restaurantId)

    if (isInWorkingHours) {
      await createOrUpdateIncident({
        restaurantId,
        platform,
        snapshotId,
        incidentType: 'STOP_TOTAL',
        severity: 'CRITICAL',
        title: `STOP TOTAL — ${platform}`,
        description: `Restaurant indisponibil în program de lucru. iiko: deschis | ${platform}: închis`,
        contextJson: {
          status_message: scraperResult.status_message,
        },
        lossAmount: await estimateHourlyLoss(restaurantId),
      })
    }
    return
  }

  // 2. PRODUSE LIPSĂ
  let missingCount = 0;
  let totalIiko = iikoProducts.length;
  let missingPercent = 0;
  let missingProductNames = [];
  let missingCriticalCategories = false;

  // Cazul A: Avem array exact de produse de la noul scraper
  if (scraperResult.products && scraperResult.products.length > 0) {
      const platformMap = new Map(
        scraperResult.products
          .filter((p) => p.is_available)
          .map((p) => [p.name.toLowerCase().trim(), p])
      )
      
      const missingProductsObj = iikoProducts.filter(
        (p) => !platformMap.has(p.name.toLowerCase().trim())
      )

      missingCount = missingProductsObj.length;
      missingPercent = totalIiko > 0 ? missingCount / totalIiko : 0;
      missingProductNames = missingProductsObj.map(p => p.name);

      // Verificam categorii critice pe sistemul bazat pe nume
      const criticalCategories = await getCriticalCategories(restaurantId)
      missingCriticalCategories = missingProductsObj.some((p) =>
          criticalCategories.includes(p.category?.toLowerCase())
      )
  } 
  // Cazul B: Folosim numere agregate extrase direct de pe platforma (legacy_stats)
  else if (scraperResult._legacy_stats && scraperResult._legacy_stats.total > 0) {
      const platformTotal = scraperResult._legacy_stats.total;
      const platformStopped = scraperResult._legacy_stats.stopped || 0;
      const platformAvailable = platformTotal - platformStopped;
      
      // Lipsa fata de Iiko (ex. in Iiko ai 100 produse, platforma vede 80 active)
      missingCount = Math.max(0, totalIiko - platformAvailable);
      
      // Dacã lipsesc mai mult decât platform_stopped, le considerm lipsă fizică (dezactivate total sau nepublicate)
      missingPercent = totalIiko > 0 ? missingCount / totalIiko : 0;
      
      missingProductNames = [`${platformStopped} oprite vizibil, re-publicare necesară`];
      
      // Pentru scraperul agregat, nu stim exact care sunt produsele, asa ca nu dam STOP_CATEGORY automat, doar partial.
      if (scraperResult.raw_json && scraperResult.raw_json.disabled_categories && scraperResult.raw_json.disabled_categories.length > 0) {
          missingCriticalCategories = true;
          missingProductNames.push(`Categorii blocate: ${scraperResult.raw_json.disabled_categories.join(', ')}`);
      }
  }

  // Declansare Incident Stop Partial daca lipsesc produse
  if (missingCount > 0) {
      const severity = missingCriticalCategories
          ? 'CRITICAL'
          : missingPercent >= MENU_STOP_PERCENT_THRESHOLD
          ? 'WARNING'
          : 'INFO';

      await createOrUpdateIncident({
          restaurantId,
          platform,
          snapshotId,
          incidentType: missingCriticalCategories ? 'STOP_CATEGORY' : 'STOP_PARTIAL_PRODUCTS',
          severity,
          title: `${missingCount} produse lipsă față de iiko — ${platform}`,
          description: `iiko: ${totalIiko} active | ${platform}: ${totalIiko - missingCount} vizibile/active`,
          contextJson: {
              missing_count:    missingCount,
              missing_percent:  missingPercent,
              missing_products: missingProductNames,
              critical_missing: missingCriticalCategories ? missingProductNames : [],
              total_iiko:       totalIiko,
          },
          lossAmount: await estimateProductLoss(restaurantId, missingPercent),
      })
  }

  // 3. RAZA CURSĂ
  await checkRadiusReduction(restaurantId, platform, snapshotId, scraperResult)
}

async function checkWorkingHours(restaurantId) {
  return true // Simplificat pt moment, ai nevoie de tabelul setari
}

async function getCriticalCategories(restaurantId) {
  return ['hot_kitchen']
}

async function checkRadiusReduction(restaurantId, platform, snapshotId, result) {
  if (!result.delivery_radius_km) return

  const { data: platformConfig } = await supabase
    .from('aggregator_restaurant_platforms')
    .select('baseline_radius_km')
    .eq('restaurant_id', restaurantId)
    .eq('platform', platform)
    .single()

  const baseline = platformConfig?.baseline_radius_km
  if (!baseline) return

  const reduction = (baseline - result.delivery_radius_km) / baseline

  await supabase.from('aggregator_radius_history').insert({
    restaurant_id:   restaurantId,
    platform,
    at:              new Date().toISOString(),
    radius_km:       result.delivery_radius_km,
    reduced_percent: reduction,
    snapshot_id:     snapshotId,
  })

  // Incident doar dacă reducerea depășește pragul
  if (reduction >= RADIUS_REDUCTION_THRESHOLD) {
    await createOrUpdateIncident({
      restaurantId,
      platform,
      snapshotId,
      incidentType: 'RADIUS_REDUCED',
      severity: reduction >= 0.5 ? 'CRITICAL' : 'WARNING',
      title: `Rază redusă cu ${Math.round(reduction * 100)}% — ${platform}`,
      description: `Baseline: ${baseline} km | Curent: ${result.delivery_radius_km} km`,
      contextJson: {
        radius_from_km: baseline,
        radius_to_km:   result.delivery_radius_km,
        reduced_percent: reduction,
      },
      lossAmount: await estimateRadiusLoss(restaurantId, reduction),
    })
  }
}


async function createOrUpdateIncident(params) {
  const {
    restaurantId, platform, snapshotId,
    incidentType, severity, title, description,
    contextJson, lossAmount,
  } = params

  const stopTypeMapping = incidentType === 'STOP_TOTAL' ? 'full' : 'partial';

  const { data: existing } = await supabase
    .from('stop_events')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('platform', platform)
    .is('resumed_at', null)
    .limit(1)
    .single()

  if (existing) {
    await supabase
      .from('stop_events')
      .update({
        affected_product_count: contextJson?.missing_count || 0,
        estimated_loss_amount: lossAmount
      })
      .eq('id', existing.id)
    return
  }

  await supabase.from('stop_events').insert({
    restaurant_id:           restaurantId,
    platform,
    stop_type:               stopTypeMapping,
    stopped_at:              new Date().toISOString(),
    affected_product_count:  contextJson?.missing_count || 0,
    total_product_count:     contextJson?.total_iiko || 0,
    reason:                  title,
    estimated_loss_amount:   lossAmount
  })
}

async function resolveIncidentsIfRecovered(restaurantId, platform, snapshotId, scraperResult) {
  if (scraperResult.is_open && scraperResult.can_order) {
    const { data: session } = await supabase
        .from('stop_events')
        .select('id, stopped_at, estimated_loss_amount')
        .eq('restaurant_id', restaurantId)
        .eq('platform', platform)
        .is('resumed_at', null)
        .order('stopped_at', { ascending: false })
        .limit(1)
        .single()

      if (session) {
        const now = new Date();
        const durationSec = Math.floor((now.getTime() - new Date(session.stopped_at).getTime()) / 1000)
        await supabase
          .from('stop_events')
          .update({
            resumed_at:        now.toISOString(),
            duration_minutes:  Math.round(durationSec / 60)
          })
          .eq('id', session.id)

        await notifyStopResolved(
          restaurantId,
          platform,
          durationSec,
          session.estimated_loss_amount
        )
      }
  }
}

async function estimateHourlyLoss(restaurantId) {
  return 400
}

async function estimateProductLoss(restaurantId, missingPercent) {
  const hourly = await estimateHourlyLoss(restaurantId)
  if (!hourly) return null
  return Math.round(hourly * missingPercent)
}

async function estimateRadiusLoss(restaurantId, reductionPercent) {
  const hourly = await estimateHourlyLoss(restaurantId)
  if (!hourly) return null
  return Math.round(hourly * reductionPercent * 8)
}

async function rescheduleJob(job) {
  if (job.id.startsWith('virtual_')) return; // nothing to reschedule for legacy mappings

  const intervalSec = INTERVAL_BY_PLAN[job.plan] ?? job.interval_sec
  const nextRun = new Date(Date.now() + intervalSec * 1000).toISOString()

  await supabase
    .from('aggregator_jobs')
    .update({
      last_run_at: new Date().toISOString(),
      next_run_at: nextRun,
    })
    .eq('id', job.id)
}

async function processJob(job) {
  console.log(`[Worker] Start job: ${job.platform} → restaurant ${job.restaurant_id}`)

  // Ia URL curent de referinta pt restaurante din supabase legacy
  const { data: legacyRest } = await supabase.from('restaurants').select('*').eq('id', job.restaurant_id).single()
  if (!legacyRest) {
      await rescheduleJob(job)
      return
  }
  
  const platKey = job.platform.replace('bolt_food', 'bolt');
  const restaurantUrl = legacyRest[`${platKey}_url`]

  if (!restaurantUrl) {
    console.warn(`[Worker] Fără URL pentru ${job.restaurant_id} pe ${job.platform}`)
    await rescheduleJob(job)
    return
  }

  const scraperResult = await runScraper(job.platform, restaurantUrl, job.restaurant_id)
  if (!scraperResult) {
    console.warn(`[Worker] Scraper a eșuat pentru ${job.platform}`)
    await rescheduleJob(job)
    return
  }

  const snapshotId = await saveSnapshot(job.restaurant_id, job.platform, scraperResult)
  if (!snapshotId) {
    await rescheduleJob(job)
    return
  }

  const iikoProducts = await getIikoProducts(job.restaurant_id)

  await resolveIncidentsIfRecovered(job.restaurant_id, job.platform, snapshotId, scraperResult)

  if (iikoProducts.length > 0) {
    await compareAndDetect(job.restaurant_id, job.platform, snapshotId, scraperResult, iikoProducts)
  }

  await processAndNotify()

  await rescheduleJob(job)
  console.log(`[Worker] Done: ${job.platform} → restaurant ${job.restaurant_id}`)
}

let isProcessingTick = false;

async function tick() {
  if (isProcessingTick) {
    console.log('[Worker] Tick skip: încă procesează tura anterioară');
    return;
  }
  isProcessingTick = true;
  try {
    const jobs = await fetchDueJobs();
    if (jobs.length === 0) return;
    console.log(`[Worker] Tick: ${jobs.length} job-uri de procesat`);
    for(const job of jobs) { 
      await processJob(job); 
      await new Promise(r => setTimeout(r, 2000)); 
    }
  } finally {
    isProcessingTick = false;
  }
}

async function startWorker() {
  console.log('════════════════════════════════════')
  console.log('  ANTIGRAVITY WORKER — pornit')
  console.log(`  Tick interval: ${WORKER_TICK_MS / 1000}s`)
  console.log('════════════════════════════════════')

  await tick()

  setInterval(async () => {
    try {
      await tick()
    } catch (err) {
      console.error('[Worker] Eroare în tick:', err)
    }
  }, WORKER_TICK_MS)

  // Autopilot nocturn - se trage ziua de ieri, în fiecare dimineață la 05:00
  cron.schedule('0 5 * * *', async () => {
    console.log('[CRON] Pornire automată sincronizare Iiko (2 zile, după tura anterioară)');
    try {
        await salesSync.syncSales(2);
        console.log('[CRON] Sincronizare nocturnă finalizată.');
    } catch(e) {
        console.error('[CRON] Eroare la sincronizare nocturnă:', e);
    }
  }, {
    scheduled: true,
    timezone: "Europe/Bucharest"
  });
}

startWorker().catch((err) => {
  console.error('[Worker] Eroare fatală la pornire:', err)
  process.exit(1)
})
