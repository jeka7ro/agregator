import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import { supabase } from '../src/services/supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');

async function main() {
  console.log('=== STEP 1: FIXING GLOVO URLS ===');
  const { data: allRests, error: fetchErr } = await supabase
    .from('restaurants')
    .select('*');

  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
    return;
  }

  let glovoFixed = 0;
  for (const r of allRests) {
    if (!r.glovo_url) continue;
    let url = r.glovo_url.trim();
    if (url.endsWith('/')) url = url.slice(0, -1);

    if (!url.includes('/stores/') && !url.includes('/store/')) {
      // e.g. https://glovoapp.com/ro/ro/sibiu/poki-woki-sibiu-sbz
      const parts = url.split('/');
      const slug = parts.pop();
      parts.push('stores');
      parts.push(slug);
      const newUrl = parts.join('/');

      const { error } = await supabase
        .from('restaurants')
        .update({ glovo_url: newUrl })
        .eq('id', r.id);

      if (error) {
        console.error(`Failed to update Glovo for ${r.name}:`, error.message);
      } else {
        glovoFixed++;
        console.log(`[Glovo Fixed] ${r.name} -> ${newUrl}`);
      }
    }
  }
  console.log(`Total Glovo URLs fixed: ${glovoFixed}\n`);

  console.log('=== STEP 2: FILLING MISSING ADDRESSES ===');
  const addressFixes = [
    { match: 'BALOTESTI (Roll Master)', address: 'Calea Bucureşti 2bis, 077015 Balotești, Romania' },
    { match: 'BALOTESTI (Poki Woki)', address: 'Calea Bucureşti 2bis, 077015 Balotești, Romania' },
    { match: 'CLUJ (Poki Woki)', address: 'Strada Emil Isac 15, 400394 Cluj-Napoca, Romania' },
    { match: 'Smash Me Cluj (Smash Me)', address: 'Strada Avram Iancu 492-500 (Vivo Mall), 407280 Cluj-Napoca, Romania' },
    { match: 'Smash Me Cluj (Crunch)', address: 'Strada Avram Iancu 492-500 (Vivo Mall), 407280 Cluj-Napoca, Romania' }
  ];

  for (const fix of addressFixes) {
    const target = allRests.find(r => r.name === fix.match);
    if (target) {
      await supabase.from('restaurants').update({ address: fix.address }).eq('id', target.id);
      console.log(`[Address Fixed] ${target.name} -> ${fix.address}`);
    }
  }
  console.log('Addresses updated.\n');

  console.log('=== STEP 3: MAPPING MISSING WOLT URLS ===');
  const venueCsvPath = path.join(ROOT_DIR, 'venue_ids_branduri_tip_livrare - Untitled.csv');
  if (fs.existsSync(venueCsvPath)) {
    const csvContent = fs.readFileSync(venueCsvPath, 'utf8');
    const venues = parse(csvContent, { columns: true, skip_empty_lines: true });

    let woltFixed = 0;
    const activeRests = allRests.filter(r => r.is_active);

    for (const r of activeRests) {
      if (r.wolt_url) continue; // Already has Wolt

      const rName = r.name.toLowerCase();
      const rCity = (r.city || '').toLowerCase();
      let matchedVenue = null;

      for (const v of venues) {
        const vBrand = (v['Brand'] || '').trim();
        const vCity = (v['City'] || '').trim().toLowerCase();
        const vName = (v['Venue Name'] || '').trim().toLowerCase();

        // Check brand
        let bMatch = false;
        if (rName.includes('poki') && vBrand === 'Poki-Woki') bMatch = true;
        else if (rName.includes('roll') && vBrand === 'Roll Master') bMatch = true;
        else if (rName.includes('love') && vBrand === 'Love Sushi') bMatch = true;
        else if (rName.includes('smash') && vBrand === 'Smash Me') bMatch = true;
        else if (rName.includes('crunch') && vBrand === 'Crunch') bMatch = true;

        if (!bMatch) continue;

        // Check city and specific location
        if (rName.includes('unirii') && (vName.includes('halelor') || vName.includes('unirii'))) matchedVenue = v;
        else if (rName.includes('titan') && vName.includes('titan')) matchedVenue = v;
        else if (rName.includes('ceaikovski') && vName.includes('ceaikovski')) matchedVenue = v;
        else if (rName.includes('balotesti') && vName.includes('balotesti')) matchedVenue = v;
        else if (rName.includes('cora') && (vName.includes('lujerului') || vName.includes('cora'))) matchedVenue = v;
        else if (rCity.includes('cluj') && vCity.includes('cluj')) matchedVenue = v;
        else if (rCity.includes('craiova') && vCity.includes('craiova')) matchedVenue = v;
        else if (rCity.includes('galati') && vCity.includes('galati')) matchedVenue = v;
        else if (rCity.includes('braila') && vCity.includes('braila')) matchedVenue = v;
        else if (rCity.includes('oradea') && vCity.includes('oradea')) matchedVenue = v;
        else if (rCity.includes('piatra neamt') && vCity.includes('piatra')) matchedVenue = v;
        else if (rCity.includes('suceava') && vCity.includes('suceava')) matchedVenue = v;
        else if (rCity.includes('iasi') && vCity.includes('iasi')) matchedVenue = v;
        else if (rCity.includes('timisoara') && vCity.includes('timisoara')) matchedVenue = v;
        else if (rCity.includes('sibiu') && vCity.includes('sibiu')) matchedVenue = v;
        else if (rCity.includes('constanta') && vCity.includes('constanta')) matchedVenue = v;
        else if (rCity.includes('tulcea') && vCity.includes('tulcea')) matchedVenue = v;

        if (matchedVenue) break;
      }

      if (matchedVenue) {
        const venueId = matchedVenue['Venue ID']?.trim();
        if (venueId) {
          const woltUrl = `https://wolt.com/en/rou/restaurant/${venueId}`;
          const { error } = await supabase.from('restaurants').update({ wolt_url: woltUrl }).eq('id', r.id);
          if (!error) {
            woltFixed++;
            console.log(`[Wolt Mapped] ${r.name} -> ${woltUrl} (${matchedVenue['Venue Name']})`);
          }
        }
      }
    }
    console.log(`Total Wolt URLs mapped: ${woltFixed}\n`);
  }

  console.log('=== ALL DATABASE FIXES APPLIED SUCCESSFULLY ===');
}

main().catch(console.error);
