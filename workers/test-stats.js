import { supabase } from './src/services/supabase.js';

async function run() {
  const { data } = await supabase.from('restaurants').select('name, is_active, city, glovo_url, wolt_url, bolt_url').eq('is_active', true);
  console.log(`Total active: ${data.length}`);
  console.log(`With Glovo: ${data.filter(d => d.glovo_url).length}`);
  console.log(`With Wolt: ${data.filter(d => d.wolt_url).length}`);
  
  const missingAll = data.filter(d => !d.glovo_url && !d.wolt_url && !d.bolt_url);
  console.log(`Missing ALL platforms: ${missingAll.length}`);
  missingAll.forEach(m => console.log(` - ${m.name} (${m.city})`));
  process.exit(0);
}
run();
