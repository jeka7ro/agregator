import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('./.env', 'utf-8');
const env = envText.split('\n').reduce((acc, line) => {
    const [k, ...v] = line.split('=');
    if(k && v.length) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
    return acc;
}, {});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

async function run() {
    console.log('Fetching snapshots...');
    const { data: snaps, error: snapErr } = await supabase.from('competitor_snapshots').select('id');
    if (snapErr) return console.error(snapErr);
    
    const snapIds = new Set(snaps.map(s => s.id));
    console.log('Valid snapshots:', snapIds.size);

    console.log('Fetching restaurants to check orphans...');
    let start = 0;
    const allOrphans = [];
    while(true) {
        const { data: rests, error: err } = await supabase.from('competitor_restaurants')
            .select('id, snapshot_id')
            .range(start, start + 999);
            
        if (err) return console.error('Error fetching restaurants', err);
        if (!rests || rests.length === 0) break;
        
        const orphans = rests.filter(r => !snapIds.has(r.snapshot_id));
        allOrphans.push(...orphans.map(o => o.id));
        console.log(`Fetched range ${start}-${start+999}. Found ${orphans.length} orphans in batch. Total orphans so far: ${allOrphans.length}`);
        
        start += 1000;
    }

    console.log(`Total orphans to delete: ${allOrphans.length}`);
    for (let i = 0; i < allOrphans.length; i += 200) {
        const ids = allOrphans.slice(i, i + 200);
        const { error: delErr } = await supabase.from('competitor_restaurants').delete().in('id', ids);
        if(delErr) console.error('Delete error', delErr);
        console.log(`Deleted chunk ${i} to ${i+200}`);
    }

    console.log('Done cleaning restaurants!');
    process.exit(0);
}
run();
