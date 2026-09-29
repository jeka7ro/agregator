import { supabase } from '../src/services/supabase.js';

// Matricea exactă de slug-uri Glovo validate direct prin Glovo API (HTTP 200)
const GLOVO_MAPPINGS = [
  // Bacau
  { cityMatch: 'bacau', brandMatch: 'roll master', url: 'https://glovoapp.com/ro/ro/bacau/stores/sushi-master-bcu' },
  { cityMatch: 'bacau', brandMatch: 'poki woki', url: 'https://glovoapp.com/ro/ro/bacau/stores/ikura-sushi-bcu' },

  // Brasov
  { cityMatch: 'brasov', brandMatch: 'roll master', url: 'https://glovoapp.com/ro/ro/brasov/stores/roll-master-brv' },
  { cityMatch: 'brasov', brandMatch: 'poki woki', url: 'https://glovoapp.com/ro/ro/brasov/stores/ikurasushi' },

  // Botosani
  { cityMatch: 'botosani', brandMatch: 'roll master', url: 'https://glovoapp.com/ro/ro/botosani/stores/sushi-master-bto' },
  { cityMatch: 'botosani', brandMatch: 'poki woki', url: 'https://glovoapp.com/ro/ro/botosani/stores/ikura-sushi-bto' },

  // Bucuresti (hub-uri centrale)
  { cityMatch: 'buc', brandMatch: 'roll master', url: 'https://glovoapp.com/ro/ro/bucuresti/stores/sushi-master' },
  { cityMatch: 'buc', brandMatch: 'poki woki', url: 'https://glovoapp.com/ro/ro/bucuresti/stores/ikurasushi-buc' },

  // Cluj
  { cityMatch: 'cluj', brandMatch: 'roll master', url: 'https://glovoapp.com/ro/ro/cluj-napoca/stores/sushi-masterclj' },
  { cityMatch: 'cluj', brandMatch: 'poki woki', url: 'https://glovoapp.com/ro/ro/cluj-napoca/stores/ikurasushiclj' },
  { cityMatch: 'cluj', brandMatch: 'smash me', url: 'https://glovoapp.com/ro/ro/cluj-napoca/stores/smash-me-clj' },

  // Balotesti / Corbeanca
  { cityMatch: 'balotesti', brandMatch: 'roll master', url: 'https://glovoapp.com/ro/ro/balotesti/stores/sushi-master2' },
  { cityMatch: 'balotesti', brandMatch: 'poki woki', url: 'https://glovoapp.com/ro/ro/balotesti/stores/ikura-crb' },

  // Constanta
  { cityMatch: 'constanta', brandMatch: 'roll master', url: 'https://glovoapp.com/ro/ro/constanta/stores/sushi-master-cta' },
  { cityMatch: 'constanta', brandMatch: 'poki woki', url: 'https://glovoapp.com/ro/ro/constanta/stores/ikura-sushi-cta' },
  { cityMatch: 'constanta', brandMatch: 'smash me', url: 'https://glovoapp.com/ro/ro/constanta/stores/smash-me' },

  // Craiova
  { cityMatch: 'craiova', brandMatch: 'roll master', url: 'https://glovoapp.com/ro/ro/craiova/stores/sushi-master-crv' },
  { cityMatch: 'craiova', brandMatch: 'poki woki', url: 'https://glovoapp.com/ro/ro/craiova/stores/ikura-sushi-crv' },

  // Galati
  { cityMatch: 'galati', brandMatch: 'roll master', url: 'https://glovoapp.com/ro/ro/galati/stores/sushi-mastergl' },
  { cityMatch: 'galati', brandMatch: 'poki woki', url: 'https://glovoapp.com/ro/ro/galati/stores/ikura-sushi-galati' },

  // Iasi
  { cityMatch: 'iasi', brandMatch: 'roll master', url: 'https://glovoapp.com/ro/ro/iasi/stores/sushi-master-ias' },
  { cityMatch: 'iasi', brandMatch: 'poki woki', url: 'https://glovoapp.com/ro/ro/iasi/stores/ikurasushi-ias' },

  // Oradea
  { cityMatch: 'oradea', brandMatch: 'roll master', url: 'https://glovoapp.com/ro/ro/oradea/stores/sushi-masterord' },
  { cityMatch: 'oradea', brandMatch: 'poki woki', url: 'https://glovoapp.com/ro/ro/oradea/stores/ikurasushi-ord' },

  // Pitesti
  { cityMatch: 'pitesti', brandMatch: 'roll master', url: 'https://glovoapp.com/ro/ro/pitesti/stores/sushi-master-pit' },
  { cityMatch: 'pitesti', brandMatch: 'poki woki', url: 'https://glovoapp.com/ro/ro/pitesti/stores/ikura-sushi-pit' },

  // Piatra Neamt
  { cityMatch: 'piatra neamt', brandMatch: 'roll master', url: 'https://glovoapp.com/ro/ro/piatra-neamt/stores/sushi-master-ptn' },
  { cityMatch: 'piatra neamt', brandMatch: 'poki woki', url: 'https://glovoapp.com/ro/ro/piatra-neamt/stores/ikura-sushi-ptn' },

  // Sibiu
  { cityMatch: 'sibiu', brandMatch: 'roll master', url: 'https://glovoapp.com/ro/ro/sibiu/stores/sushimaster' },
  { cityMatch: 'sibiu', brandMatch: 'poki woki', url: 'https://glovoapp.com/ro/ro/sibiu/stores/ikurasushi-sbu' },

  // Suceava
  { cityMatch: 'suceava', brandMatch: 'roll master', url: 'https://glovoapp.com/ro/ro/suceava/stores/sushi-master-scv' },
  { cityMatch: 'suceava', brandMatch: 'poki woki', url: 'https://glovoapp.com/ro/ro/suceava/stores/ikura-sushi' },

  // Targu Mures
  { cityMatch: 'targu mures', brandMatch: 'roll master', url: 'https://glovoapp.com/ro/ro/targu-mures/stores/sushi-master-tgm' },
  { cityMatch: 'targu mures', brandMatch: 'poki woki', url: 'https://glovoapp.com/ro/ro/targu-mures/stores/ikura-sushi-targu-mures' },

  // Timisoara
  { cityMatch: 'timisoara', brandMatch: 'roll master', url: 'https://glovoapp.com/ro/ro/timisoara/stores/sushi-master-tim' },
  { cityMatch: 'timisoara', brandMatch: 'poki woki', url: 'https://glovoapp.com/ro/ro/timisoara/stores/poki-woki-tim' },

  // Tulcea
  { cityMatch: 'tulcea', brandMatch: 'roll master', url: 'https://glovoapp.com/ro/ro/tulcea/stores/sushi-master-tul' },
  { cityMatch: 'tulcea', brandMatch: 'poki woki', url: 'https://glovoapp.com/ro/ro/tulcea/stores/ikura-sushi-tul' },
];

