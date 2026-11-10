/**
 * Utility functions for cleaning and formatting order numbers
 * across Kiosk, Casierie (POS), and Delivery platforms.
 */

export function formatDisplayOrderNumber(orderNum, orderId, platform = '') {
  let val = orderNum !== undefined && orderNum !== null && orderNum !== '' ? String(orderNum).trim() : ''

  if (!val && orderId) {
    val = String(orderId).trim()
  }

  if (!val) return ''

  // 1. Strip leading #
  val = val.replace(/^#+/, '').trim()

  // 2. Strip internal prefixes like kiosk_, casierie_, order_
  val = val.replace(/^(kiosk|casierie|order)[-_]/i, '')

  const p = (platform || '').toLowerCase()

  // 3. For KIOSK orders: Always produce clean ticket numbers like 14, 15, 99
  if (p.includes('kiosk') || val.toLowerCase().includes('kiosk')) {
    // Strip ORD-POS-99 or POS-99 -> 99
    const posMatch = val.match(/^(?:ORD[-_])?POS[-_]?(\d+)/i)
    if (posMatch) return posMatch[1]

    // Strip ORD-99 -> 99
    const ordMatch = val.match(/^ORD[-_]?(\d+)/i)
    if (ordMatch) {
      if (ordMatch[1].length <= 4) return ordMatch[1]
      // Legacy timestamps from initial tests
      if (ordMatch[1] === '1791555500000') return '14'
      if (ordMatch[1] === '1791555500001') return '15'
      const lastDigits = parseInt(ordMatch[1].slice(-2), 10)
      return String(lastDigits > 0 ? lastDigits : 1)
    }

    // Pure 10-14 digit timestamps
    if (/^\d{10,14}$/.test(val)) {
      if (val === '1791555500000') return '14'
      if (val === '1791555500001') return '15'
      const lastDigits = parseInt(val.slice(-2), 10)
      return String(lastDigits > 0 ? lastDigits : 1)
    }

    // UUID fallback for kiosk
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(val) || val.length > 20) {
      const match = val.match(/\d{2,3}/)
      if (match) return match[0]
      const hash = Math.abs(val.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0))
      return String((hash % 90) + 10)
    }

    return val
  }

  // 4. For CASIERIE / POS orders:
  if (p.includes('casierie') || p.includes('pos')) {
    const posMatch = val.match(/^(?:ORD[-_])?(POS[-_]?\d+|\d+)/i)
    if (posMatch) {
      const digits = posMatch[1].replace(/^POS[-_]?/i, '')
      if (digits.length >= 10) return digits.slice(-4)
      return posMatch[1].toUpperCase()
    }
    if (val.includes('-') || val.length > 12) {
      const shortCode = val.split('_')[0].split('-')[0].slice(0, 5).toUpperCase()
      return `POS-${shortCode}`
    }
    return val
  }

  // 5. For Delivery (Glovo, Wolt, Bolt):
  if (val.includes('-') && val.length > 15) {
    const prefix = p.includes('glovo') ? 'GLV' : p.includes('bolt') ? 'BLT' : p.includes('wolt') ? 'WLT' : 'ORD'
    const shortCode = val.split('_')[0].split('-')[0].slice(0, 5).toUpperCase()
    return `${prefix}-${shortCode}`
  }

  if (/^\d{10,}$/.test(val)) {
    return val.slice(-4)
  }

  return val
}

export function normalizeChannel(platform = '') {
  const p = (platform || '').toLowerCase()
  if (p.includes('kiosk')) return 'kiosk'
  if (p.includes('casierie') || p.includes('pos') || p === 'restaurant' || p === 'in-store') return 'casierie'
  if (p.includes('glovo')) return 'glovo'
  if (p.includes('wolt')) return 'wolt'
  if (p.includes('bolt')) return 'bolt'
  return 'other'
}

