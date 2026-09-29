import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
dotenv.config()
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const { data, error } = await supabase.from('restaurants').select('id, name, city, address, glovo_url, wolt_url')
fs.writeFileSync('dump.json', JSON.stringify(data, null, 2))
const missing = data.filter(r => !r.address || r.address.trim() === '')
console.log(`Total restaurants: ${data.length}`)
console.log(`Missing address: ${missing.length}`)
