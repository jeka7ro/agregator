import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
dotenv.config({path: './.env'})

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function createSqlFunc() {
  console.log("We need to run SQL via some REST request or similar.");
}
createSqlFunc()
