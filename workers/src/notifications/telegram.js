import { supabase } from '../services/supabase.js';
import dotenv from 'dotenv';
import path from 'path';

// Folosim .env.local unde probabil tii cheile.
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env.local") });

// const supabase = createClient(...) is now imported

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const PLATFORM_LABEL = {
  glovo: 'Glovo',
  wolt: 'Wolt',
  bolt: 'Bolt Food',
  bolt_food: 'Bolt Food',
};

const SEVERITY_EMOJI = {
  CRITICAL: '🔴',
  WARNING: '🟡',
  INFO: '🔵',
};

function formatDuration(detectedAt) {
  if (!detectedAt) return '—';
  const minutes = Math.floor((Date.now() - new Date(detectedAt).getTime()) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

function formatLoss(amount, currency) {
  if (!amount) return '—';
  return `${Math.round(amount).toLocaleString('ro-RO')} ${currency || 'RON'}`;
}

function formatMissingProducts(contextJson) {
  if (!contextJson?.missing_products?.length) return '';
  const products = contextJson.missing_products.slice(0, 5);
  const total = contextJson.missing_count || products.length;
  const more = total > 5 ? `\n  +${total - 5} alte produse` : '';
  return `\n📦 Lipsă:\n  · ${products.join('\n  · ')}${more}`;
}

function buildMessage(incident, restaurant) {
  const emoji = SEVERITY_EMOJI[incident.severity] || '🔴';
  const platform = PLATFORM_LABEL[incident.platform] || incident.platform;
  const duration = formatDuration(incident.detected_at);
  const loss = formatLoss(incident.estimated_loss_amount, incident.estimated_loss_currency);

  switch (incident.incident_type) {
    case 'STOP_TOTAL':
    case 'CLOSED_DURING_WORKING_HOURS':
      return [
        `${emoji} <b>STOP TOTAL — ${platform}</b>`,
        `📍 ${restaurant.name} · ${restaurant.city}`,
        `⏱ Oprit de ${duration} (în program de lucru)`,
        `💸 Pierdere estimată: ${loss}`,
        `📋 iiko: deschis | ${platform}: închis`,
      ].join('\n');

    case 'STOP_PARTIAL_PRODUCTS':
    case 'MENU_MISMATCH': {
      const count = incident.context_json?.missing_count || '?';
      const missingList = formatMissingProducts(incident.context_json);
      return [
        `${emoji} <b>Produse lipsă — ${platform}</b>`,
        `📍 ${restaurant.name} · ${restaurant.city}`,
        `📦 ${count} produse față de iiko${missingList}`,
        `💸 Pierdere estimată: ${loss}`,
      ].join('\n');
    }

    case 'STOP_CATEGORY': {
      const category = incident.context_json?.category || 'categorie necunoscută';
      return [
        `${emoji} <b>Categorie oprită — ${platform}</b>`,
        `📍 ${restaurant.name} · ${restaurant.city}`,
        `🗂 Categorie: ${category}`,
        `⏱ De ${duration}`,
        `💸 Pierdere estimată: ${loss}`,
      ].join('\n');
    }

    case 'RADIUS_REDUCED': {
      const from = incident.context_json?.radius_from_km || '?';
      const to = incident.context_json?.radius_to_km || '?';
      const pct = incident.context_json?.reduced_percent
        ? `−${Math.round(incident.context_json.reduced_percent * 100)}%`
        : '';
      return [
        `${emoji} <b>Rază redusă — ${platform}</b>`,
        `📍 ${restaurant.name} · ${restaurant.city}`,
        `📏 ${from} km → ${to} km ${pct} · De ${duration}`,
        `💸 Pierdere estimată: ${loss}`,
      ].join('\n');
    }

    case 'RANKING_DROP': {
      const from = incident.context_json?.rank_from || '?';
      const to = incident.context_json?.rank_to || '?';
      return [
        `${emoji} <b>Cădere poziție — ${platform}</b>`,
        `📍 ${restaurant.name} · ${restaurant.city}`,
        `📊 Poziție: ${from} → ${to}`,
        `💸 Pierdere estimată: ${loss}`,
      ].join('\n');
    }

    case 'RATING_DROP': {
      const from = incident.context_json?.rating_from || '?';
      const to = incident.context_json?.rating_to || '?';
      return [
        `${emoji} <b>Scădere rating — ${platform}</b>`,
        `📍 ${restaurant.name} · ${restaurant.city}`,
        `⭐ Rating: ${from} → ${to}`,
      ].join('\n');
    }

    default:
      return [
        `${emoji} <b>${incident.title}</b>`,
        `📍 ${restaurant.name} · ${restaurant.city}`,
        incident.description || '',
      ].filter(Boolean).join('\n');
  }
}

function buildDedupeKey(incident) {
  return `${incident.incident_type}:${incident.platform}:${incident.restaurant_id}`;
}

async function wasRecentlySent(restaurantId, dedupeKey, windowMinutes = 30) {
  // Deduplicare simpla locala sau in baza de rating/history in lipsa tabelei aggregator_notifications
  // Vom crea structura minimala on the fly in Supabase daca lipseste, sau presupunem falsa
  try {
      const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('aggregator_notifications')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('dedupe_key', dedupeKey)
        .gte('sent_at', since)
        .limit(1);
        
      if (error && error.code === '42P01') {
          // Table doesn't exist, ignore deduplication gracefully to not block application
          return false;
      }
      return (data?.length ?? 0) > 0;
  } catch (e) {
      return false;
  }
}

async function logNotification(restaurantId, platform, incidentId, dedupeKey, payload) {
  try {
      const { error } = await supabase.from('aggregator_notifications').insert({
        restaurant_id: restaurantId,
        platform,
        channel: 'telegram',
        incident_id: incidentId,
        dedupe_key: dedupeKey,
        payload,
        sent_at: new Date().toISOString(),
      });
      if (error && error.code === '42P01') {
          // Table doesn't exist, ignore
      }
  } catch (e) {
      // Ignora erorile de DB
  }
}

export async function sendTelegramMessage(chatId, text, threadId) {
  if (!TELEGRAM_BOT_TOKEN) {
      console.warn('🔴 Nu ai setat TELEGRAM_BOT_TOKEN in ENV.');
      return false;
  }
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (threadId) {
    body.message_thread_id = threadId;
  }
  
  try {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        console.error(`[Telegram] Eroare trimitere chat_id=${chatId}:`, err);
        return false;
      }
      return true;
  } catch (e) {
      console.error(`[Telegram] Network error la trimitere:`, e);
      return false;
  }
}

export async function processAndNotify() {
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  // Folosim tabelul real 'stop_events' în loc de aggregator_incidents conceptual
  const { data: activeStops, error } = await supabase
    .from('stop_events')
    .select('id, restaurant_id, platform, stop_type, stopped_at, affected_product_count, reason, estimated_loss_amount')
    .is('resumed_at', null)
    .gte('stopped_at', since)
    .order('stopped_at', { ascending: false });

  if (error || !activeStops?.length) {
    if (error) console.error('[Notifier] Eroare citire stop_events:', error);
    return;
  }

  const restaurantIds = [...new Set(activeStops.map((i) => i.restaurant_id))];
  const { data: restaurants } = await supabase.from('restaurants').select('id, name, city, working_hours').in('id', restaurantIds);
  const restaurantMap = new Map((restaurants || []).map((r) => [r.id, r]));

  for (const stopEvent of activeStops) {
    const restaurant = restaurantMap.get(stopEvent.restaurant_id);
    if (!restaurant) continue;

    const targetChatId = restaurant.working_hours?.telegram_group_id || restaurant.telegram_group_id;
    if (!targetChatId) continue;
    if (restaurant.working_hours?.notification_enabled === false) continue;

    // Adapt incident structure
    const incident = {
        id: stopEvent.id,
        restaurant_id: stopEvent.restaurant_id,
        platform: stopEvent.platform,
        incident_type: stopEvent.stop_type === 'full' ? 'STOP_TOTAL' : 'STOP_PARTIAL_PRODUCTS',
        severity: stopEvent.stop_type === 'full' ? 'CRITICAL' : 'WARNING',
        detected_at: stopEvent.stopped_at,
        estimated_loss_amount: stopEvent.estimated_loss_amount,
        estimated_loss_currency: 'RON',
        context_json: { missing_count: stopEvent.affected_product_count },
        title: stopEvent.reason || 'Incident',
        description: null
    };

    const dedupeKey = buildDedupeKey(incident);
    const alreadySent = await wasRecentlySent(incident.restaurant_id, dedupeKey, 30);
    if (alreadySent) continue;

    const message = buildMessage(incident, restaurant);
    const sent = await sendTelegramMessage(targetChatId, message);

    if (sent) {
      await logNotification(incident.restaurant_id, incident.platform, incident.id, dedupeKey, { message, incident_type: incident.incident_type });
      console.log(`[Notifier] Trimis: ${incident.incident_type} → ${restaurant.name} (${targetChatId})`);
    }
  }
}

export async function notifyStopResolved(restaurantId, platform, durationSec, lossAmount, currency = 'RON') {
  const restaurant = await supabase
    .from('restaurants')
    .select('name, city, telegram_group_id')
    .eq('id', restaurantId)
    .single();

  if (!restaurant.data || !restaurant.data.telegram_group_id) return;

  const minutes = Math.floor(durationSec / 60);
  const loss = lossAmount ? `${Math.round(lossAmount).toLocaleString('ro-RO')} ${currency}` : '—';
  const platData = PLATFORM_LABEL[platform] || platform;

  const message = [
    `✅ <b>STOP rezolvat — ${platData}</b>`,
    `📍 ${restaurant.data.name} · ${restaurant.data.city}`,
    `⏱ Durată totală: ${minutes} min`,
    `💸 Pierdere totală: ${loss}`,
  ].join('\n');

  await sendTelegramMessage(restaurant.data.telegram_group_id, message);
}
