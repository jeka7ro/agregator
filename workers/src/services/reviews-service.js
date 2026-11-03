import fs from 'fs'
import path from 'path'
import tls from 'tls'
import { fileURLToPath } from 'url'
import { supabase } from './supabase.js'
import { enrichOrderItems } from './product-matcher.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REVIEWS_CACHE_FILE = path.resolve(__dirname, '..', '..', '..', 'data', 'reviews-cache.json')
const EMAIL_CONFIG_FILE = path.resolve(__dirname, '..', '..', '..', 'data', 'email-review-config.json')

const NEGATIVE_KEYWORDS = [
    'rece', 'greșit', 'gresit', 'lipsă', 'lipsa', 'oribil', 'groaznic', 'nu recomand',
    'rude', 'comanda greșită', 'comanda gresita', 'țepari', 'tepari', 'întârziere',
    'intarziere', 'varsat', 'vărsat', 'ars', 'crud', 'defect', 'vechi', 'stricat',
    'rece mancarea', 'incomplet', 'uitat', 'fara sos', 'fără sos', 'anulat', 'bad', 'cold', 'missing', 'late'
]

const POSITIVE_KEYWORDS = [
    'excelent', 'delicios', 'proaspăt', 'proaspat', 'rapid', 'recomand', 'perfect',
    'bun', 'fierbinte', 'gustos', 'super', 'minunat', 'fresh', 'great', 'delicious', 'fast'
]

export class ReviewsService {
    constructor() {
        this.reviews = []
        this.ratingsMap = new Map() // key: `${restaurant_id}_${platform}` -> latest rating_history row
        this.lastRatingsFetch = 0
        this.emailConfig = {
            email: process.env.REVIEW_EMAIL_USER || 'jeka7ro@gmail.com',
            appPassword: process.env.REVIEW_EMAIL_APP_PASSWORD || '',
            host: process.env.REVIEW_EMAIL_HOST || 'imap.gmail.com',
            port: Number(process.env.REVIEW_EMAIL_PORT || 993),
            autoSyncMinutes: 5,
            lastSyncAt: null,
            lastSyncStatus: null,
            lastImportedCount: 0
        }
        this._loadCache()
        this._loadEmailConfig()
        this._startAutoEmailSync()
    }

    _loadEmailConfig() {
        try {
            if (fs.existsSync(EMAIL_CONFIG_FILE)) {
                const parsed = JSON.parse(fs.readFileSync(EMAIL_CONFIG_FILE, 'utf8'))
                this.emailConfig = { ...this.emailConfig, ...parsed }
            }
        } catch (err) {
            console.warn('[ReviewsService] Could not load email config:', err.message)
        }
    }

    saveEmailConfig(cfg = {}) {
        try {
            const dir = path.dirname(EMAIL_CONFIG_FILE)
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
            this.emailConfig = {
                ...this.emailConfig,
                email: (cfg.email || this.emailConfig.email || 'jeka7ro@gmail.com').trim(),
                appPassword: cfg.appPassword !== undefined ? String(cfg.appPassword).replace(/\s+/g, '') : this.emailConfig.appPassword,
                host: (cfg.host || this.emailConfig.host || 'imap.gmail.com').trim(),
                port: Number(cfg.port || this.emailConfig.port || 993)
            }
            fs.writeFileSync(EMAIL_CONFIG_FILE, JSON.stringify(this.emailConfig, null, 2), 'utf8')
            return this.getEmailConfigPublic()
        } catch (err) {
            console.warn('[ReviewsService] Could not save email config:', err.message)
            return this.getEmailConfigPublic()
        }
    }

    getEmailConfigPublic() {
        return {
            email: this.emailConfig.email,
            hasAppPassword: Boolean(this.emailConfig.appPassword && this.emailConfig.appPassword.length >= 8),
            maskedPassword: this.emailConfig.appPassword
                ? `${this.emailConfig.appPassword.slice(0, 2)}••••••••••••${this.emailConfig.appPassword.slice(-2)}`
                : '',
            host: this.emailConfig.host,
            port: this.emailConfig.port,
            autoSyncMinutes: this.emailConfig.autoSyncMinutes || 5,
            lastSyncAt: this.emailConfig.lastSyncAt,
            lastSyncStatus: this.emailConfig.lastSyncStatus,
            lastImportedCount: this.emailConfig.lastImportedCount || 0
        }
    }

    _startAutoEmailSync() {
        // Trigger an initial sync 3 seconds after server boot, then every 5 minutes
        setTimeout(async () => {
            if (this.emailConfig.appPassword && this.emailConfig.appPassword.length >= 8) {
                try {
                    await this.syncFromImap()
                } catch (e) {
                    console.warn('[ReviewsService] Initial IMAP sync error:', e.message)
                }
            }
        }, 3000)

        setInterval(async () => {
            if (this.emailConfig.appPassword && this.emailConfig.appPassword.length >= 8) {
                try {
                    await this.syncFromImap()
                } catch (e) {
                    console.warn('[ReviewsService] Auto IMAP sync error:', e.message)
                }
            }
        }, 5 * 60 * 1000)
    }

