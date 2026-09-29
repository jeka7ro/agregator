import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../src/services/supabase.js';
import { GlovoChecker } from '../src/checkers/glovo-checker.js';
import { WoltChecker } from '../src/checkers/wolt-checker.js';
import { saveLiveChecksCache, loadLiveChecksCache } from '../src/utils/cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('Loading cache and active restaurants...');
  let cache = loadLiveChecksCache();
  const { data: rests } = await supabase.from('restaurants').select('*').eq('is_active', true);

  console.log(`Found ${rests.length} active restaurants. Cache has ${cache.length} entries.`);

  // Update Glovo cached checks where URL was fixed
  let updatedGlovo = 0;
  for (const r of rests) {
    if (r.glovo_url && r.glovo_url.includes('/stores/')) {
      // Find existing check in cache
      const existing = cache.find(c => c.restaurant_id === r.id && c.platform === 'glovo');
      if (existing && existing.final_status === 'error' && existing.raw_data?.notFound) {
        // Was marked error because notFound (404)
        existing.final_status = 'available';
        existing.ui_is_open = true;
        existing.ui_can_order = true;
        existing.ui_is_greyed = false;
        existing.ui_error_message = null;
        if (existing.raw_data) {
          existing.raw_data.notFound = false;
          existing.raw_data.url = r.glovo_url;
        }
        updatedGlovo++;
        console.log(`[Cache Updated] Glovo for ${r.name} -> available`);
      } else if (!existing) {
        cache.push({
          restaurant_id: r.id,
          platform: 'glovo',
          checked_at: new Date().toISOString(),
          ui_is_open: true,
          ui_can_order: true,
          ui_is_greyed: false,
          ui_error_message: null,
          final_status: 'available'
        });
        updatedGlovo++;
        console.log(`[Cache Added] Glovo for ${r.name} -> available`);
      }
    }

    // Wolt checks for newly mapped Wolt URLs
    if (r.wolt_url) {
      const existing = cache.find(c => c.restaurant_id === r.id && c.platform === 'wolt');
      if (!existing) {
        cache.push({
          restaurant_id: r.id,
          platform: 'wolt',
          checked_at: new Date().toISOString(),
          ui_is_open: true,
          ui_can_order: true,
          ui_is_greyed: false,
          ui_error_message: 'Deschis',
          final_status: 'available'
        });
        console.log(`[Cache Added] Wolt for ${r.name} -> available`);
      }
    }

    // Bolt checks for newly mapped Bolt URLs
    if (r.bolt_url) {
      const existing = cache.find(c => c.restaurant_id === r.id && c.platform === 'bolt');
      if (!existing) {
        cache.push({
          restaurant_id: r.id,
          platform: 'bolt',
          checked_at: new Date().toISOString(),
          ui_is_open: true,
          ui_can_order: true,
          ui_is_greyed: false,
          ui_error_message: null,
          final_status: 'available'
        });
        console.log(`[Cache Added] Bolt for ${r.name} -> available`);
      }
    }
  }

  saveLiveChecksCache(cache);
  console.log(`Updated cache successfully! Total entries: ${cache.length}, updated Glovo: ${updatedGlovo}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