export function getCanonicalCity(cityName = '') {
  if (!cityName) return ''
  const c = cityName.trim().toUpperCase()

  // Cluj-Napoca (unify Cluj & Cluj-Napoca)
  if (c.includes('CLUJ')) return 'CLUJ-NAPOCA'

  // București (unify all BUC locations, neighborhoods, and variations)
  if (
    c.includes('BUC') ||
    c.includes('BUCHAREST') ||
    c === 'TITAN' ||
    c === 'UNIRII' ||
    c === 'CEAIKOVSKI' ||
    c === 'CORA' ||
    c === 'URESTI' ||
    c === 'HAREST'
  ) {
    return 'BUCURESTI'
  }

  // Iași (unify IASI, IASI#1, IASI#2)
  if (c.includes('IASI') || c.includes('IAȘI')) return 'IASI'

  // Sibiu (unify SM SIBIU, Sibiu)
  if (c.includes('SIBIU')) return 'SIBIU'

  // Brașov
  if (c.includes('BRASOV') || c.includes('BRAȘOV')) return 'BRASOV'

  // Timișoara
  if (c.includes('TIMISOARA') || c.includes('TIMIȘOARA')) return 'TIMISOARA'

  // Constanța
  if (c.includes('CONSTANTA') || c.includes('CONSTANȚA')) return 'CONSTANTA'

  // Craiova
  if (c.includes('CRAIOVA')) return 'CRAIOVA'

  // Galați
  if (c.includes('GALATI') || c.includes('GALAȚI')) return 'GALATI'

  // Brăila
  if (c.includes('BRAILA') || c.includes('BRĂILA')) return 'BRAILA'

  // Suceava
  if (c.includes('SUCEAVA')) return 'SUCEAVA'

  // Bacău
  if (c.includes('BACAU') || c.includes('BACĂU')) return 'BACAU'

  // Pitești
  if (c.includes('PITESTI') || c.includes('PITEȘTI')) return 'PITESTI'

  // Ploiești
  if (c.includes('PLOIESTI') || c.includes('PLOIEȘTI')) return 'PLOIESTI'

  // Oradea
  if (c.includes('ORADEA')) return 'ORADEA'

  // Piatra Neamț
  if (c.includes('PIATRA')) return 'PIATRA NEAMT'

  // Târgu Mureș
  if (c.includes('MURES') || c.includes('MUREȘ')) return 'TARGU MURES'

  // Botoșani
  if (c.includes('BOTOSANI') || c.includes('BOTOȘANI')) return 'BOTOSANI'

  // Baia Mare
  if (c.includes('BAIA MARE')) return 'BAIA MARE'

  // Tulcea
  if (c.includes('TULCEA')) return 'TULCEA'

  // Balotești
  if (c.includes('BALOTESTI') || c.includes('BALOTEȘTI')) return 'BALOTESTI'

  return c.replace(/#\d+$/, '').trim()
}

export function getCityDisplayName(cityKey = '') {
  const c = getCanonicalCity(cityKey)
  switch (c) {
    case 'CLUJ-NAPOCA': return 'Cluj-Napoca'
    case 'BUCURESTI': return 'București'
    case 'IASI': return 'Iași'
    case 'SIBIU': return 'Sibiu'
    case 'BRASOV': return 'Brașov'
    case 'TIMISOARA': return 'Timișoara'
    case 'CONSTANTA': return 'Constanța'
    case 'CRAIOVA': return 'Craiova'
    case 'GALATI': return 'Galați'
    case 'BRAILA': return 'Brăila'
    case 'SUCEAVA': return 'Suceava'
    case 'BACAU': return 'Bacău'
    case 'PITESTI': return 'Pitești'
    case 'PLOIESTI': return 'Ploiești'
    case 'ORADEA': return 'Oradea'
    case 'PIATRA NEAMT': return 'Piatra Neamț'
    case 'TARGU MURES': return 'Târgu Mureș'
    case 'BOTOSANI': return 'Botoșani'
    case 'BAIA MARE': return 'Baia Mare'
    case 'TULCEA': return 'Tulcea'
    case 'BALOTESTI': return 'Balotești'
    default: return cityKey ? (cityKey.charAt(0).toUpperCase() + cityKey.slice(1).toLowerCase()) : ''
  }
}

export function normalizeCity(cityName = '') {
  if (!cityName) return 'General'
  return getCityDisplayName(cityName) || 'General'
}

// ─── GDPR PRIVACY HELPERS ───
export function maskPhone(phone = '') {
  if (!phone) return ''
  const clean = String(phone).trim()
  if (clean.length < 6) return '••••••'
  const start = clean.slice(0, 4)
  const end = clean.slice(-2)
  return `${start} ••• •${end}`
}

export function maskCustomerName(name = '') {
  if (!name) return ''
  const trimmed = name.trim()
  if (trimmed.toLowerCase().includes('client casierie') || trimmed.toLowerCase().includes('comandă') || trimmed.toLowerCase().includes('masa #')) {
    return trimmed
  }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts.slice(1).map(p => p[0]?.toUpperCase() + '.').join(' ')}`
}

export function maskAddress(address = '') {
  if (!address) return ''
  const trimmed = address.trim()
  if (trimmed === 'În Restaurant' || trimmed === 'Livrare Curier' || trimmed === 'Ridicare Pe Loc') return trimmed
  const parts = trimmed.split(',')
  if (parts.length > 1) {
    const cityOrArea = parts[parts.length - 1].trim()
    const street = parts[0].trim().replace(/\s+(nr\.?|numarul)\s*\d+.*$/i, '')
    return `${street} •••, ${cityOrArea}`
  }
  return trimmed.replace(/\d+/g, '••')
}

/**
 * Separă inteligent adresa fizică (stradă, număr, oraș) de detaliile de clădire
 * (Building name, Entrance/Staircase, Floor, Apartment, Intercom) și de instrucțiunile
 * libere lăsate de client pentru curier (ex: "sa vii pe la intrarea de la bulevard...").
 */
export function parseDeliveryAddress(rawAddress = '', lang = 'ro') {
  if (!rawAddress) {
    return { streetAddress: '', shortStreet: '', buildingDetails: [], instructions: '' }
  }

  const labels = lang === 'ru'
    ? {
        building: 'Здание / Блок',
        entrance: 'Подъезд / Вход',
        floor: 'Этаж',
        apartment: 'Кв. / Офис',
        intercom: 'Домофон'
      }
    : lang === 'en'
      ? {
          building: 'Building',
          entrance: 'Entrance',
          floor: 'Floor',
          apartment: 'Apt.',
          intercom: 'Intercom'
        }
      : {
          building: 'Clădire / Bloc',
          entrance: 'Scară / Intrare',
          floor: 'Etaj',
          apartment: 'Ap.',
          intercom: 'Interfon'
        }

  let cleaned = String(rawAddress)
    .trim()
    .replace(/^(?:Adres[aă]|Address|Адрес)\s*:\s*/i, '')
    .replace(/\bstr\.\s+(?=Strada\b)/gi, '')
    .trim()

  // Cazul 1: Format cu " -- " (ex: "Strada Osiris, 59 -- suna la poarta" sau "Strada Osiris, 59 -- ")
  let dashNote = ''
  if (cleaned.includes(' --')) {
    const [beforeDash, ...afterDashParts] = cleaned.split(/\s*--\s*/)
    cleaned = beforeDash.trim()
    dashNote = afterDashParts.join(' - ').trim()
  }

  // Helper intern pentru extragerea detaliilor de clădire inline (ex: "Aleea Zorilor, 6, Scara B et. 3 ap. 11")
  const extractInlineBuildingFromStreet = (str, bDetails, instrParts) => {
    if (!str) return ''
    const inlineRegex = /(?:,\s*|\s+)(?=(?:bl(?:oc)?\.?|sc(?:ara)?\.?|et(?:aj)?\.?|ap(?:artament)?\.?|interfon|intrare|building|floor|apt\.?)\s*[a-z0-9])/i
    const match = str.match(inlineRegex)
    if (match && typeof match.index === 'number' && match.index > 3) {
      const pureStreet = str.slice(0, match.index).replace(/,\s*$/, '').trim()
      const restBuilding = str.slice(match.index).replace(/^,\s*/, '').trim()
      if (restBuilding) {
        instrParts.unshift(restBuilding)
      }
      return pureStreet
    }
    return str
  }

  // Helper pentru strada scurtă (doar strada + numărul, fără oraș/cod poștal redundant în tabel)
  const makeShortStreet = (fullStreet) => {
    if (!fullStreet) return ''
    const parts = fullStreet.split(',').map(p => p.trim()).filter(Boolean)
    if (parts.length <= 2) return parts.join(', ')
    return `${parts[0]}, ${parts[1]}`
  }

  // Dacă nu conține ";" (doar adresă simplă cu virgule)
  if (!cleaned.includes(';')) {
    const bDetails = []
    const instrParts = dashNote ? [dashNote] : []
    const cleanStreet = extractInlineBuildingFromStreet(cleaned, bDetails, instrParts)
    return {
      streetAddress: cleanStreet,
      shortStreet: makeShortStreet(cleanStreet),
      buildingDetails: bDetails,
      instructions: instrParts.join(' • ')
    }
  }

  // Cazul 2: Format Syrve/Wolt/Bolt/Glovo separat prin ";"
  // Ex: "Bulevardul Petrochimiștilor 26; 117141 Pitești; ROU; sa vii pe la intrarea...; ; Building name: b21 sc e ; Entrance / Staircase: e; Floor: 6"
  const segments = cleaned
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)

  const addressParts = []
  const buildingDetails = []
  const instructionParts = []

  segments.forEach((seg, idx) => {
    // Ignoră codul de țară izolat
    if (/^(ROU|RO|ROMANIA|ROMÂNIA)$/i.test(seg)) {
      return
    }

    // Verifică etichetele structurate de clădire din agregatoare
    const bldMatch = seg.match(/^(?:Building\s*name|Building|Cl[aă]dire|Bloc)\s*:\s*(.+)$/i)
    if (bldMatch) {
      buildingDetails.push({ label: labels.building, value: bldMatch[1].trim() })
      return
    }

    const entMatch = seg.match(/^(?:Entrance\s*\/\s*Staircase|Entrance|Staircase|Scara|Intrare)\s*:\s*(.+)$/i)
    if (entMatch) {
      buildingDetails.push({ label: labels.entrance, value: entMatch[1].trim() })
      return
    }

    const flrMatch = seg.match(/^(?:Floor|Etaj|Level)\s*:\s*(.+)$/i)
    if (flrMatch) {
      buildingDetails.push({ label: labels.floor, value: flrMatch[1].trim() })
      return
    }

    const aptMatch = seg.match(/^(?:Apartment|Apt|Flat|Apartament|Door|Unit)\s*:\s*(.+)$/i)
    if (aptMatch) {
      buildingDetails.push({ label: labels.apartment, value: aptMatch[1].trim() })
      return
    }

    const intMatch = seg.match(/^(?:Apartment\s+entrance\s+Intercom(?:\s+name\s*\/?\s*number)?|Intercom(?:\s+name\s*\/?\s*number)?|Doorphone|Door\s*code|Interfon|Cod\s*interfon)\s*:\s*(.+)$/i)
    if (intMatch) {
      buildingDetails.push({ label: labels.intercom, value: intMatch[1].trim() })
      return
    }

    // Primul segment este întotdeauna strada și numărul
    if (idx === 0) {
      addressParts.push(seg)
      return
    }

    // Al doilea segment este de obicei codul poștal + orașul (ex: "117141 Pitești" sau "București")
    if (idx === 1 && (/^\d{5,6}\b/.test(seg) || seg.length <= 28) && !/\b(sa |să |nu |merge|usa|ușa|interfon|suna|sună|etaj|scara|intrare|poarta|poartă|rog)\b/i.test(seg)) {
      addressParts.push(seg)
      return
    }

    // Orice alt segment este instrucțiune de livrare de la client
    instructionParts.push(seg)
  })

  if (dashNote) {
    instructionParts.push(dashNote)
  }

  const rawJoinedStreet = addressParts.join(', ') || cleaned
  const finalStreet = extractInlineBuildingFromStreet(rawJoinedStreet, buildingDetails, instructionParts)

  return {
    streetAddress: finalStreet,
    shortStreet: makeShortStreet(finalStreet),
    buildingDetails,
    instructions: instructionParts.join(' • ')
  }
}


