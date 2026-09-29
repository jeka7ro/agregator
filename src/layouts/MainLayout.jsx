import React from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import LanguageToggle from '../components/LanguageToggle'
import { 
  LayoutDashboard, 
  Store, 
  BellRing, 
  Settings, 
  Moon, 
  Sun, 
  FileText
} from 'lucide-react'

export default function MainLayout() {
  const { isDark, toggleTheme } = useTheme()
  const { t } = useLanguage()

  const navItems = [
    { name: t('nav.dashboard'), path: '/dashboard', icon: LayoutDashboard },
    { name: t('nav.monitoring'), path: '/monitoring', icon: Store },
    { name: t('nav.alerts'), path: '/alerts', icon: BellRing },
    { name: t('nav.reports'), path: '/reports', icon: FileText },
    { name: t('nav.settings'), path: '/settings', icon: Settings },
  ]

  return (
    <div className={`min-h-screen flex transition-colors duration-200 ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* SIDEBAR */}
      <aside className="w-[260px] shrink-0 sticky top-0 h-screen flex flex-col z-30">
        <div className={`h-full flex flex-col border-r transition-colors duration-200 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          {/* Logo Section */}
          <div className={`h-16 shrink-0 px-6 flex items-center border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-sm tracking-wider shadow-sm shrink-0">
                M2
              </div>
              <div className="min-w-0">
                <h1 className={`text-sm font-bold tracking-tight leading-none uppercase truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  MONITORING <span className="text-emerald-600 dark:text-emerald-400">2.0</span>
                </h1>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1 truncate">
                  {t('nav.subtitle')}
                </div>
              </div>
            </div>
          </div>

          {/* Nav Menu */}
          <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto custom-scrollbar">
            <div className="px-3 pb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('nav.menu')}
            </div>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  `flex items-center gap-3 px-4 h-10 rounded-full transition-all duration-150 text-sm font-semibold ${
                    isActive 
                      ? 'bg-emerald-600 text-white shadow-sm font-bold'
                      : isDark
                        ? 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.name}</span>
                    {isActive && (
                      <div className="ml-auto w-2 h-2 rounded-full bg-white"></div>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Status Badge at bottom */}
          <div className={`p-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'} mt-auto`}>
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
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* TOP BAR */}
        <header className={`h-16 shrink-0 px-6 md:px-8 flex items-center justify-end border-b z-20 transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>

          <div className="flex items-center gap-3">
            {/* Controls: Language Switcher & Theme Toggle right next to each other */}
            <div className="flex items-center gap-2">
              <LanguageToggle />

              <button 
                onClick={toggleTheme}
                className={`w-8 h-8 rounded-full border transition-colors flex items-center justify-center shrink-0 ${
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

    </div>
  )
}
