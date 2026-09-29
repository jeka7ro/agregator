import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const { data, error } = await supabase.rpc('get_tables')
if(error) {
  // alternative way to get tables if RPC doesn't exist
  const res = await supabase.from('checks').select('id').limit(1)
  console.log('checks table exists:', !res.error)
} else {
  console.log(data)
}
