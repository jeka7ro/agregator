import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Users,
  UserPlus,
  ShieldCheck,
  Search,
  X,
  Edit2,
  Trash2,
  Send,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  Store,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Mail,
  Copy,
  Check,
  Upload,
  Eye,
  EyeOff,
  SlidersHorizontal,
  UserCheck,
  Lock
} from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { useAuth, ROLE_META } from '../lib/AuthContext'
import { getApiUrl } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import UserAvatar, { compressAvatarImage } from '../components/UserAvatar'
import BrandAvatar, { cleanRestaurantName } from '../components/BrandAvatar'

const AUTHORITATIVE_BRANDS = ['Roll Master', 'Poki Woki', 'Love Sushi', 'Smash Me', 'Crunch']

const DEFAULT_CITIES = [
  'BUCURESTI',
  'IASI',
  'CONSTANTA',
  'CLUJ-NAPOCA',
  'TIMISOARA',
  'BRASOV',
  'GALATI',
  'CRAIOVA',
  'PLOIESTI',
  'ORADEA',
  'SIBIU',
  'BACAU',
  'SUCEAVA',
  'PITESTI',
  'ARAD',
  'TARGU MURES'
]

const ALL_MODULES = [
  { key: 'dashboard', labelRo: 'Dashboard', labelRu: 'Дашборд', labelEn: 'Dashboard' },
  { key: 'dispatch', labelRo: 'Dispecerat Live', labelRu: 'Диспетчерская', labelEn: 'Live Dispatch' },
  { key: 'couriers-map', labelRo: 'Harta Curieri', labelRu: 'Карта курьеров', labelEn: 'Couriers Map' },
  { key: 'customers', labelRo: 'Clienți CRM', labelRu: 'Клиенты CRM', labelEn: 'Customers CRM' },
  { key: 'monitoring', labelRo: 'Monitorizare', labelRu: 'Мониторинг', labelEn: 'Monitoring' },
  { key: 'reputation', labelRo: 'Recenzii & Rating', labelRu: 'Отзывы и Рейтинг', labelEn: 'Reviews & Rating' },
  { key: 'alerts', labelRo: 'Alerte', labelRu: 'Алерты', labelEn: 'Alerts' },
  { key: 'reports', labelRo: 'Rapoarte', labelRu: 'Отчеты', labelEn: 'Reports' },
  { key: 'users', labelRo: 'Utilizatori & Roluri', labelRu: 'Пользователи и Роли', labelEn: 'Users & Roles' },
  { key: 'settings', labelRo: 'Setări Sistem', labelRu: 'Настройки', labelEn: 'Settings' }
]

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${out}!`
}

export default function UsersManagement() {
  const { isDark } = useTheme()
  const { language } = useLanguage()
  const { user: currentUser, switchUserDirect } = useAuth()
  const fileInputRef = useRef(null)

  const [users, setUsers] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [brevoStatus, setBrevoStatus] = useState({
    hasApiKey: false,
    maskedApiKey: '',
    senderEmail: 'noreply@smartdevize.ro',
    senderName: 'Get App — Central Dispatch',
    enabled: true
  })
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  // Filters, Search, Sort & Pagination
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortCol, setSortCol] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(15)

  // Invite / Edit Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formFirstName, setFormFirstName] = useState('')
  const [formLastName, setFormLastName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formRole, setFormRole] = useState('operational')
  const [formAvatarUrl, setFormAvatarUrl] = useState('')
  const [formTempPassword, setFormTempPassword] = useState('')
  const [formMustChangePass, setFormMustChangePass] = useState(true)
  const [formSendBrevoEmail, setFormSendBrevoEmail] = useState(true)
  const [formStatus, setFormStatus] = useState('active')
  const [formPages, setFormPages] = useState(ROLE_META.operational.defaultPages)
  const [formCities, setFormCities] = useState(['all'])
  const [formBrands, setFormBrands] = useState(['all'])
  const [formRestaurants, setFormRestaurants] = useState(['all'])
  const [savingUser, setSavingUser] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  // Brevo Modal State
  const [isBrevoModalOpen, setIsBrevoModalOpen] = useState(false)
  const [brevoApiKeyInput, setBrevoApiKeyInput] = useState('')
  const [brevoSenderEmailInput, setBrevoSenderEmailInput] = useState('')
  const [brevoSenderNameInput, setBrevoSenderNameInput] = useState('')
  const [savingBrevo, setSavingBrevo] = useState(false)

  // Delete Confirmation Modal
  const [deleteTargetUser, setDeleteTargetUser] = useState(null)

  const showToast = (type, text) => {
    setToast({ type, text })
    setTimeout(() => {
      setToast(prev => (prev?.text === text ? null : prev))
    }, 4500)
  }

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [uRes, rRes] = await Promise.all([
        fetch(getApiUrl('/api/users')).then(r => r.json()).catch(() => null),
        supabase.from('restaurants').select('id, name, brand, city, is_active').order('name')
      ])
      if (uRes?.success) {
        setUsers(uRes.users || [])
        if (uRes.brevo) {
          setBrevoStatus(uRes.brevo)
          setBrevoSenderEmailInput(uRes.brevo.senderEmail || 'noreply@smartdevize.ro')
          setBrevoSenderNameInput(uRes.brevo.senderName || 'Get App — Central Dispatch')
        }
      }
      if (Array.isArray(rRes?.data)) {
        setRestaurants(rRes.data)
      }
    } catch (_) {}
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const availableCities = useMemo(() => {
    const set = new Set(DEFAULT_CITIES)
    for (const r of restaurants) {
      if (r.city) set.add(String(r.city).trim().toUpperCase())
    }
    return Array.from(set).sort()
  }, [restaurants])

  // KPIs
  const kpis = useMemo(() => {
    const total = users.length
    const active = users.filter(u => u.status === 'active' && !u.must_change_password).length
    const invited = users.filter(u => u.status === 'invited' || u.must_change_password).length
    const adminsAndSup = users.filter(u => u.role === 'admin' || u.role === 'supervisor').length
    const opsAndMkt = users.filter(u => u.role === 'operational' || u.role === 'marketing').length
    const managers = users.filter(u => u.role === 'restaurant_manager').length
    return { total, active, invited, adminsAndSup, opsAndMkt, managers }
  }, [users])

  // Filtering & Sorting
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const list = users.filter(u => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (statusFilter === 'active' && (u.status !== 'active' || u.must_change_password)) return false
      if (statusFilter === 'invited' && !u.must_change_password && u.status !== 'invited') return false
      if (statusFilter === 'blocked' && u.status !== 'blocked') return false
      if (q) {
        const hay = `${u.first_name || ''} ${u.last_name || ''} ${u.email || ''} ${u.phone || ''} ${u.role || ''} ${(u.allowed_cities || []).join(' ')} ${(u.allowed_brands || []).join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortCol === 'name') {
        return dir * String(a.full_name || '').localeCompare(String(b.full_name || ''))
      }
      if (sortCol === 'role') {
        return dir * String(a.role || '').localeCompare(String(b.role || ''))
      }
      if (sortCol === 'cities') {
        const ca = (a.allowed_cities || []).includes('all') ? 999 : (a.allowed_cities || []).length
        const cb = (b.allowed_cities || []).includes('all') ? 999 : (b.allowed_cities || []).length
        return dir * (ca - cb)
      }
      if (sortCol === 'brands') {
        const ba = (a.allowed_brands || []).includes('all') ? 999 : (a.allowed_brands || []).length
        const bb = (b.allowed_brands || []).includes('all') ? 999 : (b.allowed_brands || []).length
        return dir * (ba - bb)
      }
      if (sortCol === 'modules') {
        const ma = (a.allowed_pages || []).length
        const mb = (b.allowed_pages || []).length
        return dir * (ma - mb)
      }
      if (sortCol === 'status') {
        return dir * String(a.status || '').localeCompare(String(b.status || ''))
      }
      if (sortCol === 'last_login') {
        return dir * (new Date(a.last_login_at || 0).getTime() - new Date(b.last_login_at || 0).getTime())
      }
      return dir * (new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
    })

    return list
  }, [users, roleFilter, statusFilter, searchQuery, sortCol, sortDir])

  // Pagination calculations
  const effectivePerPage = rowsPerPage === 'all' ? Math.max(filteredUsers.length, 1) : Number(rowsPerPage)
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / effectivePerPage))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * effectivePerPage
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + effectivePerPage)

  // Totals for tfoot (Page Totals + General Filtered Totals)
  const totals = useMemo(() => {
    const countCities = (u) => (u.allowed_cities || []).includes('all') ? availableCities.length : (u.allowed_cities || []).length
    const countBrands = (u) => (u.allowed_brands || []).includes('all') ? AUTHORITATIVE_BRANDS.length : (u.allowed_brands || []).length
    const countModules = (u) => (u.allowed_pages || []).includes('all') ? ALL_MODULES.length : (u.allowed_pages || []).length

    const pageCities = paginatedUsers.reduce((acc, u) => acc + countCities(u), 0)
    const genCities = filteredUsers.reduce((acc, u) => acc + countCities(u), 0)

    const pageBrands = paginatedUsers.reduce((acc, u) => acc + countBrands(u), 0)
    const genBrands = filteredUsers.reduce((acc, u) => acc + countBrands(u), 0)

    const pageModules = paginatedUsers.reduce((acc, u) => acc + countModules(u), 0)
    const genModules = filteredUsers.reduce((acc, u) => acc + countModules(u), 0)

    const pageActive = paginatedUsers.filter(u => u.status === 'active' && !u.must_change_password).length
    const genActive = filteredUsers.filter(u => u.status === 'active' && !u.must_change_password).length

    return {
      pageCities,
      genCities,
      pageBrands,
      genBrands,
      pageModules,
      genModules,
      pageActive,
      genActive
    }
  }, [paginatedUsers, filteredUsers, availableCities.length])

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const openInviteModal = () => {
    setEditingUser(null)
    setFormFirstName('')
    setFormLastName('')
    setFormEmail('')
    setFormPhone('')
    setFormRole('operational')
    setFormAvatarUrl('')
    setFormTempPassword(randomPassword())
    setFormMustChangePass(true)
    setFormSendBrevoEmail(true)
    setFormStatus('invited')
    setFormPages(ROLE_META.operational.defaultPages)
    setFormCities(['all'])
    setFormBrands(['all'])
    setFormRestaurants(['all'])
    setIsUserModalOpen(true)
  }

  const openEditModal = (u) => {
    setEditingUser(u)
    setFormFirstName(u.first_name || '')
    setFormLastName(u.last_name || '')
    setFormEmail(u.email || '')
    setFormPhone(u.phone || '')
    setFormRole(u.role || 'operational')
    setFormAvatarUrl(u.avatar_url || '')
    setFormTempPassword(u.temp_password_hint || '')
    setFormMustChangePass(Boolean(u.must_change_password))
    setFormSendBrevoEmail(false)
    setFormStatus(u.status || 'active')
    setFormPages(Array.isArray(u.allowed_pages) && u.allowed_pages.length > 0 ? u.allowed_pages : ROLE_META[u.role]?.defaultPages || ['dashboard'])
    setFormCities(Array.isArray(u.allowed_cities) && u.allowed_cities.length > 0 ? u.allowed_cities : ['all'])
    setFormBrands(Array.isArray(u.allowed_brands) && u.allowed_brands.length > 0 ? u.allowed_brands : ['all'])
    setFormRestaurants(Array.isArray(u.allowed_restaurants) && u.allowed_restaurants.length > 0 ? u.allowed_restaurants : ['all'])
    setIsUserModalOpen(true)
  }

  const handleRoleSelect = (roleKey) => {
    setFormRole(roleKey)
    const defPages = ROLE_META[roleKey]?.defaultPages || ['dashboard']
    setFormPages([...defPages])
  }

  const toggleItemInList = (list, setList, item) => {
    if (item === 'all') {
      setList(['all'])
      return
    }
    const withoutAll = list.filter(x => x !== 'all')
    if (withoutAll.includes(item)) {
      const next = withoutAll.filter(x => x !== item)
      setList(next.length === 0 ? ['all'] : next)
    } else {
      setList([...withoutAll, item])
    }
  }

  const toggleModulePage = (pageKey) => {
    if (formPages.includes(pageKey)) {
      if (formPages.length <= 1) return
      setFormPages(formPages.filter(p => p !== pageKey))
    } else {
      setFormPages([...formPages, pageKey])
    }
  }

  const handleModalPhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await compressAvatarImage(file)
      setFormAvatarUrl(dataUrl)
    } catch (err) {
      showToast('error', err.message)
    }
  }

  const handleSaveUser = async (e) => {
    e.preventDefault()
    if (!formEmail.trim() || !formEmail.includes('@')) {
      showToast('error', language === 'ru' ? 'Введите корректный email.' : 'Introdu o adresă de email validă.')
      return
    }
    if (!formFirstName.trim()) {
      showToast('error', language === 'ru' ? 'Введите имя пользователя.' : 'Introdu prenumele utilizatorului.')
      return
    }

    setSavingUser(true)
    try {
      if (editingUser) {
        const res = await fetch(getApiUrl(`/api/users/${encodeURIComponent(editingUser.id)}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: formFirstName.trim(),
            last_name: formLastName.trim(),
            email: formEmail.trim(),
            phone: formPhone.trim(),
            role: formRole,
            avatar_url: formAvatarUrl,
            status: formStatus,
            must_change_password: formMustChangePass,
            temp_password: formTempPassword.trim() || undefined,
            allowed_pages: formPages,
            allowed_cities: formCities,
            allowed_brands: formBrands,
            allowed_restaurants: formRestaurants
          })
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Eroare la actualizare.')
        showToast('success', language === 'ru' ? 'Пользователь успешно обновлен!' : 'Utilizatorul și permisiunile au fost actualizate!')
      } else {
        const res = await fetch(getApiUrl('/api/users/invite'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: formFirstName.trim(),
            last_name: formLastName.trim(),
            email: formEmail.trim(),
            phone: formPhone.trim(),
            role: formRole,
            avatar_url: formAvatarUrl,
            temp_password: formTempPassword.trim(),
            must_change_password: formMustChangePass,
            send_email: formSendBrevoEmail,
            allowed_pages: formPages,
            allowed_cities: formCities,
            allowed_brands: formBrands,
            allowed_restaurants: formRestaurants,
            invited_by: currentUser?.full_name || 'Super Admin',
            app_url: `${window.location.origin}/login`
          })
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Eroare la invitarea utilizatorului.')
        if (data.emailStatus?.sent) {
          showToast('success', language === 'ru'
            ? `Приглашение отправлено на ${data.user.email} (Пароль: ${data.tempPassword})`
            : `Invitație trimisă pe email către ${data.user.email} (Parolă temp: ${data.tempPassword})`)
        } else {
          showToast('info', `Utilizator creat! Parolă temporară: ${data.tempPassword}`)
        }
      }
      setIsUserModalOpen(false)
      fetchAll()
    } catch (err) {
      showToast('error', err.message)
    } finally {
      setSavingUser(false)
    }
  }

  const handleResendInvite = async (u) => {
    try {
      const res = await fetch(getApiUrl(`/api/users/${encodeURIComponent(u.id)}/resend-invite`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_url: `${window.location.origin}/login` })
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Eroare la retrimiterea invitației.')
      if (data.emailStatus?.sent) {
        showToast('success', language === 'ru'
          ? `Приглашение повторно отправлено на ${u.email} (Пароль: ${data.tempPassword})`
          : `Invitația a fost retrimisă pe email către ${u.email} (Parolă temp: ${data.tempPassword})`)
      } else {
        showToast('info', `Parolă temporară regenerată: ${data.tempPassword}`)
      }
      fetchAll()
    } catch (err) {
      showToast('error', err.message)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTargetUser) return
    try {
      const res = await fetch(getApiUrl(`/api/users/${encodeURIComponent(deleteTargetUser.id)}`), {
        method: 'DELETE'
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Eroare la ștergere.')
      showToast('success', `Contul ${deleteTargetUser.full_name} a fost șters.`)
      setDeleteTargetUser(null)
      fetchAll()
    } catch (err) {
      showToast('error', err.message)
    }
  }

  const handleSaveBrevoConfig = async (e) => {
    e.preventDefault()
    setSavingBrevo(true)
    try {
      const res = await fetch(getApiUrl('/api/users/brevo-config'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: brevoApiKeyInput.trim() || undefined,
          senderEmail: brevoSenderEmailInput.trim(),
          senderName: brevoSenderNameInput.trim(),
          enabled: true
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Eroare la salvarea configurației Brevo.')
      setBrevoStatus(data.brevo)
      setBrevoApiKeyInput('')
      setIsBrevoModalOpen(false)
      showToast('success', language === 'ru' ? 'Настройки Brevo сохранены!' : 'Configurația Brevo Email a fost salvată cu succes!')
    } catch (err) {
      showToast('error', err.message)
    } finally {
      setSavingBrevo(false)
    }
  }

  const copyCredentials = (u) => {
    const pass = u.temp_password_hint || '(parolă personalizată de utilizator)'
    const text = `Get App — Date Acces:\nURL: ${window.location.origin}/login\nEmail: ${u.email}\nParolă: ${pass}\n(La prima logare ți se va cere schimbarea parolei)`
    navigator.clipboard?.writeText(text)
    setCopiedId(u.id)
    showToast('success', `Datele de logare pentru ${u.full_name} au fost copiate în clipboard!`)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-[9995] max-w-md px-4 py-3 rounded-2xl border shadow-xl text-xs font-bold flex items-center gap-2.5 transition-all ${
          toast.type === 'error'
            ? 'bg-rose-600 border-rose-500 text-white'
            : toast.type === 'info'
              ? 'bg-slate-900 border-slate-700 text-white'
              : 'bg-emerald-600 border-emerald-500 text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={16} className="shrink-0" /> : <CheckCircle2 size={16} className="shrink-0" />}
          <span className="leading-snug">{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} className="ml-auto opacity-80 hover:opacity-100 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ─── 1. HEADER & ACȚIUNI PRINCIPALE ─── */}
      <div className={`px-5 py-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-extrabold tracking-tight leading-tight">
              {language === 'ru' ? 'Пользователи, Роли и Приглашения' : 'Utilizatori, Roluri de Acces & Invitații'}
            </h1>
            <p className="text-xs text-slate-400">
              {language === 'ru'
                ? 'Управление правами доступа по городам, брендам, ресторанам и приглашения по email'
                : 'Control granular pe orașe, branduri, puncte de lucru și invitații pe email'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={openInviteModal}
            className="h-9 px-4 rounded-full text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all"
          >
            <UserPlus size={14} />
            <span>{language === 'ru' ? 'Пригласить пользователя' : 'Invită Utilizator Nou'}</span>
          </button>
        </div>
      </div>

      {/* ─── 2. KPI CARDS ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          {
            label: language === 'ru' ? 'Всего аккаунтов' : 'Total Utilizatori',
            value: kpis.total,
            sub: `${kpis.active} ${language === 'ru' ? 'активных' : 'activi'}`,
            color: 'text-emerald-600 dark:text-emerald-400'
          },
          {
            label: language === 'ru' ? 'Ожидают 1-го входа' : 'Invitați (1-a Logare)',
            value: kpis.invited,
            sub: language === 'ru' ? 'Смена пароля при входе' : 'Schimbă parola la login',
            color: 'text-amber-600 dark:text-amber-400'
          },
          {
            label: 'Admin & Supervisor',
            value: kpis.adminsAndSup,
            sub: language === 'ru' ? 'Полный / Региональный' : 'Control extins / regional',
            color: 'text-blue-600 dark:text-blue-400'
          },
          {
            label: 'Operațional & Marketing',
            value: kpis.opsAndMkt,
            sub: language === 'ru' ? 'Диспетчерская и CRM' : 'Dispecerat Live & CRM',
            color: 'text-purple-600 dark:text-purple-400'
          },
          {
            label: language === 'ru' ? 'Менеджеры точек' : 'Manageri Restaurant',
            value: kpis.managers,
            sub: language === 'ru' ? 'Доступ по точкам' : 'Acces per locație/oraș',
            color: 'text-cyan-600 dark:text-cyan-400'
          }
        ].map((card, i) => (
          <div
            key={i}
            className={`px-4 py-3 rounded-2xl border ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
            }`}
          >
            <div className="text-[11px] font-bold text-slate-400 truncate">{card.label}</div>
            <div className={`text-xl font-extrabold mt-0.5 tabular-nums ${card.color}`}>{card.value}</div>
            <div className="text-[10px] text-slate-400 truncate mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ─── 3. FILTRE ROLURI (DROP LIST), STATUS & BARA DE CĂUTARE PE 1 SINGUR RÂND ─── */}
      <div className={`px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-2 flex-nowrap overflow-x-auto ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
      }`}>
        <div className="flex items-center gap-2 flex-nowrap shrink-0">
          {/* Selector Rol în Drop List */}
          <div className="flex items-center gap-1.5 shrink-0">
            <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value)
                setCurrentPage(1)
              }}
              className={`h-8 px-3 rounded-full text-xs font-bold border outline-none cursor-pointer transition-colors ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-white hover:border-slate-600'
                  : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
              }`}
            >
              <option value="all">{language === 'ru' ? `Все роли (${users.length})` : `Toate Rolurile (${users.length})`}</option>
              <option value="admin">Super Admin ({users.filter(u => u.role === 'admin').length})</option>
              <option value="supervisor">Supervisor ({users.filter(u => u.role === 'supervisor').length})</option>
              <option value="operational">{language === 'ru' ? 'Операционный' : 'Operațional'} ({users.filter(u => u.role === 'operational').length})</option>
              <option value="marketing">Marketing & CRM ({users.filter(u => u.role === 'marketing').length})</option>
              <option value="restaurant_manager">{language === 'ru' ? 'Менеджер ресторана' : 'Manager Restaurant'} ({users.filter(u => u.role === 'restaurant_manager').length})</option>
            </select>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

          {/* Filtre Status cu înălțime identică h-8 */}
          {[
            { key: 'all', label: language === 'ru' ? 'Все статусы' : 'Toți', count: users.length },
            { key: 'active', label: language === 'ru' ? 'Активные' : 'Activi', count: kpis.active },
            { key: 'invited', label: language === 'ru' ? 'Приглашенные' : 'Invitați', count: kpis.invited }
          ].map(tab => {
            const active = statusFilter === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.key)
                  setCurrentPage(1)
                }}
                className={`h-8 px-3 rounded-full text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5 border whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                    : isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] font-mono px-1.5 rounded-full ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search input with counter {filtered} / {total} and X button (h-8) */}
        <div className="relative w-64 shrink-0">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            placeholder={language === 'ru' ? 'Поиск имени, email, города...' : 'Caută nume, email, oraș, brand...'}
            className={`h-8 w-full pl-8 pr-16 rounded-full text-xs font-medium border outline-none transition-colors ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500'
                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:bg-white'
            }`}
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <span className="text-[10px] font-mono font-bold text-slate-400">
              {filteredUsers.length}/{users.length}
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── 4. TABEL STANDARD SMARTDEVIZE (CU NR, SORTARE, TRUNCATE, TFOOT Σ + GEN, PAGINARE) ─── */}
      <div className={`rounded-2xl border overflow-hidden ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b text-[11px] font-extrabold uppercase tracking-wider select-none ${
                isDark ? 'bg-slate-800/70 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
                <th className="py-2.5 px-2 w-10 text-center">#</th>
                <th
                  onClick={() => handleSort('name')}
                  className="py-2.5 px-3 cursor-pointer hover:text-emerald-500 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>{language === 'ru' ? 'Пользователь' : 'Utilizator'}</span>
                    <span className="text-[10px]">{sortCol === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('role')}
                  className="py-2.5 px-3 cursor-pointer hover:text-emerald-500 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>{language === 'ru' ? 'Роль доступа' : 'Rol Acces'}</span>
                    <span className="text-[10px]">{sortCol === 'role' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('cities')}
                  className="py-2.5 px-3 cursor-pointer hover:text-emerald-500 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>{language === 'ru' ? 'Города' : 'Orașe Permise'}</span>
                    <span className="text-[10px]">{sortCol === 'cities' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('brands')}
                  className="py-2.5 px-3 cursor-pointer hover:text-emerald-500 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>{language === 'ru' ? 'Бренды' : 'Branduri Permise'}</span>
                    <span className="text-[10px]">{sortCol === 'brands' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('modules')}
                  className="py-2.5 px-3 text-center cursor-pointer hover:text-emerald-500 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{language === 'ru' ? 'Модули' : 'Module'}</span>
                    <span className="text-[10px]">{sortCol === 'modules' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="py-2.5 px-3 cursor-pointer hover:text-emerald-500 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>{language === 'ru' ? 'Статус и Пароль' : 'Status & Parolă'}</span>
                    <span className="text-[10px]">{sortCol === 'status' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('last_login')}
                  className="py-2.5 px-3 cursor-pointer hover:text-emerald-500 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>{language === 'ru' ? 'Вход' : 'Ultima Logare'}</span>
                    <span className="text-[10px]">{sortCol === 'last_login' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right">
                  {language === 'ru' ? 'Действия' : 'Acțiuni'}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {paginatedUsers.map((u, idx) => {
                const roleMeta = ROLE_META[u.role] || ROLE_META.operational
                const roleLabel = language === 'ru' ? roleMeta.labelRu : language === 'en' ? roleMeta.labelEn : roleMeta.labelRo
                const allCities = (u.allowed_cities || []).includes('all')
                const allBrands = (u.allowed_brands || []).includes('all')
                const modCount = (u.allowed_pages || []).includes('all') ? ALL_MODULES.length : (u.allowed_pages || []).length
                const isCurrent = currentUser?.id === u.id

                return (
                  <tr
                    key={u.id}
                    onClick={() => openEditModal(u)}
                    className={`transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/90'
                    }`}
                  >
                    {/* Col 1: Nr (#) */}
                    <td className="py-2 px-2 w-10 text-center font-mono text-[11px] text-slate-400">
                      {startIndex + idx + 1}
                    </td>

                    {/* Col 2: Utilizator (Single-line compact) */}
                    <td className="py-2 px-3 max-w-[230px]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar user={u} size={32} showOnlineDot={u.status === 'active' && !u.must_change_password} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-extrabold text-slate-900 dark:text-white truncate">
                              {u.full_name}
                            </span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                                TU
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Col 3: Rol */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${roleMeta.badgeClass}`}>
                        <ShieldCheck size={11} />
                        <span>{roleLabel}</span>
                      </span>
                    </td>

                    {/* Col 4: Orașe Permise (Single-line truncate) */}
                    <td className="py-2 px-3 max-w-[170px]">
                      {allCities ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <MapPin size={11} />
                          <span>{language === 'ru' ? `Все (${availableCities.length})` : `Toate (${availableCities.length})`}</span>
                        </span>
                      ) : (
                        <div className="truncate font-semibold text-slate-700 dark:text-slate-300" title={(u.allowed_cities || []).join(', ')}>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold mr-1">
                            {(u.allowed_cities || []).length}:
                          </span>
                          {(u.allowed_cities || []).join(', ')}
                        </div>
                      )}
                    </td>

                    {/* Col 5: Branduri Permise (Single-line truncate) */}
                    <td className="py-2 px-3 max-w-[180px]">
                      {allBrands ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          <Store size={11} />
                          <span>{language === 'ru' ? `Все (${AUTHORITATIVE_BRANDS.length})` : `Toate (${AUTHORITATIVE_BRANDS.length})`}</span>
                        </span>
                      ) : (
                        <div className="truncate font-semibold text-slate-700 dark:text-slate-300" title={(u.allowed_brands || []).join(', ')}>
                          <span className="font-mono text-blue-600 dark:text-blue-400 font-bold mr-1">
                            {(u.allowed_brands || []).length}:
                          </span>
                          {(u.allowed_brands || []).join(', ')}
                        </div>
                      )}
                    </td>

                    {/* Col 6: Module */}
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {modCount} / {ALL_MODULES.length}
                      </span>
                    </td>

                    {/* Col 7: Status & Parolă */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      {u.status === 'blocked' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800">
                          <Lock size={11} />
                          <span>{language === 'ru' ? 'Заблокирован' : 'Blocat'}</span>
                        </span>
                      ) : u.must_change_password ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
                          <KeyRound size={11} />
                          <span>{language === 'ru' ? 'Приглашен (Смена пароля)' : 'Invitație (Schimbă la 1-a logare)'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 size={11} />
                          <span>{language === 'ru' ? 'Активен' : 'Activ'}</span>
                        </span>
                      )}
                    </td>

                    {/* Col 8: Ultima Logare */}
                    <td className="py-2 px-3 whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400">
                      {u.last_login_at
                        ? new Date(u.last_login_at).toLocaleString('ro-RO', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : (language === 'ru' ? 'Не входил' : 'Neautentificat')}
                    </td>

                    {/* Col 9: Acțiuni */}
                    <td className="py-2 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => switchUserDirect(u)}
                          title={language === 'ru' ? 'Протестировать вход под этой ролью' : 'Testează aplicația cu acest cont/rol'}
                          className="px-2 py-1 rounded-full text-[10px] font-bold border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer flex items-center gap-1"
                        >
                          <UserCheck size={11} />
                          <span>Test</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => copyCredentials(u)}
                          title={language === 'ru' ? 'Скопировать доступы' : 'Copiază datele de logare'}
                          className={`p-1.5 rounded-full border transition-colors cursor-pointer ${
                            isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                          }`}
                        >
                          {copiedId === u.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResendInvite(u)}
                          title={language === 'ru' ? 'Отправить приглашение на email повторно' : 'Retrimite invitația pe email'}
                          className={`p-1.5 rounded-full border transition-colors cursor-pointer ${
                            isDark ? 'border-slate-700 hover:bg-slate-800 text-emerald-400' : 'border-slate-200 hover:bg-slate-100 text-emerald-600'
                          }`}
                        >
                          <Send size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          title={language === 'ru' ? 'Редактировать права' : 'Editează rol și limite de acces'}
                          className={`p-1.5 rounded-full border transition-colors cursor-pointer ${
                            isDark ? 'border-slate-700 hover:bg-slate-800 text-blue-400' : 'border-slate-200 hover:bg-slate-100 text-blue-600'
                          }`}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetUser(u)}
                          title={language === 'ru' ? 'Удалить аккаунт' : 'Șterge utilizator'}
                          className={`p-1.5 rounded-full border transition-colors cursor-pointer ${
                            isDark ? 'border-slate-700 hover:bg-rose-950/50 text-rose-400' : 'border-slate-200 hover:bg-rose-50 text-rose-600'
                          }`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {paginatedUsers.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400 font-medium">
                    {language === 'ru' ? 'Пользователи по выбранным фильтрам не найдены.' : 'Niciun utilizator găsit pentru filtrele selectate.'}
                  </td>
                </tr>
              )}
            </tbody>

            {/* ─── 5. RÂND DE TOTALURI TFOOT (Σ Total Pagină + Gen: Total General) ─── */}
            <tfoot>
              <tr className={`border-t font-extrabold text-[11px] ${
                isDark ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}>
                <td className="py-2.5 px-2 text-center font-mono text-emerald-600 dark:text-emerald-400">Σ</td>
                <td className="py-2.5 px-3" colSpan={2}>
                  <div>
                    {language === 'ru' ? 'Итого на странице:' : 'Total Pagină:'}{' '}
                    <span className="text-emerald-600 dark:text-emerald-400">{paginatedUsers.length}</span>{' '}
                    <span className="text-slate-400 font-normal">
                      ({language === 'ru' ? `из ${filteredUsers.length} всего` : `din ${filteredUsers.length} total`})
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-3">
                  <div>{totals.pageCities} {language === 'ru' ? 'гор.' : 'orașe'}</div>
                  <div className="text-[10px] text-slate-400 font-semibold">Gen: {totals.genCities} {language === 'ru' ? 'гор.' : 'orașe'}</div>
                </td>
                <td className="py-2.5 px-3">
                  <div>{totals.pageBrands} {language === 'ru' ? 'бренд.' : 'branduri'}</div>
                  <div className="text-[10px] text-slate-400 font-semibold">Gen: {totals.genBrands} {language === 'ru' ? 'бренд.' : 'branduri'}</div>
                </td>
                <td className="py-2.5 px-3 text-center">
                  <div>{totals.pageModules} mod.</div>
                  <div className="text-[10px] text-slate-400 font-semibold">Gen: {totals.genModules} mod.</div>
                </td>
                <td className="py-2.5 px-3" colSpan={3}>
                  <div>{totals.pageActive} {language === 'ru' ? 'активных на стр.' : 'activi pe pagină'}</div>
                  <div className="text-[10px] text-slate-400 font-semibold">Gen: {totals.genActive} {language === 'ru' ? 'активных всего' : 'activi în total'}</div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ─── 6. FOOTER STANDARD DE PAGINARE & SELECTOR RÂNDURI ─── */}
        <div className={`px-4 py-2.5 border-t flex flex-wrap items-center justify-between gap-3 text-xs ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400">
              {language === 'ru' ? 'Строк:' : 'Rânduri:'}
            </span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                const v = e.target.value === 'all' ? 'all' : Number(e.target.value)
                setRowsPerPage(v)
                setCurrentPage(1)
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-bold border outline-none cursor-pointer ${
                isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              {[10, 15, 25, 50, 100].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
              <option value="all">{language === 'ru' ? 'Все' : 'Toți'}</option>
            </select>
          </div>

          <div className="text-[11px] font-bold">
            Total: <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{filteredUsers.length}</span>{' '}
            {language === 'ru' ? 'записей' : 'înregistrări'} ({kpis.active} {language === 'ru' ? 'активных' : 'activi'})
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400">
              {language === 'ru' ? `Страница ${safePage} из ${totalPages}` : `Pagina ${safePage} din ${totalPages}`}
            </span>
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 ${
                isDark ? 'border-slate-700 hover:bg-slate-800 text-white' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 ${
                isDark ? 'border-slate-700 hover:bg-slate-800 text-white' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── MODAL 1: INVITĂ / EDITEAZĂ UTILIZATOR & LIMITE DE ACCES ─── */}
      {isUserModalOpen && (
        <div
          className="fixed inset-0 z-[9990] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsUserModalOpen(false)}
        >
          <div
            className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden transition-colors ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header cu Avatar & Încărcare Poză integrată */}
            <div className={`px-6 py-4 border-b flex items-center justify-between gap-3 ${
              isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50/70'
            }`}>
              <div className="flex items-center gap-3 min-w-0">
                <UserAvatar
                  user={{
                    first_name: formFirstName || 'U',
                    last_name: formLastName || 'N',
                    email: formEmail,
                    role: formRole,
                    avatar_url: formAvatarUrl
                  }}
                  size={42}
                />
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold leading-tight truncate">
                    {editingUser
                      ? (language === 'ru' ? `Редактировать доступ: ${editingUser.full_name}` : `Editare Rol & Acces: ${editingUser.full_name}`)
                      : (language === 'ru' ? 'Пригласить нового пользователя' : 'Invită Utilizator Nou')}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    {language === 'ru'
                      ? 'Настройте роль, разрешенные города, бренды и модули'
                      : 'Setează rolul, orașele permise, brandurile, locațiile și parola de acces'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleModalPhotoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 px-3 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Upload size={12} />
                  <span>{language === 'ru' ? 'Фото' : 'Poză'}</span>
                </button>
                {formAvatarUrl && (
                  <button
                    type="button"
                    onClick={() => setFormAvatarUrl('')}
                    className="h-8 px-3 rounded-full text-xs font-bold text-rose-500 border border-rose-200 dark:border-rose-900 inline-flex items-center justify-center cursor-pointer"
                  >
                    {language === 'ru' ? 'Удалить' : 'Șterge'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className={`w-8 h-8 rounded-full border inline-flex items-center justify-center cursor-pointer ${
                    isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-500'
                  }`}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto custom-scrollbar">
              {/* Grid Simetric 2 Coloane (Toate câmpurile h-9 identice) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    {language === 'ru' ? 'ИМЯ (PRENUME) *' : 'PRENUME *'}
                  </label>
                  <input
                    type="text"
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    placeholder={language === 'ru' ? 'Напр: Александр' : 'Ex: Alexandru'}
                    className={`h-9 w-full px-3 rounded-xl border text-xs font-semibold outline-none transition-colors ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500 focus:bg-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    {language === 'ru' ? 'ФАМИЛИЯ (NUME)' : 'NUME DE FAMILIE'}
                  </label>
                  <input
                    type="text"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    placeholder={language === 'ru' ? 'Напр: Морару' : 'Ex: Moraru'}
                    className={`h-9 w-full px-3 rounded-xl border text-xs font-semibold outline-none transition-colors ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500 focus:bg-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    {language === 'ru' ? 'EMAIL (ДЛЯ ВХОДА И ПРИГЛАШЕНИЯ) *' : 'EMAIL (PENTRU LOGARE & INVITAȚIE) *'}
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="utilizator@getapp.ro"
                    className={`h-9 w-full px-3 rounded-xl border text-xs font-semibold outline-none transition-colors ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500 focus:bg-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    {language === 'ru' ? 'ТЕЛЕФОН' : 'TELEFON'}
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+407..."
                    className={`h-9 w-full px-3 rounded-xl border text-xs font-semibold outline-none transition-colors ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500 focus:bg-white'
                    }`}
                  />
                </div>

                {/* Rol de Acces în Drop List (h-9) */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    {language === 'ru' ? 'РОЛЬ ДОСТУПА (ВЫПАДАЮЩИЙ СПИСОК) *' : 'ROL DE ACCES (DROP LIST) *'}
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => handleRoleSelect(e.target.value)}
                    className={`h-9 w-full px-3 rounded-xl border text-xs font-bold outline-none cursor-pointer transition-colors ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500 focus:bg-white'
                    }`}
                  >
                    {Object.values(ROLE_META).map(r => (
                      <option key={r.key} value={r.key}>
                        {language === 'ru' ? r.labelRu : r.labelRo}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Parolă Temporară de Invitație cu buton Generează integrat (h-9) */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    {editingUser
                      ? (language === 'ru' ? 'ВРЕМЕННЫЙ ПАРОЛЬ (СБРОС)' : 'PAROLĂ TEMPORARĂ (RESETARE)')
                      : (language === 'ru' ? 'ВРЕМЕННЫЙ ПАРОЛЬ ПРИГЛАШЕНИЯ *' : 'PAROLĂ TEMPORARĂ DE INVITAȚIE *')}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formTempPassword}
                      onChange={(e) => setFormTempPassword(e.target.value)}
                      placeholder="Ex: GetApp26!"
                      className={`h-9 w-full pl-3 pr-24 rounded-xl border font-mono text-xs font-bold outline-none transition-colors ${
                        isDark ? 'bg-slate-800 border-slate-700 text-emerald-400 focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-emerald-700 focus:border-emerald-500 focus:bg-white'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setFormTempPassword(randomPassword())}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 px-2 rounded-lg text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={10} />
                      <span>{language === 'ru' ? 'Сгенер.' : 'Generează'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 3: Allowed Modules / Pages (Toate butoanele h-7 uniforme) */}
              <div className={`p-3.5 rounded-2xl border ${
                isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/80 border-slate-200/80'
              }`}>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-extrabold flex items-center gap-1.5">
                    <LayoutGrid size={13} className="text-emerald-500" />
                    <span>
                      {language === 'ru'
                        ? `Разрешенные разделы меню (${formPages.length}/${ALL_MODULES.length})`
                        : `Pagini & Module Permise în Meniu (${formPages.length}/${ALL_MODULES.length})`}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormPages(ALL_MODULES.map(m => m.key))}
                    className={`h-7 px-3 rounded-full text-[11px] font-bold border inline-flex items-center justify-center cursor-pointer transition-all ${
                      formPages.length === ALL_MODULES.length
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    {language === 'ru' ? 'Все модули' : 'Toate Modulele'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_MODULES.map(mod => {
                    const checked = formPages.includes(mod.key) || formPages.includes('all')
                    return (
                      <button
                        key={mod.key}
                        type="button"
                        onClick={() => toggleModulePage(mod.key)}
                        className={`h-7 px-3 rounded-full text-[11px] font-bold border inline-flex items-center justify-center whitespace-nowrap transition-all cursor-pointer ${
                          checked
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : isDark
                              ? 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                              : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {language === 'ru' ? mod.labelRu : mod.labelRo}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Row 4: Allowed Cities (Toate butoanele h-7 uniforme) */}
              <div className={`p-3.5 rounded-2xl border ${
                isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/80 border-slate-200/80'
              }`}>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-extrabold flex items-center gap-1.5">
                    <MapPin size={13} className="text-emerald-500" />
                    <span>{language === 'ru' ? 'Ограничение доступа по городам' : 'Limita de Acces pe Orașe'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormCities(['all'])}
                    className={`h-7 px-3 rounded-full text-[11px] font-bold border inline-flex items-center justify-center cursor-pointer transition-all ${
                      formCities.includes('all')
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    {language === 'ru' ? 'Все города' : 'Toate Orașele'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
                  {availableCities.map(city => {
                    const active = !formCities.includes('all') && formCities.includes(city)
                    return (
                      <button
                        key={city}
                        type="button"
                        onClick={() => toggleItemInList(formCities, setFormCities, city)}
                        className={`h-7 px-3 rounded-full text-[11px] font-bold border inline-flex items-center justify-center whitespace-nowrap transition-all cursor-pointer ${
                          active
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : isDark
                              ? 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                              : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {city}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Row 5: Allowed Brands (Toate butoanele h-7 uniforme) */}
              <div className={`p-3.5 rounded-2xl border ${
                isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/80 border-slate-200/80'
              }`}>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-extrabold flex items-center gap-1.5">
                    <Store size={13} className="text-emerald-500" />
                    <span>{language === 'ru' ? 'Ограничение доступа по брендам' : 'Limita de Acces pe Branduri'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormBrands(['all'])}
                    className={`h-7 px-3 rounded-full text-[11px] font-bold border inline-flex items-center justify-center cursor-pointer transition-all ${
                      formBrands.includes('all')
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    {language === 'ru' ? 'Все бренды' : 'Toate Brandurile'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {AUTHORITATIVE_BRANDS.map(brand => {
                    const active = !formBrands.includes('all') && formBrands.includes(brand)
                    return (
                      <button
                        key={brand}
                        type="button"
                        onClick={() => toggleItemInList(formBrands, setFormBrands, brand)}
                        className={`h-7 px-3 rounded-full text-[11px] font-bold border inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                          active
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : isDark
                              ? 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                              : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        <BrandAvatar brand={brand} size={15} className="rounded-full" />
                        <span>{brand}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Row 6: Checkboxes & Status */}
              <div className={`px-4 py-3 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
                isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200/80'
              }`}>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formMustChangePass}
                      onChange={(e) => setFormMustChangePass(e.target.checked)}
                      className="rounded accent-emerald-600 w-4 h-4 cursor-pointer"
                    />
                    <span>
                      {language === 'ru'
                        ? 'Обязательная смена пароля при первом входе'
                        : 'Obligă schimbarea parolei la prima logare'}
                    </span>
                  </label>

                  {!editingUser && (
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formSendBrevoEmail}
                        onChange={(e) => setFormSendBrevoEmail(e.target.checked)}
                        className="rounded accent-emerald-600 w-4 h-4 cursor-pointer"
                      />
                      <span>
                        {language === 'ru'
                          ? 'Отправить приглашение на email'
                          : 'Trimite invitația pe email'}
                      </span>
                    </label>
                  )}
                </div>

                {editingUser && (
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className={`h-8 px-3 rounded-full border text-xs font-bold outline-none cursor-pointer ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    <option value="active">{language === 'ru' ? 'Статус: Активен' : 'Status: Activ'}</option>
                    <option value="invited">{language === 'ru' ? 'Статус: Ожидает входа' : 'Status: Invitat'}</option>
                    <option value="blocked">{language === 'ru' ? 'Статус: Заблокирован' : 'Status: Blocat'}</option>
                  </select>
                )}
              </div>

              {/* Modal Footer (Butoane h-9 uniforme) */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className={`h-9 px-5 rounded-full text-xs font-bold border inline-flex items-center justify-center cursor-pointer ${
                    isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {language === 'ru' ? 'Отмена' : 'Anulează'}
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="h-9 px-5 rounded-full text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {editingUser ? <CheckCircle2 size={14} /> : <Send size={14} />}
                  <span>
                    {savingUser
                      ? (language === 'ru' ? 'Сохранение...' : 'Se salvează...')
                      : editingUser
                        ? (language === 'ru' ? 'Сохранить изменения' : 'Salvează Modificările')
                        : (language === 'ru' ? 'Создать и отправить приглашение' : 'Creează Cont & Trimite Invitația')}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: CONFIRMARE ȘTERGERE UTILIZATOR (FĂRĂ NATIVE CONFIRM) ─── */}
      {deleteTargetUser && (
        <div
          className="fixed inset-0 z-[9995] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteTargetUser(null)}
        >
          <div
            className={`w-full max-w-sm rounded-3xl border shadow-2xl p-6 text-center ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-3">
              <Trash2 size={22} />
            </div>
            <h3 className="text-base font-extrabold">Ștergi acest utilizator?</h3>
            <p className="text-xs text-slate-400 mt-1">
              Contul <strong>{deleteTargetUser.full_name}</strong> ({deleteTargetUser.email}) nu se va mai putea autentifica în platformă.
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeleteTargetUser(null)}
                className="px-4 py-2 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-full text-xs font-extrabold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
              >
                Șterge Contul
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

