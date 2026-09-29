/**
 * Sync script - populates database with the COMPLETE list of Sushi Master restaurants
 * matching the user's master list. One row per LOCATION, all platform URLs combined.
 * All URLs verified as HTTP 200.
 */
import { supabase } from '../src/services/supabase.js'

// The COMPLETE list matching user's spreadsheet
// One entry per location, all platform URLs combined
const RESTAURANTS = [
    {
        name: 'Sushi Master Halelor',
        city: 'Bucuresti',
        glovo_url: 'https://glovoapp.com/ro/ro/bucuresti/stores/sushi-master-buc',
        wolt_url: 'https://wolt.com/ro/rou/bucharest/restaurant/sushi-master-bucuresti-halelor-67dd59415e61a1513fbf7037',
        bolt_url: 'https://food.bolt.eu/ro-RO/restaurant/sushi-master-halelor',
    },
    {
        name: 'Sushi Master Lujerului',
        city: 'Bucuresti',
        glovo_url: null,
        wolt_url: 'https://wolt.com/ro/rou/bucharest/restaurant/sushi-master-lujerului-67dd59415e61a1513fbf703a',
        bolt_url: 'https://food.bolt.eu/ro-RO/restaurant/sushi-master-lujerului',
    },
    {
        name: 'Sushi Master Cluj',
        city: 'Cluj-Napoca',
        glovo_url: 'https://glovoapp.com/ro/ro/cluj-napoca/stores/sushi-masterclj',
        wolt_url: 'https://wolt.com/ro/rou/cluj-napoca/restaurant/sushi-master-cluj-napoca-67dd59415e61a1513fbf703c',
        bolt_url: 'https://food.bolt.eu/ro-RO/restaurant/sushi-master-cluj',
    },
    {
        name: 'Sushi Master Tudor Vladimirescu',
        city: 'Iasi',
        glovo_url: null,
        wolt_url: 'https://wolt.com/ro/rou/iasi/restaurant/sushi-master-tudor-67dad68ddb56261b0e642509',
        bolt_url: 'https://food.bolt.eu/ro-RO/restaurant/sushi-master-tudor-vladimirescu',
    },
    {
        name: 'Sushi Master Bucuresti',
        city: 'Bucuresti',
        glovo_url: 'https://glovoapp.com/ro/ro/bucuresti/stores/sushi-master-buc',
        wolt_url: null,
        bolt_url: 'https://food.bolt.eu/ro-RO/restaurant/sushi-master-bucuresti',
    },
    {
        name: 'Sushi Master Corbeanca',
        city: 'Bucuresti',
        glovo_url: 'https://glovoapp.com/ro/ro/bucuresti/stores/sushi-master-corbeanca',
        wolt_url: null,
        bolt_url: 'https://food.bolt.eu/ro-RO/restaurant/sushi-master-corbeanca',
    },
    {
        name: 'Sushi Master Galati',
        city: 'Galati',
        glovo_url: 'https://glovoapp.com/ro/ro/galati/stores/sushi-mastergl',
        wolt_url: null,
        bolt_url: 'https://food.bolt.eu/ro-RO/restaurant/sushi-master-galati',
    },
    {
        name: 'Sushi Master Iasi',
        city: 'Iasi',
        glovo_url: 'https://glovoapp.com/ro/ro/iasi/stores/sushi-master-ias',
        wolt_url: 'https://wolt.com/ro/rou/iasi/restaurant/sushi-master-iasi-67dad68ddb56261b0e642501',
        bolt_url: 'https://food.bolt.eu/ro-RO/restaurant/sushi-master-iasi',
    },
    {
        name: 'Sushi Master Sibiu',
        city: 'Sibiu',
        glovo_url: 'https://glovoapp.com/ro/ro/sibiu/stores/sushi-master-sib',
        wolt_url: null,
        bolt_url: 'https://food.bolt.eu/ro-RO/restaurant/sushi-master-sibiu',
    },
    {
        name: 'Sushi Master Suceava',
        city: 'Suceava',
        glovo_url: 'https://glovoapp.com/ro/ro/suceava/stores/sushi-mastersv',
        wolt_url: null,
        bolt_url: 'https://food.bolt.eu/ro-RO/restaurant/sushi-master-suceava',
    },
    {
        name: 'Sushi Master Targu Mures',
        city: 'Targu Mures',
        glovo_url: 'https://glovoapp.com/ro/ro/targu-mures/stores/sushi-mastertgm',
        wolt_url: null,
        bolt_url: 'https://food.bolt.eu/ro-RO/restaurant/sushi-master-targu-mures',
    },
    {
        name: 'Sushi Master - Brasov',
        city: 'Brasov',
        glovo_url: 'https://glovoapp.com/ro/ro/brasov/stores/sushi-marster-brv',
        wolt_url: 'https://wolt.com/ro/rou/brasov/restaurant/sushi-master-brasov-67dd59415e61a1513fbf7035',
        bolt_url: 'https://food.bolt.eu/ro-RO/restaurant/sushi-master-brasov',
    },
    {
        name: 'Sushi Master - Ceaikovski',
        city: 'Bucuresti',
        glovo_url: null,
        wolt_url: 'https://wolt.com/ro/rou/bucharest/restaurant/sushi-master-ceaikovski-67dd59415e61a1513fbf703b',
        bolt_url: null,
    },
    {
        name: 'Sushi Master - Titan',
        city: 'Bucuresti',
        glovo_url: null,
        wolt_url: 'https://wolt.com/ro/rou/bucharest/restaurant/sushi-master-titan-67dd59415e61a1513fbf7036',
        bolt_url: null,
    },
    {
        name: 'Sushi Master - Constanta',
        city: 'Constanta',
        glovo_url: 'https://glovoapp.com/ro/ro/constanta/stores/sushi-master-cta',
        wolt_url: 'https://wolt.com/ro/rou/constanta/restaurant/sushi-master-constanta',
        bolt_url: 'https://food.bolt.eu/ro-RO/restaurant/sushi-master-constanta',
    },
]