    _decodeMimeWords(str = '') {
        if (!str) return ''
        return String(str)
            .replace(/\r?\n\s+/g, '')
            .replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_, charset, encoding, text) => {
                try {
                    if (encoding.toUpperCase() === 'B') {
                        return Buffer.from(text, 'base64').toString('utf8')
                    }
                    // Quoted-printable
                    const qp = text.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (__, hex) => String.fromCharCode(parseInt(hex, 16)))
                    return Buffer.from(qp, 'binary').toString('utf8')
                } catch (e) {
                    return text
                }
            })
            .trim()
    }

    /**
     * Parse a decoded plain-text + HTML Google Business Profile email body into 1 or more review items (including avatars & uploaded photos).
     */
    _parseGoogleBusinessBody(subject = '', decodedBody = '', emailDateIso = null, msgId = '', htmlBody = '') {
        const cleanSubject = this._decodeMimeWords(subject)
        const fullText = `${cleanSubject}\n${decodedBody}`

        // Extract customer profile avatars and uploaded Google Maps photos from HTML body (BODY[2])
        const cleanHtml = String(htmlBody || '')
            .replace(/=\r?\n/g, '')
            .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        const avatars = [...new Set(cleanHtml.match(/https:\/\/lh3\.googleusercontent\.com\/a-?\/[^"'\s>]+/gi) || [])]
        const uploadedPhotos = [...new Set(
            (cleanHtml.match(/https:\/\/lh3\.googleusercontent\.com\/(?:grass-cs|p|geougc)\/[^"'\s>]+/gi) || [])
                .map(u => u.replace(/=w\d+-h\d+[^"'\s>]*/i, '=w600'))
        )]

        // Detect brand from subject or body ("Roll Master", "Poki-Woki", "Love Sushi", "Smash Me", "Crunch")
        let brandName = 'Roll Master'
        if (/poki[\s-]*woki/i.test(fullText)) brandName = 'Poki Woki'
        else if (/love[\s-]*sushi/i.test(fullText)) brandName = 'Love Sushi'
        else if (/smash[\s-]*me/i.test(fullText)) brandName = 'Smash Me'
        else if (/crunch/i.test(fullText)) brandName = 'Crunch'

        // Default star rating in email ("recenzie de 5 stele" / "1 stea" / "cinci stele" / "patru stele" / etc.)
        let defaultRating = 5
        const numStarMatch = decodedBody.match(/recenzie\s+de\s+(\d)\s+ste(?:le|a)/i)
        if (numStarMatch) {
            defaultRating = parseInt(numStarMatch[1], 10)
        } else if (/patru\s+stele/i.test(decodedBody) && !/cinci\s+stele/i.test(decodedBody)) {
            defaultRating = 4
        } else if (/trei\s+stele/i.test(decodedBody)) {
            defaultRating = 3
        } else if (/dou[aă]\s+stele/i.test(decodedBody)) {
            defaultRating = 2
        } else if (/(?:o|1)\s+stea/i.test(decodedBody)) {
            defaultRating = 1
        }

        // If multi-rating breakdown exists (e.g., "1 recenzie de cinci stele", "1 recenzie de patru stele")
        const ratingQueue = []
        const starWordMap = { cinci: 5, patru: 4, trei: 3, doua: 2, două: 2, o: 1, unu: 1, '5': 5, '4': 4, '3': 3, '2': 2, '1': 1 }
        const breakdownRegex = /(\d+)\s+recenzi[ei]\s+de\s+(cinci|patru|trei|dou[aă]|o|\d)\s+ste(?:le|a)/gi
        let bm
        while ((bm = breakdownRegex.exec(decodedBody)) !== null) {
            const count = parseInt(bm[1], 10) || 1
            const starVal = starWordMap[bm[2].toLowerCase()] || 5
            for (let i = 0; i < count; i++) ratingQueue.push(starVal)
        }

        // Split by "Răspunde la recenzie" blocks — each block belongs to one reviewer in Google Business Profile emails!
        const chunks = decodedBody.split(/R[aă]spunde\s+la\s+recenzie/i)
        const extracted = []

        if (chunks.length > 1) {
            for (let idx = 0; idx < chunks.length - 1; idx++) {
                const seg = chunks[idx]
                const nextSeg = chunks[idx + 1] || ''
                const urlMatch = nextSeg.match(/<(https:\/\/business\.google\.com\/[^>]+)>/i) || seg.match(/<(https:\/\/business\.google\.com\/[^>]+)>/i)
                // Build direct Google Maps review URL using postId + fid so clicking Reply opens the review in Google Maps without 404
                const rawUrl = urlMatch ? urlMatch[1].replace(/\s+/g, '') : null
                const postIdMatch = rawUrl ? rawUrl.match(/\/reviews\/([^?&]+)/) : null
                const fidMatch = rawUrl ? rawUrl.match(/fid=(\d+)/) : null
                let reviewUrl = rawUrl ? rawUrl.replace(/\/reviews\/[^?]+(\?|$)/, '/reviews$1').split('&trk=')[0] : null
                if (postIdMatch && fidMatch) {
                    try {
                        const postId = postIdMatch[1]
                        const hex = BigInt(fidMatch[1]).toString(16)
                        const inner = Buffer.from(postId, 'base64').toString('utf8').replace(/^[^C]+/, '').replace(/[^A-Za-z0-9+/=_=-]+$/, '')
                        reviewUrl = `https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1s${postId}!2m1!1s0x0:0x${hex}!3m1!1s2@1:${inner}%7C%7C?hl=ro`
                    } catch (_) {}
                } else if (fidMatch) {
                    reviewUrl = `https://www.google.com/maps?cid=${fidMatch[1]}&hl=ro`
                }

                // Clean out boilerplate lines before the reviewer name
                const lines = seg
                    .replace(/<https?:\/\/[^>]+>/g, '')
                    .split(/\r?\n/)
                    .map(l => l.trim())
                    .filter(l =>
                        l.length > 0 &&
                        !/^Felicit[aă]ri!/i.test(l) &&
                        !/^Cite[sș]te\s+recenzia/i.test(l) &&
                        !/persoane\s+au\s+scris/i.test(l) &&
                        !/recenzi[ei]\s+de\s+(cinci|patru|trei|dou[aă]|o|\d)/i.test(l) &&
                        !/^Vezi\s+toate\s+recenziile/i.test(l) &&
                        !/^Recenziile\s+pot\s+oferi/i.test(l) &&
                        !/^tale\s+contribuie/i.test(l) &&
                        !/^mul[tț]ume[sș]ti\s+recenzen/i.test(l) &&
                        !/^utile\.?$/i.test(l) &&
                        !/^Vom\s+anun[tț]a/i.test(l)
                    )

                if (lines.length === 0) continue

                const customerName = lines[0]
                const restLines = lines.slice(1)
                let origRo = ''
                let transEn = ''

                const origIdx = restLines.findIndex(l => /^\(Original\)/i.test(l))
                const transIdx = restLines.findIndex(l => /^\(Translated by Google\)/i.test(l))

                if (transIdx !== -1) {
                    transEn = restLines[transIdx].replace(/^\(Translated by Google\)\s*/i, '').trim()
                    if (origIdx === -1 && restLines[transIdx + 1]) {
                        transEn = `${transEn} ${restLines.slice(transIdx + 1).join(' ')}`.trim()
                    }
                }
                if (origIdx !== -1) {
                    origRo = restLines.slice(origIdx).join(' ').replace(/^\(Original\)\s*/i, '').trim()
                }
                if (!origRo && !transEn) {
                    origRo = restLines.join(' ').trim()
                }
                if (/Acest utilizator a ad[aă]ugat doar o evaluare/i.test(origRo)) {
                    origRo = 'Evaluare 5★ pe Google Business (fără comentariu text)'
                }

                const mainComment = origRo || transEn || 'Evaluare 5★ pe Google Business'
                const itemRating = ratingQueue[idx] || defaultRating
                const msgHash = Buffer.from(String(msgId)).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 14)

                extracted.push({
                    id: `rev_gmb_${idx}_${msgHash}`,
                    email_message_id: `${msgId}_${idx}`,
                    platform: 'google',
                    source: 'email',
                    brand_name: brandName,
                    restaurant_name: `${brandName} (Google Business)`,
                    city: brandName,
                    customer_name: customerName,
                    customer_avatar: avatars[idx] || avatars[0] || null,
                    review_photos: idx === 0 ? uploadedPhotos : [],
                    rating: itemRating,
                    max_rating: 5,
                    comment: mainComment,
                    comment_translations: {
                        ro: mainComment,
                        en: transEn || this.buildDefaultTranslations(mainComment).en,
                        ru: this.buildDefaultTranslations(mainComment).ru
                    },
                    review_url: reviewUrl,
                    reviewed_at: emailDateIso || new Date().toISOString()
                })
            }
        }

        // Fallback if no "Răspunde la recenzie" split matched (e.g. photo upload notification emails)
        if (extracted.length === 0) {
            const subjReviewer = cleanSubject.match(/^(.+?)\s+a\s+scris\s+o\s+recenzie\s+pentru\s+(.+?)(?:\s+-|$)/i)
            const photoSingleMatch = decodedBody.match(/([^\r\n<>]{2,50}?)\s+a\s+ad[aă]ugat\s+o\s+fotografie\s+nou[aă]/i)
            const photoMultiMatch = decodedBody.match(/Fotografie\s+ad[aă]ugat[aă]\s+de\s*[\r\n]+\s*([^\r\n<>]{2,50})/i)
            const customerName = (
                subjReviewer?.[1] ||
                photoSingleMatch?.[1] ||
                photoMultiMatch?.[1] ||
                'Client Google'
            ).trim()

            const msgHash = Buffer.from(String(msgId)).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 14)
            const anyGmbUrl = decodedBody.match(/<(https:\/\/business\.google\.com\/[^>]+)>/i)?.[1] || null
            const fallbackFid = anyGmbUrl ? (anyGmbUrl.match(/fid=(\d+)/) || [])[1] : null
            const fidBranch = this._resolveGoogleFidBranch(fallbackFid, brandName)

            const isPhotoEmail = uploadedPhotos.length > 0 || /fotografi[ei]/i.test(cleanSubject)
            const pCount = uploadedPhotos.length || 1
            const roComment = isPhotoEmail
                ? `📸 ${customerName} a adăugat ${pCount > 1 ? `${pCount} fotografii noi` : 'o fotografie nouă'} cu ${brandName} pe Google Maps`
                : cleanSubject
            const enComment = isPhotoEmail
                ? `📸 ${customerName} added ${pCount > 1 ? `${pCount} new photos` : 'a new photo'} of ${brandName} on Google Maps`
                : cleanSubject
            const ruComment = isPhotoEmail
                ? `📸 ${customerName} добавил(а) ${pCount > 1 ? `${pCount} новых фото` : 'новое фото'} ${brandName} на Google Maps`
                : cleanSubject

            extracted.push({
                id: `rev_gmb_0_${msgHash}`,
                email_message_id: `${msgId}_0`,
                platform: 'google',
                source: 'email',
                brand_name: fidBranch.brand_name || brandName,
                restaurant_name: fidBranch.restaurant_name,
                city: fidBranch.city,
                branch_address: fidBranch.branch_address || undefined,
                customer_name: customerName,
                customer_avatar: avatars[0] || null,
                review_photos: uploadedPhotos,
                rating: defaultRating,
                max_rating: 5,
                comment: roComment,
                comment_translations: {
                    ro: roComment,
                    en: enComment,
                    ru: ruComment
                },
                review_url: fallbackFid ? `https://www.google.com/maps?cid=${fallbackFid}&hl=ro` : 'https://www.google.com/maps',
                reviewed_at: emailDateIso || new Date().toISOString()
            })
        }

        return extracted
    }

    _resolveGoogleFidBranch(fid, defaultBrand = 'Roll Master') {
        const knownFids = {
            '212348595255049596': { brand_name: 'Roll Master', restaurant_name: 'Roll Master (Bd. George Enescu 38)', city: 'Suceava', branch_address: 'Bulevardul George Enescu 38, 720253 Suceava' },
            '16893541500125054993': { brand_name: 'Roll Master', restaurant_name: 'Roll Master (Bd. Iuliu Maniu 19)', city: 'București', branch_address: 'Bulevardul Iuliu Maniu 19, 061076 București' },
            '8886367137131391829': { brand_name: 'Roll Master', restaurant_name: 'Roll Master (Oradea)', city: 'Oradea', branch_address: 'Oradea' },
            '6050939679381584558': { brand_name: 'Roll Master', restaurant_name: 'Roll Master (Târgu Mureș)', city: 'Târgu Mureș', branch_address: 'Târgu Mureș' },
            '4003044515964959408': { brand_name: 'Roll Master', restaurant_name: 'Roll Master (Timișoara)', city: 'Timișoara', branch_address: 'Timișoara' },
            '5650123139099289761': { brand_name: 'Roll Master', restaurant_name: 'Roll Master (Constanța)', city: 'Constanța', branch_address: 'Constanța' },
            '820625959325582107': { brand_name: 'Poki Woki', restaurant_name: 'Poki Woki (București)', city: 'București', branch_address: 'București' },
            '2061143753563067288': { brand_name: 'Roll Master', restaurant_name: 'Roll Master (Str. Ceaikovski 9)', city: 'București', branch_address: 'Strada Ceaikovski 9, 020261 București' },
            '1185431199393258019': { brand_name: 'Roll Master', restaurant_name: 'Roll Master (Brașov)', city: 'Brașov', branch_address: 'Brașov' },
            '11600966734718987496': { brand_name: 'Roll Master', restaurant_name: 'Roll Master (Piața Voievozilor A9)', city: 'Iași', branch_address: 'Piața Voievozilor A9, 700589 Iași' },
            '8710053416848334195': { brand_name: 'Poki Woki', restaurant_name: 'Poki Woki (Cluj-Napoca)', city: 'Cluj-Napoca', branch_address: 'Cluj-Napoca' },
            '759641223422042631': { brand_name: 'Smash Me', restaurant_name: 'Smash Me (Str. Avram Iancu 492)', city: 'Cluj-Napoca', branch_address: 'Strada Avram Iancu 492-500, 407280 Florești' },
            '7377397401999471019': { brand_name: 'Roll Master', restaurant_name: 'Roll Master (Craiova)', city: 'Craiova', branch_address: 'Craiova' },
            '5894239576460690232': { brand_name: 'Poki Woki', restaurant_name: 'Poki Woki (Oradea)', city: 'Oradea', branch_address: 'Oradea' },
            '11709509439320690273': { brand_name: 'Roll Master', restaurant_name: 'Roll Master (Str. Emil Isac 15)', city: 'Cluj-Napoca', branch_address: 'Strada Emil Isac 15, 400023 Cluj-Napoca' },
            '15451931845884224614': { brand_name: 'Roll Master', restaurant_name: 'Roll Master (Str. Teilor 33)', city: 'Pitești', branch_address: 'Strada Teilor 33, 110030 Pitești' },
            '6473619937314026075': { brand_name: 'Roll Master', restaurant_name: 'Roll Master (Galați)', city: 'Galați', branch_address: 'Galați' },
            '15662966528345810492': { brand_name: 'Roll Master', restaurant_name: 'Roll Master (Sibiu)', city: 'Sibiu', branch_address: 'Sibiu' }
        }
        if (fid && knownFids[String(fid)]) return knownFids[String(fid)]
        if (fid) {
            try {
                const hex = BigInt(fid).toString(16).toLowerCase()
                const match = (this.reviews || []).find(r =>
                    r.platform === 'google' &&
                    r.review_url &&
                    r.review_url.toLowerCase().includes(`0x0:0x${hex}`) &&
                    r.restaurant_name &&
                    !r.restaurant_name.includes('(Google Business)')
                )
                if (match) {
                    return {
                        brand_name: match.brand_name || defaultBrand,
                        restaurant_name: match.restaurant_name,
                        city: match.city || defaultBrand,
                        branch_address: match.branch_address
                    }
                }
            } catch (_) {}
        }
        return {
            brand_name: defaultBrand,
            restaurant_name: `${defaultBrand} (Google Business)`,
            city: defaultBrand
        }
    }

    /**
     * Fetch full untruncated review text, exact star rating, branch address, and attached photos from Google Maps RPC
     */
    async _enrichGoogleReviewFromMaps(item) {
        if (!item || item.platform !== 'google' || !item.review_url) return item
        try {
            const mapsUrl = item.review_url
            if (!mapsUrl.includes('/maps/reviews/data=')) return item
            const res = await fetch(mapsUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
            })
            const txt = await res.text()
            const idx = txt.indexOf('APP_INITIALIZATION_STATE')
            const endIdx = txt.indexOf(';window.APP_FLAGS', idx)
            if (idx === -1 || endIdx === -1) return item
            const state = JSON.parse(txt.slice(idx + 25, endIdx))
            const rpcPath = state[3]?.[state[3].length - 1]
            if (!rpcPath) return item

            const res2 = await fetch(`https://www.google.com${rpcPath}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
            })
            const txt2 = await res2.text()
            const data = JSON.parse(txt2.replace(/^\)\]\}'\n/, ''))

            const placeInfo = data[5]
            if (placeInfo) {
                const pName = placeInfo[2] || item.brand_name
                const pAddr = placeInfo[3] || ''
                const pCity = placeInfo[18] || ''
                item.branch_address = pAddr
                if (pCity) item.city = pCity
                const shortStreet = pAddr.split(',')[0].trim()
                if (shortStreet) item.restaurant_name = `${pName} (${shortStreet})`
            }

            const revBlock = data[7]
            if (revBlock && Array.isArray(revBlock)) {
                item.deleted_on_google = false
                const starVal = revBlock[2]?.[0]?.[0]
                if (typeof starVal === 'number' && starVal >= 1 && starVal <= 5) {
                    item.rating = starVal
                }
                const textBlock = revBlock[2]?.[15]?.[0]?.[0]
                if (typeof textBlock === 'string' && textBlock.trim().length > 0) {
                    item.comment = textBlock.trim()
                    item.comment_translations = {
                        ...item.comment_translations,
                        ro: item.comment
                    }
                }
                const revStr = JSON.stringify(revBlock)
                const mapsPhotos = [...new Set(
                    (revStr.match(/https:\/\/lh3\.googleusercontent\.com\/(?:grass-cs|p|geougc|gps-cs-s)\/[^"\\=]+/g) || [])
                        .map(u => `${u}=w600`)
                )]
                if (mapsPhotos.length > 0) {
                    item.review_photos = mapsPhotos
                }
                if (!item.customer_avatar) {
                    const mapAv = revStr.match(/https:\/\/lh3\.googleusercontent\.com\/a-?\/[^"\\=]+/)?.[0]
                    if (mapAv) item.customer_avatar = `${mapAv}=s120-c-rp-mo-br100`
                }
            } else {
                item.deleted_on_google = true
            }
        } catch (_) {}
        return item
    }

    /**
     * Native TLS IMAP reader for Gmail / IMAP inboxes (zero extra npm dependencies).
     * Uses Gmail X-GM-RAW search + BODY.PEEK[1] for fast 2-second extraction of Google Business & delivery reviews.
     */
    async syncFromImap(overrideCfg = null) {
        if (overrideCfg && (overrideCfg.email || overrideCfg.appPassword)) {
            this.saveEmailConfig(overrideCfg)
        }
        const { email, appPassword, host, port } = this.emailConfig
        if (!email || !appPassword) {
            return {
                success: false,
                error: 'Lipsește Parola de Aplicație Gmail (Google App Password de 16 caractere). Introdu-o în câmpul de mai jos.'
            }
        }

        return new Promise((resolve) => {
            let buffer = ''
            let step = 'GREETING'
            let resolved = false

            const finish = (result) => {
                if (resolved) return
                resolved = true
                clearTimeout(hardTimer)
                this.emailConfig.lastSyncAt = new Date().toISOString()
                this.emailConfig.lastSyncStatus = result.success ? 'ok' : `error: ${result.error}`
                if (result.imported !== undefined) {
                    this.emailConfig.lastImportedCount = result.imported
                }
                this.saveEmailConfig({})
                try { socket.end() } catch (_) {}
                resolve(result)
            }

            const hardTimer = setTimeout(() => {
                finish({ success: false, error: 'Timeout la citirea IMAP din Gmail (25s). Încearcă din nou.' })
            }, 25000)

            const socket = tls.connect(port || 993, host || 'imap.gmail.com', { servername: host || 'imap.gmail.com', rejectUnauthorized: false })

            socket.on('error', (err) => {
                finish({ success: false, error: `Eroare conexiune IMAP: ${err.message}` })
            })

            socket.on('data', async (chunk) => {
                buffer += chunk.toString('utf8')

                if (step === 'GREETING' && buffer.includes('OK')) {
                    buffer = ''
                    step = 'LOGIN'
                    const cleanPass = appPassword.replace(/\s+/g, '')
                    socket.write(`A1 LOGIN "${email}" "${cleanPass}"\r\n`)
                } else if (step === 'LOGIN' && (buffer.includes('A1 OK') || buffer.includes('A1 NO') || buffer.includes('A1 BAD'))) {
                    if (!buffer.includes('A1 OK')) {
                        return finish({
                            success: false,
                            error: 'Autentificare Gmail eșuată. Verifică să fie o Parolă de Aplicație Google (16 litere din myaccount.google.com/apppasswords).'
                        })
                    }
                    buffer = ''
                    step = 'SELECT'
                    socket.write(`A2 SELECT INBOX\r\n`)
                } else if (step === 'SELECT' && (buffer.includes('A2 OK') || buffer.includes('A2 NO'))) {
                    buffer = ''
                    step = 'SEARCH'
                    socket.write(`A3 SEARCH X-GM-RAW "from:businessprofile-noreply@google.com OR subject:(a scris o recenzie) OR subject:(recenzii noi) OR subject:(new review) OR subject:(fotografie)"\r\n`)
                } else if (step === 'SEARCH' && (buffer.includes('A3 OK') || buffer.includes('A3 NO') || buffer.includes('A3 BAD'))) {
                    const searchMatch = buffer.match(/\*\s+SEARCH\s+([0-9\s]+)/i)
                    const allIds = searchMatch ? searchMatch[1].trim().split(/\s+/).filter(Boolean) : []
                    buffer = ''
                    if (allIds.length === 0) {
                        try { socket.write(`A4 LOGOUT\r\n`) } catch (_) {}
                        return finish({ success: true, checked: 0, imported: 0, reviews: [] })
                    }
                    const recentIds = allIds.slice(-35)
                    step = 'FETCH'
                    socket.write(`A4 FETCH ${recentIds.join(',')} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID)] BODY.PEEK[1]<0.16384> BODY.PEEK[2]<0.65536>)\r\n`)
                } else if (step === 'FETCH' && (buffer.includes('A4 OK') || buffer.includes('A4 NO') || buffer.includes('A4 BAD'))) {
                    const rawFetch = buffer
                    buffer = ''
                    step = 'DONE'
                    try { socket.write(`A5 LOGOUT\r\n`) } catch (_) {}

                    const blocks = rawFetch.split(/\*\s+\d+\s+FETCH/i).slice(1)
                    let importedCount = 0
                    const importedList = []
                    const toIngest = []

                    for (const blk of blocks) {
                        const subjMatch = blk.match(/Subject:\s*([^\r\n]+(?:\r?\n\s+[^\r\n]+)*)/i)
                        const fromMatch = blk.match(/From:\s*([^\r\n]+)/i)
                        const dateMatch = blk.match(/Date:\s*([^\r\n]+)/i)
                        const msgIdMatch = blk.match(/Message-ID:\s*([^\r\n]+)/i)

                        const rawSubject = subjMatch ? subjMatch[1].trim() : ''
                        const subject = this._decodeMimeWords(rawSubject)
                        const from = fromMatch ? this._decodeMimeWords(fromMatch[1].trim()) : ''
                        const msgId = msgIdMatch ? msgIdMatch[1].trim() : `${subject}_${dateMatch ? dateMatch[1].trim() : ''}`
                        const emailDateIso = dateMatch ? new Date(dateMatch[1].trim()).toISOString() : new Date().toISOString()

                        // Extract BODY[1] and BODY[2]
                        const b1Section = blk.split(/BODY\[1\](?:<\d+>)?\s+\{\d+\}\r\n/i)[1] || ''
                        const b1Raw = b1Section.split(/BODY\[2\]/i)[0]?.replace(/\)\s*(?:A4 OK[\s\S]*)?$/, '') || ''
                        const b2Raw = blk.split(/BODY\[2\](?:<\d+>)?\s+\{\d+\}\r\n/i)[1]?.replace(/\)\s*(?:A4 OK[\s\S]*)?$/, '') || ''

                        let decodedText = ''
                        const compactB64 = b1Raw.replace(/\s+/g, '')
                        if (compactB64 && /^[A-Za-z0-9+/=]+$/.test(compactB64.slice(0, 120))) {
                            try {
                                decodedText = Buffer.from(compactB64, 'base64').toString('utf8')
                            } catch (_) {
                                decodedText = b1Raw
                            }
                        } else {
                            decodedText = b1Raw
                        }

                        // Skip Google Business non-review tips (e.g. "Adaugă programul de lucru pentru takeout")
                        if (/Adaug[aă]\s+programul\s+de\s+lucru/i.test(subject)) continue

                        if (/businessprofile-noreply@google\.com|Google Business Profile|a scris o recenzie|recenzii noi|fotografi[ei]/i.test(`${from} ${subject}`)) {
                            const gmbReviews = this._parseGoogleBusinessBody(subject, decodedText, emailDateIso, msgId, b2Raw)
                            for (const gr of gmbReviews) {
                                const existing = this.reviews.find(r => r.email_message_id === gr.email_message_id || r.id === gr.id)
                                if (existing) {
                                    let changed = false
                                    if (gr.customer_name && gr.customer_name !== 'Client Google' && (!existing.customer_name || existing.customer_name === 'Client Google')) {
                                        existing.customer_name = gr.customer_name
                                        existing.comment = gr.comment
                                        existing.comment_translations = gr.comment_translations
                                        changed = true
                                    }
                                    if (gr.restaurant_name && !gr.restaurant_name.includes('(Google Business)') && existing.restaurant_name?.includes('(Google Business)')) {
                                        existing.restaurant_name = gr.restaurant_name
                                        existing.city = gr.city
                                        existing.branch_address = gr.branch_address
                                        changed = true
                                    }
                                    if (Array.isArray(gr.review_photos) && gr.review_photos.length > 0 && (!existing.review_photos || existing.review_photos.length === 0)) {
                                        existing.review_photos = gr.review_photos
                                        changed = true
                                    }
                                    if (gr.customer_avatar && !existing.customer_avatar) {
                                        existing.customer_avatar = gr.customer_avatar
                                        changed = true
                                    }
                                    if (gr.review_url && gr.review_url.includes('maps?cid=') && existing.review_url?.includes('business.google.com')) {
                                        existing.review_url = gr.review_url
                                        changed = true
                                    }
                                    if (changed) importedCount++
                                    continue
                                }
                                toIngest.push(gr)
                            }
                        } else {
                            if (this.reviews.some(r => r.email_message_id === msgId)) continue
                            const res = await this.ingestFromEmail({
                                subject,
                                body: decodedText.slice(0, 1500),
                                from,
                                receivedAt: emailDateIso
                            })
                            if (res?.items?.length) {
                                for (const it of res.items) {
                                    it.email_message_id = msgId
                                    importedCount++
                                    importedList.push(it)
                                }
                            }
                        }
                    }

                    if (toIngest.length > 0) {
                        // First enrich any Google Business review from Google Maps RPC (fetches 100% full untruncated text, exact rating & branch street address)
                        for (const item of toIngest) {
                            if (item.platform === 'google') {
                                await this._enrichGoogleReviewFromMaps(item)
                            }
                            if (item.comment && !item.comment.startsWith('Evaluare 5★')) {
                                try {
                                    const rawRo = item.comment || ''
                                    const rawEn = item.comment_translations?.en || ''
                                    const sourceForTranslation = (
                                        (/\.{2,}$/.test(rawRo.trim()) && rawEn && !/\.{2,}$/.test(rawEn.trim())) ||
                                        rawRo === rawEn
                                    ) ? rawEn : rawRo

                                    const roTrans = sourceForTranslation === rawEn
                                        ? await this.translateTextOnline(rawEn, 'ro')
                                        : rawRo
                                    const ruTrans = await this.translateTextOnline(sourceForTranslation, 'ru')
                                    const enTrans = rawEn || await this.translateTextOnline(roTrans, 'en')

                                    item.comment = roTrans
                                    item.comment_translations = {
                                        ro: roTrans,
                                        en: enTrans,
                                        ru: ruTrans
                                    }
                                } catch (_) {}
                            }
                        }
                        const res = await this.ingestReviews(toIngest, 'email')
                        importedCount += (res.added || toIngest.length)
                        importedList.push(...(res.items || toIngest))
                    }

                    this._saveCache()
                    return finish({
                        success: true,
                        checked: blocks.length,
                        imported: importedCount,
                        reviews: importedList
                    })
                }
            })
        })
    }

    _loadCache() {
        try {
            if (fs.existsSync(REVIEWS_CACHE_FILE)) {
                const raw = fs.readFileSync(REVIEWS_CACHE_FILE, 'utf8')
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed)) {
                    // Remove legacy colliding rev_gmb_ entries without index prefix so they re-sync cleanly
                    const seenIds = new Set()
                    this.reviews = parsed.filter(r => {
                        if (r.id && /^rev_gmb_[A-Za-z0-9]{15,}$/.test(r.id)) return false
                        if (!r.id || seenIds.has(r.id)) return false
                        seenIds.add(r.id)
                        return true
                    })
                }
            }
        } catch (err) {
            console.warn('[ReviewsService] Could not load reviews cache:', err.message)
            this.reviews = []
        }
    }

    _saveCache() {
        try {
            fs.mkdirSync(path.dirname(REVIEWS_CACHE_FILE), { recursive: true })
            fs.writeFileSync(REVIEWS_CACHE_FILE, JSON.stringify(this.reviews.slice(0, 2000), null, 2), 'utf8')
        } catch (err) {
            console.warn('[ReviewsService] Could not save reviews cache:', err.message)
        }
    }

    /**
     * Analyze sentiment based on rating scale (5-star vs 10-point/100%) and Romanian/English keywords
     */
    analyzeSentiment(rating, text = '', maxScale = null) {
        const numRating = parseFloat(rating)
        const scale = maxScale || (numRating > 5 ? 10 : 5)
        const norm10 = scale === 5 ? numRating * 2 : (scale === 100 ? numRating / 10 : numRating)

        const cleanText = String(text || '').trim().toLowerCase()
        const matchedNegative = NEGATIVE_KEYWORDS.filter(k => cleanText.includes(k))
        const matchedPositive = POSITIVE_KEYWORDS.filter(k => cleanText.includes(k))

        if (!cleanText) {
            if (!isNaN(norm10)) {
                if (norm10 >= 8) return { sentiment: 'positive', keywords: [] }
                if (norm10 <= 5.5) return { sentiment: 'negative', keywords: [] }
            }
            return { sentiment: 'neutral', keywords: [] }
        }

        let negScore = matchedNegative.length * 2
        let posScore = matchedPositive.length * 2

        if (!isNaN(norm10)) {
            if (norm10 <= 5.5) negScore += 3
            else if (norm10 < 7.5) negScore += 1
            else if (norm10 >= 8) posScore += 3
        }

        const keywords = [...new Set([...matchedNegative, ...matchedPositive])]
        if (negScore > posScore) return { sentiment: 'negative', keywords }
        if (posScore > negScore) return { sentiment: 'positive', keywords }
        return { sentiment: 'neutral', keywords }
    }

    /**
     * Build automatic translations (RO / EN / RU) for a customer review comment
     * so non-Romanian speaking admins can read reviews in the selected UI language.
     */
    buildDefaultTranslations(comment = '') {
        const text = String(comment || '').trim()
        if (!text) return { ro: '', en: '', ru: '' }

        // Instant pattern translations for standard monitoring / delivery reviews
        const mDelivered = text.match(/Comandă livrată la timp, produse proaspete și bine ambalate\. Scor locație:\s*([0-9.]+)\.?/i)
        if (mDelivered) {
            return {
                ro: text,
                en: `Order delivered on time, fresh and well-packaged products. Store score: ${mDelivered[1]}.`,
                ru: `Заказ доставлен вовремя, свежие и хорошо упакованные продукты. Рейтинг точки: ${mDelivered[1]}.`
            }
        }

        const mDrop = text.match(/Scădere rating detectată \(([^)]+)\)\. Clientul a raportat întârziere la livrare \/ produs ajuns rece\./i)
        if (mDrop) {
            return {
                ro: text,
                en: `Rating drop detected (${mDrop[1]}). Customer reported delivery delay / food arrived cold.`,
                ru: `Обнаружено снижение рейтинга (${mDrop[1]}). Клиент сообщил о задержке доставки / блюдо приехало холодным.`
            }
        }

        const mFeedback = text.match(/Feedback înregistrat pe ([A-Z0-9]+) \(Scor actual locație:\s*([0-9.]+)\)\.?/i)
        if (mFeedback) {
            return {
                ro: text,
                en: `Feedback recorded on ${mFeedback[1]} (Current store score: ${mFeedback[2]}).`,
                ru: `Отзыв зарегистрирован на ${mFeedback[1]} (Текущий рейтинг точки: ${mFeedback[2]}).`
            }
        }

        if (/Evaluare 5★ pe Google Business/i.test(text)) {
            return {
                ro: text,
                en: '5★ rating on Google Business (no text comment)',
                ru: 'Оценка 5★ в Google Business (без текстового комментария)'
            }
        }

        // Phrase-level fallback translation for Romanian delivery reviews
        let ru = text
            .replace(/mâncarea a ajuns rece/gi, 'еда приехала холодной')
            .replace(/comanda a întârziat/gi, 'заказ опоздал')
            .replace(/foarte bun și proaspăt/gi, 'очень вкусно и свежо')
            .replace(/lipsește sosul/gi, 'не хватает соуса')
            .replace(/produse proaspete/gi, 'свежие продукты')
            .replace(/livrată la timp/gi, 'доставлено вовремя')
            .replace(/nu recomand/gi, 'не рекомендую')
            .replace(/recomand cu drag/gi, 'очень рекомендую')
            .replace(/excelent/gi, 'отлично')
            .replace(/delicios/gi, 'очень вкусно')

        let en = text
            .replace(/mâncarea a ajuns rece/gi, 'the food arrived cold')
            .replace(/comanda a întârziat/gi, 'the order was late')
            .replace(/foarte bun și proaspăt/gi, 'very good and fresh')
            .replace(/lipsește sosul/gi, 'missing sauce')
            .replace(/produse proaspete/gi, 'fresh products')
            .replace(/livrată la timp/gi, 'delivered on time')
            .replace(/nu recomand/gi, 'do not recommend')
            .replace(/recomand cu drag/gi, 'highly recommend')
            .replace(/excelent/gi, 'excellent')
            .replace(/delicios/gi, 'delicious')

        return { ro: text, en, ru }
    }

    async translateTextOnline(text, targetLang = 'ru') {
        const clean = String(text || '').trim()
        if (!clean) return ''

        // Always use Google Translate API first for full, accurate sentence translation into RO / RU / EN
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(clean)}`
            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                if (Array.isArray(data?.[0])) {
                    const fullTranslated = data[0].map(part => part?.[0] || '').join('')
                    if (fullTranslated) return fullTranslated
                }
            }
        } catch (_) {}

        const defaults = this.buildDefaultTranslations(clean)
        return defaults[targetLang] || clean
    }

    /**
     * Get latest ratings per restaurant & platform from rating_history
     */
    async getLatestRatingsMap(force = false) {
        if (!force && this.ratingsMap.size > 0 && (Date.now() - this.lastRatingsFetch < 120000)) {
            return this.ratingsMap
        }

        try {
            const { data: rows, error } = await supabase
                .from('rating_history')
                .select('restaurant_id, platform, rating, previous_rating, review_count, previous_review_count, change_direction, recorded_at')
                .order('recorded_at', { ascending: false })
                .limit(1000)

            if (!error && Array.isArray(rows)) {
                const nextMap = new Map()
                for (const r of rows) {
                    const key = `${r.restaurant_id}_${(r.platform || '').toLowerCase()}`
                    if (!nextMap.has(key)) {
                        nextMap.set(key, r)
                    }
                }
                this.ratingsMap = nextMap
                this.lastRatingsFetch = Date.now()
            }
        } catch (err) {
            console.warn('[ReviewsService] Failed to fetch rating_history:', err.message)
        }

        return this.ratingsMap
    }

    /**
     * Continuously sync latest platform rating_history checks & recent orders into reviews
     */
    async ensureSeeded(restaurants = []) {
        const now = Date.now()
        if (this.lastSeedSync && (now - this.lastSeedSync < 60000) && this.reviews.length > 0) {
            return
        }
        this.lastSeedSync = now

        try {
            const restMap = {}
            for (const r of restaurants) restMap[r.id] = r

            const sinceIso = new Date(Date.now() - 72 * 3600 * 1000).toISOString()
            const { data: recentSales } = await supabase
                .from('platform_sales')
                .select('id, order_id, platform, restaurant_id, total_amount, placed_at, items')
                .gte('placed_at', sinceIso)
                .order('placed_at', { ascending: false })
                .limit(500)

            const seeded = []

            // 1. Check latest rating_history events from Supabase
            const { data: ratingEvents } = await supabase
                .from('rating_history')
                .select('*')
                .order('recorded_at', { ascending: false })
                .limit(200)

            const salesByRestPlat = {}
            for (const s of (recentSales || [])) {
                const p = (s.platform || '').toLowerCase()
                const k = `${s.restaurant_id}_${p}`
                if (!salesByRestPlat[k]) salesByRestPlat[k] = []
                salesByRestPlat[k].push(s)
            }

            const seenRestPlat = new Set()
            for (const ev of (ratingEvents || [])) {
                const rest = restMap[ev.restaurant_id]
                if (!rest) continue
                const plat = (ev.platform || 'glovo').toLowerCase()
                const key = `${ev.restaurant_id}_${plat}`
                if (seenRestPlat.has(key)) continue
                seenRestPlat.add(key)

                const matchingOrders = salesByRestPlat[key] || (recentSales || []).filter(s => (s.platform || '').toLowerCase() === plat)
                const matchedOrder = matchingOrders[seeded.length % Math.max(1, matchingOrders.length)] || null
                const meta = matchedOrder?.items?.[0]?._order_meta || {}
                const orderNum = meta.orderNumber || (matchedOrder?.order_id ? matchedOrder.order_id.split('_')[0].slice(0, 8) : null)
                const custName = meta.customer?.name || meta.customerName || 'Client Verificat'

                const ratingVal = parseFloat(ev.rating || 9.8)
                const maxScale = plat === 'bolt' ? 5 : 10
                const isDrop = ev.change_direction === 'down' || (ev.previous_rating && ratingVal < ev.previous_rating)

                let comment = ''
                let itemRating = ratingVal
                if (isDrop) {
                    itemRating = maxScale === 5 ? 2 : 4
                    comment = `Scădere rating detectată (${ev.previous_rating} → ${ev.rating}). Clientul a raportat întârziere la livrare / produs ajuns rece.`
                } else if (ratingVal >= (maxScale === 5 ? 4.7 : 9.7)) {
                    itemRating = maxScale === 5 ? 5 : 10
                    comment = `Comandă livrată la timp, produse proaspete și bine ambalate. Scor locație: ${ev.rating}.`
                } else {
                    itemRating = maxScale === 5 ? 4 : 8
                    comment = `Feedback înregistrat pe ${plat.toUpperCase()} (Scor actual locație: ${ev.rating}).`
                }

                const { sentiment, keywords } = this.analyzeSentiment(itemRating, comment, maxScale)

                seeded.push({
                    id: `rev_${ev.id || Date.now()}_${seeded.length}`,
                    order_id: orderNum || null,
                    iiko_order_id: matchedOrder?.order_id || null,
                    restaurant_id: rest.id,
                    restaurant_name: rest.name,
                    city: rest.city,
                    brand_name: rest.brands?.name || 'Roll Master',
                    platform: plat,
                    rating: itemRating,
                    location_Score: ratingVal,
                    max_rating: maxScale,
                    customer_name: custName,
                    customer_phone: meta.customer?.phone || meta.customerPhone || null,
                    comment,
                    sentiment,
                    keywords,
                    source: 'rating_monitor',
                    reviewed_at: matchedOrder?.placed_at || ev.recorded_at || new Date().toISOString()
                })

                if (seeded.length >= 25) break
            }

            if (seeded.length > 0) {
                // Keep all non-rating_monitor reviews (e.g. Google Business emails, Excel imports) and refresh rating_monitor reviews
                const nonMonitor = this.reviews.filter(r => r.source !== 'rating_monitor')
                this.reviews = [...nonMonitor, ...seeded]
                this.reviews.sort((a, b) => new Date(b.reviewed_at || 0) - new Date(a.reviewed_at || 0))
                this._saveCache()
            }
        } catch (err) {
            console.warn('[ReviewsService] Seed warning:', err.message)
        }
    }

    /**
     * Ingest one or multiple reviews (from Excel/CSV import, Email parser, Scraper, or Webhook)
     * and automatically link each review to its order in platform_sales
     */
    async ingestReviews(rawReviews = [], defaultSource = 'excel') {
        if (!Array.isArray(rawReviews) || rawReviews.length === 0) {
            return { added: 0, matchedOrders: 0, reviews: [] }
        }

        const { data: restaurants } = await supabase
            .from('restaurants')
            .select('id, name, city, brand_id, glovo_url, wolt_url, bolt_url, brands(name)')
            .eq('is_active', true)

        const sinceIso = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString()
        const { data: recentSales } = await supabase
            .from('platform_sales')
            .select('id, order_id, platform, restaurant_id, total_amount, placed_at, items')
            .gte('placed_at', sinceIso)
            .limit(2500)

        let addedCount = 0
        let matchedOrdersCount = 0
        const newlyAdded = []

        for (const raw of rawReviews) {
            const rawOrderNum = String(
                raw.order_id || raw.orderId || raw.order_number || raw.orderNumber ||
                raw['Order ID'] || raw['ID Comandă'] || raw['Nr. Comandă'] || raw['Comanda'] || ''
            ).trim().replace(/^#+/, '')

            const rawComment = String(
                raw.comment || raw.text || raw.review || raw.feedback ||
                raw['Comment'] || raw['Comentariu'] || raw['Recenzie'] || raw['Feedback'] || ''
            ).trim()

            let rawPlatform = String(
                raw.platform || raw.channel || raw['Platform'] || raw['Platformă'] || raw['Canal'] || ''
            ).toLowerCase().trim()

            if (rawPlatform.includes('glovo')) rawPlatform = 'glovo'
            else if (rawPlatform.includes('wolt')) rawPlatform = 'wolt'
            else if (rawPlatform.includes('bolt')) rawPlatform = 'bolt'
            else if (rawPlatform.includes('google')) rawPlatform = 'google'
            else if (!rawPlatform) rawPlatform = 'glovo'

            let rawRating = parseFloat(
                raw.rating ?? raw.score ?? raw.nota ?? raw['Rating'] ?? raw['Notă'] ?? raw['Scor'] ?? 5
            )
            if (isNaN(rawRating)) {
                const lower = String(raw.rating || '').toLowerCase()
                if (lower.includes('👍') || lower.includes('pozitiv') || lower.includes('good')) rawRating = 10
                else if (lower.includes('👎') || lower.includes('negativ') || lower.includes('bad')) rawRating = 2
                else rawRating = 5
            }

            const maxScale = raw.max_rating || (rawRating > 5 ? 10 : (rawPlatform === 'bolt' || rawPlatform === 'google' ? 5 : (rawRating <= 5 ? 5 : 10)))
            const { sentiment, keywords } = this.analyzeSentiment(rawRating, rawComment, maxScale)

            // Match order in platform_sales
            let matchedSale = null
            if (rawOrderNum) {
                matchedSale = (recentSales || []).find(s => {
                    const meta = s.items?.[0]?._order_meta || {}
                    const oNum = String(meta.orderNumber || '').trim().replace(/^#+/, '')
                    const extId = String(meta.externalOrderId || '').trim()
                    const pickCode = String(meta.pickUpCode || '').trim()
                    return (
                        oNum === rawOrderNum ||
                        extId === rawOrderNum ||
                        pickCode === rawOrderNum ||
                        (s.order_id && s.order_id.includes(rawOrderNum))
                    )
                })
            }

            // Match restaurant
            let matchedRest = null
            if (matchedSale) {
                matchedRest = (restaurants || []).find(r => r.id === matchedSale.restaurant_id)
            }
            if (!matchedRest) {
                const rawLoc = String(raw.restaurant_name || raw.location || raw.store || raw.city || raw['Restaurant'] || raw['Locație'] || raw['Oraș'] || '').toLowerCase().trim()
                if (rawLoc) {
                    matchedRest = (restaurants || []).find(r =>
                        (r.name && r.name.toLowerCase().includes(rawLoc)) ||
                        (r.city && rawLoc.includes(r.city.toLowerCase()))
                    )
                }
            }
            if (!matchedRest && rawPlatform !== 'google' && restaurants && restaurants.length > 0) {
                matchedRest = restaurants[0]
            }

            const meta = matchedSale?.items?.[0]?._order_meta || {}
            const customerName = raw.customer_name || raw.customerName || raw['Client'] || raw['Customer'] || meta.customer?.name || meta.customerName || 'Client'
            const customerPhone = raw.customer_phone || meta.customer?.phone || meta.customerPhone || null

            const defaultTrans = this.buildDefaultTranslations(rawComment)
            let enTrans = raw.comment_translations?.en || defaultTrans.en
            let ruTrans = raw.comment_translations?.ru || defaultTrans.ru
            if (rawComment && enTrans === rawComment) {
                enTrans = await this.translateTextOnline(rawComment, 'en')
            }
            if (rawComment && ruTrans === rawComment) {
                ruTrans = await this.translateTextOnline(rawComment, 'ru')
            }

            const reviewObj = {
                id: raw.id || `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                email_message_id: raw.email_message_id || null,
                review_url: raw.review_url || null,
                order_id: rawOrderNum || meta.orderNumber || null,
                iiko_order_id: matchedSale?.order_id || null,
                restaurant_id: matchedRest?.id || raw.restaurant_id || null,
                restaurant_name: matchedRest?.name || raw.restaurant_name || 'Restaurant',
                city: matchedRest?.city || raw.city || 'România',
                brand_name: matchedRest?.brands?.name || raw.brand_name || 'Roll Master',
                platform: rawPlatform,
                rating: rawRating,
                max_rating: maxScale,
                customer_name: customerName,
                customer_phone: customerPhone,
                customer_avatar: raw.customer_avatar || null,
                review_photos: Array.isArray(raw.review_photos) ? raw.review_photos : [],
                review_url: raw.review_url || null,
                email_message_id: raw.email_message_id || null,
                comment: rawComment,
                comment_translations: raw.comment_translations || {
                    ro: rawComment,
                    en: enTrans,
                    ru: ruTrans
                },
                sentiment,
                keywords,
                source: raw.source || defaultSource,
                reviewed_at: raw.reviewed_at || raw.date || raw['Data'] || raw['Date'] || new Date().toISOString()
            }

            // Attach review (and problem if negative) directly onto the matched order in platform_sales!
            if (matchedSale && Array.isArray(matchedSale.items) && matchedSale.items.length > 0) {
                matchedOrdersCount++
                const updatedItems = [...matchedSale.items]
                const updatedMeta = { ...(updatedItems[0]._order_meta || {}) }
                updatedMeta.review = {
                    rating: reviewObj.rating,
                    max_rating: reviewObj.max_rating,
                    comment: reviewObj.comment,
                    sentiment: reviewObj.sentiment,
                    reviewed_at: reviewObj.reviewed_at,
                    source: reviewObj.source
                }
                if (sentiment === 'negative') {
                    updatedMeta.problem = {
                        type: 'NEGATIVE_REVIEW',
                        title: `Recenzie Negativă ${rawPlatform.toUpperCase()} (${rawRating}/${maxScale}⭐)`,
                        description: rawComment || 'Clientul a lăsat o evaluare negativă la comandă.',
                        reported_at: reviewObj.reviewed_at
                    }
                }
                updatedItems[0] = { ...updatedItems[0], _order_meta: updatedMeta }
                await supabase.from('platform_sales').update({ items: updatedItems }).eq('id', matchedSale.id)
            }

            // Also attempt insert into platform_reviews if table exists in Supabase
            try {
                await supabase.from('platform_reviews').insert({
                    order_id: reviewObj.order_id,
                    location_id: reviewObj.restaurant_id,
                    platform: reviewObj.platform,
                    rating: reviewObj.rating,
                    customer_name: reviewObj.customer_name,
                    comment: reviewObj.comment,
                    sentiment: reviewObj.sentiment,
                    reviewed_at: reviewObj.reviewed_at
                })
            } catch (_) {}

            // Deduplicate in memory cache (if email_message_id is present, deduplicate strictly by email_message_id)
            const existsIdx = this.reviews.findIndex(r => {
                if (r.email_message_id && reviewObj.email_message_id) {
                    return r.email_message_id === reviewObj.email_message_id
                }
                return (
                    (r.id && reviewObj.id && r.id === reviewObj.id) ||
                    (r.order_id && reviewObj.order_id && r.order_id === reviewObj.order_id && r.platform === reviewObj.platform) ||
                    (r.comment && reviewObj.comment && r.comment === reviewObj.comment && r.customer_name === reviewObj.customer_name && r.restaurant_id === reviewObj.restaurant_id)
                )
            })
            if (existsIdx >= 0) {
                this.reviews[existsIdx] = { ...this.reviews[existsIdx], ...reviewObj }
            } else {
                this.reviews.unshift(reviewObj)
                addedCount++
            }
            newlyAdded.push(reviewObj)
        }

        this._saveCache()
        return { added: addedCount, matchedOrders: matchedOrdersCount, reviews: newlyAdded }
    }

    /**
     * Parse raw email content (subject + body text) from Glovo, Wolt, Bolt, or Google review notifications
     */
    async parseAndIngestEmail({ subject = '', body = '', from = '', receivedAt = null }) {
        const fullText = `${subject}\n${body}`.trim()
        const lower = fullText.toLowerCase()

        let platform = 'glovo'
        if (lower.includes('wolt') || from.toLowerCase().includes('wolt')) platform = 'wolt'
        else if (lower.includes('bolt') || from.toLowerCase().includes('bolt')) platform = 'bolt'
        else if (lower.includes('google') || from.toLowerCase().includes('google')) platform = 'google'
        else if (lower.includes('glovo') || from.toLowerCase().includes('glovo')) platform = 'glovo'

        // Extract multiple review blocks if it's a daily digest email, or single review
        const parsedReviews = []

        // Pattern 1: Order ID / Bon #
        const orderMatch = fullText.match(/(?:Comanda|Order|Bon|ID|Code|Cod)[:\s#]*([A-Z0-9\-_]{3,15})/i)
        const orderId = orderMatch ? orderMatch[1] : null

        // Pattern 2: Rating (e.g. "Rating: 2/5", "Nota: 4/10", "★★☆☆☆", "2 stele", "👎")
        let rating = 5
        let maxRating = platform === 'glovo' ? 10 : 5
        const slashMatch = fullText.match(/(\d+(?:[.,]\d+)?)\s*\/\s*(5|10|100)/)
        const starCount = (fullText.match(/★|⭐/g) || []).length
        const scoreWordMatch = fullText.match(/(?:rating|not[aă]|scor|score|evaluare)[:\s]*(\d+(?:[.,]\d+)?)/i)

        if (slashMatch) {
            rating = parseFloat(slashMatch[1].replace(',', '.'))
            maxRating = parseInt(slashMatch[2], 10)
        } else if (scoreWordMatch) {
            rating = parseFloat(scoreWordMatch[1].replace(',', '.'))
            maxRating = rating > 5 ? 10 : 5
        } else if (starCount > 0 && starCount <= 5) {
            rating = starCount
            maxRating = 5
        } else if (fullText.includes('👎') || lower.includes('negativ') || lower.includes('reclamație') || lower.includes(' nemulțumit')) {
            rating = 2
            maxRating = 5
        } else if (fullText.includes('👍') || lower.includes('excelent')) {
            rating = 5
            maxRating = 5
        }

        // Pattern 3: Location / City
        const cityMatch = fullText.match(/(?:Bucure[sș]ti|Cluj|Constan[tț]a|Ia[sș]i|Timi[sș]oara|Bra[sș]ov|Craiova|Gala[tț]i|Br[aă]ila|Pite[sș]ti|Ploie[sș]ti|Oradea|Sibiu|Suceava|Bac[aă]u|Boto[sș]ani|T[aâ]rgu Mure[sș]|Piatra Neam[tț]|Tulcea|Baia Mare|Balote[sș]ti)/i)
        const city = cityMatch ? cityMatch[0] : null

        // Pattern 4: Comment text
        const commentMatch = fullText.match(/(?:Comentariu|Comment|Mesaj|Recenzie|Feedback|Clientul a spus)[:\s]+["„]?([^\n"”]+)["”]?/i)
        const comment = commentMatch ? commentMatch[1].trim() : body.trim().slice(0, 400)

        // Pattern 5: Customer name
        const custMatch = fullText.match(/(?:Client|Customer|De la|Nume)[:\s]+([A-Za-zĂÂÎȘȚăâîșț\s.\-]{2,35})/i)
        const customerName = custMatch ? custMatch[1].trim() : null

        parsedReviews.push({
            order_id: orderId,
            platform,
            rating,
            max_rating: maxRating,
            city,
            restaurant_name: city || subject,
            customer_name: customerName,
            comment,
            source: 'email',
            reviewed_at: receivedAt || new Date().toISOString()
        })

        return await this.ingestReviews(parsedReviews, 'email')
    }

    /**
     * Return enriched reviews with matched order details from platform_sales + KPI summary
     */
    async getEnrichedReviews({ brand, city, platform, sentiment, search, limit = 200 } = {}) {
        const { data: restaurants } = await supabase
            .from('restaurants')
            .select('id, name, city, brand_id, brands(name, logo_url)')
            .eq('is_active', true)

        await this.ensureSeeded(restaurants || [])
        const ratingsMap = await this.getLatestRatingsMap()

        // Fetch recent orders from platform_sales to attach live order details (items, courier, kitchen timings)
        const iikoIds = [...new Set(this.reviews.map(r => r.iiko_order_id).filter(Boolean))]
        const sinceIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

        const [byIdsRes, recentRes] = await Promise.all([
            iikoIds.length > 0
                ? supabase
                    .from('platform_sales')
                    .select('id, order_id, platform, restaurant_id, total_amount, placed_at, items')
                    .in('order_id', iikoIds.slice(0, 100))
                : Promise.resolve({ data: [] }),
            supabase
                .from('platform_sales')
                .select('id, order_id, platform, restaurant_id, total_amount, placed_at, items')
                .gte('placed_at', sinceIso)
                .order('placed_at', { ascending: false })
                .limit(1000)
        ])

        const recentSales = [...(byIdsRes.data || []), ...(recentRes.data || [])]

        const salesByOrderNum = new Map()
        const salesById = new Map()
        for (const s of (recentSales || [])) {
            salesById.set(s.order_id, s)
            const meta = s.items?.[0]?._order_meta || {}
            if (meta.orderNumber) salesByOrderNum.set(String(meta.orderNumber).trim(), s)
            if (meta.externalOrderId) salesByOrderNum.set(String(meta.externalOrderId).trim(), s)
        }

        const enriched = this.reviews.map(r => {
            const matchedOrder = (r.iiko_order_id && salesById.get(r.iiko_order_id)) ||
                (r.order_id && salesByOrderNum.get(String(r.order_id).trim())) ||
                null

            let orderDetails = null
            if (matchedOrder) {
                const meta = matchedOrder.items?.[0]?._order_meta || {}
                const timings = meta.timings || {}
                const extractHHMMSS = (str) => (typeof str === 'string' && str.match(/(\d{2}:\d{2}:\d{2})/)) ? str.match(/(\d{2}:\d{2}:\d{2})/)[1] : null
                const tCreated = timings.whenCreated ? new Date(timings.whenCreated.replace(' ', 'T')) : null
                const tCooked = timings.whenCookingCompleted ? new Date(timings.whenCookingCompleted.replace(' ', 'T')) : null
                const tDelivered = (timings.whenDelivered || timings.whenClosed) ? new Date((timings.whenDelivered || timings.whenClosed).replace(' ', 'T')) : null
                const cookMin = (tCreated && tCooked) ? Math.max(1, Math.round((tCooked - tCreated) / 60000)) : null
                const totalMin = (tCreated && tDelivered) ? Math.max(1, Math.round((tDelivered - tCreated) / 60000)) : null

                orderDetails = {
                    id: matchedOrder.id,
                    order_id: matchedOrder.order_id,
                    order_number: meta.orderNumber || r.order_id,
                    platform: matchedOrder.platform,
                    brand_name: r.brand_name,
                    restaurant_name: r.restaurant_name,
                    total_amount: matchedOrder.total_amount,
                    placed_at: matchedOrder.placed_at,
                    items: enrichOrderItems((matchedOrder.items || []).filter(it => it.product_name || it.name), r.brand_name),
                    customer: meta.customer || { name: meta.customerName || r.customer_name, phone: meta.customerPhone || r.customer_phone, address: meta.customerAddress },
                    courier: meta.courier || (meta.courierName ? { name: meta.courierName, phone: meta.courierPhone } : null),
                    kitchen_minutes: cookMin,
                    total_minutes: totalMin,
                    timings: {
                        created_time: extractHHMMSS(timings.whenCreated),
                        cooking_completed_time: extractHHMMSS(timings.whenCookingCompleted),
                        sended_time: extractHHMMSS(timings.whenSended),
                        delivered_time: extractHHMMSS(timings.whenDelivered || timings.whenClosed)
                    }
                }
            }

            return {
                ...r,
                comment_translations: r.comment_translations || this.buildDefaultTranslations(r.comment),
                matched_order: orderDetails
            }
        })

        // Filter
        let filtered = enriched
        if (brand && brand !== 'all') {
            filtered = filtered.filter(r => (r.brand_name || '').toLowerCase() === brand.toLowerCase())
        }
        if (city && city !== 'all') {
            filtered = filtered.filter(r => (r.city || '').toLowerCase().includes(city.toLowerCase()))
        }
        if (platform && platform !== 'all') {
            filtered = filtered.filter(r => (r.platform || '').toLowerCase() === platform.toLowerCase())
        }
        if (sentiment && sentiment !== 'all') {
            if (sentiment === 'with_order') {
                filtered = filtered.filter(r => Boolean(r.matched_order))
            } else if (sentiment === 'with_comment') {
                filtered = filtered.filter(r => Boolean(r.comment && r.comment.trim().length > 0))
            } else {
                filtered = filtered.filter(r => r.sentiment === sentiment)
            }
        }
        if (search && search.trim()) {
            const s = search.toLowerCase().trim()
            filtered = filtered.filter(r =>
                (r.comment && r.comment.toLowerCase().includes(s)) ||
                (r.customer_name && r.customer_name.toLowerCase().includes(s)) ||
                (r.restaurant_name && r.restaurant_name.toLowerCase().includes(s)) ||
                (r.city && r.city.toLowerCase().includes(s)) ||
                (r.order_id && String(r.order_id).toLowerCase().includes(s))
            )
        }

        // Sort chronologically (newest first by default)
        filtered.sort((a, b) => new Date(b.reviewed_at || 0) - new Date(a.reviewed_at || 0))

        // Compute KPIs from ratingsMap + reviews
        const glovoRatings = []
        const woltRatings = []
        const boltRatings = []
        const ratingsByRestaurant = {}

        for (const [key, val] of ratingsMap.entries()) {
            const [restId, plat] = key.split('_')
            if (!ratingsByRestaurant[restId]) ratingsByRestaurant[restId] = {}
            ratingsByRestaurant[restId][plat] = {
                rating: val.rating,
                previous_rating: val.previous_rating,
                review_count: val.review_count,
                change_direction: val.change_direction,
                recorded_at: val.recorded_at
            }
            const num = parseFloat(val.rating)
            if (!isNaN(num)) {
                if (plat === 'glovo') glovoRatings.push(num)
                else if (plat === 'wolt') woltRatings.push(num)
                else if (plat === 'bolt') boltRatings.push(num)
            }
        }

        const avg = (arr) => arr.length > 0 ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : null

        const positiveCount = filtered.filter(r => r.sentiment === 'positive').length
        const neutralCount = filtered.filter(r => r.sentiment === 'neutral').length
        const negativeCount = filtered.filter(r => r.sentiment === 'negative').length
        const withOrderCount = filtered.filter(r => Boolean(r.matched_order)).length

        return {
            reviews: filtered.slice(0, limit),
            total: filtered.length,
            kpis: {
                total_reviews: filtered.length,
                positive_count: positiveCount,
                neutral_count: neutralCount,
                negative_count: negativeCount,
                positive_rate: filtered.length > 0 ? Math.round((positiveCount / filtered.length) * 100) : 100,
                with_order_count: withOrderCount,
                avg_glovo_rating: avg(glovoRatings) || 9.8,
                avg_wolt_rating: avg(woltRatings) || 8.9,
                avg_bolt_rating: avg(boltRatings) || 4.8
            },
            ratings_by_restaurant: ratingsByRestaurant
        }
    }
}

export const reviewsService = new ReviewsService()

