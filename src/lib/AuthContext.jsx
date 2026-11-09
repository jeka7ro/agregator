import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { getApiUrl } from './api'
import { getCanonicalCity } from './orderUtils'
import { getBrandInfo } from '../components/BrandAvatar'

const AuthContext = createContext(null)

const STORAGE_USER_KEY = 'ag_auth_user_v1'
const STORAGE_LOGGED_OUT_KEY = 'ag_auth_logged_out_v1'

export const ROLE_META = {
  admin: {
    key: 'admin',
    labelRo: 'Super Admin',
    labelRu: 'Супер Админ',
    labelEn: 'Super Admin',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    defaultPages: ['dashboard', 'dispatch', 'couriers-map', 'customers', 'monitoring', 'reputation', 'alerts', 'reports', 'users', 'settings']
  },
  supervisor: {
    key: 'supervisor',
    labelRo: 'Supervisor',
    labelRu: 'Супервайзер',
    labelEn: 'Supervisor',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    defaultPages: ['dashboard', 'dispatch', 'couriers-map', 'customers', 'monitoring', 'reputation', 'alerts', 'reports']
  },
  operational: {
    key: 'operational',
    labelRo: 'Operațional',
    labelRu: 'Операционный',
    labelEn: 'Operations',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    defaultPages: ['dashboard', 'dispatch', 'couriers-map', 'monitoring', 'alerts']
  },
  marketing: {
    key: 'marketing',
    labelRo: 'Marketing & CRM',
    labelRu: 'Маркетинг и CRM',
    labelEn: 'Marketing & CRM',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    defaultPages: ['dashboard', 'customers', 'reputation', 'reports']
  },
  restaurant_manager: {
    key: 'restaurant_manager',
    labelRo: 'Manager',
    labelRu: 'Менеджер',
    labelEn: 'Manager',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    defaultPages: ['dashboard', 'dispatch', 'couriers-map', 'reputation', 'alerts']
  }
}

export function getUserInitials(user) {
  if (!user) return 'AD'
  const f = String(user.first_name || '').trim()
  const l = String(user.last_name || '').trim()
  if (f && l) {
    return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase()
  }
  if (f) {
    const parts = f.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
    }
    return f.slice(0, 2).toUpperCase()
  }
  if (user.full_name) {
    const parts = String(user.full_name).trim().split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
    }
    return String(user.full_name).slice(0, 2).toUpperCase()
  }
  return String(user.email || 'US').slice(0, 2).toUpperCase()
}

