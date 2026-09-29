import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({path: 'workers/.env'})
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
async function go() {
    const { data } = await supabase.from('restaurants').select('id, name, city').ilike('name', '%brasov%');
    console.log(data);
}
go();
