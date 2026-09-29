import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function runSQL() {
    // There isn't a direct way to run DDL via REST without a function
    // But maybe we can just create configs directly from the client?
    // User wants general search with OR, daily/weekly repetition, multiple rules, multiple times.
    // AND individual schedules for restaurants.
}
runSQL()
