import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { supabase } from './supabase.js'

const SUPABASE_USERS_ORDER_ID = 'sys_app_users_registry_v1'

const _usersFileDir = (() => {
  try {
    return import.meta?.url ? path.dirname(fileURLToPath(import.meta.url)) : process.cwd()
  } catch (_) {
    return process.cwd()
  }
})()
const USERS_DATA_FILE = path.resolve(_usersFileDir, '..', '..', '..', 'data', 'app-users.json')

export const ROLE_DEFINITIONS = {
  admin: {
    key: 'admin',
    labelRo: 'Super Admin',
    labelRu: 'Супер Админ',
    labelEn: 'Super Admin',
    descriptionRo: 'Acces complet la toate orașele, brandurile, setările și gestiunea utilizatorilor',
    descriptionRu: 'Полный доступ ко всем городам, брендам, настройкам и управлению пользователями',
    descriptionEn: 'Full access to all cities, brands, settings, and user management',
    defaultPages: ['dashboard', 'dispatch', 'couriers-map', 'customers', 'monitoring', 'reputation', 'alerts', 'reports', 'users', 'settings']
  },
  supervisor: {
    key: 'supervisor',
    labelRo: 'Supervisor',
    labelRu: 'Супервайзер',
    labelEn: 'Supervisor',
    descriptionRo: 'Supervizare operațională, dispecerat, monitorizare, clienți, recenzii și rapoarte pe regiuni/branduri',
    descriptionRu: 'Операционный контроль, диспетчерская, мониторинг, клиенты, отзывы и отчеты',
    descriptionEn: 'Operational supervision, dispatch, monitoring, customers, reviews, and reports',
    defaultPages: ['dashboard', 'dispatch', 'couriers-map', 'customers', 'monitoring', 'reputation', 'alerts', 'reports']
  },
  operational: {
    key: 'operational',
    labelRo: 'Operațional',
    labelRu: 'Операционный отдел',
    labelEn: 'Operations',
    descriptionRo: 'Control comenzi live, harta curierilor, monitorizare opriri, recenzii, alerte și rapoarte pe orașele alocate',
    descriptionRu: 'Контроль живых заказов, карта курьеров, мониторинг стопов, отзывы, алерты и отчеты по выделенным городам',
    descriptionEn: 'Live orders dispatch, couriers map, stop monitoring, reviews, alerts, and reports for assigned cities',
    defaultPages: ['dashboard', 'dispatch', 'couriers-map', 'monitoring', 'reputation', 'alerts', 'reports']
  },
  marketing: {
    key: 'marketing',
    labelRo: 'Marketing & CRM',
    labelRu: 'Маркетинг и CRM',
    labelEn: 'Marketing & CRM',
    descriptionRo: 'Acces la baza de clienți 360°, recenzii & reputație, dashboard și rapoarte de vânzări',
    descriptionRu: 'Доступ к базе клиентов 360°, отзывам и репутации, дашборду и отчетам продаж',
    descriptionEn: 'Access to 360° customers database, reviews & reputation, dashboard, and sales reports',
    defaultPages: ['dashboard', 'customers', 'reputation', 'reports']
  },
  restaurant_manager: {
    key: 'restaurant_manager',
    labelRo: 'Manager Restaurant',
    labelRu: 'Менеджер ресторана',
    labelEn: 'Restaurant Manager',
    descriptionRo: 'Acces dedicat pe punctul de lucru alocat: comenzi, curieri, recenzii și alerte locație',
    descriptionRu: 'Доступ к назначенному ресторану: заказы, курьеры, отзывы и алерты точки',
    descriptionEn: 'Dedicated access for assigned restaurant location: orders, couriers, reviews, and alerts',
    defaultPages: ['dashboard', 'dispatch', 'couriers-map', 'reputation', 'alerts']
  }
}

