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
  }
]

/**
 * Normalize a product name for fuzzy comparison
 */
function normalizeName(name) {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')   // remove (modifiers)
    .replace(/\[.*?\]/g, '')   // remove [comments]
    .replace(/\b\d+\s*(gr|g|ml|kg|l)\b/gi, '') // remove quantities like 150 gr
    .replace(/[^a-z0-9]/g, '') // alphanumeric only
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
  const rawLower = rawName.toLowerCase()

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

  // 4. Keyword token match
  const rawWords = rawLower.split(/\s+/).filter(w => w.length > 3)
  if (rawWords.length > 0) {
    const tokenMatch = catalogCache.find(e => {
      const eLower = e.name.toLowerCase()
      return rawWords.some(w => eLower.includes(w))
    })
    if (tokenMatch) return tokenMatch
  }

  return null
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
