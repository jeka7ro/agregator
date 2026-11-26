import React, { useState } from 'react'
import { PieChart, Activity, LayoutGrid } from 'lucide-react'
import { useLanguage } from '../../lib/LanguageContext'
import ZoomDrilldownPie from './ZoomDrilldownPie'
import ZoomTimeChart from './ZoomTimeChart'

export default function ZoomChartsSuite({ restaurants = [], checks = [], salesData = null, isDark = false, t }) {
  const { t: contextT } = useLanguage()
  const tr = t || contextT
  const [activeView, setActiveView] = useState('both') // 'both' | 'pie' | 'timeline'

  return (
    <div className="w-full h-full flex flex-col space-y-2">
      {/* Clean Executive Header ABOVE the cards — 1:1 height & rhythm with CumulativeHourlyChart (no duplicate fullscreen button) */}
      <div className="flex flex-wrap items-center justify-between gap-2 min-h-[30px] shrink-0">
        <h3 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
          <LayoutGrid size={15} className="text-[#047857] dark:text-[#10B981]" />
          <span>{tr('charts.suite_title', 'Analiză Operațională & Vizuală')}</span>
        </h3>

        {/* Apple Segmented Control View Switchers */}
        <div className="flex items-center gap-2 shrink-0">
          <div role="group" className="apple-segmented">
            <button
              type="button"
              onClick={() => setActiveView('both')}
              className={`apple-segment !h-[24px] !px-2.5 !text-[11px] ${activeView === 'both' ? 'apple-segment-active' : ''}`}
            >
              <LayoutGrid size={12} />
              <span>{tr('charts.view_both', 'Complet')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('pie')}
              className={`apple-segment !h-[24px] !px-2.5 !text-[11px] ${activeView === 'pie' ? 'apple-segment-active' : ''}`}
            >
              <PieChart size={12} />
              <span>{tr('charts.view_pie', 'Distribuție')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('timeline')}
              className={`apple-segment !h-[24px] !px-2.5 !text-[11px] ${activeView === 'timeline' ? 'apple-segment-active' : ''}`}
            >
              <Activity size={12} />
              <span>{tr('charts.view_timeline', 'Evoluție')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Charts — stretches 100% height to match CumulativeHourlyChart pixel-for-pixel */}
      <div className={`flex-1 grid gap-3 items-stretch transition-all duration-300 ${
        activeView === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
      }`}>
        {(activeView === 'both' || activeView === 'pie') && (
          <div className="w-full min-w-0 h-full flex flex-col">
            <ZoomDrilldownPie 
              restaurants={restaurants} 
              checks={checks} 
              salesData={salesData}
              isDark={isDark} 
              t={t} 
            />
          </div>
        )}

        {(activeView === 'both' || activeView === 'timeline') && (
          <div className="w-full min-w-0 h-full flex flex-col">
            <ZoomTimeChart 
              restaurants={restaurants}
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