async function applyAccurateFixes() {
  console.log('=== Incepe aplicarea slug-urilor Glovo reale si ID-urilor iiko ===');

  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select('id, name, city, glovo_url, iiko_restaurant_id, iiko_config, is_active');

  if (error) {
    console.error('Eroare la preluarea restaurantelor:', error);
    return;
  }

  let glovoUpdatedCount = 0;
  let iikoUpdatedCount = 0;

  for (const r of restaurants) {
    const cityNorm = (r.city || '').toLowerCase().trim();
    const nameNorm = (r.name || '').toLowerCase().trim();

    // 1. Gaseste mapping Glovo
    const match = GLOVO_MAPPINGS.find(m => {
      const cityMatches = cityNorm.includes(m.cityMatch) || nameNorm.includes(m.cityMatch);
      const brandMatches = nameNorm.includes(m.brandMatch);
      return cityMatches && brandMatches;
    });

    const updates = {};

    if (match && r.glovo_url !== match.url) {
      updates.glovo_url = match.url;
      glovoUpdatedCount++;
      console.log(`[GLOVO UPDATE] ${r.name} (${r.city}) -> ${match.url}`);
    }

    // 2. Corectare iiko Syrve organizationId
    // Timisoara -> 0af6b0d4-c56f-4264-9384-965d24c97e43 (RM TIMISOARA)
    if (cityNorm.includes('timisoara') || nameNorm.includes('timisoara')) {
      const currentOrg = r.iiko_config?.organizationId || r.iiko_restaurant_id;
      if (currentOrg !== '0af6b0d4-c56f-4264-9384-965d24c97e43') {
        const newConfig = { ...(r.iiko_config || {}), organizationId: '0af6b0d4-c56f-4264-9384-965d24c97e43', api_login: '93a34e75123e47b897e390f31ecfa4cb' };
        updates.iiko_restaurant_id = '0af6b0d4-c56f-4264-9384-965d24c97e43';
        updates.iiko_config = newConfig;
        iikoUpdatedCount++;
        console.log(`[IIKO TIMISOARA] ${r.name} -> orgId: 0af6b0d4-c56f-4264-9384-965d24c97e43`);
      }
    }

    // Smash Me Cluj & Crunch Cluj -> 90296b11-9ba9-4279-a69b-1f84e193315e (SM CLUJ)
    if (nameNorm.includes('cluj') && (nameNorm.includes('smash') || nameNorm.includes('crunch'))) {
      const newConfig = { ...(r.iiko_config || {}), organizationId: '90296b11-9ba9-4279-a69b-1f84e193315e', api_login: '93a34e75123e47b897e390f31ecfa4cb' };
      updates.iiko_restaurant_id = '90296b11-9ba9-4279-a69b-1f84e193315e';
      updates.iiko_config = newConfig;
      iikoUpdatedCount++;
      console.log(`[IIKO CLUJ SMASH] ${r.name} -> orgId: 90296b11-9ba9-4279-a69b-1f84e193315e`);
    }

    // Smash Me Constanta & Crunch Constanta -> 8ed15b53-e788-411b-8a06-96d0f9ee005a (SM CONSTANTA)
    if (nameNorm.includes('constanta') && (nameNorm.includes('smash') || nameNorm.includes('crunch'))) {
      const newConfig = { ...(r.iiko_config || {}), organizationId: '8ed15b53-e788-411b-8a06-96d0f9ee005a', api_login: '93a34e75123e47b897e390f31ecfa4cb' };
      updates.iiko_restaurant_id = '8ed15b53-e788-411b-8a06-96d0f9ee005a';
      updates.iiko_config = newConfig;
      iikoUpdatedCount++;
      console.log(`[IIKO CONSTANTA SMASH] ${r.name} -> orgId: 8ed15b53-e788-411b-8a06-96d0f9ee005a`);
    }

    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await supabase
        .from('restaurants')
        .update(updates)
        .eq('id', r.id);

      if (updErr) {
        console.error(`Eroare actualizare ${r.name}:`, updErr.message);
      }
    }
  }

  console.log(`\n=== FINALIZAT ===`);
  console.log(`Actualizari Glovo aplicate: ${glovoUpdatedCount}`);
  console.log(`Actualizari iiko aplicate: ${iikoUpdatedCount}`);
}

applyAccurateFixes().catch(console.error);
