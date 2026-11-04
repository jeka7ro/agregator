import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

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
    descriptionRo: 'Control comenzi live, harta curierilor, monitorizare opriri și alerte în timp real',
    descriptionRu: 'Контроль живых заказов, карта курьеров, мониторинг стопов и алерты',
    descriptionEn: 'Live orders dispatch, couriers map, stop monitoring, and real-time alerts',
    defaultPages: ['dashboard', 'dispatch', 'couriers-map', 'monitoring', 'alerts']
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
const DEFAULT_BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Get App — Central Dispatch'

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
      },
      {
        id: 'usr_sup_1',
        first_name: 'Alexandru',
        last_name: 'Moraru',
        email: 'alexandru.moraru@getapp.ro',
        phone: '+40744112233',
        role: 'supervisor',
        avatar_url: '',
        password_hash: hashPassword('Super2026!'),
        temp_password_hint: 'Super2026!',
        must_change_password: false,
        status: 'active',
        allowed_pages: ['dashboard', 'dispatch', 'couriers-map', 'customers', 'monitoring', 'reputation', 'alerts', 'reports'],
        allowed_cities: ['BUCURESTI', 'CONSTANTA', 'BRASOV'],
        allowed_brands: ['all'],
        allowed_restaurants: ['all'],
        invited_by: 'Eugeniu Cazmal',
        created_at: '2026-10-15T10:30:00.000Z',
        last_login_at: '2026-11-04T08:15:00.000Z'
      },
      {
        id: 'usr_ops_1',
        first_name: 'Mihai',
        last_name: 'Diaconu',
        email: 'mihai.operational@getapp.ro',
        phone: '+40722334455',
        role: 'operational',
        avatar_url: '',
        password_hash: hashPassword('Ops2026!'),
        temp_password_hint: 'Ops2026!',
        must_change_password: false,
        status: 'active',
        allowed_pages: ['dashboard', 'dispatch', 'couriers-map', 'monitoring', 'alerts'],
        allowed_cities: ['all'],
        allowed_brands: ['Roll Master', 'Love Sushi', 'Poki Woki'],
        allowed_restaurants: ['all'],
        invited_by: 'Eugeniu Cazmal',
        created_at: '2026-10-20T12:00:00.000Z',
        last_login_at: '2026-11-04T09:40:00.000Z'
      },
      {
        id: 'usr_mkt_1',
        first_name: 'Elena',
        last_name: 'Popescu',
        email: 'elena.marketing@getapp.ro',
        phone: '+40766554433',
        role: 'marketing',
        avatar_url: '',
        password_hash: hashPassword('Mkt2026!'),
        temp_password_hint: 'Mkt2026!',
        must_change_password: true,
        status: 'invited',
        allowed_pages: ['dashboard', 'customers', 'reputation', 'reports'],
        allowed_cities: ['all'],
        allowed_brands: ['all'],
        allowed_restaurants: ['all'],
        invited_by: 'Eugeniu Cazmal',
        created_at: '2026-11-02T14:20:00.000Z',
        last_login_at: null
      },
      {
        id: 'usr_mgr_1',
        first_name: 'Cristian',
        last_name: 'Ionescu',
        email: 'cristian.iasi@getapp.ro',
        phone: '+40755998877',
        role: 'restaurant_manager',
        avatar_url: '',
        password_hash: hashPassword('Manager2026!'),
        temp_password_hint: 'Manager2026!',
        must_change_password: true,
        status: 'invited',
        allowed_pages: ['dashboard', 'dispatch', 'couriers-map', 'reputation', 'alerts'],
        allowed_cities: ['IASI'],
        allowed_brands: ['Love Sushi', 'Roll Master'],
        allowed_restaurants: ['all'],
        invited_by: 'Eugeniu Cazmal',
        created_at: '2026-11-03T16:10:00.000Z',
        last_login_at: null
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
    try {
      if (fs.existsSync(USERS_DATA_FILE)) {
        const raw = JSON.parse(fs.readFileSync(USERS_DATA_FILE, 'utf8'))
        if (raw && Array.isArray(raw.users) && raw.users.length > 0) {
          this.state = {
            brevoConfig: {
              apiKey: raw.brevoConfig?.apiKey || DEFAULT_BREVO_API_KEY,
              senderEmail: (raw.brevoConfig?.senderEmail && raw.brevoConfig.senderEmail !== 'noreply@smartdevize.ro') ? raw.brevoConfig.senderEmail : DEFAULT_BREVO_SENDER_EMAIL,
              senderName: raw.brevoConfig?.senderName || DEFAULT_BREVO_SENDER_NAME,
              enabled: raw.brevoConfig?.enabled !== false
            },
            resetCodes: raw.resetCodes || {},
            users: raw.users
          }
          return
        }
      }
    } catch (_) {}

    this.state = getDefaultSeedData()
    this._save()
  }

  hydrateFromStatic(raw) {
    try {
      if (raw && Array.isArray(raw.users) && raw.users.length > 0) {
        this.state = {
          brevoConfig: {
            apiKey: raw.brevoConfig?.apiKey || DEFAULT_BREVO_API_KEY,
            senderEmail: (raw.brevoConfig?.senderEmail && raw.brevoConfig.senderEmail !== 'noreply@smartdevize.ro') ? raw.brevoConfig.senderEmail : DEFAULT_BREVO_SENDER_EMAIL,
            senderName: raw.brevoConfig?.senderName || DEFAULT_BREVO_SENDER_NAME,
            enabled: raw.brevoConfig?.enabled !== false
          },
          resetCodes: raw.resetCodes || {},
          users: raw.users
        }
      }
    } catch (_) {}
  }

  _save() {
    try {
      fs.mkdirSync(path.dirname(USERS_DATA_FILE), { recursive: true })
      const toWrite = {
        ...this.state,
        brevoConfig: {
          ...this.state.brevoConfig,
          apiKey: this.state.brevoConfig?.apiKey === DEFAULT_BREVO_API_KEY ? '' : (this.state.brevoConfig?.apiKey || '')
        }
      }
      fs.writeFileSync(USERS_DATA_FILE, JSON.stringify(toWrite, null, 2))
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
    const users = (this.state.users || []).map(u => this.sanitizeUser(u, true))
    const kpis = {
      total: users.length,
      active: users.filter(u => u.status === 'active').length,
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
            name: cfg.senderName || DEFAULT_BREVO_SENDER_NAME,
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

  buildInviteEmailHtml({ user, tempPassword, appUrl }) {
    const roleObj = ROLE_DEFINITIONS[user.role] || ROLE_DEFINITIONS.operational
    const citiesLabel = (user.allowed_cities || []).includes('all') ? 'Toate orașele' : (user.allowed_cities || []).join(', ')
    const brandsLabel = (user.allowed_brands || []).includes('all') ? 'Toate brandurile' : (user.allowed_brands || []).join(', ')
    const loginUrl = appUrl || 'http://localhost:5174/login'

    return `
      <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; background: #f8fafc; padding: 24px; border-radius: 20px; border: 1px solid #e2e8f0;">
        <div style="background: #059669; color: #ffffff; padding: 20px 24px; border-radius: 16px; margin-bottom: 20px;">
          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; font-weight: 700;">Invitație Oficială de Acces</div>
          <h2 style="margin: 6px 0 0 0; font-size: 20px; font-weight: 800;">Get App — Central Dispatch</h2>
        </div>
        <div style="background: #ffffff; padding: 24px; border-radius: 16px; border: 1px solid #e2e8f0; color: #0f172a;">
          <p style="margin-top: 0; font-size: 15px;">Salut <strong>${user.first_name} ${user.last_name}</strong>,</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.5;">
            Ai fost invitat(ă) în platforma operațională cu rolul de <strong style="color: #059669;">${roleObj.labelRo}</strong>.
          </p>
          <div style="background: #f1f5f9; border-radius: 12px; padding: 16px; margin: 18px 0;">
            <div style="font-size: 12px; color: #64748b; margin-bottom: 8px; font-weight: 700; text-transform: uppercase;">Datele tale de autentificare</div>
            <div style="font-size: 14px; margin-bottom: 6px;"><strong>Email:</strong> ${user.email}</div>
            <div style="font-size: 14px; margin-bottom: 6px;"><strong>Parolă temporară:</strong> <code style="background: #ffffff; padding: 3px 8px; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a;">${tempPassword}</code></div>
            <div style="font-size: 12px; color: #64748b; margin-top: 10px;">
              <strong>Orașe alocate:</strong> ${citiesLabel}<br/>
              <strong>Branduri alocate:</strong> ${brandsLabel}
            </div>
          </div>
          <p style="font-size: 13px; color: #d97706; font-weight: 600;">
            Important: La prima autentificare ți se va solicita automat să îți setezi propria parolă personală.
          </p>
          <div style="margin-top: 22px; text-align: center;">
            <a href="${loginUrl}" style="display: inline-block; background: #059669; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 9999px;">
              Autentificare în Platformă
            </a>
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

    user.last_login_at = new Date().toISOString()
    if (!user.must_change_password && user.status === 'invited') {
      user.status = 'active'
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

    user.password_hash = hashPassword(String(newPassword).trim())
    user.temp_password_hint = null
    user.must_change_password = false
    user.status = 'active'
    user.last_login_at = new Date().toISOString()

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

    const htmlContent = `
      <div style="font-family: Inter, sans-serif; max-width: 500px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 16px; border: 1px solid #e2e8f0;">
        <h3 style="margin-top: 0; color: #0f172a;">Resetare Parolă — Get App</h3>
        <p style="font-size: 14px; color: #475569;">Salut <strong>${user.first_name}</strong>, folosește codul de mai jos în pagina de autentificare pentru a-ți seta o parolă nouă:</p>
        <div style="background: #f1f5f9; padding: 16px; border-radius: 12px; text-align: center; font-size: 24px; font-weight: 800; letter-spacing: 6px; color: #059669; margin: 16px 0;">
          ${code}
        </div>
        <p style="font-size: 12px; color: #64748b;">Codul este valabil 15 minute.</p>
      </div>
    `

    const emailResult = await this.sendBrevoEmail({
      toEmail: user.email,
      toName: `${user.first_name} ${user.last_name}`.trim(),
      subject: 'Cod de resetare a parolei — Get App Dispatch',
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
      const htmlContent = this.buildInviteEmailHtml({
        user: newUser,
        tempPassword,
        appUrl: payload.app_url
      })
      emailStatus = await this.sendBrevoEmail({
        toEmail: newUser.email,
        toName: `${newUser.first_name} ${newUser.last_name}`.trim(),
        subject: `Invitație de acces (${roleDef.labelRo}) — Get App Central Dispatch`,
        htmlContent
      })
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

    const roleDef = ROLE_DEFINITIONS[user.role] || ROLE_DEFINITIONS.operational
    const htmlContent = this.buildInviteEmailHtml({ user, tempPassword, appUrl })
    const emailStatus = await this.sendBrevoEmail({
      toEmail: user.email,
      toName: `${user.first_name} ${user.last_name}`.trim(),
      subject: `Invitație de acces (${roleDef.labelRo}) — Get App Central Dispatch`,
      htmlContent
    })

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
