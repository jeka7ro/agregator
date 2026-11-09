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
import { getCityDisplayName } from '../lib/orderUtils'
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
  KeyRound,
  RotateCcw,
  X
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
  const userMenuRef = useRef(null)

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true'
    } catch (_) {
      return false
    }
  })

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!user || pendingFirstLoginUser) {
    return <Navigate to="/login" replace />
  }

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev
      try {
        localStorage.setItem('sidebar_collapsed', String(next))
      } catch (_) {}
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
    <div className={`min-h-screen flex transition-colors duration-200 ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* SIDEBAR */}
      <aside className={`${isSidebarCollapsed ? 'w-[72px]' : 'w-[260px]'} shrink-0 sticky top-0 h-screen flex flex-col z-30 transition-all duration-200`}>
        <div className={`h-full flex flex-col border-r transition-colors duration-200 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          {/* Logo Section */}
          <div className={`h-16 shrink-0 ${isSidebarCollapsed ? 'px-2 justify-center' : 'px-4'} flex items-center border-b transition-all duration-200 ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}>
            <AppLogo
              variant="radar"
              size={isSidebarCollapsed ? 38 : 42}
              showText={!isSidebarCollapsed}
              isDark={isDark}
              onClick={() => navigate(navItems[0]?.path || '/dashboard')}
            />
          </div>

          {/* Nav Menu */}
          <nav className={`flex-1 ${isSidebarCollapsed ? 'px-2 py-3' : 'px-4 py-5'} space-y-1.5 overflow-y-auto custom-scrollbar`}>
            {!isSidebarCollapsed && (
              <div className="px-3 pb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('nav.menu')}
              </div>
            )}
            {navItems.map((item) => {
              const preservedParams = new URLSearchParams()
              try {
                const currentParams = new URLSearchParams(location.search)
                for (const key of ['city', 'brand', 'period']) {
                  if (currentParams.has(key)) {
                    preservedParams.set(key, currentParams.get(key))
                  }
                }
              } catch (_) {}
              const qs = preservedParams.toString()
              const targetPath = qs ? `${item.path}?${qs}` : item.path
              const isItemActive = location.pathname === item.path || (item.path === '/dashboard' && location.pathname === '/')
              return (
                <NavLink
                  key={item.path}
                  to={targetPath}
                  title={isSidebarCollapsed ? item.name : undefined}
                  className={() => 
                    `flex items-center ${isSidebarCollapsed ? 'justify-center w-10 h-10 mx-auto rounded-xl' : 'gap-3 px-4 h-10 rounded-full'} transition-all duration-150 text-sm font-semibold ${
                      isItemActive 
                        ? 'bg-emerald-600 text-white shadow-sm font-bold'
                        : isDark
                          ? 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`
                  }
                >
                  {() => (
                    <>
                      <item.icon className={`w-4 h-4 shrink-0 ${isItemActive ? 'text-white' : 'text-slate-400'}`} />
                      {!isSidebarCollapsed && (
                        <>
                          <span className="truncate">{item.name}</span>
                          {isItemActive && (
                            <div className="ml-auto w-2 h-2 rounded-full bg-white"></div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* Status Badge & Build Info at bottom */}
          <div className={`${isSidebarCollapsed ? 'p-2' : 'p-4'} border-t ${isDark ? 'border-slate-800' : 'border-slate-200'} mt-auto space-y-2`}>
            {!isSidebarCollapsed ? (
              <>
                {/* Build Number, Date & Time */}
                <div className="flex items-center justify-between px-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 select-none">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80"></span>
                    <span>{t('common.build', 'Build')} {BUILD_INFO.buildNumber}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    {BUILD_INFO.formatted}
                  </span>
                </div>

                {/* HQ Live Card */}
                <div className={`p-3 rounded-2xl flex items-center gap-3 ${isDark ? 'bg-slate-800/60 border border-slate-700/60' : 'bg-slate-50 border border-slate-200'}`}>
                  <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                    HQ
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {t('nav.hq')}
                    </div>
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold truncate flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>{t('nav.active_locations', { count: activeLocCount })}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Compact HQ when collapsed */
              <div className="flex flex-col items-center gap-1">
                <div 
                  className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/30 cursor-pointer"
                  title={`${t('nav.hq')} · ${activeLocCount} active · Build ${BUILD_INFO.buildNumber}`}
                >
                  HQ
                </div>
                <span className="text-[9px] text-slate-400 font-mono">#{BUILD_INFO.buildNumber}</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* TOP BAR */}
        <header className={`h-16 shrink-0 px-4 md:px-6 flex items-center justify-between border-b z-30 transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>

          {/* Left: Sidebar Toggle Button & Active Scope Badge */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className={`w-9 h-9 rounded-xl border transition-colors flex items-center justify-center cursor-pointer shrink-0 ${
                isDark 
                  ? 'border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white' 
                  : 'border-slate-200 hover:bg-slate-100 text-slate-700 hover:text-slate-900'
              }`}
              title={isSidebarCollapsed ? t('common.expand_sidebar', 'Extinde meniu') : t('common.collapse_sidebar', 'Restrânge meniu')}
            >
              {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>

            <div className="hidden md:flex items-center gap-2">
              <span className={`text-sm font-bold leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('header.central_dispatch')}
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {citiesScope} · {brandsScope}
              </span>
            </div>

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
                (activePeriod && activePeriod !== 'today' && activePeriod !== 'all')
              )
              return (
                <div className="flex items-center gap-1.5 ml-1">
                  {activeCity && activeCity !== 'all' && (
                    <span className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                      isDark ? 'bg-emerald-950/50 border-emerald-800/70 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}>
                      <MapPin size={11} />
                      <span>{getCityDisplayName(activeCity)}</span>
                    </span>
                  )}
                  {activeBrand && activeBrand !== 'all' && (
                    <span className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                      isDark ? 'bg-sky-950/50 border-sky-800/70 text-sky-300' : 'bg-sky-50 border-sky-200 text-sky-700'
                    }`}>
                      <Store size={11} />
                      <span>{activeBrand}</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      navigate(location.pathname, { replace: true })
                      window.dispatchEvent(new CustomEvent('global-reset-filters'))
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                      hasUrlFilters
                        ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 border-rose-500/30 shadow-2xs'
                        : isDark
                          ? 'bg-slate-800/70 hover:bg-slate-800 text-slate-300 border-slate-700/80'
                          : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200'
                    }`}
                    title={language === 'ru' ? 'Сбросить все активные фильтры (город, бренд, точка, канал)' : language === 'en' ? 'Reset all active filters (city, brand, location, channel)' : 'Resetează toate filtrele active (oraș, brand, locație, canal)'}
                  >
                    <RotateCcw size={12} />
                    <span>{language === 'ru' ? 'Сбросить фильтры' : language === 'en' ? 'Reset filters' : 'Reset filtre'}</span>
                  </button>
                </div>
              )
            })()}
          </div>

          {/* Right: Language Switcher, Theme Toggle & User Avatar Profile Pill */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2">
              <LanguageToggle />

              <button 
                onClick={toggleTheme}
                className={`w-8 h-8 rounded-full border transition-colors flex items-center justify-center shrink-0 cursor-pointer ${
                  isDark 
                    ? 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-amber-300' 
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
                title={t('common.toggle_theme')}
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
            
            <div className={`h-6 w-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
            
            {/* User Avatar & Role Dropdown in Header Right */}
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className={`pl-1.5 pr-2.5 py-1 rounded-full border flex items-center gap-2.5 transition-all cursor-pointer select-none ${
                  isDark
                    ? 'bg-slate-800/80 border-slate-700 hover:border-slate-600 text-white'
                    : 'bg-slate-50/90 border-slate-200 hover:border-slate-300 text-slate-900 shadow-2xs'
                }`}
              >
                <UserAvatar user={user} size={32} showOnlineDot />
                <div className="text-left hidden sm:block max-w-[140px]">
                  <div className="text-xs font-extrabold leading-tight truncate">
                    {user.full_name}
                  </div>
                  <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 leading-tight truncate">
                    {roleLabel}
                  </div>
                </div>
                <ChevronDown size={13} className="text-slate-400 shrink-0" />
              </button>

              {isUserMenuOpen && (
                <div className={`absolute right-0 mt-2 w-72 rounded-3xl border shadow-2xl overflow-hidden z-50 ${
                  isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                }`}>
                  {/* User Info Header */}
                  <div className={`p-4 border-b flex items-center gap-3 ${
                    isDark ? 'border-slate-800 bg-slate-800/40' : 'border-slate-100 bg-slate-50/70'
                  }`}>
                    <UserAvatar user={user} size={44} showOnlineDot />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-extrabold truncate">{user.full_name}</div>
                      <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
                      <div className="mt-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleMeta.badgeClass}`}>
                          <ShieldCheck size={10} />
                          <span>{roleLabel}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Scope info */}
                  <div className={`px-4 py-2 border-b text-[11px] flex items-center justify-between ${
                    isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'
                  }`}>
                    <span>{citiesScope}</span>
                    <span>•</span>
                    <span>{brandsScope}</span>
                  </div>

                  {/* Menu Actions */}
                  <div className="p-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false)
                        setIsProfileModalOpen(true)
                      }}
                      className={`w-full px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <UserCog size={15} className="text-slate-500 dark:text-slate-400" />
                      <span>{language === 'ru' ? 'Мой профиль' : language === 'en' ? 'My Profile' : 'Profilul meu'}</span>
                    </button>

                    <div className={`my-1 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`} />

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false)
                        logout()
                        navigate('/login')
                      }}
                      className={`w-full px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-rose-950/50 text-rose-400' : 'hover:bg-rose-50 text-rose-600'
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

        {/* OUTLET SCROLL AREA */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 w-full custom-scrollbar">
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