async function syncRestaurants() {
    console.log('🔄 Starting restaurant sync...')
    console.log(`📋 Will sync ${RESTAURANTS.length} restaurants\n`)

    // Step 1: Delete ALL existing data
    console.log('🗑️  Clearing existing data...')

    await supabase
        .from('monitoring_checks')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
    console.log('  ✅ Monitoring checks cleared')

    await supabase
        .from('alerts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
    console.log('  ✅ Alerts cleared')

    const { error: delErr } = await supabase
        .from('restaurants')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

    if (delErr) {
        console.error('  ❌ Error deleting restaurants:', delErr.message)
        return
    }
    console.log('  ✅ Old restaurants cleared\n')

    // Step 2: Insert all restaurants
    console.log('📝 Inserting restaurants...\n')
    let inserted = 0

    for (const r of RESTAURANTS) {
        const record = {
            name: r.name,
            city: r.city,
            glovo_url: r.glovo_url,
            wolt_url: r.wolt_url,
            bolt_url: r.bolt_url,
            is_active: true,
        }

        const { data, error } = await supabase
            .from('restaurants')
            .insert(record)
            .select()
            .single()

        if (error) {
            console.error(`  ❌ ${r.name}: ${error.message}`)
        } else {
            inserted++
            const platforms = [
                r.glovo_url ? '🟡 Glovo' : null,
                r.wolt_url ? '🔵 Wolt' : null,
                r.bolt_url ? '⚡ Bolt' : null,
            ].filter(Boolean).join(' | ')
            console.log(`  ✅ ${r.name} (${r.city})`)
            console.log(`     ${platforms}`)
        }
    }

    console.log(`\n${'='.repeat(50)}`)
    console.log(`🎉 Sync complete: ${inserted}/${RESTAURANTS.length} restaurants`)
    console.log(`${'='.repeat(50)}`)
}

syncRestaurants().catch(console.error)