const DEFAULT_ADMIN_USER = {
  id: 'usr_admin_1',
  first_name: 'Eugeniu',
  last_name: 'Cazmal',
  full_name: 'Eugeniu Cazmal',
  initials: 'EC',
  email: 'jeka7ro@gmail.com',
  phone: '+40750000001',
  role: 'admin',
  avatar_url: '',
  must_change_password: false,
  status: 'active',
  allowed_pages: ['dashboard', 'dispatch', 'couriers-map', 'customers', 'monitoring', 'reputation', 'alerts', 'reports', 'users', 'settings'],
  allowed_cities: ['all'],
  allowed_brands: ['all'],
  allowed_restaurants: ['all']
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const isLoggedOut = localStorage.getItem(STORAGE_LOGGED_OUT_KEY) === '1'
      if (isLoggedOut) return null
      const saved = localStorage.getItem(STORAGE_USER_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && parsed.email) {
          parsed.initials = getUserInitials(parsed)
          parsed.full_name = `${parsed.first_name || ''} ${parsed.last_name || ''}`.trim() || parsed.email
          return parsed
        }
      }
    } catch (_) {}
    return null
  })

  const [pendingFirstLoginUser, setPendingFirstLoginUser] = useState(null)

  const saveSessionUser = useCallback((nextUser) => {
    if (!nextUser) {
      setUser(null)
      try {
        localStorage.removeItem(STORAGE_USER_KEY)
        localStorage.setItem(STORAGE_LOGGED_OUT_KEY, '1')
      } catch (_) {}
      return
    }
    const enriched = {
      ...nextUser,
      full_name: `${nextUser.first_name || ''} ${nextUser.last_name || ''}`.trim() || nextUser.email,
      initials: getUserInitials(nextUser)
    }
    setUser(enriched)
    try {
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(enriched))
      localStorage.removeItem(STORAGE_LOGGED_OUT_KEY)
    } catch (_) {}
  }, [])

  // Sync active user profile once on mount if logged in
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    fetch(getApiUrl('/api/users'))
      .then(r => r.json())
      .then(data => {
        if (cancelled || !data?.success || !Array.isArray(data.users)) return
        const fresh = data.users.find(u => u.id === user.id || u.email === user.email)
        if (fresh) {
          saveSessionUser({
            ...fresh,
            // Preserve local avatar if user just updated it
            avatar_url: fresh.avatar_url || user.avatar_url || ''
          })
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const login = async (email, password) => {
    const res = await fetch(getApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Autentificare eșuată.')
    }
    if (data.must_change_password) {
      setPendingFirstLoginUser(data.user)
      return { mustChangePassword: true, user: data.user }
    }
    setPendingFirstLoginUser(null)
    saveSessionUser(data.user)
    return { mustChangePassword: false, user: data.user }
  }

  const completeFirstLogin = async ({ userId, email, newPassword, firstName, lastName, avatarUrl }) => {
    const res = await fetch(getApiUrl('/api/auth/first-login-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email, newPassword, firstName, lastName, avatarUrl })
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Nu s-a putut salva noua parolă.')
    }
    setPendingFirstLoginUser(null)
    saveSessionUser(data.user)
    return data.user
  }

  const requestPasswordReset = async (email) => {
    const res = await fetch(getApiUrl('/api/auth/forgot-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Eroare la trimiterea codului de resetare.')
    }
    return data
  }

  const confirmPasswordReset = async ({ email, code, newPassword }) => {
    const res = await fetch(getApiUrl('/api/auth/reset-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, newPassword })
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Eroare la resetarea parolei.')
    }
    setPendingFirstLoginUser(null)
    saveSessionUser(data.user)
    return data.user
  }

  const updateProfile = async (payload) => {
    if (!user?.id) throw new Error('Niciun utilizator autentificat.')
    const res = await fetch(getApiUrl('/api/auth/profile'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, ...payload })
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Eroare la actualizarea profilului.')
    }
    saveSessionUser(data.user)
    return data.user
  }

  const logout = useCallback(() => {
    setPendingFirstLoginUser(null)
    saveSessionUser(null)
  }, [saveSessionUser])

  const switchUserDirect = useCallback((targetUser) => {
    if (!targetUser) return
    if (targetUser.must_change_password) {
      setPendingFirstLoginUser(targetUser)
      saveSessionUser(null)
      return
    }
    setPendingFirstLoginUser(null)
    saveSessionUser(targetUser)
  }, [saveSessionUser])

  const canAccessPage = useCallback((pageKey) => {
    if (!user) return false
    if (user.role === 'admin') return true
    const pages = Array.isArray(user.allowed_pages) && user.allowed_pages.length > 0
      ? user.allowed_pages
      : (ROLE_META[user.role]?.defaultPages || ['dashboard'])
    if (pages.includes('all')) return true
    return pages.includes(pageKey)
  }, [user])

  const canAccessCity = useCallback((cityOrRestName) => {
    if (!user || user.role === 'admin') return true
    const cities = user.allowed_cities || ['all']
    if (cities.includes('all')) return true
    const raw = String(cityOrRestName || '').trim()
    if (!raw) return false
    const canonTarget = getCanonicalCity(raw) || raw.toUpperCase()
    return cities.some(c => {
      const canonAllowed = getCanonicalCity(String(c || '')) || String(c || '').trim().toUpperCase()
      return canonAllowed === canonTarget
    })
  }, [user])

  const canAccessBrand = useCallback((brandOrRestObj) => {
    if (!user || user.role === 'admin') return true
    const brands = user.allowed_brands || ['all']
    if (brands.includes('all')) return true
    let brandStr = ''
    if (typeof brandOrRestObj === 'string') {
      brandStr = brandOrRestObj.trim()
      if (!brandStr) return false
      const info = getBrandInfo({ name: brandStr, brand: brandStr })
      if (info && info.name && info.name !== 'Necunoscut') {
        brandStr = info.name
      }
    } else if (brandOrRestObj && typeof brandOrRestObj === 'object') {
      brandStr = brandOrRestObj.brand_name || brandOrRestObj.brand || getBrandInfo(brandOrRestObj)?.name || ''
    }
    const clean = String(brandStr || '').trim().toLowerCase()
    if (!clean) return false
    return brands.some(b => String(b).trim().toLowerCase() === clean)
  }, [user])

  const canAccessRestaurant = useCallback((restId) => {
    if (!user || user.role === 'admin') return true
    const rests = user.allowed_restaurants || ['all']
    if (rests.includes('all')) return true
    return rests.includes(String(restId))
  }, [user])

  const hasScopeRestrictions = useMemo(() => {
    if (!user || user.role === 'admin') return false
    const allC = (user.allowed_cities || ['all']).includes('all')
    const allB = (user.allowed_brands || ['all']).includes('all')
    const allR = (user.allowed_restaurants || ['all']).includes('all')
    return !(allC && allB && allR)
  }, [user])

  return (
    <AuthContext.Provider
      value={{
        user,
        pendingFirstLoginUser,
        setPendingFirstLoginUser,
        login,
        completeFirstLogin,
        requestPasswordReset,
        confirmPasswordReset,
        updateProfile,
        logout,
        switchUserDirect,
        saveSessionUser,
        canAccessPage,
        canAccessCity,
        canAccessBrand,
        canAccessRestaurant,
        hasScopeRestrictions
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
