import { supabase } from './src/services/supabase.js';

async function run() {
  const { data } = await supabase.from('restaurants').select('name, is_active, city, glovo_url, wolt_url, bolt_url').eq('is_active', true);
  console.log(`\n========= STATISTICI LINKURI (76 RESTAURANTE ACTIVE) =========`);
  console.log(`Glovo:  ${data.filter(d => d.glovo_url).length} linkuri extrase`);
  console.log(`Wolt:   ${data.filter(d => d.wolt_url).length} linkuri extrase`);
  console.log(`Bolt:   ${data.filter(d => d.bolt_url).length} linkuri extrase`);
  console.log(`==============================================================\n`);
  process.exit(0);
}
run();
