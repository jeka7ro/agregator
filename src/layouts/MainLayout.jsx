import React, { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { useAuth, ROLE_META } from '../lib/AuthContext'
import { useLiveChecks } from '../hooks/useLiveChecks'
import { BUILD_INFO } from '../lib/buildInfo'
import LanguageToggle from '../components/LanguageToggle'
import AppLogo from '../components/AppLogo'
import UserAvatar from '../components/UserAvatar'
import UserProfileModal from '../components/UserProfileModal'
import {
  LayoutDashboard,
  Store,
  BellRing,
  Settings,
  Moon,
  Sun,
  FileText,
  Radio,
  MapPin,
  Users,
  Star,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  ChevronDown,
  UserCog,
  LogOut,
  RotateCcw,
  Maximize2,
  Minimize2
} from 'lucide-react'

export default function MainLayout() {
  const { isDark, toggleTheme } = useTheme()
  const { t, language } = useLanguage()
  const { user, pendingFirstLoginUser, logout, canAccessPage } = useAuth()
  const { restaurants } = useLiveChecks()
  const navigate = useNavigate()
  const location = useLocation()

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isAppFullscreen, setIsAppFullscreen] = useState(false)
  const userMenuRef = useRef(null)

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar_collapsed')
      if (saved !== null) return saved === 'true'
      return typeof window !== 'undefined' ? window.innerWidth < 1024 : false
    } catch (_) {
      return false
    }
  })

  useEffect(() => {
    const syncFsState = () => {
      const fsActive = Boolean(document.fullscreenElement || document.webkitFullscreenElement)
      setIsAppFullscreen(fsActive)
      document.documentElement.classList.toggle('app-fullscreen', fsActive)
      // Trigger ResizeObserver / Leaflet invalidateSize cleanly across all active views
      setTimeout(() => window.dispatchEvent(new Event('resize')), 180)
    }
    document.addEventListener('fullscreenchange', syncFsState)
    document.addEventListener('webkitfullscreenchange', syncFsState)
    syncFsState()
    return () => {
      document.removeEventListener('fullscreenchange', syncFsState)
      document.removeEventListener('webkitfullscreenchange', syncFsState)
      document.documentElement.classList.remove('app-fullscreen')
    }
  }, [])

  // Notify charts & Leaflet maps whenever sidebar width changes
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 220)
    return () => clearTimeout(t)
  }, [isSidebarCollapsed])

  const toggleAppFullscreen = async () => {
    try {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement
      if (!fsEl) {
        const root = document.documentElement
        if (root.requestFullscreen) await root.requestFullscreen()
        else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen()
      } else {
        if (document.exitFullscreen) await document.exitFullscreen()
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen()
      }
    } catch (_) {}
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  if (!user || user.status === 'blocked' || pendingFirstLoginUser) {
    return <Navigate to="/login" replace />
  }

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev
      try {
        localStorage.setItem('sidebar_collapsed', String(next))
      } catch (_) { }
      return next
    })
  }

  const allNavItems = [
    { key: 'dashboard', name: t('nav.dashboard'), path: '/dashboard', icon: LayoutDashboard },
    { key: 'dispatch', name: t('nav.dispatch'), path: '/dispatch', icon: Radio },
    { key: 'couriers-map', name: t('nav.couriers_map', 'Harta Curieri Live'), path: '/couriers-map', icon: MapPin },
    { key: 'customers', name: t('nav.customers', 'Clienți'), path: '/customers', icon: Users },
    { key: 'monitoring', name: t('nav.monitoring'), path: '/monitoring', icon: Store },
    { key: 'reputation', name: t('nav.reputation', 'Recenzii & Rating'), path: '/reputation', icon: Star },
    { key: 'alerts', name: t('nav.alerts'), path: '/alerts', icon: BellRing },
    { key: 'reports', name: t('nav.reports'), path: '/reports', icon: FileText },
    {
      key: 'users',
      name: language === 'ru' ? 'Пользователи и Роли' : language === 'en' ? 'Users & Roles' : 'Utilizatori & Roluri',
      path: '/users',
      icon: ShieldCheck
    },
    { key: 'settings', name: t('nav.settings'), path: '/settings', icon: Settings },
  ]

  const navItems = allNavItems.filter(item => canAccessPage(item.key))

  // Route guard if current path is not allowed for the user's role
  const currentPathKey = location.pathname.replace(/^\/+/, '') || 'dashboard'
  if (currentPathKey && !canAccessPage(currentPathKey) && navItems.length > 0) {
    return <Navigate to={navItems[0].path} replace />
  }

  const roleMeta = ROLE_META[user.role] || ROLE_META.operational
  const roleLabel = language === 'ru' ? roleMeta.labelRu : language === 'en' ? roleMeta.labelEn : roleMeta.labelRo
  const allowedCitiesClean = (user.allowed_cities || []).filter(c => c !== 'all')
  const allowedBrandsClean = (user.allowed_brands || []).filter(b => b !== 'all')
  const citiesScope = (user.allowed_cities || []).includes('all')
    ? (language === 'ru' ? 'Все города' : language === 'en' ? 'All cities' : 'Toate orașele')
    : allowedCitiesClean.length === 1
      ? allowedCitiesClean[0]
      : `${allowedCitiesClean.length} ${language === 'ru' ? 'гор.' : language === 'en' ? 'cities' : 'orașe'}`
  const brandsScope = (user.allowed_brands || []).includes('all')
    ? (language === 'ru' ? 'Все бренды' : language === 'en' ? 'All brands' : 'Toate brandurile')
    : allowedBrandsClean.length === 1
      ? allowedBrandsClean[0]
      : `${allowedBrandsClean.length} ${language === 'ru' ? 'бренд.' : language === 'en' ? 'brands' : 'branduri'}`
  const activeLocCount = (restaurants || []).filter(r => r.is_active !== false).length || (allowedCitiesClean.length === 1 ? 1 : 52)

  return (
    <div className={`min-h-screen w-full max-w-[100vw] overflow-x-hidden flex apple-app-canvas transition-colors duration-200 ${isDark ? 'text-[#F5F5F7]' : 'text-[#1D1D1F]'}`}>

      {/* FLOATING INSET LIQUID GLASS SIDEBAR — Adaptive Laptop → 5K Ultrawide */}
      <aside
        aria-label={t('nav.menu')}
        className={`${isSidebarCollapsed ? 'w-[68px]' : 'w-[214px] xl:w-[232px] 2xl:w-[246px]'} shrink-0 sticky top-0 h-screen p-2 pr-0 flex flex-col z-30 transition-[width] duration-200`}
      >
        <div className="h-full flex flex-col rounded-[18px] apple-glass-sidebar overflow-hidden transition-colors duration-200">
          {/* Logo Section */}
          <div className={`h-12 shrink-0 ${isSidebarCollapsed ? 'px-1.5 justify-center' : 'px-3.5'} flex items-center border-b transition-all duration-200 ${isDark ? 'border-white/[0.08]' : 'border-black/[0.06]'
            }`}>
            <AppLogo
              variant="radar"
              size={isSidebarCollapsed ? 30 : 32}
              showText={!isSidebarCollapsed}
              isDark={isDark}
              onClick={() => navigate(navItems[0]?.path || '/dashboard')}
            />
          </div>

          {/* Nav Menu */}
          <nav className={`flex-1 ${isSidebarCollapsed ? 'px-1.5 py-2.5' : 'px-2 py-2.5'} space-y-0.5 overflow-y-auto custom-scrollbar`}>
            {navItems.map((item) => {
              const preservedParams = new URLSearchParams()
              try {
                const currentParams = new URLSearchParams(location.search)
                const curPeriod = currentParams.get('period')
                const curFrom = currentParams.get('from')
                for (const key of ['city', 'brand', 'period', 'from', 'to', 'channel']) {
                  if (!currentParams.has(key)) continue
                  if (key === 'period' && curPeriod === 'custom' && !curFrom) continue
                  if ((key === 'from' || key === 'to') && curPeriod !== 'custom') continue
                  preservedParams.set(key, currentParams.get(key))
                }
              } catch (_) { }
              const qs = preservedParams.toString()
              const targetPath = qs ? `${item.path}?${qs}` : item.path
              const isItemActive = location.pathname === item.path || (item.path === '/dashboard' && location.pathname === '/')
              return (
                <NavLink
                  key={item.path}
                  to={targetPath}
                  aria-current={isItemActive ? 'page' : undefined}
                  title={isSidebarCollapsed ? item.name : undefined}
                  className={() =>
                    `flex items-center ${isSidebarCollapsed ? 'justify-center w-9 h-8 mx-auto rounded-[10px]' : 'gap-2.5 px-2.5 h-[34px] rounded-[10px]'} transition-all duration-150 text-[12.5px] ${isItemActive
                      ? 'bg-gradient-to-b from-[#059669] to-[#047857] text-white font-semibold shadow-[0_2px_8px_rgba(4,120,87,0.34)]'
                      : isDark
                        ? 'text-[#D1D1D6] hover:text-white hover:bg-white/[0.07] font-medium'
                        : 'text-[#3A3A3C] hover:text-[#1D1D1F] hover:bg-black/[0.045] font-medium'
                    }`
                  }
                >
                  {() => (
                    <>
                      <item.icon className={`w-[15px] h-[15px] shrink-0 ${isItemActive
                        ? 'text-white'
                        : 'text-[#047857] dark:text-[#34D399] opacity-85'
                        }`} />
                      {!isSidebarCollapsed && (
                        <span className="truncate">{item.name}</span>
                      )}
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* Status Badge & Build Info at bottom */}
          <div className={`${isSidebarCollapsed ? 'p-1.5' : 'p-2.5'} border-t ${isDark ? 'border-white/[0.08]' : 'border-black/[0.06]'} mt-auto space-y-1.5`}>
            {!isSidebarCollapsed ? (
              <>
                <div className="flex items-center justify-between px-1 text-[10.5px] font-medium text-[#636366] dark:text-[#8E8E93] select-none">
                  <span className="font-semibold text-[#3A3A3C] dark:text-[#D1D1D6] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>{t('common.build', 'Build')} {BUILD_INFO.buildNumber}</span>
                  </span>
                  <span className="text-[10px] tabular-nums">
                    {BUILD_INFO.formatted}
                  </span>
                </div>

                <div className={`p-2 rounded-xl flex items-center gap-2 ${isDark ? 'bg-white/[0.05] border border-white/[0.08]' : 'bg-black/[0.03] border border-black/[0.05]'}`}>
                  <div className="w-7 h-7 rounded-[9px] bg-[#047857]/12 text-[#047857] dark:bg-[#10B981]/18 dark:text-[#34D399] flex items-center justify-center font-bold text-[11px] shrink-0">
                    HQ
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11.5px] font-semibold truncate ${isDark ? 'text-white' : 'text-[#1D1D1F]'}`}>
                      {t('nav.hq')}
                    </div>
                    <div className="text-[10.5px] text-[#0A7B5C] dark:text-emerald-400 font-semibold truncate flex items-center gap-1.5 tabular-nums">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>{t('nav.active_locations', { count: activeLocCount })}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-8 h-8 rounded-[10px] bg-[#047857]/12 text-[#047857] dark:bg-[#10B981]/18 dark:text-[#34D399] flex items-center justify-center font-bold text-[11px] cursor-pointer"
                  title={`${t('nav.hq')} · ${activeLocCount} active · Build ${BUILD_INFO.buildNumber}`}
                >
                  HQ
                </div>
                <span className="text-[9px] text-[#636366] dark:text-[#8E8E93] tabular-nums">{BUILD_INFO.buildNumber}</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA — Content glides smoothly beneath the Floating macOS Tahoe Liquid Glass Toolbar */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto overflow-x-hidden custom-scrollbar relative">

        {/* FLOATING LIQUID GLASS TOOLBAR — 100% Full-Bleed Edge-to-Edge (zero side margins on 5K/Ultrawide) */}
        <div className={`sticky top-0 z-30 px-2.5 md:px-3.5 ${isAppFullscreen ? 'pt-1.5 pb-1' : 'pt-2 pb-1'} pointer-events-none`}>
          <header className="pointer-events-auto h-11 px-2 md:px-3 rounded-full flex items-center justify-between gap-2 apple-glass-toolbar transition-colors w-full">

            {/* Left: Clean macOS Sidebar Toggle (+ contextual Reset pill ONLY when URL filters are active) */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={isSidebarCollapsed ? t('common.expand_sidebar', 'Extinde meniu') : t('common.collapse_sidebar', 'Restrânge meniu')}
                aria-expanded={!isSidebarCollapsed}
                className="apple-btn-secondary !w-8 !h-8 !p-0 shrink-0"
                title={isSidebarCollapsed ? t('common.expand_sidebar', 'Extinde meniu') : t('common.collapse_sidebar', 'Restrânge meniu')}
              >
                {isSidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
              </button>

              {(() => {
                const sp = new URLSearchParams(location.search)
                const activeCity = sp.get('city')
                const activeBrand = sp.get('brand')
                const activeChannel = sp.get('channel')
                const activePeriod = sp.get('period')
                const hasUrlFilters = Boolean(
                  (activeCity && activeCity !== 'all') ||
                  (activeBrand && activeBrand !== 'all') ||
                  (activeChannel && activeChannel !== 'all') ||
                  (activePeriod && activePeriod !== 'today' && activePeriod !== 'this_month' && activePeriod !== 'all')
                )
                if (!hasUrlFilters) return null
                return (
                  <button
                    type="button"
                    onClick={() => {
                      navigate(location.pathname, { replace: true })
                      window.dispatchEvent(new CustomEvent('global-reset-filters'))
                    }}
                    className="apple-btn-secondary !h-7 !px-2.5 !text-[11px] !text-rose-600 dark:!text-rose-400 !border-rose-500/30"
                    title={language === 'ru' ? 'Сбросить активные фильтры' : language === 'en' ? 'Reset active filters' : 'Resetează filtrele active'}
                  >
                    <RotateCcw size={11} />
                    <span className="hidden sm:inline">{language === 'ru' ? 'Сбросить фильтры' : language === 'en' ? 'Reset filters' : 'Reset filtre'}</span>
                  </button>
                )
              })()}
            </div>

            {/* Right: Concentric macOS Tahoe Capsules — Language, Fullscreen, Theme & Full User Profile */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <LanguageToggle />

              <button
                type="button"
                onClick={toggleAppFullscreen}
                aria-label={
                  isAppFullscreen
                    ? (language === 'ru' ? 'Выйти из полноэкранного режима' : language === 'en' ? 'Exit Fullscreen' : 'Ieși din ecran complet')
                    : (language === 'ru' ? 'На весь экран' : language === 'en' ? 'Fullscreen' : 'Ecran complet')
                }
                aria-pressed={isAppFullscreen}
                className={`!hidden sm:!inline-flex apple-btn-secondary !w-8 !h-8 !p-0 shrink-0 ${
                  isAppFullscreen ? '!border-[#047857]/50 !text-[#047857] dark:!border-[#34D399]/50 dark:!text-[#34D399] !bg-emerald-500/10' : ''
                }`}
                title={
                  isAppFullscreen
                    ? (language === 'ru' ? 'Свернуть экран (Esc)' : language === 'en' ? 'Exit Fullscreen (Esc)' : 'Ieși din ecran complet (Esc)')
                    : (language === 'ru' ? 'Полный экран (ноутбук → 5K Ultrawide)' : language === 'en' ? 'Fullscreen (Laptop → 5K Ultrawide)' : 'Ecran complet (Laptop → 5K Ultrawide)')
                }
              >
                {isAppFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={t('common.toggle_theme')}
                className="apple-btn-secondary !w-8 !h-8 !p-0 shrink-0"
                title={t('common.toggle_theme')}
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-[#3A3A3C]" />}
              </button>

              <div className={`h-5 w-px ${isDark ? 'bg-white/[0.12]' : 'bg-black/[0.09]'}`} />

              {/* User Avatar & Role Capsule — Full 2-line readable name + role (zero truncation!) */}
              <div ref={userMenuRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className={`pl-1 pr-2.5 h-8 rounded-full border flex items-center gap-2 transition-colors cursor-pointer select-none ${isDark
                    ? 'bg-white/[0.07] border-white/[0.12] hover:bg-white/[0.12] text-white'
                    : 'bg-white/90 border-black/[0.09] hover:bg-white text-[#1D1D1F] shadow-2xs'
                    }`}
                >
                  <UserAvatar user={user} size={24} showOnlineDot />
                  <div className="text-left hidden sm:block">
                    <div className="text-[12px] font-semibold leading-tight whitespace-nowrap">
                      {user.full_name}
                    </div>
                    <div className="text-[10px] font-semibold text-[#047857] dark:text-[#34D399] leading-tight whitespace-nowrap">
                      {roleLabel}
                    </div>
                  </div>
                  <ChevronDown size={13} className="text-[#636366] dark:text-[#AEAEB2] shrink-0" />
                </button>

                {isUserMenuOpen && (
                  <div
                    role="menu"
                    className={`absolute right-0 mt-2 w-72 rounded-2xl overflow-hidden z-50 apple-glass-popover ${isDark ? 'text-white' : 'text-slate-900'
                      }`}
                  >
                    {/* User Info Header */}
                    <div className={`p-4 border-b flex items-center gap-3 ${isDark ? 'border-white/[0.08] bg-white/[0.03]' : 'border-slate-900/[0.07] bg-slate-50/70'
                      }`}>
                      <UserAvatar user={user} size={44} showOnlineDot />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold truncate">{user.full_name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</div>
                        <div className="mt-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${roleMeta.badgeClass}`}>
                            <ShieldCheck size={10} />
                            <span>{roleLabel}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Scope info */}
                    <div className={`px-4 py-2 border-b text-[11px] flex items-center justify-between ${isDark ? 'border-white/[0.08] text-slate-400' : 'border-slate-900/[0.07] text-slate-500'
                      }`}>
                      <span>{citiesScope}</span>
                      <span>•</span>
                      <span>{brandsScope}</span>
                    </div>

                    {/* Menu Actions */}
                    <div className="p-2 space-y-1">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsUserMenuOpen(false)
                          setIsProfileModalOpen(true)
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${isDark ? 'hover:bg-white/[0.08] text-slate-200' : 'hover:bg-slate-900/[0.05] text-slate-700'
                          }`}
                      >
                        <UserCog size={15} className="text-slate-500 dark:text-slate-400" />
                        <span>{language === 'ru' ? 'Мой профиль' : language === 'en' ? 'My Profile' : 'Profilul meu'}</span>
                      </button>

                      <div className={`my-1 border-t ${isDark ? 'border-white/[0.08]' : 'border-slate-900/[0.07]'}`} />

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsUserMenuOpen(false)
                          logout()
                          navigate('/login')
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${isDark ? 'hover:bg-rose-950/60 text-rose-400' : 'hover:bg-rose-50 text-rose-600'
                          }`}
                      >
                        <LogOut size={15} />
                        <span>{language === 'ru' ? 'Выйти из аккаунта' : language === 'en' ? 'Sign Out' : 'Deconectare'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>
        </div>

        {/* OUTLET CONTENT AREA — 100% Full-Bleed Adaptive Command Center (Laptop → 5K → 49" Ultrawide, zero dead margins) */}
        <div className={`px-2.5 pb-4 pt-1.5 md:px-3.5 md:pb-5 w-full max-w-none app-fluid-shell ${isAppFullscreen ? 'app-fluid-fullscreen' : ''}`}>
          <Outlet />
        </div>
      </main>

      {/* Modal Editare Profil, Poză Avatar & Schimbare Parolă */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        isDark={isDark}
      />

    </div>
  )
}
