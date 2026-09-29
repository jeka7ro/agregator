import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { supabase } from './src/services/supabase.js'
import { IikoChecker } from './src/checkers/iiko-checker.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_FILE = path.resolve(__dirname, '..', 'data', 'live-checks-cache.json')

async function run() {
    console.log('Fetching restaurants...')
    const { data: restaurants } = await supabase.from('restaurants').select('*')
    
    let cache = []
    if (fs.existsSync(CACHE_FILE)) {
        cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
    }

    cache = cache.filter(c => c.platform !== 'iiko')
    const checker = new IikoChecker()

    console.log('Checking iiko with IikoChecker...')
    for (const r of restaurants) {
        if (r.iiko_restaurant_id) {
            const result = await checker.check(r)
            if (result) {
                cache.push(result)
            }
        }
    }
    
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2))
    console.log('Fixed cache with full products data!')
    process.exit(0)
}
run()
