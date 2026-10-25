import { supabase } from './supabase.js'

// In-memory catalog cache for instant matching
let catalogCache = []
let lastFetchedAt = 0

// Official Syrve / iiko Nomenclature Seeds for instant zero-latency matching
const SYRVE_SEEDS = [
  // Smash Me Burgers & Fries
  {
    name: 'Cheesburger Simplu',
    synonyms: ['cheeseburger', 'cheesburger', 'cheese burger', 'classic cheeseburger', 'burger simplu'],
    brand: 'Smash Me',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/7601594/5f23895a-a7b6-4fd6-a6dd-a9d713b30d5a.jpg',
    description: 'Carne de vită, Black Angus, smash suculentă, cheddar topit, salată proaspătă, ceapă, castraveți murați și sosuri savuroase între două chifle pufoase. Gust clasic, simplu și irezistibil. (270g)',
    ingredients: 'Chiflă artizanală, carne vită Black Angus 100%, brânză cheddar, castraveți murați, ceapă, salată iceberg, sos clasic, ketchup, muștar'
  },
  {
    name: 'Cheesburger Dublu',
    synonyms: ['double cheeseburger', 'cheeseburger dublu', 'cheesburger dublu', 'double cheese burger'],
    brand: 'Smash Me',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/7601594/4e21ae1f-d604-458e-9a81-05f1b5f7a378.jpg',
    description: 'Două straturi de carne de vită Black Angus smash suculentă, brânză cheddar topită, salată iceberg crocantă, ceapă proaspătă, castraveți murați și sosuri delicioase. (335g)',
    ingredients: 'Chiflă artizanală, 2x carne vită Black Angus, 2x brânză cheddar, castraveți murați, salată iceberg, sos clasic, ketchup, muștar'
  },
  {
    name: 'Smashed ME Burger Simplu',
    synonyms: ['classic smash burger', 'smash burger', 'smashed me simplu', 'smash burger simplu'],
    brand: 'Smash Me',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/7601594/5f23895a-a7b6-4fd6-a6dd-a9d713b30d5a.jpg',
    description: 'Carne de vită Black Angus presată pe plită încinsă (smash), margini crocante caramelizate, cheddar topit și sos secret Smash Me.',
    ingredients: 'Carne vită Black Angus, chiflă glazurată cu unt, cheddar maturat, ceapă caramelizată, sos Smash Me'
  },
  {
    name: 'Smashed ME Burger Dublu',
    synonyms: ['double smash burger', 'double smash', 'smashed me burger dublu', 'smash dublu'],
    brand: 'Smash Me',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/7601594/4e21ae1f-d604-458e-9a81-05f1b5f7a378.jpg',
    description: '2x carne de vită Black Angus smash, crustă crocantă, dublu cheddar topit, bacon crocant și sos special.',
    ingredients: '2x carne vită Black Angus, 2x cheddar maturat, bacon crocant, chiflă rumenită cu unt, sos Smash Me'
  },
  {
    name: 'Cartofi Prajiti Classic 150 gr',
    synonyms: ['cartofi', 'cartofi prajiti', 'cartofi prajiti mari', 'cartofi clasic', 'cartofi prajiti clasic', 'french fries'],
    brand: 'Smash Me',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/7601594/3d988f31-87fc-4df3-bea3-38d085c3b63c.jpg',
    description: 'Cartofi aurii și crocanți, prăjiți la perfecțiune și asezonați simplu cu sare marină - gustul clasic care merge perfect lângă orice burger. (150g)',
    ingredients: 'Cartofi preprăjiți, ulei floarea-soarelui 100% high-oleic, sare marină'
  },
  {
    name: 'Cartofi Prajiti Cajun 150 gr',
    synonyms: ['cartofi cajun', 'cartofi prajiti cajun', 'cajun fries'],
    brand: 'Smash Me',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/7601594/da943aad-e9b5-4ef1-9545-e5faf1aedd0e.jpg',
    description: 'Cartofi crocanți condimentați cu mix aromat de boia, usturoi, piper și ierburi - o combinație ușor picantă și plină de savoare. (150g)',
    ingredients: 'Cartofi, ulei high-oleic, mix condimente cajun (boia dulce, usturoi, piper, cimbrișor, chilli)'
  },
  {
    name: 'Cartofi Prajiti Usturoi si Patrunjel 150 gr',
    synonyms: ['cartofi usturoi', 'cartofi cu usturoi', 'cartofi usturoi si patrunjel'],
    brand: 'Smash Me',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/7601594/d8d1348e-6ce1-4970-bfe3-65b445b56d57.jpg',
    description: 'Cartofi aurii și crocanți, asezonați cu usturoi proaspăt zdrobit și pătrunjel tocat. (150g)',
    ingredients: 'Cartofi, ulei high-oleic, usturoi, pătrunjel proaspăt, sare'
  },
  {
    name: 'Chicken Burger',
    synonyms: ['chicken burger', 'burger pui', 'crispy chicken burger'],
    brand: 'Smash Me',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/7601594/2f8f7423-f2b3-4fe6-a94f-f3900ca89fc1.jpg',
    description: 'Piept de pui suculent în crustă crocantă aurie, salată proaspătă și sos fin de maioneză cu ierburi.',
    ingredients: 'Piept pui în crustă crocantă, chiflă, salată iceberg, maioneză, castraveți murați'
  },
  {
    name: 'Sos Smash Me 50g',
    synonyms: ['sos smash', 'sos smash me', 'smash sauce'],
    brand: 'Smash Me',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/7601594/54f8ffee-f5bd-4b1b-8ae1-e396afb86a44.jpg',
    description: 'Sosul casei cu maioneză, ketchup, muștar Dijon, castraveți murați tocați fin și condimente secrete. (50g)',
    ingredients: 'Maioneză, ketchup, muștar, castraveți murați, ceapă granulată, sare, condimente'
  },
  {
    name: 'Vanilla Milkshake',
    synonyms: ['vanilla milkshake', 'milkshake vanilie', 'shake vanilie'],
    brand: 'Smash Me',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/7601594/62a91ae7-16fd-46f5-a3b5-449022aef0c8.jpg',
    description: 'Milkshake cremos din înghețată artizanală de vanilie de Madagascar și lapte proaspăt.',
    ingredients: 'Lapte 3.5%, înghețată vanilie bourbon, frișcă naturală'
  },
  // Roll Master / Sushi Master Official Syrve Seeds
  {
    name: 'SushiMaster Big in Japan',
    synonyms: ['big in japan', 'rollmaster big in japan', 'sushimaster big in japan', 'japan'],
    brand: 'Roll Master',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/6feb48c5-2886-4da5-b10d-47097fd98821.png',
    description: 'Set emblematic cu somon, ton, creveți tempura și avocado.',
    ingredients: null
  },
  {
    name: 'SushiMaster Big Party Set',
    synonyms: ['big party set', 'top rolls selection set', 'selection set', 'rolls selection', 'big party', 'grand gurmand', 'master choice'],
    brand: 'Roll Master',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/4660855e-dbb6-43f8-bf73-86dd8e1f3705.png',
    description: 'Platou festiv cu selecție variată de maki, nigiri și uramaki.',
    ingredients: null
  },
  {
    name: 'SushiMaster Royal Party Set',
    synonyms: ['royal party', 'royal party set', 'rollmaster royal party'],
    brand: 'Roll Master',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/35c937ce-f358-4d63-b637-e0a840462b20.png',
    description: 'Selecție regală de sushi premium cu somon proaspăt și icre tobiko.',
    ingredients: null
  },
  {
    name: 'Sushimaster Fusion Set',
    synonyms: ['fusion', 'love fusion', 'tempura&fusion', 'tempura fusion', 'fusion set'],
    brand: 'Love Sushi',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/6e17ce44-cc0a-4b76-b9fe-38516258526a.png',
    description: 'Combinație fusion modernă de arome crocante și sosuri dulci-picante.',
    ingredients: null
  },
  {
    name: 'We Love Phila Set',
    synonyms: ['phila set', 'love phila set', 'phila love new edition', 'love new edition', 'new edition'],
    brand: 'Love Sushi',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/20a34ba4-dbcf-415a-a57d-69ad6e18686c.png',
    description: 'Celebra rețetă Philadelphia reinterpretată cu cremă bogată de brânză.',
    ingredients: null
  },
  {
    name: 'We Love Classic',
    synonyms: ['classic', 'love classic', 'classic set', 'we love classic'],
    brand: 'Love Sushi',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/26a416fc-5be2-436b-9c83-b8f09b0bb65c.png',
    description: 'Maki și uramaki tradiționale japoneze.',
    ingredients: null
  },
  {
    name: 'Shanghai',
    synonyms: ['shanghai', 'rollmaster shanghai'],
    brand: 'Roll Master',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/35fa2e92-078f-4c20-a824-6bc9178626eb.png',
    description: 'Roll cu pui crocant, sos dulce-acrișor și susan prăjit.',
    ingredients: null
  },
  {
    name: 'SushiMaster Phi♥LOVE♥delphia',
    synonyms: ['phi♥love♥delphia', 'philovedelphia', 'love philadelphia', 'philove'],
    brand: 'Love Sushi',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/4dcb55c2-3226-40ee-a2fa-2da7bda91eee.png',
    description: 'Set special creat din dragoste pentru iubitorii de Philadelphia.',
    ingredients: null
  },
  {
    name: 'Creveti Tempura',
    synonyms: ['tempura', 'creveti tempura', 'shrimp tempura', 'vegan tempura'],
    brand: 'Roll Master',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/af811ef8-3df1-4eca-b25c-abc1ec8e4916.png',
    description: 'Creveți crocanți în aluat japonez tempura.',
    ingredients: null
  },
  {
    name: 'Burger Somon',
    synonyms: ['burger somon', 'sushi burger somon'],
    brand: 'Roll Master',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/2ad07ee9-9df0-4dc6-8898-e73c2db6bf2e.jpg',
    description: 'Burger inedit din orez de sushi, somon proaspăt și sos cremos.',
    ingredients: null
  },
  {
    name: 'Burger Creveti',
    synonyms: ['burger creveti', 'sushi burger creveti'],
    brand: 'Roll Master',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/0533a7d5-400f-4d6f-a332-ec83e1e3bca5.jpg',
    description: 'Burger crocant de orez cu creveți tempura și avocado.',
    ingredients: null
  },
  {
    name: 'Wok orez cu pui in sos Teriyaki',
    synonyms: ['wok orez pui sos teriyaki', 'orez pui sos teriyaki', 'wok orez', 'wok udon'],
    brand: 'Poki Woki',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/e0d7070d-43d4-4195-bf79-a4488e2a9909.png',
    description: 'Orez prăjit la wok cu piept de pui fraged, legume proaspete și sos Teriyaki.',
    ingredients: null
  },
  {
    name: 'Poke Bowl Salmon',
    synonyms: ['poke bowl', 'poke somon', 'poke orez', 'poke ton'],
    brand: 'Poki Woki',
    image: 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/2d9ca6de-83c8-460b-be44-150dcbe9748a.png',
    description: 'Bol hawaiian nutritiv cu somon proaspăt marinat, edamame, avocado și orez.',
    ingredients: null
  }
]

