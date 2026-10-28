import React, { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { BUILD_INFO } from '../lib/buildInfo'
import LanguageToggle from '../components/LanguageToggle'
import AppLogo from '../components/AppLogo'
import LogoSelectorModal from '../components/LogoSelectorModal'
import { 
  LayoutDashboard, 
  Store, 
  BellRing, 
  Settings, 
  Moon, 
  Sun, 
  FileText,
  Radio,
  Star,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'

export default function MainLayout() {
  const { isDark, toggleTheme } = useTheme()
  const { t } = useLanguage()

  const [logoVariant, setLogoVariant] = useState(() => {
    try {
      return localStorage.getItem('app_logo_variant') || 'radar'
    } catch (_) {
      return 'radar'
    }
  })
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false)

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true'
    } catch (_) {
      return false
    }
  })

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev
      try {
        localStorage.setItem('sidebar_collapsed', String(next))
      } catch (_) {}
      return next
    })
  }

  const handleSelectLogo = (variant) => {
    setLogoVariant(variant)
    try {
      localStorage.setItem('app_logo_variant', variant)
    } catch (_) {}
  }

  const navItems = [
    { name: t('nav.dashboard'), path: '/dashboard', icon: LayoutDashboard },
    { name: t('nav.dispatch'), path: '/dispatch', icon: Radio },
    { name: t('nav.monitoring'), path: '/monitoring', icon: Store },
    { name: t('nav.reputation', 'Recenzii & Rating'), path: '/reputation', icon: Star },
    { name: t('nav.alerts'), path: '/alerts', icon: BellRing },
    { name: t('nav.reports'), path: '/reports', icon: FileText },
    { name: t('nav.settings'), path: '/settings', icon: Settings },
  ]

  const location = useLocation()

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
              variant={logoVariant}
              size={isSidebarCollapsed ? 32 : 36}
              showText={!isSidebarCollapsed}
              isDark={isDark}
              onClick={() => setIsLogoModalOpen(true)}
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
              const targetPath = location.search ? `${item.path}${location.search}` : item.path
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
                      <span>{t('nav.active_locations', { count: 52 })}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Compact HQ when collapsed */
              <div className="flex flex-col items-center gap-1">
                <div 
                  className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/30 cursor-pointer"
                  title={`${t('nav.hq')} · 52 active · Build ${BUILD_INFO.buildNumber}`}
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
        <header className={`h-16 shrink-0 px-4 md:px-6 flex items-center justify-between border-b z-20 transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>

          {/* Left: Sidebar Toggle Button */}
          <div className="flex items-center gap-2">
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
          </div>

          {/* Right: Controls & Header Title */}
          <div className="flex items-center gap-3">
            {/* Controls: Language Switcher & Theme Toggle right next to each other */}
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
            
            <div className="text-right">
              <div className={`text-sm font-bold leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('header.central_dispatch')}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {t('header.sync_status')}
              </div>
            </div>
          </div>
        </header>

        {/* OUTLET SCROLL AREA */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 w-full custom-scrollbar">
          <Outlet />
        </div>
      </main>

      {/* Modal alegere Logo Reprezentativ */}
      <LogoSelectorModal
        isOpen={isLogoModalOpen}
        onClose={() => setIsLogoModalOpen(false)}
        selectedLogo={logoVariant}
        onSelectLogo={handleSelectLogo}
        isDark={isDark}
      />

    </div>
  )
}