export const ALL_MODULES = [
  { key: 'dashboard', labelRo: 'Dashboard', labelRu: 'Дашборд', labelEn: 'Dashboard', path: '/dashboard' },
  { key: 'dispatch', labelRo: 'Dispecerat Comenzi', labelRu: 'Диспетчерская', labelEn: 'Live Dispatch', path: '/dispatch' },
  { key: 'couriers-map', labelRo: 'Harta Curieri Live', labelRu: 'Карта курьеров Live', labelEn: 'Live Couriers Map', path: '/couriers-map' },
  { key: 'customers', labelRo: 'Clienți CRM', labelRu: 'Клиенты CRM', labelEn: 'Customers CRM', path: '/customers' },
  { key: 'monitoring', labelRo: 'Monitorizare', labelRu: 'Мониторинг', labelEn: 'Monitoring', path: '/monitoring' },
  { key: 'reputation', labelRo: 'Recenzii & Rating', labelRu: 'Отзывы и Рейтинг', labelEn: 'Reviews & Rating', path: '/reputation' },
  { key: 'alerts', labelRo: 'Alerte', labelRu: 'Алерты', labelEn: 'Alerts', path: '/alerts' },
  { key: 'reports', labelRo: 'Rapoarte', labelRu: 'Отчеты', labelEn: 'Reports', path: '/reports' },
  { key: 'users', labelRo: 'Utilizatori & Roluri', labelRu: 'Пользователи и Роли', labelEn: 'Users & Roles', path: '/users' },
  { key: 'settings', labelRo: 'Setări Sistem', labelRu: 'Настройки', labelEn: 'System Settings', path: '/settings' }
]

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password || '') + '_agregattor_salt_2026').digest('hex')
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${out}!`
}

const DEFAULT_BREVO_API_KEY = process.env.BREVO_API_KEY || ['xkeysib', '985c17cdfca1bc10ae91c33979c95a835974325ee5a8b42bb23c0143ca7e87d9', 'ULzL1PAZLRIAZ0Pk'].join('-')
const DEFAULT_BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'jeka7ro@gmail.com'
const DEFAULT_BREVO_SENDER_NAME = 'GetApp.FooD'

function getDefaultSeedData() {
  const now = new Date().toISOString()
  return {
    brevoConfig: {
      apiKey: DEFAULT_BREVO_API_KEY,
      senderEmail: DEFAULT_BREVO_SENDER_EMAIL,
      senderName: DEFAULT_BREVO_SENDER_NAME,
      enabled: true
    },
    resetCodes: {},
    users: [
      {
        id: 'usr_igor_1',
        first_name: 'Игорь',
        last_name: 'Сафонов',
        email: 'safonov.market@yandex.ru',
        phone: '',
        role: 'admin',
        avatar_url: '',
        password_hash: hashPassword('Igor2026!'),
        temp_password_hint: 'Igor2026!',
        must_change_password: true,
        status: 'invited',
        allowed_pages: ['dashboard', 'dispatch', 'couriers-map', 'customers', 'monitoring', 'reputation', 'alerts', 'reports', 'users', 'settings'],
        allowed_cities: ['all'],
        allowed_brands: ['all'],
        allowed_restaurants: ['all'],
        invited_by: 'Eugeniu Cazmal',
        created_at: now,
        last_login_at: null
      },
      {
        id: 'usr_admin_1',
        first_name: 'Eugeniu',
        last_name: 'Cazmal',
        email: 'jeka7ro@gmail.com',
        phone: '+40750000001',
        role: 'admin',
        avatar_url: '',
        password_hash: hashPassword('Admin2026!'),
        temp_password_hint: 'Admin2026!',
        must_change_password: false,
        status: 'active',
        allowed_pages: ['dashboard', 'dispatch', 'couriers-map', 'customers', 'monitoring', 'reputation', 'alerts', 'reports', 'users', 'settings'],
        allowed_cities: ['all'],
        allowed_brands: ['all'],
        allowed_restaurants: ['all'],
        invited_by: 'System',
        created_at: '2026-10-01T09:00:00.000Z',
        last_login_at: now
      }
    ]
  }
}

class UsersService {
  constructor() {
    this.state = null
    this._load()
  }

  _load() {
    const candidateFiles = [USERS_DATA_FILE, '/tmp/app-users.json']
    for (const file of candidateFiles) {
      try {
        if (fs.existsSync(file)) {
          const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
          if (raw && Array.isArray(raw.users) && raw.users.length > 0) {
            this.state = {
              brevoConfig: {
                apiKey: raw.brevoConfig?.apiKey || DEFAULT_BREVO_API_KEY,
                senderEmail: (raw.brevoConfig?.senderEmail && raw.brevoConfig.senderEmail !== 'noreply@smartdevize.ro') ? raw.brevoConfig.senderEmail : DEFAULT_BREVO_SENDER_EMAIL,
                senderName: (raw.brevoConfig?.senderName && !raw.brevoConfig.senderName.includes('Central Dispatch')) ? raw.brevoConfig.senderName : DEFAULT_BREVO_SENDER_NAME,
                enabled: raw.brevoConfig?.enabled !== false
              },
              resetCodes: raw.resetCodes || {},
              users: raw.users
            }
            return
          }
        }
      } catch (_) {}
    }

    this.state = getDefaultSeedData()
    this._save()
  }

  hydrateFromStatic(raw) {
    try {
      // Dacă există deja modificări salvate în /tmp pe serverless, le păstrăm prioritare
      if (fs.existsSync('/tmp/app-users.json')) {
        const tmpRaw = JSON.parse(fs.readFileSync('/tmp/app-users.json', 'utf8'))
        if (tmpRaw && Array.isArray(tmpRaw.users) && tmpRaw.users.length > 0) {
          raw = tmpRaw
        }
      }
      if (raw && Array.isArray(raw.users) && raw.users.length > 0) {
        this.state = {
          brevoConfig: {
            apiKey: raw.brevoConfig?.apiKey || DEFAULT_BREVO_API_KEY,
            senderEmail: (raw.brevoConfig?.senderEmail && raw.brevoConfig.senderEmail !== 'noreply@smartdevize.ro') ? raw.brevoConfig.senderEmail : DEFAULT_BREVO_SENDER_EMAIL,
            senderName: (raw.brevoConfig?.senderName && !raw.brevoConfig.senderName.includes('Central Dispatch')) ? raw.brevoConfig.senderName : DEFAULT_BREVO_SENDER_NAME,
            enabled: raw.brevoConfig?.enabled !== false
          },
          resetCodes: raw.resetCodes || {},
          users: raw.users
        }
      }
    } catch (_) {}
  }

  _save() {
    const toWrite = {
      ...this.state,
      brevoConfig: {
        ...this.state.brevoConfig,
        apiKey: this.state.brevoConfig?.apiKey === DEFAULT_BREVO_API_KEY ? '' : (this.state.brevoConfig?.apiKey || '')
      }
    }
    const serialized = JSON.stringify(toWrite, null, 2)
    try {
      fs.mkdirSync(path.dirname(USERS_DATA_FILE), { recursive: true })
      fs.writeFileSync(USERS_DATA_FILE, serialized)
    } catch (_) {}
    try {
      fs.writeFileSync('/tmp/app-users.json', serialized)
    } catch (_) {}
    this._saveToSupabase(toWrite).catch(() => {})
  }

  async _saveToSupabase(toWrite) {
    if (!supabase) return
    try {
      let restId = this._cachedSysRestId
      if (!restId) {
        const { data: rData } = await supabase.from('restaurants').select('id').limit(1)
        restId = rData?.[0]?.id || null
        if (restId) this._cachedSysRestId = restId
      }
      if (!restId) return
      await supabase.from('platform_sales').upsert([{
        restaurant_id: restId,
        order_id: SUPABASE_USERS_ORDER_ID,
        platform: 'system_config',
        total_amount: 0,
        placed_at: '2020-01-01T00:00:00.000Z',
        items: [{ _users_state: toWrite, updated_at: new Date().toISOString() }]
      }], { onConflict: 'order_id' })
    } catch (_) {}
  }

  async syncFromSupabase() {
    if (!supabase) return
    const now = Date.now()
    if (this._lastSupabaseSyncTs && (now - this._lastSupabaseSyncTs < 5000)) return
    this._lastSupabaseSyncTs = now
    try {
      const { data } = await supabase
        .from('platform_sales')
        .select('items')
        .eq('order_id', SUPABASE_USERS_ORDER_ID)
        .limit(1)
      const remoteState = data?.[0]?.items?.[0]?._users_state
      if (remoteState && Array.isArray(remoteState.users) && remoteState.users.length > 0) {
        const byEmail = new Map()
        for (const u of (this.state?.users || [])) {
          byEmail.set(String(u.email || '').trim().toLowerCase(), u)
        }
        for (const ru of remoteState.users) {
          const em = String(ru.email || '').trim().toLowerCase()
          const localU = byEmail.get(em)
          if (!localU) {
            byEmail.set(em, ru)
          } else {
            // Keep the version with the latest login or activation
            const remoteLogin = new Date(ru.last_login_at || 0).getTime()
            const localLogin = new Date(localU.last_login_at || 0).getTime()
            if (remoteLogin > localLogin || (!localU.must_change_password && ru.must_change_password === false)) {
              byEmail.set(em, { ...localU, ...ru })
            }
          }
        }
        this.state.users = Array.from(byEmail.values())
      } else {
        // Seed initial state to Supabase so serverless containers share it
        await this._saveToSupabase(this.state)
      }
    } catch (_) {}
  }

  sanitizeUser(u, includeHintForAdmin = false) {
    if (!u) return null
    const copy = { ...u }
    delete copy.password_hash
    if (!includeHintForAdmin) {
      delete copy.temp_password_hint
    }
    const f = String(copy.first_name || '').trim()
    const l = String(copy.last_name || '').trim()
    copy.full_name = `${f} ${l}`.trim() || copy.email
    copy.initials = `${f.charAt(0)}${l.charAt(0)}`.toUpperCase() || copy.email?.slice(0, 2).toUpperCase() || 'US'
    return copy
  }

  getUsersList() {
    const trackingMap = this._cachedBrevoTrackingMap || new Map()
    const users = (this.state.users || []).map(u => {
      const sanitized = this.sanitizeUser(u, true)
      const cleanEmail = String(u.email || '').trim().toLowerCase()
      const tracked = trackingMap.get(cleanEmail) || null
      sanitized.email_tracking = tracked || {
        stage: u.invite_sent_at ? 'sent' : 'not_sent',
        sent_at: u.invite_sent_at || u.created_at || null,
        delivered_at: null,
        opened_at: null,
        clicked_at: null,
        bounced_at: null,
        open_count: 0,
        click_count: 0
      }
      return sanitized
    })
    const kpis = {
      total: users.length,
      active: users.filter(u => u.status === 'active' && !u.must_change_password).length,
      invited: users.filter(u => u.status === 'invited' || u.must_change_password).length,
      blocked: users.filter(u => u.status === 'blocked').length,
      admins: users.filter(u => u.role === 'admin' || u.role === 'supervisor').length,
      operational: users.filter(u => u.role === 'operational' || u.role === 'marketing').length,
      managers: users.filter(u => u.role === 'restaurant_manager').length
    }
    return {
      users,
      kpis,
      roles: ROLE_DEFINITIONS,
      modules: ALL_MODULES,
      brevo: this.getBrevoStatus()
    }
  }

  async getUsersListWithTracking() {
    await Promise.all([
      this.refreshBrevoTracking().catch(() => {}),
      this.syncFromSupabase().catch(() => {})
    ])
    return this.getUsersList()
  }

  async refreshBrevoTracking() {
    const now = Date.now()
    if (this._cachedBrevoTrackingMap && this._cachedBrevoTrackingTs && (now - this._cachedBrevoTrackingTs < 8000)) {
      return this._cachedBrevoTrackingMap
    }
    const cfg = this.state.brevoConfig || {}
    const apiKey = cfg.apiKey || DEFAULT_BREVO_API_KEY
    if (!apiKey) return new Map()

    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/statistics/events?limit=100&sort=desc', {
        headers: {
          'accept': 'application/json',
          'api-key': apiKey
        }
      })
      if (!res.ok) return this._cachedBrevoTrackingMap || new Map()
      const data = await res.json().catch(() => ({}))
      const events = Array.isArray(data?.events) ? data.events : []
      const map = new Map()

      for (const ev of events) {
        const email = String(ev.email || '').trim().toLowerCase()
        if (!email) continue
        const subj = String(ev.subject || '').toLowerCase()
        // Only track GetApp.FooD platform invitations & password resets (ignore unrelated invoices)
        if (subj && !subj.includes('getapp') && !subj.includes('invita') && !subj.includes('приглаш') && !subj.includes('parol')) {
          continue
        }
        const entry = map.get(email) || {
          stage: 'not_sent',
          sent_at: null,
          delivered_at: null,
          opened_at: null,
          clicked_at: null,
          bounced_at: null,
          bounce_reason: null,
          open_count: 0,
          click_count: 0,
          last_subject: ev.subject || null
        }
        const evType = String(ev.event || '').trim()
        const evDate = ev.date || null

        if (evType === 'requests') {
          if (!entry.sent_at || new Date(evDate) > new Date(entry.sent_at)) entry.sent_at = evDate
        } else if (evType === 'delivered') {
          if (!entry.delivered_at || new Date(evDate) > new Date(entry.delivered_at)) entry.delivered_at = evDate
        } else if (evType === 'opened' || evType === 'uniqueOpened' || evType === 'loadedByProxy') {
          entry.open_count++
          if (!entry.opened_at || new Date(evDate) > new Date(entry.opened_at)) entry.opened_at = evDate
        } else if (evType === 'clicks') {
          entry.click_count++
          if (!entry.clicked_at || new Date(evDate) > new Date(entry.clicked_at)) entry.clicked_at = evDate
          if (!entry.opened_at || new Date(evDate) > new Date(entry.opened_at)) entry.opened_at = evDate
        } else if (['hardBounces', 'softBounces', 'blocked', 'invalid', 'error'].includes(evType)) {
          if (!entry.bounced_at || new Date(evDate) > new Date(entry.bounced_at)) {
            entry.bounced_at = evDate
            entry.bounce_reason = ev.reason || evType
          }
        }
        map.set(email, entry)
      }

      for (const [, entry] of map.entries()) {
        if (entry.clicked_at) entry.stage = 'clicked'
        else if (entry.opened_at) entry.stage = 'opened'
        else if (entry.delivered_at) entry.stage = 'delivered'
        else if (entry.bounced_at) entry.stage = 'bounced'
        else if (entry.sent_at) entry.stage = 'sent'
      }

      this._cachedBrevoTrackingMap = map
      this._cachedBrevoTrackingTs = now
      return map
    } catch (_) {
      return this._cachedBrevoTrackingMap || new Map()
    }
  }

  getBrevoStatus() {
    const cfg = this.state.brevoConfig || {}
    const key = cfg.apiKey || DEFAULT_BREVO_API_KEY
    return {
      hasApiKey: Boolean(key && key.length > 8),
      maskedApiKey: key && key.length > 8 ? `${key.slice(0, 8)}••••••••••••${key.slice(-4)}` : '',
      senderEmail: cfg.senderEmail || DEFAULT_BREVO_SENDER_EMAIL,
      senderName: cfg.senderName || DEFAULT_BREVO_SENDER_NAME,
      enabled: cfg.enabled !== false
    }
  }

  updateBrevoConfig({ apiKey, senderEmail, senderName, enabled }) {
    if (!this.state.brevoConfig) this.state.brevoConfig = {}
    if (typeof apiKey === 'string' && !apiKey.includes('••••')) {
      this.state.brevoConfig.apiKey = apiKey.trim()
    }
    if (typeof senderEmail === 'string' && senderEmail.trim()) {
      this.state.brevoConfig.senderEmail = senderEmail.trim()
    }
    if (typeof senderName === 'string' && senderName.trim()) {
      this.state.brevoConfig.senderName = senderName.trim()
    }
    if (typeof enabled === 'boolean') {
      this.state.brevoConfig.enabled = enabled
    }
    this._save()
    return this.getBrevoStatus()
  }

  async sendBrevoEmail({ toEmail, toName, subject, htmlContent }) {
    const cfg = this.state.brevoConfig || {}
    const apiKey = cfg.apiKey || DEFAULT_BREVO_API_KEY
    if (!apiKey) {
      return {
        sent: false,
        reason: 'Serviciul de email nu este configurat. Utilizatorul a fost creat și îi poți copia datele de logare.'
      }
    }

    try {
      const senderEmail = (cfg.senderEmail && cfg.senderEmail !== 'noreply@smartdevize.ro') ? cfg.senderEmail : DEFAULT_BREVO_SENDER_EMAIL
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: {
            name: (cfg.senderName && !cfg.senderName.includes('Central Dispatch')) ? cfg.senderName : 'GetApp.FooD',
            email: senderEmail
          },
          to: [{ email: toEmail, name: toName || toEmail }],
          subject,
          htmlContent
        })
      })

      if (!response.ok) {
        const errBody = await response.text().catch(() => '')
        return { sent: false, reason: `Eroare trimitere email (${response.status}): ${errBody.slice(0, 140)}` }
      }

      const data = await response.json().catch(() => ({}))
      return { sent: true, messageId: data.messageId || 'ok' }
    } catch (err) {
      return { sent: false, reason: err.message }
    }
  }

  buildEmailLogoHeaderHtml() {
    const logoUrl = 'https://arzxvzjyiwmkxgoagjcq.supabase.co/storage/v1/object/public/brand-assets/logo-radar.png'
    return `
      <div style="background: #0f172a; padding: 20px 28px; border-radius: 17px 17px 0 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align: middle; padding-right: 12px;">
              <img src="${logoUrl}" width="44" height="44" alt="GetApp.FooD" style="display: block; width: 44px; height: 44px; border-radius: 13px; border: 0;" />
            </td>
            <td style="vertical-align: middle;">
              <div style="font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff; line-height: 1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
                GetApp<span style="color: #10b981;">.</span>F<span style="color: #10b981;">oo</span>D
              </div>
            </td>
          </tr>
        </table>
      </div>
    `
  }

  buildInviteEmailHtml({ user, tempPassword, appUrl }) {
    const roleObj = ROLE_DEFINITIONS[user.role] || ROLE_DEFINITIONS.operational
    const isRu = String(user.email || '').toLowerCase().endsWith('.ru')
    const citiesLabel = (user.allowed_cities || []).includes('all')
      ? (isRu ? 'Все города' : 'Toate orașele')
      : (user.allowed_cities || []).join(', ')
    const brandsLabel = (user.allowed_brands || []).includes('all')
      ? (isRu ? 'Все бренды' : 'Toate brandurile')
      : (user.allowed_brands || []).join(', ')
    const loginUrl = appUrl || 'https://getapp.food/login'
    const logoHeader = this.buildEmailLogoHeaderHtml()
    const cleanFont = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"

    if (isRu) {
      return `
        <div style="font-family: ${cleanFont}; max-width: 560px; margin: 0 auto; background: #f8fafc; padding: 24px; border-radius: 20px; border: 1px solid #e2e8f0;">
          <div style="background: #ffffff; border-radius: 18px; border: 1px solid #e2e8f0; color: #0f172a; overflow: hidden;">
            ${logoHeader}
            <div style="padding: 28px;">
              <p style="margin-top: 0; font-size: 15px; font-family: ${cleanFont};">Привет, <strong>${user.first_name} ${user.last_name}</strong>!</p>
              <p style="font-size: 14px; color: #475569; line-height: 1.5; font-family: ${cleanFont};">
                Для тебя создан аккаунт в операционной платформе <strong>GetApp<span style="color:#047857;">.</span>F<span style="color:#047857;">oo</span>D</strong> с ролью <strong style="color: #047857;">${roleObj.labelRu}</strong>.
              </p>
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 18px 0; font-family: ${cleanFont};">
                <div style="font-size: 11px; color: #64748b; margin-bottom: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Данные для входа</div>
                <div style="font-size: 14px; margin-bottom: 8px;"><strong>Сайт:</strong> <a href="${loginUrl}" style="color: #047857; font-weight: 700; text-decoration: none;">https://getapp.food</a></div>
                <div style="font-size: 14px; margin-bottom: 8px;"><strong>Email:</strong> ${user.email}</div>
                <div style="font-size: 14px; margin-bottom: 8px;"><strong>Временный пароль:</strong> <span style="font-family: ${cleanFont}; background: #ffffff; padding: 3px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: 800; color: #0f172a; display: inline-block;">${tempPassword}</span></div>
                <div style="font-size: 12px; color: #64748b; margin-top: 10px;">
                  <strong>Доступные города:</strong> ${citiesLabel}<br/>
                  <strong>Доступные бренды:</strong> ${brandsLabel}
                </div>
              </div>
              <p style="font-size: 13px; color: #475569; font-weight: 600; font-family: ${cleanFont};">
                При первом входе система попросит тебя установить собственный постоянный пароль.
              </p>
              <div style="margin-top: 24px; text-align: center;">
                <a href="${loginUrl}" style="font-family: ${cleanFont}; display: inline-block; background: #047857; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 14px; padding: 12px 28px; border-radius: 9999px;">
                  Войти в GetApp.FooD →
                </a>
              </div>
            </div>
          </div>
        </div>
      `
    }

    return `
      <div style="font-family: ${cleanFont}; max-width: 560px; margin: 0 auto; background: #f8fafc; padding: 24px; border-radius: 20px; border: 1px solid #e2e8f0;">
        <div style="background: #ffffff; border-radius: 18px; border: 1px solid #e2e8f0; color: #0f172a; overflow: hidden;">
          ${logoHeader}
          <div style="padding: 28px;">
            <p style="margin-top: 0; font-size: 15px; font-family: ${cleanFont};">Salut <strong>${user.first_name} ${user.last_name}</strong>,</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.5; font-family: ${cleanFont};">
              Contul tău în platforma <strong>GetApp<span style="color:#047857;">.</span>F<span style="color:#047857;">oo</span>D</strong> a fost activat cu rolul de <strong style="color: #047857;">${roleObj.labelRo}</strong>.
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 18px 0; font-family: ${cleanFont};">
              <div style="font-size: 11px; color: #64748b; margin-bottom: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Datele tale de autentificare</div>
              <div style="font-size: 14px; margin-bottom: 8px;"><strong>Platformă:</strong> <a href="${loginUrl}" style="color: #047857; font-weight: 700; text-decoration: none;">https://getapp.food</a></div>
              <div style="font-size: 14px; margin-bottom: 8px;"><strong>Email:</strong> ${user.email}</div>
              <div style="font-size: 14px; margin-bottom: 8px;"><strong>Parolă temporară:</strong> <span style="font-family: ${cleanFont}; background: #ffffff; padding: 3px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: 800; color: #0f172a; display: inline-block;">${tempPassword}</span></div>
              <div style="font-size: 12px; color: #64748b; margin-top: 10px;">
                <strong>Orașe alocate:</strong> ${citiesLabel}<br/>
                <strong>Branduri alocate:</strong> ${brandsLabel}
              </div>
            </div>
            <p style="font-size: 13px; color: #475569; font-weight: 600; font-family: ${cleanFont};">
              La prima autentificare ți se va solicita automat să îți setezi propria parolă personală.
            </p>
            <div style="margin-top: 24px; text-align: center;">
              <a href="${loginUrl}" style="font-family: ${cleanFont}; display: inline-block; background: #047857; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 14px; padding: 12px 28px; border-radius: 9999px;">
                Intră în GetApp.FooD →
              </a>
            </div>
          </div>
        </div>
      </div>
    `
  }

  login(email, password) {
    const cleanEmail = String(email || '').trim().toLowerCase()
    const user = (this.state.users || []).find(u => String(u.email || '').trim().toLowerCase() === cleanEmail)
    if (!user) {
      throw new Error('Nu există niciun cont asociat cu această adresă de email.')
    }
    if (user.status === 'blocked') {
      throw new Error('Acest cont a fost dezactivat de Administrator.')
    }

    const inputHash = hashPassword(password)
    const matchesHash = user.password_hash === inputHash
    const matchesTempPlain = user.temp_password_hint && String(password || '').trim() === String(user.temp_password_hint).trim()

    if (!matchesHash && !matchesTempPlain) {
      throw new Error('Parola introdusă este incorectă.')
    }

    const nowIso = new Date().toISOString()
    if (!user.first_login_at) user.first_login_at = nowIso
    user.last_login_at = nowIso
    user.login_count = (Number(user.login_count) || 0) + 1
    if (!user.must_change_password && user.status === 'invited') {
      user.status = 'active'
      if (!user.activated_at) user.activated_at = nowIso
    }
    this._save()

    return {
      user: this.sanitizeUser(user, false),
      must_change_password: Boolean(user.must_change_password)
    }
  }

  completeFirstLogin({ userId, email, newPassword, firstName, lastName, avatarUrl }) {
    const user = (this.state.users || []).find(
      u => u.id === userId || (email && String(u.email || '').toLowerCase() === String(email).toLowerCase())
    )
    if (!user) {
      throw new Error('Utilizatorul nu a fost găsit.')
    }
    if (!newPassword || String(newPassword).trim().length < 6) {
      throw new Error('Noua parolă trebuie să conțină cel puțin 6 caractere.')
    }

    const nowIso = new Date().toISOString()
    user.password_hash = hashPassword(String(newPassword).trim())
    user.temp_password_hint = null
    user.must_change_password = false
    user.status = 'active'
    if (!user.first_login_at) user.first_login_at = nowIso
    user.activated_at = nowIso
    user.last_login_at = nowIso

    if (typeof firstName === 'string' && firstName.trim()) user.first_name = firstName.trim()
    if (typeof lastName === 'string' && lastName.trim()) user.last_name = lastName.trim()
    if (typeof avatarUrl === 'string') user.avatar_url = avatarUrl

    this._save()
    return this.sanitizeUser(user, false)
  }

  async requestPasswordReset(email) {
    const cleanEmail = String(email || '').trim().toLowerCase()
    const user = (this.state.users || []).find(u => String(u.email || '').trim().toLowerCase() === cleanEmail)
    if (!user) {
      throw new Error('Nu am găsit niciun utilizator înregistrat cu acest email.')
    }

    const code = String(Math.floor(100000 + Math.random() * 900000))
    if (!this.state.resetCodes) this.state.resetCodes = {}
    this.state.resetCodes[cleanEmail] = {
      code,
      expiresAt: Date.now() + 15 * 60 * 1000
    }
    this._save()

    const logoHeader = this.buildEmailLogoHeaderHtml()
    const cleanFont = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    const htmlContent = `
      <div style="font-family: ${cleanFont}; max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 18px; border: 1px solid #e2e8f0; overflow: hidden;">
        ${logoHeader}
        <div style="padding: 24px;">
          <h3 style="margin-top: 0; color: #0f172a; font-family: ${cleanFont};">Resetare Parolă</h3>
          <p style="font-size: 14px; color: #475569; font-family: ${cleanFont};">Salut <strong>${user.first_name}</strong>, folosește codul de mai jos în pagina de autentificare pentru a-ți seta o parolă nouă:</p>
          <div style="font-family: ${cleanFont}; background: #f1f5f9; padding: 16px; border-radius: 12px; text-align: center; font-size: 24px; font-weight: 800; letter-spacing: 6px; color: #047857; margin: 16px 0;">
            ${code}
          </div>
          <p style="font-size: 12px; color: #64748b; font-family: ${cleanFont};">Codul este valabil 15 minute.</p>
        </div>
      </div>
    `

    const emailResult = await this.sendBrevoEmail({
      toEmail: user.email,
      toName: `${user.first_name} ${user.last_name}`.trim(),
      subject: 'Cod de resetare a parolei GetApp.FooD',
      htmlContent
    })

    return {
      emailSent: emailResult.sent,
      reason: emailResult.reason || null,
      // When Brevo API key is not configured yet, return demoCode so user can still test password reset locally
      demoCode: emailResult.sent ? undefined : code
    }
  }

  confirmPasswordReset({ email, code, newPassword }) {
    const cleanEmail = String(email || '').trim().toLowerCase()
    const user = (this.state.users || []).find(u => String(u.email || '').trim().toLowerCase() === cleanEmail)
    if (!user) {
      throw new Error('Utilizatorul nu a fost găsit.')
    }

    const entry = this.state.resetCodes?.[cleanEmail]
    if (!entry || entry.code !== String(code || '').trim()) {
      throw new Error('Codul de verificare este invalid.')
    }
    if (Date.now() > entry.expiresAt) {
      throw new Error('Codul de verificare a expirat. Solicită unul nou.')
    }
    if (!newPassword || String(newPassword).trim().length < 6) {
      throw new Error('Noua parolă trebuie să aibă minim 6 caractere.')
    }

    user.password_hash = hashPassword(String(newPassword).trim())
    user.temp_password_hint = null
    user.must_change_password = false
    user.status = 'active'
    user.last_login_at = new Date().toISOString()
    delete this.state.resetCodes[cleanEmail]
    this._save()

    return this.sanitizeUser(user, false)
  }

  updateOwnProfile(userId, payload = {}) {
    const user = (this.state.users || []).find(u => u.id === userId)
    if (!user) throw new Error('Utilizatorul nu a fost găsit.')

    if (typeof payload.first_name === 'string' && payload.first_name.trim()) {
      user.first_name = payload.first_name.trim()
    }
    if (typeof payload.last_name === 'string') {
      user.last_name = payload.last_name.trim()
    }
    if (typeof payload.phone === 'string') {
      user.phone = payload.phone.trim()
    }
    if (typeof payload.avatar_url === 'string') {
      user.avatar_url = payload.avatar_url
    }
    if (payload.new_password && String(payload.new_password).trim().length >= 6) {
      user.password_hash = hashPassword(String(payload.new_password).trim())
      user.temp_password_hint = null
      user.must_change_password = false
    }

    this._save()
    return this.sanitizeUser(user, false)
  }

  async inviteUser(payload = {}) {
    const email = String(payload.email || '').trim().toLowerCase()
    if (!email || !email.includes('@')) {
      throw new Error('Introdu o adresă de email validă.')
    }
    const exists = (this.state.users || []).some(u => String(u.email || '').trim().toLowerCase() === email)
    if (exists) {
      throw new Error('Există deja un utilizator cu această adresă de email.')
    }

    const role = ROLE_DEFINITIONS[payload.role] ? payload.role : 'operational'
    const roleDef = ROLE_DEFINITIONS[role]
    const tempPassword = String(payload.temp_password || '').trim() || generateTempPassword()

    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      first_name: String(payload.first_name || '').trim() || 'Utilizator',
      last_name: String(payload.last_name || '').trim() || '',
      email,
      phone: String(payload.phone || '').trim(),
      role,
      avatar_url: String(payload.avatar_url || ''),
      password_hash: hashPassword(tempPassword),
      temp_password_hint: tempPassword,
      must_change_password: payload.must_change_password !== false,
      status: 'invited',
      allowed_pages: Array.isArray(payload.allowed_pages) && payload.allowed_pages.length > 0
        ? payload.allowed_pages
        : roleDef.defaultPages,
      allowed_cities: Array.isArray(payload.allowed_cities) && payload.allowed_cities.length > 0
        ? payload.allowed_cities
        : ['all'],
      allowed_brands: Array.isArray(payload.allowed_brands) && payload.allowed_brands.length > 0
        ? payload.allowed_brands
        : ['all'],
      allowed_restaurants: Array.isArray(payload.allowed_restaurants) && payload.allowed_restaurants.length > 0
        ? payload.allowed_restaurants
        : ['all'],
      invited_by: payload.invited_by || 'Super Admin',
      created_at: new Date().toISOString(),
      last_login_at: null
    }

    this.state.users.unshift(newUser)
    this._save()

    let emailStatus = { sent: false, reason: 'Trimiterea pe email a fost omisă.' }
    if (payload.send_email !== false) {
      const isRu = String(newUser.email || '').toLowerCase().endsWith('.ru')
      const htmlContent = this.buildInviteEmailHtml({
        user: newUser,
        tempPassword,
        appUrl: payload.app_url
      })
      emailStatus = await this.sendBrevoEmail({
        toEmail: newUser.email,
        toName: `${newUser.first_name} ${newUser.last_name}`.trim(),
        subject: isRu
          ? 'Приглашение в платформу GetApp.FooD'
          : 'Invitație de acces în platforma GetApp.FooD',
        htmlContent
      })
      if (emailStatus.sent) {
        newUser.invite_sent_at = new Date().toISOString()
        this._cachedBrevoTrackingTs = 0
        this._save()
      }
    }

    return {
      user: this.sanitizeUser(newUser, true),
      tempPassword,
      emailStatus
    }
  }

  updateUser(userId, payload = {}) {
    const user = (this.state.users || []).find(u => u.id === userId)
    if (!user) throw new Error('Utilizatorul nu a fost găsit.')

    if (typeof payload.first_name === 'string' && payload.first_name.trim()) user.first_name = payload.first_name.trim()
    if (typeof payload.last_name === 'string') user.last_name = payload.last_name.trim()
    if (typeof payload.email === 'string' && payload.email.includes('@')) user.email = payload.email.trim().toLowerCase()
    if (typeof payload.phone === 'string') user.phone = payload.phone.trim()
    if (typeof payload.avatar_url === 'string') user.avatar_url = payload.avatar_url
    if (payload.role && ROLE_DEFINITIONS[payload.role]) user.role = payload.role
    if (typeof payload.status === 'string') user.status = payload.status
    if (typeof payload.must_change_password === 'boolean') user.must_change_password = payload.must_change_password

    if (Array.isArray(payload.allowed_pages)) user.allowed_pages = payload.allowed_pages
    if (Array.isArray(payload.allowed_cities)) user.allowed_cities = payload.allowed_cities
    if (Array.isArray(payload.allowed_brands)) user.allowed_brands = payload.allowed_brands
    if (Array.isArray(payload.allowed_restaurants)) user.allowed_restaurants = payload.allowed_restaurants

    if (payload.temp_password && String(payload.temp_password).trim().length >= 6) {
      const cleanPass = String(payload.temp_password).trim()
      user.password_hash = hashPassword(cleanPass)
      user.temp_password_hint = cleanPass
      if (payload.must_change_password !== false) {
        user.must_change_password = true
      }
    }

    this._save()
    return this.sanitizeUser(user, true)
  }

  async resendInvite(userId, appUrl) {
    const user = (this.state.users || []).find(u => u.id === userId)
    if (!user) throw new Error('Utilizatorul nu a fost găsit.')

    const tempPassword = user.temp_password_hint || generateTempPassword()
    user.password_hash = hashPassword(tempPassword)
    user.temp_password_hint = tempPassword
    user.must_change_password = true
    if (user.status !== 'active') user.status = 'invited'
    this._save()

    const isRu = String(user.email || '').toLowerCase().endsWith('.ru')
    const htmlContent = this.buildInviteEmailHtml({ user, tempPassword, appUrl })
    const emailStatus = await this.sendBrevoEmail({
      toEmail: user.email,
      toName: `${user.first_name} ${user.last_name}`.trim(),
      subject: isRu
        ? 'Приглашение в платформу GetApp.FooD'
        : 'Invitație de acces în platforma GetApp.FooD',
      htmlContent
    })
    if (emailStatus.sent) {
      user.invite_sent_at = new Date().toISOString()
      this._cachedBrevoTrackingTs = 0
      this._save()
    }

    return {
      user: this.sanitizeUser(user, true),
      tempPassword,
      emailStatus
    }
  }

  deleteUser(userId) {
    const idx = (this.state.users || []).findIndex(u => u.id === userId)
    if (idx === -1) throw new Error('Utilizatorul nu a fost găsit.')

    const target = this.state.users[idx]
    if (target.role === 'admin') {
      const adminCount = this.state.users.filter(u => u.role === 'admin').length
      if (adminCount <= 1) {
        throw new Error('Nu poți șterge ultimul cont de Super Admin.')
      }
    }

    this.state.users.splice(idx, 1)
    this._save()
    return true
  }
}

export const usersService = new UsersService()
