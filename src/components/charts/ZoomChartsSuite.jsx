import React, { useState } from 'react'
import { PieChart, Activity, Maximize2, Minimize2, LayoutGrid } from 'lucide-react'
import { useLanguage } from '../../lib/LanguageContext'
import ZoomDrilldownPie from './ZoomDrilldownPie'
import ZoomTimeChart from './ZoomTimeChart'

export default function ZoomChartsSuite({ restaurants = [], checks = [], isDark = false, t }) {
  const { t: contextT } = useLanguage()
  const tr = t || contextT
  const [activeView, setActiveView] = useState('both') // 'both' | 'pie' | 'timeline'
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="w-full space-y-4">
      {/* Clean Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <LayoutGrid size={16} className="text-emerald-500" />
            <span>{tr('charts.suite_title', 'Analiză Operațională & Vizuală')}</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {tr('charts.suite_subtitle', 'Distribuție multi-nivel a rețelei și evoluție temporală în timp real')}
          </p>
        </div>

        {/* View Switchers */}
        <div className="flex items-center gap-2 shrink-0">
          <div className={`p-1 rounded-xl border flex items-center gap-1 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}>
            <button
              onClick={() => setActiveView('both')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeView === 'both'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid size={13} />
              <span>{tr('charts.view_both', 'Complet')}</span>
            </button>
            <button
              onClick={() => setActiveView('pie')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeView === 'pie'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <PieChart size={13} />
              <span>{tr('charts.view_pie', 'Distribuție')}</span>
            </button>
            <button
              onClick={() => setActiveView('timeline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeView === 'timeline'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Activity size={13} />
              <span>{tr('charts.view_timeline', 'Evoluție')}</span>
            </button>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? tr('charts.minimize', 'Micșorează') : tr('charts.expand', 'Extinde')}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
              isDark 
                ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 shadow-xs'
            }`}
          >
            {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* Grid of Charts */}
      <div className={`grid gap-6 transition-all duration-300 ${
        activeView === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
      }`}>
        {(activeView === 'both' || activeView === 'pie') && (
          <div className="w-full">
            <ZoomDrilldownPie 
              restaurants={restaurants} 
              checks={checks} 
              isDark={isDark} 
              t={t} 
            />
          </div>
        )}

        {(activeView === 'both' || activeView === 'timeline') && (
          <div className="w-full">
            <ZoomTimeChart 
              checks={checks} 
              isDark={isDark} 
              t={t} 
            />
          </div>
        )}
      </div>
    </div>
  )
}
