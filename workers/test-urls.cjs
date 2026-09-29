require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data } = await supabase.from('restaurants').select('name, city, glovo_url, wolt_url').eq('is_active', true).limit(3);
  console.log(JSON.stringify(data, null, 2));
}
run();