/**
 * Normalize a product name for fuzzy comparison
 */
function normalizeName(name) {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/^(?:p_|pw_|rm_|sm_|ik_|ls_|[a-z0-9]{1,3}_)\s*/i, '')
    .replace(/\(.*?\)/g, '')   // remove (modifiers)
    .replace(/\[.*?\]/g, '')   // remove [comments]
    .replace(/\b\d+\s*(gr|g|ml|kg|l)\b/gi, '') // remove quantities like 150 gr
    .replace(/\b(rollmaster|sushimaster|we love|love sushi|roll master|sushi master|smash me|poki woki|crunch)\b/gi, '')
    .replace(/[^a-z0-9]/g, '') // alphanumeric only
    .trim()
}

/**
 * Load / Refresh iiko nomenclature catalog
 */
export async function refreshCatalogCache() {
  try {
    const { data: dbItems } = await supabase
      .from('iiko_catalog')
      .select('name, image_url, brand_name, category')
      .not('image_url', 'is', null)

    const items = (dbItems || []).map(it => ({
      name: it.name,
      synonyms: [it.name.toLowerCase()],
      brand: it.brand_name || 'All',
      image: it.image_url,
      description: `Preparat oficial sincronizat din nomenclatorul iiko (${it.category || 'Meniu'}).`,
      ingredients: null
    }))

    catalogCache = [...SYRVE_SEEDS, ...items]
    lastFetchedAt = Date.now()
    console.log(`[PRODUCT MATCHER] Catalog cache loaded with ${catalogCache.length} items with official Syrve/iiko images.`)
  } catch (err) {
    console.error('[PRODUCT MATCHER] Error refreshing catalog:', err.message)
    catalogCache = [...SYRVE_SEEDS]
  }
}

// Initial cache load
refreshCatalogCache()

/**
 * Match a raw product name to its official iiko photo and metadata
 */
export function matchProductImage(rawName, brandHint = '') {
  if (!rawName) return null
  if (catalogCache.length === 0) {
    catalogCache = [...SYRVE_SEEDS]
  }

  const cleanRaw = normalizeName(rawName)
  const rawLower = rawName.toLowerCase().replace(/^(?:p_|pw_|rm_|sm_|ik_|ls_|[a-z0-9]{1,3}_)\s*/i, '').trim()

  // 1. Direct synonym match
  for (const entry of catalogCache) {
    if (entry.synonyms && entry.synonyms.some(s => rawLower.includes(s) || s.includes(rawLower))) {
      return entry
    }
  }

  // 2. Normalized name equality
  const exact = catalogCache.find(e => normalizeName(e.name) === cleanRaw)
  if (exact) return exact

  // 3. Substring contains
  const sub = catalogCache.find(e => {
    const eNorm = normalizeName(e.name)
    return (cleanRaw.length > 3 && eNorm.includes(cleanRaw)) || (eNorm.length > 3 && cleanRaw.includes(eNorm))
  })
  if (sub) return sub

  // 4. Token similarity match
  const rawWords = rawLower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !['cu', 'in', 'sos', 'de', 'si'].includes(w))

  if (rawWords.length > 0) {
    let bestScore = 0
    let bestMatch = null
    for (const entry of catalogCache) {
      const eLower = entry.name.toLowerCase()
      const matches = rawWords.filter(w => eLower.includes(w))
      const score = matches.length / rawWords.length
      if (score > bestScore && score >= 0.4) {
        bestScore = score
        bestMatch = entry
      }
    }
    if (bestMatch) return bestMatch
  }

  // 5. Category-based fallback using official Syrve seeds
  if (rawLower.includes('set') || rawLower.includes('roll') || rawLower.includes('sushi')) {
    return catalogCache.find(e => e.name.includes('Big Party Set')) || SYRVE_SEEDS[11]
  }
  if (rawLower.includes('burger') || rawLower.includes('smash')) {
    return catalogCache.find(e => e.name.includes('Smashed ME Burger Dublu')) || SYRVE_SEEDS[3]
  }
  if (rawLower.includes('wok') || rawLower.includes('orez') || rawLower.includes('udon') || rawLower.includes('noodle')) {
    return catalogCache.find(e => e.name.includes('Wok orez')) || SYRVE_SEEDS[21]
  }
  if (rawLower.includes('poke')) {
    return catalogCache.find(e => e.name.includes('Poke Bowl')) || SYRVE_SEEDS[22]
  }
  if (rawLower.includes('cartofi') || rawLower.includes('fries')) {
    return catalogCache.find(e => e.name.includes('Cartofi Prajiti Classic')) || SYRVE_SEEDS[4]
  }

  return SYRVE_SEEDS[11] // Default to signature sushi set photo
}

/**
 * Enrich order items with official Syrve / iiko image, description & ingredients
 */
export function enrichOrderItems(items = [], brandHint = '') {
  if (!Array.isArray(items)) return items

  return items.map((it, idx) => {
    // If it already has an authentic image URL, keep it
    if (it.image && it.image.startsWith('http')) {
      return it
    }

    const pName = it.name || it.product_name || ''
    const matched = matchProductImage(pName, brandHint)

    if (matched) {
      return {
        ...it,
        image: matched.image,
        imageUrl: matched.image,
        description: it.description || matched.description || null,
        ingredients: it.ingredients || matched.ingredients || null
      }
    }

    return it
  })
}
